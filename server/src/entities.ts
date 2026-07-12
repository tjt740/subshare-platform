import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 角色体系：
 * - user     前台用户
 * - super    超级管理员（父管理员，可创建子管理员）
 * - admin    子管理员（按 permissions 数组授权后台模块）
 * - supplier 供应商（提交账号/产品，走审核入库）
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id: number;
  @Index({ unique: true })
  @Column({ type: 'text' })
  email: string;
  @Column({ type: 'text' }) passwordHash: string;
  @Column({ type: 'text', default: '' }) nickname: string;
  @Column({ type: 'text', default: '😀' }) avatar: string;
  @Column({ type: 'text', default: 'user' })
  role: 'user' | 'admin' | 'super' | 'supplier';
  @Column({ type: 'text', default: '[]' }) permissions: string; // JSON string[]
  @Column({ type: 'text', default: 'active' }) status: 'active' | 'banned';
  @Column({ type: 'real', default: 0 }) balance: number; // 钱包余额（USD）
  /** 成长值：累计充值+消费（USD），驱动用户等级 */
  @Column({ type: 'real', default: 0 }) growthUsd: number;
  /** 等级人工覆盖（后台设置；null=按成长值自动计算） */
  @Column({ type: 'integer', nullable: true }) levelOverride: number | null;
  @CreateDateColumn() createdAt: Date;
}

/** 产品；meta 为富信息 JSON：officialPriceUsd/badge/features/faq/reviews */
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn() id: number;
  @Index({ unique: true })
  @Column({ type: 'text' })
  slug: string;
  @Column({ type: 'text' }) title: string;
  @Column({ type: 'text', default: '流媒体' }) category: string;
  @Column({ type: 'text', default: '' }) description: string;
  @Column({ type: 'text', default: '{}' }) meta: string;
  @Column({ type: 'real', default: 4.8 }) rating: number;
  @Column({ type: 'integer', default: 0 }) soldCount: number;
  @Column({ type: 'text', default: 'on' }) status: 'on' | 'off';
  @Column({ type: 'integer', default: 0 }) sort: number;
  @CreateDateColumn() createdAt: Date;
}

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer' })
  productId: number;
  @Column({ type: 'text' }) name: string;
  @Column({ type: 'text', default: 'shared' }) type: 'shared' | 'topup';
  @Column({ type: 'integer', default: 1 }) periodMonths: number;
  @Column({ type: 'text', default: 'on' }) status: 'on' | 'off';
  @CreateDateColumn() createdAt: Date;
}

@Entity('price_books')
@Index(['planId', 'region'], { unique: true })
export class PriceBook {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) planId: number;
  @Column({ type: 'text' }) region: string;
  @Column({ type: 'text' }) currency: string;
  @Column({ type: 'real' }) price: number;
}

@Entity('inventory_accounts')
export class InventoryAccount {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer' })
  planId: number;
  @Column({ type: 'text' }) credentials: string;
  @Column({ type: 'integer', default: 5 }) maxSlots: number;
  @Column({ type: 'text', default: 'ok' }) health: 'ok' | 'banned';
  @Column({ type: 'integer', nullable: true }) supplierId: number | null; // 供应商来源
  @CreateDateColumn() createdAt: Date;
}

@Entity('slots')
export class Slot {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer' })
  accountId: number;
  @Column({ type: 'integer', nullable: true }) orderId: number | null;
  @Column({ type: 'text', default: 'free' }) status: 'free' | 'assigned' | 'revoked';
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn() id: number;
  @Index({ unique: true })
  @Column({ type: 'text' })
  orderNo: string;
  @Index()
  @Column({ type: 'integer' })
  userId: number;
  /** 兼容字段：首个商品的套餐（多商品明细见 order_items） */
  @Column({ type: 'integer' }) planId: number;
  @Column({ type: 'text' }) region: string;
  @Column({ type: 'text' }) currency: string;
  @Column({ type: 'real' }) amount: number;
  @Column({ type: 'text', default: 'created' })
  status: 'created' | 'paid' | 'allocating' | 'delivered' | 'refunded' | 'canceled';
  @Column({ type: 'datetime', nullable: true }) paidAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}

/** 订单明细（购物车合并结算：一单多商品） */
@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer' })
  orderId: number;
  @Column({ type: 'integer' }) planId: number;
  @Column({ type: 'real' }) unitPrice: number; // 已折算为订单币种
  @Column({ type: 'text' }) currency: string;
  /** 交付守卫：重试补发时跳过已完成项，避免续费重复顺延 */
  @Column({ type: 'text', default: 'pending' }) status: 'pending' | 'done';
}

/** 支付单：purpose=order 订单支付；purpose=recharge 钱包充值 */
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer', nullable: true })
  orderId: number | null;
  @Index()
  @Column({ type: 'integer' })
  userId: number;
  @Column({ type: 'text', default: 'order' }) purpose: 'order' | 'recharge';
  @Column({ type: 'text' }) provider: string; // mock-card/mock-alipay/mock-usdt/balance
  @Column({ type: 'real' }) amount: number;
  @Column({ type: 'text' }) currency: string;
  @Column({ type: 'text', default: 'pending' }) status: 'pending' | 'succeeded' | 'failed';
  @CreateDateColumn() createdAt: Date;
}

