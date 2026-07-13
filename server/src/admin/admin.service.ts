import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Like, MoreThanOrEqual, LessThanOrEqual, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  ADMIN_PERMISSIONS,
  AccountCostEntry,
  computeLevel,
  effectiveLevel,
  InventoryAccount,
  InventoryAuditLog,
  Order,
  OrderItem,
  Payment,
  Plan,
  PriceBook,
  Product,
  SiteSetting,
  SiteConfigRevision,
  Slot,
  SlotAssignment,
  Subscription,
  SupplierSubmission,
  Ticket,
  TicketMessage,
  TicketTransfer,
  toUsd,
  User,
  WalletTransaction,
} from '../entities';
import { FulfillmentService } from '../payments/fulfillment.service';
import { OrdersService } from '../orders/orders.service';

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const DAY_MS = 86_400_000;
const supportName = (user?: User | null) =>
  user?.nickname?.trim() || user?.email?.split('@')[0] || '客服';
const canHandleTickets = (user: User) => {
  if (user.role === 'super') return true;
  if (user.role !== 'admin') return false;
  try {
    return (JSON.parse(user.permissions || '[]') as string[]).includes('tickets');
  } catch {
    return false;
  }
};
const ratioAt = (start: Date | null, end: Date | null, asOf: Date) => {
  if (!start || !end) return 1;
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (to <= from) return 1;
  return Math.max(0, Math.min(1, (asOf.getTime() - from) / (to - from)));
};

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    @InjectRepository(PriceBook) private readonly prices: Repository<PriceBook>,
    @InjectRepository(InventoryAccount)
    private readonly accounts: Repository<InventoryAccount>,
    @InjectRepository(AccountCostEntry)
    private readonly accountCosts: Repository<AccountCostEntry>,
    @InjectRepository(InventoryAuditLog)
    private readonly inventoryAudits: Repository<InventoryAuditLog>,
    @InjectRepository(Slot) private readonly slots: Repository<Slot>,
    @InjectRepository(SlotAssignment)
    private readonly assignments: Repository<SlotAssignment>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subs: Repository<Subscription>,
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly ticketMessages: Repository<TicketMessage>,
    @InjectRepository(TicketTransfer)
    private readonly ticketTransfers: Repository<TicketTransfer>,
    @InjectRepository(SupplierSubmission)
    private readonly submissions: Repository<SupplierSubmission>,
    @InjectRepository(WalletTransaction)
    private readonly txns: Repository<WalletTransaction>,
    @InjectRepository(SiteSetting)
    private readonly settings: Repository<SiteSetting>,
    @InjectRepository(SiteConfigRevision)
    private readonly siteRevisions: Repository<SiteConfigRevision>,
    private readonly fulfillment: FulfillmentService,
    private readonly ordersService: OrdersService,
  ) {}

  // ---------- 看板 ----------
  async metrics() {
    // paymentStatus 是新账务口径；兼容升级前仅有 status 的历史订单。
    const paidOrders = await this.orders.find({
      where: [
        { paymentStatus: 'paid' },
        { status: In(['paid', 'delivered', 'allocating']) },
      ],
    });
    const revenueByCurrency: Record<string, number> = {};
    let revenueUsd = 0;
    for (const o of paidOrders) {
      revenueByCurrency[o.currency] =
        Math.round(((revenueByCurrency[o.currency] || 0) + o.amount) * 100) /
        100;
      revenueUsd += toUsd(o.amount, o.currency);
    }
    const now = new Date();
    const assignments = await this.assignments.find();
    const accounts = await this.accounts.find();
    const costs = await this.accountCosts.find();
    const totalCostUsd = money(
      costs.length
        ? costs.reduce((sum, x) => sum + x.amountUsd, 0)
        : accounts.reduce((sum, x) => sum + (x.costUsd || 0), 0),
    );
    const cashRevenueUsd = money(
      assignments.reduce((sum, x) => sum + x.saleUsd - x.refundUsd, 0),
    );
    const recognizedRevenueUsd = money(
      assignments.reduce(
        (sum, x) =>
          sum +
          Math.max(0, x.saleUsd - x.refundUsd) *
            ratioAt(x.startsAt, x.endsAt, now),
        0,
      ),
    );
    const recognizedCostUsd = money(
      costs.length
        ? costs.reduce(
            (sum, x) =>
              sum + x.amountUsd * ratioAt(x.effectiveFrom, x.effectiveTo, now),
            0,
          )
        : accounts.reduce(
            (sum, x) =>
              sum + x.costUsd * ratioAt(x.serviceStartedAt, x.expiresAt, now),
            0,
          ),
    );
    const paymentFeesUsd = money(
      assignments.reduce((sum, x) => sum + x.paymentFeeUsd, 0),
    );
    const grossProfitUsd = money(
      recognizedRevenueUsd - recognizedCostUsd - paymentFeesUsd,
    );

    const trend = Array.from({ length: 30 }, (_, index) => {
      const asOf = new Date(now);
      asOf.setHours(23, 59, 59, 999);
      asOf.setDate(asOf.getDate() - (29 - index));
      const recognizedRevenue = assignments.reduce(
        (sum, x) =>
          sum +
          Math.max(0, x.saleUsd - x.refundUsd) *
            ratioAt(x.startsAt, x.endsAt, asOf),
        0,
      );
      const recognizedCost = costs.length
        ? costs.reduce(
            (sum, x) =>
              sum + x.amountUsd * ratioAt(x.effectiveFrom, x.effectiveTo, asOf),
            0,
          )
        : accounts.reduce(
            (sum, x) =>
              sum + x.costUsd * ratioAt(x.serviceStartedAt, x.expiresAt, asOf),
            0,
          );
      return {
        date: asOf.toISOString().slice(0, 10),
        revenue: money(recognizedRevenue),
        cost: money(recognizedCost),
        profit: money(recognizedRevenue - recognizedCost),
      };
    });
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
      finance: {
        cashRevenueUsd,
        recognizedRevenueUsd,
        deferredRevenueUsd: money(cashRevenueUsd - recognizedRevenueUsd),
        totalCostUsd,
        recognizedCostUsd,
        paymentFeesUsd,
        grossProfitUsd,
        grossMargin:
          recognizedRevenueUsd > 0
            ? money((grossProfitUsd / recognizedRevenueUsd) * 100)
            : 0,
      },
      trend,
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
    items: {
      region: string;
      currency: string;
      price: number;
      costAmount?: number;
      paymentFeeAmount?: number;
      aftersalesReserveAmount?: number;
      operationCostAmount?: number;
      targetProfitAmount?: number;
    }[],
  ) {
    const plan = await this.plans.findOneBy({ id: planId });
    if (!plan) throw new NotFoundException('套餐不存在');
    await this.prices.delete({ planId });
    for (const item of items) {
      const breakdown = {
        costAmount: money(item.costAmount ?? 0),
        paymentFeeAmount: money(item.paymentFeeAmount ?? 0),
        aftersalesReserveAmount: money(item.aftersalesReserveAmount ?? 0),
        operationCostAmount: money(item.operationCostAmount ?? 0),
        targetProfitAmount: money(item.targetProfitAmount ?? 0),
      };
      const calculatedPrice = money(Object.values(breakdown).reduce((a, b) => a + b, 0));
      const price = calculatedPrice > 0 ? calculatedPrice : money(item.price);
      if (price <= 0) continue; // 拦截 0 元/负价，避免 0 元下单
      await this.prices.save(
        this.prices.create({
          planId,
          region: item.region,
          currency: item.currency,
          price,
          ...breakdown,
        }),
      );
    }
    return this.getPrices(planId);
  }

  // ---------- 库存 ----------
  private accountFinance(
    account: InventoryAccount,
    entries: AccountCostEntry[],
    assignments: SlotAssignment[],
    asOf = new Date(),
  ) {
    const totalCostUsd = money(
      entries.length
        ? entries.reduce((sum, x) => sum + x.amountUsd, 0)
        : account.costUsd || 0,
    );
    const recognizedCostUsd = money(
      entries.length
        ? entries.reduce(
            (sum, x) =>
              sum + x.amountUsd * ratioAt(x.effectiveFrom, x.effectiveTo, asOf),
            0,
          )
        : (account.costUsd || 0) *
            ratioAt(account.serviceStartedAt, account.expiresAt, asOf),
    );
    const cashRevenueUsd = money(
      assignments.reduce((sum, x) => sum + x.saleUsd - x.refundUsd, 0),
    );
    const recognizedRevenueUsd = money(
      assignments.reduce(
        (sum, x) =>
          sum +
          Math.max(0, x.saleUsd - x.refundUsd) *
            ratioAt(x.startsAt, x.endsAt, asOf),
        0,
      ),
    );
    const paymentFeesUsd = money(
      assignments.reduce((sum, x) => sum + x.paymentFeeUsd, 0),
    );
    const grossProfitUsd = money(
      recognizedRevenueUsd - recognizedCostUsd - paymentFeesUsd,
    );
    const remainingDays = account.expiresAt
      ? Math.ceil((new Date(account.expiresAt).getTime() - asOf.getTime()) / DAY_MS)
      : null;
    return {
      totalCostUsd,
      cashRevenueUsd,
      recognizedRevenueUsd,
      deferredRevenueUsd: money(cashRevenueUsd - recognizedRevenueUsd),
      recognizedCostUsd,
      paymentFeesUsd,
      grossProfitUsd,
      projectedProfitUsd: money(cashRevenueUsd - totalCostUsd - paymentFeesUsd),
      grossMargin:
        recognizedRevenueUsd > 0
          ? money((grossProfitUsd / recognizedRevenueUsd) * 100)
          : 0,
      remainingDays,
    };
  }

  async listInventory(planId?: number) {
    const where = planId ? { planId } : {};
    const accounts = await this.accounts.find({ where, order: { id: 'DESC' } });
    if (!accounts.length) return [];
    const accountIds = accounts.map((x) => x.id);
    const [operators, slotRows, costs, assignments] = await Promise.all([
      this.users.find(),
      this.slots.findBy({ accountId: In(accountIds) }),
      this.accountCosts.findBy({ accountId: In(accountIds) }),
      this.assignments.findBy({ accountId: In(accountIds) }),
    ]);
    const userMap = new Map(operators.map((s) => [s.id, s.email]));
    return accounts.map((a) => {
      const mineSlots = slotRows.filter((x) => x.accountId === a.id);
      const mineCosts = costs.filter((x) => x.accountId === a.id);
      const mineAssignments = assignments.filter((x) => x.accountId === a.id);
      const finance = this.accountFinance(a, mineCosts, mineAssignments);
      const series = Array.from({ length: 14 }, (_, index) => {
        const asOf = new Date();
        asOf.setHours(23, 59, 59, 999);
        asOf.setDate(asOf.getDate() - (13 - index));
        const point = this.accountFinance(a, mineCosts, mineAssignments, asOf);
        return {
          date: asOf.toISOString().slice(0, 10),
          revenue: point.recognizedRevenueUsd,
          cost: point.recognizedCostUsd,
          profit: point.grossProfitUsd,
        };
      });
      return {
        ...a,
        supplierEmail: a.supplierId ? userMap.get(a.supplierId) ?? '-' : null,
        createdByEmail: a.createdBy ? userMap.get(a.createdBy) ?? '-' : '-',
        updatedByEmail: a.updatedBy ? userMap.get(a.updatedBy) ?? '-' : '-',
        usedSlots: mineSlots.filter((x) => x.status === 'assigned').length,
        freeSlots: mineSlots.filter((x) => x.status === 'free').length,
        costEntries: mineCosts,
        finance,
        financeSeries: series,
      };
    });
  }

  async createInventory(data: {
    planId: number;
    credentials: string;
    maxSlots: number;
    supplierId?: number | null;
    accountCode?: string;
    purchasedAt?: string;
    serviceStartedAt?: string;
    lastRechargedAt?: string;
    nextRechargeAt?: string;
    expiresAt?: string;
    costAmount?: number;
    costCurrency?: string;
    purchaseOrderNo?: string;
    invoiceNo?: string;
    autoRenew?: boolean;
    notes?: string;
  }, operatorId: number) {
    const plan = await this.plans.findOneBy({ id: data.planId });
    if (!plan) throw new BadRequestException('套餐不存在');
    const maxSlots = Math.max(1, Math.min(50, data.maxSlots || 5));
    const costAmount = money(data.costAmount ?? 0);
    const costCurrency = data.costCurrency || 'USD';
    const costUsd = toUsd(costAmount, costCurrency);
    const serviceStartedAt = data.serviceStartedAt
      ? new Date(data.serviceStartedAt)
      : data.purchasedAt
        ? new Date(data.purchasedAt)
        : new Date();
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    const account = await this.accounts.save(
      this.accounts.create({
        planId: data.planId,
        credentials: data.credentials,
        maxSlots,
        supplierId: data.supplierId ?? null,
        accountCode:
          data.accountCode ||
          `ACC-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
        lifecycleStatus: 'active',
        purchasedAt: data.purchasedAt ? new Date(data.purchasedAt) : new Date(),
        serviceStartedAt,
        lastRechargedAt: data.lastRechargedAt ? new Date(data.lastRechargedAt) : null,
        nextRechargeAt: data.nextRechargeAt ? new Date(data.nextRechargeAt) : null,
        expiresAt,
        serviceDays: expiresAt
          ? Math.max(1, Math.ceil((expiresAt.getTime() - serviceStartedAt.getTime()) / DAY_MS))
          : 0,
        costAmount,
        costCurrency,
        costUsd,
        purchaseOrderNo: data.purchaseOrderNo || '',
        invoiceNo: data.invoiceNo || '',
        createdBy: operatorId,
        updatedBy: operatorId,
        autoRenew: !!data.autoRenew,
        notes: data.notes || '',
      }),
    );
    if (costAmount > 0) {
      await this.accountCosts.save(
        this.accountCosts.create({
          accountId: account.id,
          type: 'purchase',
          amount: costAmount,
          currency: costCurrency,
          amountUsd: costUsd,
          effectiveFrom: serviceStartedAt,
          effectiveTo: expiresAt,
          operatorId,
          note: '账号首次采购成本',
        }),
      );
    }
    await this.inventoryAudits.save(
      this.inventoryAudits.create({
        accountId: account.id,
        operatorId,
        action: 'create',
        changes: JSON.stringify({ fields: Object.keys(data) }),
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

  async updateInventory(id: number, data: Partial<InventoryAccount>, operatorId: number) {
    const account = await this.accounts.findOneBy({ id });
    if (!account) throw new NotFoundException('账号不存在');
    const allowed = [
      'planId', 'credentials', 'supplierId', 'accountCode', 'lifecycleStatus',
      'purchasedAt', 'serviceStartedAt', 'lastRechargedAt', 'nextRechargeAt',
      'expiresAt', 'purchaseOrderNo', 'invoiceNo', 'autoRenew', 'notes',
      'lastCheckedAt',
    ];
    const changes: Record<string, unknown> = {};
    for (const key of allowed) {
      if ((data as any)[key] === undefined) continue;
      const oldValue = (account as any)[key];
      let value = (data as any)[key];
      if (key.endsWith('At') && value) value = new Date(value);
      (account as any)[key] = value;
      changes[key] = { from: oldValue, to: value };
    }
    account.updatedBy = operatorId;
    if (account.serviceStartedAt && account.expiresAt) {
      account.serviceDays = Math.max(
        1,
        Math.ceil(
          (new Date(account.expiresAt).getTime() -
            new Date(account.serviceStartedAt).getTime()) /
            DAY_MS,
        ),
      );
    }
    await this.accounts.save(account);
    await this.inventoryAudits.save(
      this.inventoryAudits.create({
        accountId: id,
        operatorId,
        action: 'update',
        changes: JSON.stringify(changes),
      }),
    );
    return account;
  }

  async addAccountCost(
    id: number,
    data: {
      type?: AccountCostEntry['type'];
      amount: number;
      currency: string;
      effectiveFrom?: string;
      effectiveTo?: string;
      note?: string;
    },
    operatorId: number,
  ) {
    const account = await this.accounts.findOneBy({ id });
    if (!account) throw new NotFoundException('账号不存在');
    const amount = money(data.amount);
    if (!amount) throw new BadRequestException('成本金额不能为 0');
    const currency = data.currency || 'USD';
    const entry = await this.accountCosts.save(
      this.accountCosts.create({
        accountId: id,
        type: data.type || 'recharge',
        amount,
        currency,
        amountUsd: toUsd(amount, currency),
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : account.expiresAt,
        operatorId,
        note: data.note || '',
      }),
    );
    const newCostUsd = money(account.costUsd + entry.amountUsd);
    if (account.costCurrency === currency) {
      account.costAmount = money(account.costAmount + amount);
    } else {
      // 多币种成本统一切换为 USD 汇总，避免直接把人民币和美元相加。
      account.costAmount = newCostUsd;
      account.costCurrency = 'USD';
    }
    account.costUsd = newCostUsd;
    account.lastRechargedAt = new Date();
    if (data.effectiveTo) account.expiresAt = new Date(data.effectiveTo);
    account.updatedBy = operatorId;
    await this.accounts.save(account);
    await this.inventoryAudits.save(
      this.inventoryAudits.create({
        accountId: id,
        operatorId,
        action: 'add_cost',
        changes: JSON.stringify({ costEntryId: entry.id, amount, currency }),
      }),
    );
    return entry;
  }

  async setInventoryHealth(id: number, health: 'ok' | 'banned', operatorId?: number) {
    const account = await this.accounts.findOneBy({ id });
    if (!account) throw new NotFoundException('账号不存在');
    account.health = health;
    account.updatedBy = operatorId ?? account.updatedBy;
    await this.accounts.save(account);
    await this.inventoryAudits.save(
      this.inventoryAudits.create({
        accountId: id,
        operatorId: operatorId ?? null,
        action: 'health',
        changes: JSON.stringify({ health }),
      }),
    );
    return account;
  }

  // ---------- 订单 ----------
  async listOrders(filters: {
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.max(10, Math.min(100, Number(filters.pageSize) || 20));
    const base: any = {};
    if (filters.status) base.status = filters.status as Order['status'];
    if (filters.dateFrom && filters.dateTo) {
      base.createdAt = Between(
        new Date(`${filters.dateFrom}T00:00:00`),
        new Date(`${filters.dateTo}T23:59:59.999`),
      );
    } else if (filters.dateFrom) {
      base.createdAt = MoreThanOrEqual(new Date(`${filters.dateFrom}T00:00:00`));
    } else if (filters.dateTo) {
      base.createdAt = LessThanOrEqual(new Date(`${filters.dateTo}T23:59:59.999`));
    }
    let where: any = base;
    if (filters.search?.trim()) {
      const keyword = filters.search.trim();
      const matchedUsers = await this.users.find({
        where: { email: Like(`%${keyword}%`) },
        take: 200,
      });
      const variants: any[] = [
        { ...base, orderNo: Like(`%${keyword}%`) },
      ];
      if (matchedUsers.length) {
        variants.push({ ...base, userId: In(matchedUsers.map((x) => x.id)) });
      }
      where = variants;
    }
    const [orders, total] = await this.orders.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const decorated = await this.ordersService.decorate(orders);
    const users = await this.users.findBy({
      id: In(orders.map((o) => o.userId)),
    });
    const userMap = new Map(users.map((u) => [u.id, u.email]));
    const summaryRows = await this.orders.find();
    const summary = summaryRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});
    return {
      items: decorated.map((o) => ({
        ...o,
        userEmail: userMap.get(o.userId) ?? '-',
      })),
      total,
      page,
      pageSize,
      summary,
    };
  }

  /** 退款：回收坑位 + 吊销订阅 + 退款金额入钱包，并冲回成长值（防刷等级） */
  async refundOrder(id: number) {
    const order = await this.orders.findOneBy({ id });
    if (!order) throw new NotFoundException('订单不存在');
    if (!['paid', 'delivered', 'allocating'].includes(order.status)) {
      throw new BadRequestException('该订单状态不可退款');
    }
    await this.fulfillment.revoke(order);
    order.status = 'refunded';
    order.paymentStatus = 'refunded';
    order.refundStatus = 'refunded';
    order.fulfillmentStatus = 'failed';
    order.refundedAt = new Date();
    await this.orders.save(order);

    const usd = toUsd(order.amount, order.currency);
    const user = await this.users.findOneBy({ id: order.userId });
    if (user) {
      user.balance = Math.round((user.balance + usd) * 100) / 100;
      // 成长值冲回：仅当该订单当初「计入过成长值」时才扣回。
      // 口径与支付一致：balance 支付不计成长值（充值时已计），故其退款不扣；
      // 其余（mock 直付）计过成长值，退款按 USD 扣回，避免下单退款白嫖等级。
      const succeeded = await this.payments.findOneBy({
        orderId: order.id,
        status: 'succeeded',
      });
      const countedGrowth = !!succeeded && succeeded.provider !== 'balance';
      if (countedGrowth) {
        user.growthUsd = Math.max(0, Math.round(((user.growthUsd ?? 0) - usd) * 100) / 100);
      }
      await this.users.save(user);
      await this.txns.save(
        this.txns.create({
          userId: user.id,
          type: 'refund',
          amountUsd: usd,
          note: `订单 ${order.orderNo} 退款入钱包${countedGrowth ? '（已冲回成长值）' : ''}`,
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
      avatar: u.avatar || 'sv:spark',
      avatarFrame: u.avatarFrame || 'none',
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

  async getSiteConfigWorkspace() {
    const published = await this.getSiteConfig();
    const revisions = await this.siteRevisions.find({
      order: { id: 'DESC' },
      take: 30,
    });
    const userIds = [
      ...new Set(
        revisions.flatMap((x) =>
          [x.submittedBy, x.reviewedBy].filter(Boolean) as number[],
        ),
      ),
    ];
    const users = userIds.length
      ? await this.users.findBy({ id: In(userIds) })
      : [];
    const userMap = new Map(users.map((x) => [x.id, x.email]));
    return {
      published,
      revisions: revisions.map((x) => ({
        ...x,
        config: (() => {
          try {
            return JSON.parse(x.config);
          } catch {
            return {};
          }
        })(),
        submittedByEmail: userMap.get(x.submittedBy) ?? '-',
        reviewedByEmail: x.reviewedBy
          ? userMap.get(x.reviewedBy) ?? '-'
          : null,
      })),
    };
  }

  async submitSiteConfig(config: Record<string, unknown>, submittedBy: number) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new BadRequestException('站点配置格式不正确');
    }
    return this.siteRevisions.save(
      this.siteRevisions.create({
        config: JSON.stringify(config),
        status: 'pending',
        submittedBy,
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: '',
      }),
    );
  }

  async reviewSiteConfig(
    id: number,
    approve: boolean,
    reviewNote: string,
    reviewedBy: number,
  ) {
    const revision = await this.siteRevisions.findOneBy({ id });
    if (!revision) throw new NotFoundException('站点修改单不存在');
    if (revision.status !== 'pending') {
      throw new BadRequestException('该修改单已经审核');
    }
    revision.status = approve ? 'approved' : 'rejected';
    revision.reviewedBy = reviewedBy;
    revision.reviewedAt = new Date();
    revision.reviewNote = reviewNote || '';
    await this.siteRevisions.save(revision);
    if (approve) {
      let config: Record<string, unknown> = {};
      try {
        config = JSON.parse(revision.config);
      } catch {
        throw new BadRequestException('修改单配置无法解析');
      }
      await this.setSiteConfig(config);
    }
    return this.getSiteConfigWorkspace();
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
  private async supportAgent(id: number) {
    const agent = await this.users.findOneBy({ id, status: 'active' });
    if (!agent || !canHandleTickets(agent)) {
      throw new BadRequestException('目标客服不可用或没有工单权限');
    }
    return agent;
  }

  async ticketStats() {
    const [tickets, messages, transfers, users] = await Promise.all([
      this.tickets.find(),
      this.ticketMessages.find(),
      this.ticketTransfers.find(),
      this.users.find({ where: { status: 'active' } }),
    ]);
    const agents = users.filter(canHandleTickets);
    const rated = tickets.filter((t) => t.rating);
    const firstResponses = tickets
      .filter((t) => t.firstResponseAt)
      .map((t) =>
        Math.max(
          0,
          (new Date(t.firstResponseAt!).getTime() - new Date(t.createdAt).getTime()) /
            60_000,
        ),
      );
    return {
      total: tickets.length,
      open: tickets.filter((t) => t.status === 'open').length,
      answered: tickets.filter((t) => t.status === 'answered').length,
      resolved: tickets.filter((t) => t.status === 'resolved').length,
      closed: tickets.filter((t) => t.status === 'closed').length,
      messageCount: messages.filter((m) => m.messageType === 'text').length,
      transferCount: transfers.length,
      avgFirstResponseMinutes: firstResponses.length
        ? Math.round(
            (firstResponses.reduce((a, b) => a + b, 0) / firstResponses.length) *
              10,
          ) / 10
        : 0,
      ratings: {
        total: rated.length,
        average: rated.length
          ? Math.round(
              (rated.reduce((sum, t) => sum + Number(t.rating), 0) /
                rated.length) *
                10,
            ) / 10
          : 0,
        excellent: rated.filter((t) => t.rating === 5).length,
        medium: rated.filter((t) => Number(t.rating) >= 3 && Number(t.rating) <= 4)
          .length,
        bad: rated.filter((t) => Number(t.rating) <= 2).length,
      },
      agents: agents.map((agent) => {
        const agentMessages = messages.filter(
          (m) => m.senderRole === 'admin' && m.senderId === agent.id,
        );
        const assigned = tickets.filter((t) => t.assignedAgentId === agent.id);
        const agentRatings = tickets.filter(
          (t) => t.ratedAgentId === agent.id && t.rating,
        );
        return {
          id: agent.id,
          name: supportName(agent),
          avatar: agent.avatar,
          activeTickets: assigned.filter(
            (t) => !['resolved', 'closed'].includes(t.status),
          ).length,
          handledTickets: new Set(agentMessages.map((m) => m.ticketId)).size,
          replies: agentMessages.length,
          transfersIn: transfers.filter((t) => t.toAgentId === agent.id).length,
          transfersOut: transfers.filter((t) => t.fromAgentId === agent.id).length,
          ratingCount: agentRatings.length,
          avgRating: agentRatings.length
            ? Math.round(
                (agentRatings.reduce((sum, t) => sum + Number(t.rating), 0) /
                  agentRatings.length) *
                  10,
              ) / 10
            : 0,
        };
      }),
    };
  }

  async listSupportAgents() {
    const users = await this.users.find({ where: { status: 'active' } });
    return users.filter(canHandleTickets).map((agent) => ({
      id: agent.id,
      name: supportName(agent),
      email: agent.email,
      avatar: agent.avatar,
      role: agent.role,
    }));
  }

  async listTickets(status?: string) {
    const where = status ? { status: status as Ticket['status'] } : {};
    const rows = await this.tickets.find({
      where,
      order: { updatedAt: 'DESC' },
      take: 200,
    });
    const userIds = [
      ...new Set(
        rows.flatMap((t) => [t.userId, t.assignedAgentId]).filter(Boolean),
      ),
    ] as number[];
    const users = userIds.length ? await this.users.findBy({ id: In(userIds) }) : [];
    const messages = rows.length
      ? await this.ticketMessages.findBy({ ticketId: In(rows.map((t) => t.id)) })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.email]));
    const entityMap = new Map(users.map((u) => [u.id, u]));
    return rows.map((t) => ({
      ...t,
      userEmail: userMap.get(t.userId) ?? '-',
      agentName: t.assignedAgentId
        ? supportName(entityMap.get(t.assignedAgentId))
        : '待分配',
      messageCount: messages.filter((m) => m.ticketId === t.id).length,
    }));
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
    const agent = ticket.assignedAgentId
      ? await this.users.findOneBy({ id: ticket.assignedAgentId })
      : null;
    const transfers = await this.ticketTransfers.find({
      where: { ticketId: id },
      order: { id: 'ASC' },
    });
    return {
      ...ticket,
      userEmail: user?.email ?? '-',
      userName: supportName(user),
      orderNo,
      agent: agent
        ? { id: agent.id, name: supportName(agent), email: agent.email, avatar: agent.avatar }
        : null,
      messages,
      transfers,
    };
  }

  async replyTicket(id: number, content: string, operatorId: number) {
    const ticket = await this.tickets.findOneBy({ id });
    if (!ticket) throw new NotFoundException('工单不存在');
    if (ticket.status === 'closed') throw new BadRequestException('已完成工单不能继续回复');
    const clean = content.trim();
    if (!clean) throw new BadRequestException('回复内容不能为空');
    const operator = await this.supportAgent(operatorId);
    await this.tickets.manager.transaction(async (manager) => {
      const messageRepo = manager.getRepository(TicketMessage);
      if (!ticket.assignedAgentId) {
        ticket.assignedAgentId = operator.id;
        ticket.assignedAt = new Date();
        await messageRepo.save(
          messageRepo.create({
            ticketId: id,
            senderRole: 'system',
            senderId: null,
            senderName: '系统',
            messageType: 'transfer',
            metadata: JSON.stringify({ toAgentId: operator.id }),
            content: `客服 ${supportName(operator)} 已接待本工单，完整会话将持续保留。`,
          }),
        );
      }
      await messageRepo.save(
        messageRepo.create({
          ticketId: id,
          senderRole: 'admin',
          senderId: operator.id,
          senderName: supportName(operator),
          messageType: 'text',
          metadata: '{}',
          content: clean,
        }),
      );
      ticket.status = 'answered';
      ticket.firstResponseAt = ticket.firstResponseAt || new Date();
      ticket.lastMessageAt = new Date();
      ticket.resolvedAt = null;
      ticket.resolvedBy = null;
      ticket.resolutionNote = '';
      await manager.getRepository(Ticket).save(ticket);
    });
    return this.getTicket(id);
  }

  async resolveTicket(id: number, operatorId: number, resolutionNote = '') {
    const ticket = await this.tickets.findOneBy({ id });
    if (!ticket) throw new NotFoundException('工单不存在');
    if (ticket.status === 'closed') throw new BadRequestException('工单已经完成');
    const operator = await this.supportAgent(operatorId);
    const cleanNote = resolutionNote.trim().slice(0, 500) || '问题已处理完成';
    await this.tickets.manager.transaction(async (manager) => {
      await manager.getRepository(TicketMessage).save(
        manager.getRepository(TicketMessage).create({
          ticketId: id,
          senderRole: 'system',
          senderId: operator.id,
          senderName: supportName(operator),
          messageType: 'resolution',
          metadata: JSON.stringify({ resolvedBy: operator.id }),
          content: `客服 ${supportName(operator)} 已标记问题解决：${cleanNote}。请用户确认并可选评价本次服务。`,
        }),
      );
      ticket.status = 'resolved';
      ticket.resolvedAt = new Date();
      ticket.resolvedBy = operator.id;
      ticket.resolutionNote = cleanNote;
      ticket.lastMessageAt = new Date();
      await manager.getRepository(Ticket).save(ticket);
    });
    return this.getTicket(id);
  }

  async transferTicket(
    id: number,
    toAgentId: number,
    reason: string,
    operator: { sub: number; role: 'admin' | 'super' },
  ) {
    const ticket = await this.tickets.findOneBy({ id });
    if (!ticket) throw new NotFoundException('工单不存在');
    if (ticket.status === 'closed') throw new BadRequestException('已完成工单不能转接');
    const cleanReason = reason.trim().slice(0, 200);
    if (!cleanReason) throw new BadRequestException('请填写转接理由');
    if (ticket.assignedAgentId === toAgentId) {
      throw new BadRequestException('目标客服与当前客服相同');
    }
    const [toAgent, fromAgent] = await Promise.all([
      this.supportAgent(toAgentId),
      ticket.assignedAgentId
        ? this.users.findOneBy({ id: ticket.assignedAgentId })
        : Promise.resolve(null),
    ]);
    await this.tickets.manager.transaction(async (manager) => {
      await manager.getRepository(TicketTransfer).save(
        manager.getRepository(TicketTransfer).create({
          ticketId: id,
          fromAgentId: fromAgent?.id ?? null,
          fromAgentName: supportName(fromAgent),
          toAgentId: toAgent.id,
          toAgentName: supportName(toAgent),
          initiatedBy: operator.sub,
          initiatedRole: operator.role,
          reason: cleanReason,
        }),
      );
      await manager.getRepository(TicketMessage).save(
        manager.getRepository(TicketMessage).create({
          ticketId: id,
          senderRole: 'system',
          senderId: null,
          senderName: '系统',
          messageType: 'transfer',
          metadata: JSON.stringify({
            fromAgentId: fromAgent?.id ?? null,
            toAgentId: toAgent.id,
            reason: cleanReason,
          }),
          content: `工单由 ${supportName(fromAgent)} 转接给 ${supportName(toAgent)}。转接理由：${cleanReason}。历史对话与原客服信息完整保留。`,
        }),
      );
      ticket.assignedAgentId = toAgent.id;
      ticket.assignedAt = new Date();
      ticket.transferCount += 1;
      ticket.status = 'open';
      ticket.lastMessageAt = new Date();
      await manager.getRepository(Ticket).save(ticket);
    });
    return this.getTicket(id);
  }

  /**
   * 工单一键售后动作（后台连贯性核心）：
   * - reissue：调交付引擎补发新坑位并自动回复
   * - refund：调订单退款（退回钱包）并自动回复
   */
  async ticketAction(
    id: number,
    action: 'reissue' | 'refund',
    operatorId: number,
  ) {
    const ticket = await this.tickets.findOneBy({ id });
    if (!ticket) throw new NotFoundException('工单不存在');
    const operator = await this.supportAgent(operatorId);

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
          senderId: operator.id,
          senderName: supportName(operator),
          messageType: 'text',
          metadata: JSON.stringify({ action: 'reissue' }),
          content:
            '已为您补发新凭据（旧账号已作废）。请前往「我的订阅」查看最新账号密码；如仍有异常请直接回复本工单。',
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
          senderId: operator.id,
          senderName: supportName(operator),
          messageType: 'text',
          metadata: JSON.stringify({ action: 'refund' }),
          content:
            '订单已退款：金额已按汇率折算退回您的钱包余额，可在「钱包」页查看流水。感谢理解与支持！',
        }),
      );
    } else {
      throw new BadRequestException('不支持的动作');
    }

    ticket.status = 'answered';
    ticket.assignedAgentId = ticket.assignedAgentId || operator.id;
    ticket.assignedAt = ticket.assignedAt || new Date();
    ticket.firstResponseAt = ticket.firstResponseAt || new Date();
    ticket.lastMessageAt = new Date();
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
  async reviewSubmission(
    id: number,
    approve: boolean,
    reviewNote: string,
    operatorId: number,
  ) {
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
        }, operatorId);
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
