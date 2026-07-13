import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  convert,
  Order,
  OrderItem,
  Plan,
  Product,
  REGION_CURRENCY,
  Subscription,
} from '../entities';
import { CatalogService } from '../catalog/catalog.service';
import { FulfillmentService } from '../payments/fulfillment.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Subscription)
    private readonly subs: Repository<Subscription>,
    private readonly catalog: CatalogService,
    private readonly fulfillment: FulfillmentService,
  ) {}

  /**
   * 下单（支持购物车多商品）：
   * - 订单币种统一为地区默认币种，跨币种商品按汇率折算
   * - 有生效订阅的套餐视为续费，无需库存
   */
  async create(userId: number, planIds: number[], region: string) {
    const unique = [...new Set(planIds)].filter((n) => Number.isInteger(n));
    if (unique.length === 0) throw new BadRequestException('购物车为空');
    if (unique.length > 10) throw new BadRequestException('单笔订单最多 10 件商品');

    const currency = REGION_CURRENCY[region] ?? 'USD';
    const lines: { planId: number; unitPrice: number }[] = [];
    let total = 0;

    for (const planId of unique) {
      const plan = await this.plans.findOneBy({ id: planId, status: 'on' });
      if (!plan) throw new NotFoundException(`套餐 #${planId} 不存在或已下架`);
      const product = await this.products.findOneBy({
        id: plan.productId,
        status: 'on',
      });
      if (!product) throw new NotFoundException('商品不存在或已下架');

      const price = await this.catalog.resolvePrice(planId, region);
      if (!price) {
        throw new BadRequestException(`「${product.title}」该地区暂未开售`);
      }

      const isRenewal = !!(await this.subs.findOneBy({
        userId,
        planId,
        status: 'active',
      }));
      if (!isRenewal) {
        const stock = await this.catalog.stockOfPlan(planId);
        if (stock <= 0) {
          throw new BadRequestException(`「${product.title} / ${plan.name}」库存不足`);
        }
      }

      const unitPrice = convert(price.price, price.currency, currency);
      lines.push({ planId, unitPrice });
      total += unitPrice;
    }
    total = Math.round(total * 100) / 100;

    const order = await this.orders.save(
      this.orders.create({
        orderNo: `SS${Date.now()}${Math.floor(Math.random() * 900 + 100)}`,
        userId,
        planId: unique[0],
        region,
        currency,
        amount: total,
        status: 'created',
      }),
    );
    for (const line of lines) {
      await this.orderItems.save(
        this.orderItems.create({
          orderId: order.id,
          planId: line.planId,
          unitPrice: line.unitPrice,
          currency,
          status: 'pending',
        }),
      );
    }
    return (await this.decorate([order]))[0];
  }

  /** 补充商品/套餐/明细展示信息（含兼容字段 productTitle/planName） */
  async decorate(orders: Order[]) {
    if (orders.length === 0) return [];
    const items = await this.orderItems.findBy({
      orderId: In(orders.map((o) => o.id)),
    });
    const planIds = [...new Set([...items.map((i) => i.planId), ...orders.map((o) => o.planId)])];
    const plans = planIds.length ? await this.plans.findBy({ id: In(planIds) }) : [];
    const planMap = new Map(plans.map((p) => [p.id, p]));
    const products = plans.length
      ? await this.products.findBy({ id: In(plans.map((p) => p.productId)) })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    const itemView = (i: OrderItem) => {
      const plan = planMap.get(i.planId);
      const product = plan ? productMap.get(plan.productId) : undefined;
      return {
        id: i.id,
        planId: i.planId,
        unitPrice: i.unitPrice,
        currency: i.currency,
        status: i.status,
        planName: plan?.name ?? '-',
        periodMonths: plan?.periodMonths ?? 0,
        productTitle: product?.title ?? '-',
        productSlug: product?.slug ?? '',
        category: product?.category ?? '',
      };
    };

    return orders.map((o) => {
      const mine = items.filter((i) => i.orderId === o.id).map(itemView);
      const first = mine[0];
      return {
        ...o,
        items: mine,
        // 兼容字段（列表摘要展示）
        planName: first
          ? mine.length > 1
            ? `${first.planName} 等 ${mine.length} 件`
            : first.planName
          : '-',
        periodMonths: first?.periodMonths ?? 0,
        productTitle: first
          ? mine.length > 1
            ? `${first.productTitle} +${mine.length - 1}`
            : first.productTitle
          : '-',
        productSlug: first?.productSlug ?? '',
      };
    });
  }

  async listMine(userId: number) {
    const orders = await this.orders.find({
      where: { userId },
      order: { id: 'DESC' },
    });
    return this.decorate(orders);
  }

  /** 用户取消未支付订单 */
  async cancelMine(userId: number, orderId: number) {
    const order = await this.orders.findOneBy({ id: orderId, userId });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'created') {
      throw new BadRequestException('仅未支付订单可取消');
    }
    order.status = 'canceled';
    order.paymentStatus = 'canceled';
    await this.orders.save(order);
    return { ok: true, id: order.id, status: order.status };
  }

  async listMySubscriptions(userId: number) {
    // 惰性到期回收：置 expired 并释放坑位回池（复用交付引擎的加锁实现）
    await this.fulfillment.sweepExpired();
    const subs = await this.subs.find({
      where: { userId },
      order: { id: 'DESC' },
    });
    if (subs.length === 0) return [];
    const plans = await this.plans.findBy({
      id: In(subs.map((s) => s.planId)),
    });
    const planMap = new Map(plans.map((p) => [p.id, p]));
    const products = await this.products.findBy({
      id: In(plans.map((p) => p.productId)),
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const orders = await this.orders.findBy({
      id: In(subs.map((s) => s.orderId)),
    });
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    return subs.map((s) => {
      const plan = planMap.get(s.planId);
      const product = plan ? productMap.get(plan.productId) : undefined;
      let credentials: any = null;
      try {
        credentials = s.credentials ? JSON.parse(s.credentials) : null;
      } catch {
        credentials = { note: s.credentials };
      }
      let meta: any = {};
      try {
        meta = product?.meta ? JSON.parse(product.meta) : {};
      } catch {
        meta = {};
      }
      return {
        id: s.id,
        status: s.status,
        startsAt: s.startsAt,
        expiresAt: s.expiresAt,
        credentials,
        planId: s.planId,
        planName: plan?.name ?? '-',
        productTitle: product?.title ?? '-',
        category: product?.category ?? '',
        orderId: s.orderId,
        orderNo: orderMap.get(s.orderId)?.orderNo ?? '-',
        deliveryMethod: meta?.delivery?.method ?? '账号凭据',
        warranty: meta?.warranty ?? '有效期内免费补发',
      };
    });
  }
}