/** 钱包流水（USD 计） */
@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer' })
  userId: number;
  @Column({ type: 'text' }) type: 'recharge' | 'order_pay' | 'refund';
  @Column({ type: 'real' }) amountUsd: number; // 正=入账 负=出账
  @Column({ type: 'text', default: '' }) note: string;
  @CreateDateColumn() createdAt: Date;
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer' })
  userId: number;
  @Column({ type: 'integer' }) orderId: number;
  @Column({ type: 'integer' }) planId: number;
  @Column({ type: 'integer', nullable: true }) slotId: number | null;
  @Column({ type: 'text', default: 'active' }) status: 'active' | 'expired' | 'revoked';
  @Column({ type: 'datetime' }) startsAt: Date;
  @Column({ type: 'datetime' }) expiresAt: Date;
  @Column({ type: 'text', default: '' }) credentials: string;
  @CreateDateColumn() createdAt: Date;
}

/** 客服工单（category 售后类型化：后台可一键执行对应动作） */
export const TICKET_CATEGORIES = [
  'general',            // 一般咨询
  'aftersales_reissue', // 售后-补发
  'aftersales_refund',  // 售后-退款
  'aftersales_swap',    // 售后-换车
] as const;

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer' })
  userId: number;
  @Column({ type: 'integer', nullable: true }) orderId: number | null;
  @Column({ type: 'integer', nullable: true }) subscriptionId: number | null;
  @Column({ type: 'text', default: 'general' }) category: string;
  @Column({ type: 'text' }) subject: string;
  // open=待客服处理 answered=已回复待用户 closed=已关闭
  @Column({ type: 'text', default: 'open' }) status: 'open' | 'answered' | 'closed';
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('ticket_messages')
export class TicketMessage {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer' })
  ticketId: number;
  @Column({ type: 'text' }) senderRole: 'user' | 'admin';
  @Column({ type: 'text' }) content: string;
  @CreateDateColumn() createdAt: Date;
}

/** 供应商提交（账号入库申请 / 新产品提议），审核通过后生效 */
@Entity('supplier_submissions')
export class SupplierSubmission {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer' })
  supplierId: number;
  @Column({ type: 'text', default: 'account' }) type: 'account' | 'product';
  // type=account
  @Column({ type: 'integer', nullable: true }) planId: number | null;
  @Column({ type: 'text', default: '' }) username: string;
  @Column({ type: 'text', default: '' }) password: string;
  @Column({ type: 'integer', default: 5 }) maxSlots: number;
  // type=product
  @Column({ type: 'text', default: '' }) proposedTitle: string;
  @Column({ type: 'text', default: '' }) proposedDesc: string;
  // 公共
  @Column({ type: 'text', default: '' }) note: string;
  @Column({ type: 'text', default: 'pending' }) status: 'pending' | 'approved' | 'rejected';
  @Column({ type: 'text', default: '' }) reviewNote: string;
  @CreateDateColumn() createdAt: Date;
  @Column({ type: 'datetime', nullable: true }) reviewedAt: Date | null;
}

/** 站点配置（后台可改前台的每一处文案/数据） */
@Entity('site_settings')
export class SiteSetting {
  @PrimaryGeneratedColumn() id: number;
  @Index({ unique: true })
  @Column({ type: 'text' })
  key: string;
  @Column({ type: 'text', default: '{}' }) value: string; // JSON
}

export const ALL_ENTITIES = [
  User,
  Product,
  Plan,
  PriceBook,
  InventoryAccount,
  Slot,
  Order,
  OrderItem,
  Payment,
  WalletTransaction,
  Subscription,
  Ticket,
  TicketMessage,
  SupplierSubmission,
  SiteSetting,
];

export const REGIONS = ['US', 'EU', 'CN', 'GLOBAL'] as const;
export const REGION_CURRENCY: Record<string, string> = {
  US: 'USD',
  EU: 'EUR',
  CN: 'CNY',
  GLOBAL: 'USD',
};

/** 演示用固定汇率（生产应每日同步汇率 API） */
export const FX_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  CNY: 0.14,
};
export const toUsd = (amount: number, currency: string) =>
  Math.round(amount * (FX_TO_USD[currency] ?? 1) * 100) / 100;

/** 币种互转（演示固定汇率） */
export const convert = (amount: number, from: string, to: string) =>
  from === to
    ? amount
    : Math.round(
        ((amount * (FX_TO_USD[from] ?? 1)) / (FX_TO_USD[to] ?? 1)) * 100,
      ) / 100;

/** 用户等级阈值（成长值 USD）：等级越高越尊贵 */
export const LEVELS = [
  { lv: 1, need: 0 },
  { lv: 2, need: 50 },
  { lv: 3, need: 150 },
  { lv: 4, need: 400 },
  { lv: 5, need: 1000 },
] as const;
export function computeLevel(growthUsd: number): number {
  let lv = 1;
  for (const item of LEVELS) if (growthUsd >= item.need) lv = item.lv;
  return lv;
}
export function effectiveLevel(user: { growthUsd?: number; levelOverride?: number | null }): number {
  if (user.levelOverride && user.levelOverride >= 1 && user.levelOverride <= 5) return user.levelOverride;
  return computeLevel(user.growthUsd ?? 0);
}
export function nextLevelAt(level: number): number | null {
  const next = LEVELS.find((x) => x.lv === level + 1);
  return next ? next.need : null;
}

/** 子管理员可分配的后台权限 */
export const ADMIN_PERMISSIONS = [
  'dashboard',
  'products',
  'inventory',
  'orders',
  'users',
  'tickets',
  'suppliers',
  'settings',
] as const;
