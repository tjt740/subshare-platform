import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  ADMIN_PERMISSIONS,
  computeLevel,
  effectiveLevel,
  InventoryAccount,
  Order,
  OrderItem,
  Payment,
  Plan,
  PriceBook,
  Product,
  SiteSetting,
  Slot,
  Subscription,
  SupplierSubmission,
  Ticket,
  TicketMessage,
  toUsd,
  User,
  WalletTransaction,
} from '../entities';
import { FulfillmentService } from '../payments/fulfillment.service';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    @InjectRepository(PriceBook) private readonly prices: Repository<PriceBook>,
    @InjectRepository(InventoryAccount)
    private readonly accounts: Repository<InventoryAccount>,
    @InjectRepository(Slot) private readonly slots: Repository<Slot>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subs: Repository<Subscription>,
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly ticketMessages: Repository<TicketMessage>,
    @InjectRepository(SupplierSubmission)
    private readonly submissions: Repository<SupplierSubmission>,
    @InjectRepository(WalletTransaction)
    private readonly txns: Repository<WalletTransaction>,
    @InjectRepository(SiteSetting)
    private readonly settings: Repository<SiteSetting>,
    private readonly fulfillment: FulfillmentService,
    private readonly ordersService: OrdersService,
  ) {}

  // ---------- 看板 ----------
  async metrics() {
    const paidStatuses: Order['status'][] = ['paid', 'delivered'];
    const paidOrders = await this.orders.findBy({ status: In(paidStatuses) });
    const revenueByCurrency: Record<string, number> = {};
    let revenueUsd = 0;
    for (const o of paidOrders) {
      revenueByCurrency[o.currency] =
        Math.round(((revenueByCurrency[o.currency] || 0) + o.amount) * 100) /
        100;
      revenueUsd += toUsd(o.amount, o.currency);
    }
    const recent = await this.orders.find({ order: { id: 'DESC' }, take: 8 });
    return {
      users: await this.users.countBy({ role: 'user' }),
      suppliers: await this.users.countBy({ role: 'supplier' }),
      orders: await this.orders.count(),
      paidOrders: paidOrders.length,
      allocatingOrders: await this.orders.countBy({ status: 'allocating' }),
      activeSubscriptions: await this.subs.countBy({ status: 'active' }),
      openTickets: await this.tickets.countBy({ status: 'open' }),
      pendingSubmissions: await this.submissions.countBy({ status: 'pending' }),
      slots: {
        total: await this.slots.count(),
        free: await this.slots.countBy({ status: 'free' }),
        assigned: await this.slots.countBy({ status: 'assigned' }),
      },
      revenueByCurrency,
      revenueUsd: Math.round(revenueUsd * 100) / 100,
      recentOrders: await this.ordersService.decorate(recent),
    };
  }

  // ---------- 商品 ----------
  listProducts() {
    return this.products.find({ order: { sort: 'ASC', id: 'ASC' } });
  }

  async createProduct(data: Partial<Product>) {
    if (!data.slug || !data.title) {
      throw new BadRequestException('slug 与 title 必填');
    }
    const exists = await this.products.findOneBy({ slug: data.slug });
    if (exists) throw new BadRequestException('slug 已存在');
    return this.products.save(this.products.create(data));
  }

  /** 删除商品：级联清理套餐/价格/库存坑位；有订单引用则拒绝（建议下架） */
  async deleteProduct(id: number) {
    const product = await this.products.findOneBy({ id });
    if (!product) throw new NotFoundException('商品不存在');
    const plans = await this.plans.findBy({ productId: id });
    for (const plan of plans) await this.assertPlanDeletable(plan.id);
    for (const plan of plans) await this.removePlanCascade(plan.id);
    await this.products.delete({ id });
    return { ok: true };
  }

  /** 删除套餐(SKU)：有订单引用则拒绝 */
  async deletePlan(id: number) {
    const plan = await this.plans.findOneBy({ id });
    if (!plan) throw new NotFoundException('套餐不存在');
    await this.assertPlanDeletable(id);
    await this.removePlanCascade(id);
    return { ok: true };
  }

  private async assertPlanDeletable(planId: number) {
    const refs = await this.orderItems.countBy({ planId });
    if (refs > 0) {
      throw new BadRequestException(
        '该套餐已有订单引用，不能删除；如需停售请下架（保留历史数据）',
      );
    }
  }

  private async removePlanCascade(planId: number) {
    const accounts = await this.accounts.findBy({ planId });
    for (const account of accounts) {
      await this.slots.delete({ accountId: account.id });
    }
    await this.accounts.delete({ planId });
    await this.prices.delete({ planId });
    await this.plans.delete({ id: planId });
  }

  async updateProduct(id: number, data: Partial<Product>) {
    const product = await this.products.findOneBy({ id });
    if (!product) throw new NotFoundException('商品不存在');
    delete (data as any).id;
    Object.assign(product, data);
    return this.products.save(product);
  }

  // ---------- 套餐 ----------
  async listPlans(productId?: number) {
    const where = productId ? { productId } : {};
    const plans = await this.plans.find({ where, order: { id: 'ASC' } });
    const products = await this.products.find();
    const productMap = new Map(products.map((p) => [p.id, p.title]));
    const result = [];
    for (const p of plans) {
      const priceRows = await this.prices.findBy({ planId: p.id });
      const okAccounts = await this.accounts.findBy({
        planId: p.id,
        health: 'ok',
      });
      const stock =
        okAccounts.length === 0
          ? 0
          : await this.slots.countBy({
              accountId: In(okAccounts.map((a) => a.id)),
              status: 'free',
            });
      result.push({
        ...p,
        productTitle: productMap.get(p.productId) ?? '-',
        prices: priceRows,
        stock,
      });
    }
    return result;
  }

  async createPlan(data: Partial<Plan>) {
    if (!data.productId || !data.name) {
      throw new BadRequestException('productId 与 name 必填');
    }
    const product = await this.products.findOneBy({ id: data.productId });
    if (!product) throw new BadRequestException('商品不存在');
    return this.plans.save(this.plans.create(data));
  }

  async updatePlan(id: number, data: Partial<Plan>) {
    const plan = await this.plans.findOneBy({ id });
    if (!plan) throw new NotFoundException('套餐不存在');
    delete (data as any).id;
    Object.assign(plan, data);
    return this.plans.save(plan);
  }

  // ---------- 定价 ----------
  getPrices(planId: number) {
    return this.prices.findBy({ planId });
  }

  async setPrices(
    planId: number,
    items: { region: string; currency: string; price: number }[],
  ) {
    const plan = await this.plans.findOneBy({ id: planId });
    if (!plan) throw new NotFoundException('套餐不存在');
    await this.prices.delete({ planId });
    for (const item of items) {
      if (item.price == null || item.price < 0) continue;
      await this.prices.save(
        this.prices.create({
          planId,
          region: item.region,
          currency: item.currency,
          price: item.price,
        }),
      );
    }
    return this.getPrices(planId);
  }

  // ---------- 库存 ----------
  async listInventory(planId?: number) {
    const where = planId ? { planId } : {};
    const accounts = await this.accounts.find({ where, order: { id: 'DESC' } });
    const suppliers = await this.users.findBy({ role: 'supplier' });
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.email]));
    const result = [];
    for (const a of accounts) {
      result.push({
        ...a,
        supplierEmail: a.supplierId ? supplierMap.get(a.supplierId) ?? '-' : null,
        usedSlots: await this.slots.countBy({
          accountId: a.id,
          status: 'assigned',
        }),
        freeSlots: await this.slots.countBy({
          accountId: a.id,
          status: 'free',
        }),
      });
    }
    return result;
  }

  async createInventory(data: {
    planId: number;
    credentials: string;
    maxSlots: number;
    supplierId?: number | null;
  }) {
    const plan = await this.plans.findOneBy({ id: data.planId });
    if (!plan) throw new BadRequestException('套餐不存在');
    const maxSlots = Math.max(1, Math.min(50, data.maxSlots || 5));
    const account = await this.accounts.save(
      this.accounts.create({
        planId: data.planId,
        credentials: data.credentials,
        maxSlots,
        supplierId: data.supplierId ?? null,
      }),
    );
    for (let i = 0; i < maxSlots; i++) {
      await this.slots.save(
        this.slots.create({ accountId: account.id, status: 'free' }),
      );
    }
    const queued = await this.orders.findBy({
      planId: data.planId,
      status: 'allocating',
    });
    for (const order of queued) {
      await this.fulfillment.fulfill(order);
    }
    return account;
  }

  async setInventoryHealth(id: number, health: 'ok' | 'banned') {
    const account = await this.accounts.findOneBy({ id });
    if (!account) throw new NotFoundException('账号不存在');
    account.health = health;
    return this.accounts.save(account);
  }

  // ---------- 订单 ----------
  async listOrders(status?: string) {
    const where = status ? { status: status as Order['status'] } : {};
    const orders = await this.orders.find({
      where,
      order: { id: 'DESC' },
      take: 200,
    });
    const decorated = await this.ordersService.decorate(orders);
    const users = await this.users.findBy({
      id: In(orders.map((o) => o.userId)),
    });
    const userMap = new Map(users.map((u) => [u.id, u.email]));
    return decorated.map((o) => ({
      ...o,
      userEmail: userMap.get(o.userId) ?? '-',
    }));
  }

  /** 退款：回收坑位 + 吊销订阅 + 退款金额按汇率折 USD 入用户钱包 */
  async refundOrder(id: number) {
    const order = await this.orders.findOneBy({ id });
    if (!order) throw new NotFoundException('订单不存在');
    if (!['paid', 'delivered', 'allocating'].includes(order.status)) {
      throw new BadRequestException('该订单状态不可退款');
    }
    await this.fulfillment.revoke(order);
    order.status = 'refunded';
    await this.orders.save(order);

    const usd = toUsd(order.amount, order.currency);
    const user = await this.users.findOneBy({ id: order.userId });
    if (user) {
      user.balance = Math.round((user.balance + usd) * 100) / 100;
      await this.users.save(user);
      await this.txns.save(
        this.txns.create({
          userId: user.id,
          type: 'refund',
          amountUsd: usd,
          note: `订单 ${order.orderNo} 退款入钱包`,
        }),
      );
    }
    return order;
  }

  async fulfillOrder(id: number) {
    const order = await this.orders.findOneBy({ id });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'allocating') {
      throw new BadRequestException('仅排队中的订单可手动补发');
    }
    const ok = await this.fulfillment.fulfill(order);
    if (!ok) throw new BadRequestException('库存仍不足，请先补充账号');
    return this.orders.findOneBy({ id });
  }

  // ---------- 用户 ----------
  async listUsers() {
    const users = await this.users.find({
      where: { role: In(['user', 'supplier']) },
      order: { id: 'DESC' },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      nickname: u.nickname || '',
      avatar: u.avatar || '😀',
      role: u.role,
      status: u.status,
      balance: u.balance,
      growthUsd: Math.round((u.growthUsd ?? 0) * 100) / 100,
      level: effectiveLevel(u),
      autoLevel: computeLevel(u.growthUsd ?? 0),
      levelOverride: u.levelOverride ?? null,
      createdAt: u.createdAt,
    }));
  }

  /** 后台改等级：1-5 人工覆盖；null 恢复按成长值自动 */
  async setUserLevel(id: number, level: number | null) {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('用户不存在');
    if (level !== null && (level < 1 || level > 5)) {
      throw new BadRequestException('等级需在 1-5 之间');
    }
    user.levelOverride = level;
    await this.users.save(user);
    return {
      id: user.id,
      level: effectiveLevel(user),
      levelOverride: user.levelOverride,
    };
  }

  async setUserStatus(id: number, status: 'active' | 'banned') {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('用户不存在');
    if (user.role === 'admin' || user.role === 'super') {
      throw new BadRequestException('不能封禁管理员');
    }
    user.status = status;
    await this.users.save(user);
    return { id: user.id, status: user.status };
  }

  // ---------- 站点配置 ----------
  async getSiteConfig() {
    const row = await this.settings.findOneBy({ key: 'site' });
    try {
      return row ? JSON.parse(row.value) : {};
    } catch {
      return {};
    }
  }

  async setSiteConfig(config: Record<string, unknown>) {
    let row = await this.settings.findOneBy({ key: 'site' });
    if (!row) row = this.settings.create({ key: 'site' });
    row.value = JSON.stringify(config ?? {});
    await this.settings.save(row);
    return this.getSiteConfig();
  }

  /** 库存下钻：单账号全部坑位 + 占用订单/用户 */
  async accountSlots(accountId: number) {
    const account = await this.accounts.findOneBy({ id: accountId });
    if (!account) throw new NotFoundException('账号不存在');
    const slots = await this.slots.find({
      where: { accountId },
      order: { id: 'ASC' },
    });
    const orderIds = [...new Set(slots.map((x) => x.orderId).filter(Boolean))] as number[];
    const orders = orderIds.length ? await this.orders.findBy({ id: In(orderIds) }) : [];
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    const userIds = [...new Set(orders.map((o) => o.userId))];
    const users = userIds.length ? await this.users.findBy({ id: In(userIds) }) : [];
    const userMap = new Map(users.map((u) => [u.id, u.email]));
    return slots.map((slot) => {
      const order = slot.orderId ? orderMap.get(slot.orderId) : undefined;
      return {
        id: slot.id,
        status: slot.status,
        orderId: slot.orderId,
        orderNo: order?.orderNo ?? null,
        userEmail: order ? (userMap.get(order.userId) ?? '-') : null,
      };
    });
  }

  // ---------- 客服工单 ----------
  async listTickets(status?: string) {
    const where = status ? { status: status as Ticket['status'] } : {};
    const rows = await this.tickets.find({
      where,
      order: { updatedAt: 'DESC' },
      take: 200,
    });
    const users = await this.users.findBy({
      id: In(rows.map((t) => t.userId)),
    });
    const userMap = new Map(users.map((u) => [u.id, u.email]));
    return rows.map((t) => ({ ...t, userEmail: userMap.get(t.userId) ?? '-' }));
  }

  async getTicket(id: number) {
    const ticket = await this.tickets.findOneBy({ id });
    if (!ticket) throw new NotFoundException('工单不存在');
    const user = await this.users.findOneBy({ id: ticket.userId });
    let orderNo: string | null = null;
    if (ticket.orderId) {
      orderNo = (await this.orders.findOneBy({ id: ticket.orderId }))?.orderNo ?? null;
    }
    const messages = await this.ticketMessages.find({
      where: { ticketId: id },
      order: { id: 'ASC' },
    });
    return { ...ticket, userEmail: user?.email ?? '-', orderNo, messages };
  }

  async replyTicket(id: number, content: string) {
    const ticket = await this.tickets.findOneBy({ id });
    if (!ticket) throw new NotFoundException('工单不存在');
    await this.ticketMessages.save(
      this.ticketMessages.create({ ticketId: id, senderRole: 'admin', content }),
    );
    ticket.status = 'answered';
    await this.tickets.save(ticket);
    return this.getTicket(id);
  }

  async closeTicket(id: number) {
    const ticket = await this.tickets.findOneBy({ id });
    if (!ticket) throw new NotFoundException('工单不存在');
    ticket.status = 'closed';
    await this.tickets.save(ticket);
    return ticket;
  }

  /**
   * 工单一键售后动作（后台连贯性核心）：
   * - reissue：调交付引擎补发新坑位并自动回复
   * - refund：调订单退款（退回钱包）并自动回复
   */
  async ticketAction(id: number, action: 'reissue' | 'refund') {
    const ticket = await this.tickets.findOneBy({ id });
    if (!ticket) throw new NotFoundException('工单不存在');

    if (action === 'reissue') {
      let subId = ticket.subscriptionId;
      if (!subId && ticket.orderId) {
        const sub = await this.subs.findOneBy({
          orderId: ticket.orderId,
          status: 'active',
        });
        subId = sub?.id ?? null;
      }
      if (!subId) {
        throw new BadRequestException('该工单未关联生效订阅，无法一键补发');
      }
      await this.fulfillment.reissue(subId);
      await this.ticketMessages.save(
        this.ticketMessages.create({
          ticketId: id,
          senderRole: 'admin',
          content:
            '✅ 已为您补发新凭据（旧账号已作废）。请前往「我的订阅」查看最新账号密码；如仍有异常请直接回复本工单。',
        }),
      );
    } else if (action === 'refund') {
      if (!ticket.orderId) {
        throw new BadRequestException('该工单未关联订单，无法一键退款');
      }
      await this.refundOrder(ticket.orderId);
      await this.ticketMessages.save(
        this.ticketMessages.create({
          ticketId: id,
          senderRole: 'admin',
          content:
            '✅ 订单已退款：金额已按汇率折算退回您的钱包余额，可在「钱包」页查看流水。感谢理解与支持！',
        }),
      );
    } else {
      throw new BadRequestException('不支持的动作');
    }

    ticket.status = 'answered';
    await this.tickets.save(ticket);
    return this.getTicket(id);
  }

  // ---------- 供应商审核 ----------
  async listSubmissions(status?: string) {
    const where = status
      ? { status: status as SupplierSubmission['status'] }
      : {};
    const rows = await this.submissions.find({ where, order: { id: 'DESC' } });
    const suppliers = await this.users.findBy({
      id: In(rows.map((r) => r.supplierId)),
    });
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.email]));
    const plans = await this.plans.find();
    const products = await this.products.find();
    const productMap = new Map(products.map((p) => [p.id, p.title]));
    const planMap = new Map(
      plans.map((p) => [p.id, `${productMap.get(p.productId) ?? ''} / ${p.name}`]),
    );
    return rows.map((r) => ({
      ...r,
      supplierEmail: supplierMap.get(r.supplierId) ?? '-',
      planLabel: r.planId ? planMap.get(r.planId) ?? '-' : null,
    }));
  }

  /** 审核：账号提交通过 -> 自动入库生成坑位并补发排队订单；产品提议通过 -> 创建下架状态草稿商品 */
  async reviewSubmission(id: number, approve: boolean, reviewNote: string) {
    const sub = await this.submissions.findOneBy({ id });
    if (!sub) throw new NotFoundException('提交记录不存在');
    if (sub.status !== 'pending') {
      throw new BadRequestException('该记录已审核过');
    }
    if (approve) {
      if (sub.type === 'account') {
        await this.createInventory({
          planId: sub.planId!,
          credentials: JSON.stringify({
            username: sub.username,
            password: sub.password,
            note: sub.note || '供应商供货',
          }),
          maxSlots: sub.maxSlots,
          supplierId: sub.supplierId,
        });
      } else {
        const slug = `supplier-${sub.id}-${Date.now().toString(36)}`;
        await this.products.save(
          this.products.create({
            slug,
            title: sub.proposedTitle,
            description: sub.proposedDesc,
            category: '待分类',
            status: 'off', // 草稿：管理员完善套餐与定价后再上架
            sort: 99,
          }),
        );
      }
    }
    sub.status = approve ? 'approved' : 'rejected';
    sub.reviewNote = reviewNote || '';
    sub.reviewedAt = new Date();
    await this.submissions.save(sub);
    return sub;
  }

  // ---------- 管理员管理（仅 super） ----------
  async listAdmins() {
    const rows = await this.users.find({
      where: { role: In(['admin', 'super']) },
      order: { id: 'ASC' },
    });
    return rows.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      permissions: JSON.parse(u.permissions || '[]'),
      createdAt: u.createdAt,
    }));
  }

  async createAdmin(email: string, password: string, permissions: string[]) {
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized || !password || password.length < 6) {
      throw new BadRequestException('邮箱与密码（≥6位）必填');
    }
    if (await this.users.findOneBy({ email: normalized })) {
      throw new BadRequestException('该邮箱已注册');
    }
    const valid = permissions.filter((p) =>
      (ADMIN_PERMISSIONS as readonly string[]).includes(p),
    );
    const user = await this.users.save(
      this.users.create({
        email: normalized,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'admin',
        permissions: JSON.stringify(valid),
      }),
    );
    return { id: user.id, email: user.email, permissions: valid };
  }

  async updateAdmin(
    id: number,
    data: { permissions?: string[]; status?: 'active' | 'banned' },
  ) {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('管理员不存在');
    if (user.role === 'super') {
      throw new BadRequestException('不能修改超级管理员');
    }
    if (user.role !== 'admin') {
      throw new BadRequestException('该账号不是子管理员');
    }
    if (data.permissions) {
      const valid = data.permissions.filter((p) =>
        (ADMIN_PERMISSIONS as readonly string[]).includes(p),
      );
      user.permissions = JSON.stringify(valid);
    }
    if (data.status) user.status = data.status;
    await this.users.save(user);
    return {
      id: user.id,
      permissions: JSON.parse(user.permissions),
      status: user.status,
    };
  }
}
