import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  InventoryAccount,
  Plan,
  PriceBook,
  Product,
  Slot,
} from '../entities';

export interface PlanView {
  id: number;
  name: string;
  type: string;
  periodMonths: number;
  price: number | null;
  currency: string | null;
  stock: number;
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    @InjectRepository(PriceBook) private readonly prices: Repository<PriceBook>,
    @InjectRepository(InventoryAccount)
    private readonly accounts: Repository<InventoryAccount>,
    @InjectRepository(Slot) private readonly slots: Repository<Slot>,
  ) {}

  /** 查价：精确地区 -> GLOBAL 回退 */
  async resolvePrice(planId: number, region: string) {
    const exact = await this.prices.findOneBy({ planId, region });
    if (exact) return exact;
    return this.prices.findOneBy({ planId, region: 'GLOBAL' });
  }

  /** 套餐可用库存 = 健康账号下的空闲坑位数 */
  async stockOfPlan(planId: number): Promise<number> {
    const okAccounts = await this.accounts.findBy({ planId, health: 'ok' });
    if (okAccounts.length === 0) return 0;
    return this.slots.countBy({
      accountId: In(okAccounts.map((a) => a.id)),
      status: 'free',
    });
  }

  private async planViews(productId: number, region: string): Promise<PlanView[]> {
    const plans = await this.plans.findBy({ productId, status: 'on' });
    const views: PlanView[] = [];
    for (const p of plans) {
      const price = await this.resolvePrice(p.id, region);
      views.push({
        id: p.id,
        name: p.name,
        type: p.type,
        periodMonths: p.periodMonths,
        price: price ? price.price : null,
        currency: price ? price.currency : null,
        stock: await this.stockOfPlan(p.id),
      });
    }
    // 无价格的套餐（该地区未开售）不展示
    return views.filter((v) => v.price !== null);
  }

  private parseMeta(meta: string) {
    try {
      return JSON.parse(meta || '{}');
    } catch {
      return {};
    }
  }

  async listProducts(region: string) {
    const items = await this.products.find({
      where: { status: 'on' },
      order: { sort: 'ASC', id: 'ASC' },
    });
    const result = [];
    for (const p of items) {
      const plans = await this.planViews(p.id, region);
      if (plans.length === 0) continue; // 该地区不可售
      const cheapest = plans.reduce((a, b) => (a.price! <= b.price! ? a : b));
      const meta = this.parseMeta(p.meta);
      result.push({
        id: p.id,
        slug: p.slug,
        title: p.title,
        category: p.category,
        description: p.description,
        rating: p.rating,
        soldCount: p.soldCount,
        badge: meta.badge ?? null,
        officialPriceUsd: meta.officialPriceUsd ?? null,
        fromPrice: cheapest.price,
        currency: cheapest.currency,
        totalStock: plans.reduce((s, v) => s + v.stock, 0),
      });
    }
    return result;
  }

  async getProduct(slug: string, region: string) {
    const product = await this.products.findOneBy({ slug, status: 'on' });
    if (!product) throw new NotFoundException('商品不存在或已下架');
    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      category: product.category,
      description: product.description,
      rating: product.rating,
      soldCount: product.soldCount,
      meta: this.parseMeta(product.meta),
      plans: await this.planViews(product.id, region),
    };
  }

  /** 购物车报价：逐项当前价/库存 + 按地区币种折算合计 */
  async quote(planIds: number[], region: string) {
    const { convert, REGION_CURRENCY } = await import('../entities');
    const currency = REGION_CURRENCY[region] ?? 'USD';
    const items = [];
    let total = 0;
    for (const planId of [...new Set(planIds)].slice(0, 10)) {
      const plan = await this.plans.findOneBy({ id: planId, status: 'on' });
      if (!plan) {
        items.push({ planId, available: false, reason: '已下架' });
        continue;
      }
      const product = await this.products.findOneBy({
        id: plan.productId,
        status: 'on',
      });
      const price = await this.resolvePrice(planId, region);
      if (!product || !price) {
        items.push({
          planId,
          available: false,
          reason: !product ? '已下架' : '该地区未开售',
          planName: plan.name,
          productTitle: product?.title ?? '-',
        });
        continue;
      }
      const unitPrice = convert(price.price, price.currency, currency);
      total += unitPrice;
      items.push({
        planId,
        available: true,
        planName: plan.name,
        periodMonths: plan.periodMonths,
        productTitle: product.title,
        productSlug: product.slug,
        category: product.category,
        unitPrice,
        currency,
        stock: await this.stockOfPlan(planId),
      });
    }
    return { currency, total: Math.round(total * 100) / 100, items };
  }

  /** 结算页使用：按套餐 id 取套餐+商品+地区价+库存 */
  async getPlan(planId: number, region: string) {
    const plan = await this.plans.findOneBy({ id: planId, status: 'on' });
    if (!plan) throw new NotFoundException('套餐不存在或已下架');
    const product = await this.products.findOneBy({
      id: plan.productId,
      status: 'on',
    });
    if (!product) throw new NotFoundException('商品不存在或已下架');
    const price = await this.resolvePrice(plan.id, region);
    if (!price) throw new NotFoundException('该地区暂未开售此套餐');
    return {
      id: plan.id,
      name: plan.name,
      type: plan.type,
      periodMonths: plan.periodMonths,
      price: price.price,
      currency: price.currency,
      stock: await this.stockOfPlan(plan.id),
      product: {
        id: product.id,
        slug: product.slug,
        title: product.title,
        category: product.category,
        badge: this.parseMeta(product.meta).badge ?? null,
      },
    };
  }
}
