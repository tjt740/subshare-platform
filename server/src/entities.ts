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
  /** 头像：预置 SVG 名(如 'sv:duck')、emoji、或 data:image base64（本地上传） */
  @Column({ type: 'text', default: 'sv:spark' }) avatar: string;
  /** 头像装饰框（仿 Notion AI）：none/gold/neon/leaf/crown… */
  @Column({ type: 'text', default: 'none' }) avatarFrame: string;
  @Column({ type: 'text', default: 'user' })
  role: 'user' | 'admin' | 'super' | 'supplier';
  @Column({ type: 'text', default: '[]' }) permissions: string; // JSON string[]
  @Column({ type: 'text', default: 'active' }) status: 'active' | 'banned';
  @Column({ type: 'real', default: 0 }) balance: number; // 钱包余额（USD）
  /** 成长值：累计充值+消费（USD），驱动用户等级 */
  @Column({ type: 'real', default: 0 }) growthUsd: number;
  /** 等级人工覆盖（后台设置；null=按成长值自动计算） */
  @Column({ type: 'integer', nullable: true }) levelOverride: number | null;
  /** 密码重置令牌（演示：接口直接返回；生产走邮件） */
  @Column({ type: 'text', nullable: true }) resetToken: string | null;
  @Column({ type: 'datetime', nullable: true }) resetExpires: Date | null;
  /** 第三方登录：注册来源 local | google | github | microsoft */
  @Column({ type: 'text', default: 'local' }) provider: string;
  /** 已绑定的第三方账号，JSON: { google: 'sub-id', github: '123' } */
  @Column({ type: 'text', default: '{}' }) providerIds: string;
  @CreateDateColumn() createdAt: Date;
}

/** 登录记录（账户安全：设备/IP/时间，异常登录可查） */
@Entity('login_logs')
export class LoginLog {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer' })
  userId: number;
  @Column({ type: 'text', default: '' }) ip: string;
  @Column({ type: 'text', default: '' }) userAgent: string;
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
  /** 定价拆解：售价 = 成本 + 手续费 + 售后准备金 + 运营费用 + 目标利润 */
  @Column({ type: 'real', default: 0 }) costAmount: number;
  @Column({ type: 'real', default: 0 }) paymentFeeAmount: number;
  @Column({ type: 'real', default: 0 }) aftersalesReserveAmount: number;
  @Column({ type: 'real', default: 0 }) operationCostAmount: number;
  @Column({ type: 'real', default: 0 }) targetProfitAmount: number;
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
  @Index({ unique: true })
  @Column({ type: 'text', nullable: true })
  accountCode: string | null;
  @Column({ type: 'text', default: 'active' })
  lifecycleStatus: 'active' | 'renew_due' | 'expired' | 'suspended' | 'retired';
  @Column({ type: 'datetime', nullable: true }) purchasedAt: Date | null;
  @Column({ type: 'datetime', nullable: true }) serviceStartedAt: Date | null;
  @Column({ type: 'datetime', nullable: true }) lastRechargedAt: Date | null;
  @Column({ type: 'datetime', nullable: true }) nextRechargeAt: Date | null;
  @Column({ type: 'datetime', nullable: true }) expiresAt: Date | null;
  @Column({ type: 'integer', default: 0 }) serviceDays: number;
  @Column({ type: 'real', default: 0 }) costAmount: number;
  @Column({ type: 'text', default: 'USD' }) costCurrency: string;
  @Column({ type: 'real', default: 0 }) costUsd: number;
  @Column({ type: 'text', default: '' }) purchaseOrderNo: string;
  @Column({ type: 'text', default: '' }) invoiceNo: string;
  @Column({ type: 'integer', nullable: true }) createdBy: number | null;
  @Column({ type: 'integer', nullable: true }) updatedBy: number | null;
  @Column({ type: 'datetime', nullable: true }) lastCheckedAt: Date | null;
  @Column({ type: 'boolean', default: false }) autoRenew: boolean;
  @Column({ type: 'text', default: '' }) notes: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

/** 账号采购/充值/调账流水：每次成本变化都保留原始记录 */
@Entity('account_cost_entries')
export class AccountCostEntry {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer' }) accountId: number;
  @Column({ type: 'text', default: 'purchase' })
  type: 'purchase' | 'recharge' | 'adjustment' | 'supplier_refund';
  @Column({ type: 'real' }) amount: number;
  @Column({ type: 'text' }) currency: string;
  @Column({ type: 'real' }) amountUsd: number;
  @Column({ type: 'datetime', nullable: true }) effectiveFrom: Date | null;
  @Column({ type: 'datetime', nullable: true }) effectiveTo: Date | null;
  @Column({ type: 'integer', nullable: true }) operatorId: number | null;
  @Column({ type: 'text', default: '' }) note: string;
  @CreateDateColumn() createdAt: Date;
}

/** 账号操作审计：保存修改前后字段，支持责任追溯 */
@Entity('inventory_audit_logs')
export class InventoryAuditLog {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer' }) accountId: number;
  @Column({ type: 'integer', nullable: true }) operatorId: number | null;
  @Column({ type: 'text' }) action: string;
  @Column({ type: 'text', default: '{}' }) changes: string;
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

/** 坑位分配历史：把每笔订单收入准确归属到具体账号/坑位/服务周期 */
@Entity('slot_assignments')
export class SlotAssignment {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer' }) accountId: number;
  @Index()
  @Column({ type: 'integer' }) slotId: number;
  @Index()
  @Column({ type: 'integer' }) orderId: number;
  @Column({ type: 'integer' }) orderItemId: number;
  @Column({ type: 'integer' }) subscriptionId: number;
  @Column({ type: 'datetime' }) startsAt: Date;
  @Column({ type: 'datetime' }) endsAt: Date;
  @Column({ type: 'real' }) saleAmount: number;
  @Column({ type: 'text' }) saleCurrency: string;
  @Column({ type: 'real' }) saleUsd: number;
  @Column({ type: 'real', default: 0 }) paymentFeeUsd: number;
  @Column({ type: 'real', default: 0 }) refundUsd: number;
  @Column({ type: 'text', default: 'active' })
  status: 'active' | 'ended' | 'refunded' | 'revoked';
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
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
  @Column({ type: 'text', default: 'unpaid' })
  paymentStatus: 'unpaid' | 'paid' | 'partially_refunded' | 'refunded' | 'failed' | 'canceled';
  @Column({ type: 'text', default: 'pending' })
  fulfillmentStatus: 'pending' | 'processing' | 'partial' | 'delivered' | 'failed';
  @Column({ type: 'text', default: 'none' })
  refundStatus: 'none' | 'requested' | 'approved' | 'refunded' | 'failed';
  @Column({ type: 'text', default: 'unsettled' })
  settlementStatus: 'unsettled' | 'settled' | 'exception';
  @Column({ type: 'datetime', nullable: true }) deliveredAt: Date | null;
  @Column({ type: 'datetime', nullable: true }) refundedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
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
  // open=待客服处理 answered=已回复待用户 resolved=客服已解决待用户确认 closed=已完成
  @Column({ type: 'text', default: 'open' })
  status: 'open' | 'answered' | 'resolved' | 'closed';
  @Column({ type: 'integer', nullable: true }) assignedAgentId: number | null;
  @Column({ type: 'datetime', nullable: true }) assignedAt: Date | null;
  @Column({ type: 'datetime', nullable: true }) firstResponseAt: Date | null;
  @Column({ type: 'datetime', nullable: true }) lastMessageAt: Date | null;
  @Column({ type: 'datetime', nullable: true }) resolvedAt: Date | null;
  @Column({ type: 'integer', nullable: true }) resolvedBy: number | null;
  @Column({ type: 'text', default: '' }) resolutionNote: string;
  @Column({ type: 'datetime', nullable: true }) closedAt: Date | null;
  @Column({ type: 'integer', default: 0 }) transferCount: number;
  @Column({ type: 'integer', nullable: true }) rating: number | null;
  @Column({ type: 'text', default: '' }) ratingComment: string;
  @Column({ type: 'datetime', nullable: true }) ratedAt: Date | null;
  @Column({ type: 'integer', nullable: true }) ratedAgentId: number | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('ticket_messages')
export class TicketMessage {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer' })
  ticketId: number;
  @Column({ type: 'text' }) senderRole: 'user' | 'admin' | 'system';
  /** 发送人 ID + 当时显示名快照：账号资料或客服归属变化不会改写历史 */
  @Column({ type: 'integer', nullable: true }) senderId: number | null;
  @Column({ type: 'text', default: '' }) senderName: string;
  @Column({ type: 'text', default: 'text' })
  messageType: 'text' | 'system' | 'transfer' | 'resolution' | 'rating';
  @Column({ type: 'text', default: '{}' }) metadata: string;
  @Column({ type: 'text' }) content: string;
  @CreateDateColumn() createdAt: Date;
}

/** 客服转接历史单独留档，任何客服变更都不会覆盖会话与原处理人 */
@Entity('ticket_transfers')
export class TicketTransfer {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer' }) ticketId: number;
  @Column({ type: 'integer', nullable: true }) fromAgentId: number | null;
  @Column({ type: 'text', default: '' }) fromAgentName: string;
  @Column({ type: 'integer' }) toAgentId: number;
  @Column({ type: 'text', default: '' }) toAgentName: string;
  @Column({ type: 'integer' }) initiatedBy: number;
  @Column({ type: 'text' }) initiatedRole: 'user' | 'admin' | 'super';
  @Column({ type: 'text', default: '' }) reason: string;
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

/** 站点修改单：编辑只生成待审核版本，审核通过才覆盖正式配置 */
@Entity('site_config_revisions')
export class SiteConfigRevision {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'text', default: '{}' }) config: string;
  @Column({ type: 'text', default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';
  @Index()
  @Column({ type: 'integer' }) submittedBy: number;
  @Column({ type: 'integer', nullable: true }) reviewedBy: number | null;
  @Column({ type: 'datetime', nullable: true }) reviewedAt: Date | null;
  @Column({ type: 'text', default: '' }) reviewNote: string;
  @CreateDateColumn() createdAt: Date;
}

/** 埋点事件（PV/点击/下单漏斗/用户行为轨迹） */
@Entity('analytics_events')
export class AnalyticsEvent {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'text' })
  name: string;
  @Index()
  @Column({ type: 'integer', nullable: true })
  userId: number | null;
  @Column({ type: 'text', default: '' }) anonId: string;
  @Column({ type: 'text', default: '' }) sessionId: string;
  @Column({ type: 'text', default: '' }) path: string;
  @Column({ type: 'text', default: '' }) referrer: string;
  @Column({ type: 'text', default: '' }) device: string;
  @Column({ type: 'text', default: '{}' }) props: string;
  @Column({ type: 'text', default: '' }) ip: string;
  @Column({ type: 'text', default: '' }) userAgent: string;
  @CreateDateColumn() createdAt: Date;
}

/** 站内通知（到期提醒、订单/售后状态变更等） */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'integer' })
  userId: number;
  @Column({ type: 'text', default: 'system' }) type: string;
  @Column({ type: 'text' }) title: string;
  @Column({ type: 'text', default: '' }) body: string;
  @Column({ type: 'text', default: '' }) link: string;
  /** 去重键：同一事件只提醒一次（如 sub_expiring:<subId>:<到期日>） */
  @Index({ unique: true })
  @Column({ type: 'text', nullable: true })
  dedupeKey: string | null;
  @Column({ type: 'boolean', default: false }) read: boolean;
  @CreateDateColumn() createdAt: Date;
}

export const ALL_ENTITIES = [
  User,
  Notification,
  Product,
  Plan,
  PriceBook,
  InventoryAccount,
  AccountCostEntry,
  InventoryAuditLog,
  Slot,
  SlotAssignment,
  Order,
  OrderItem,
  Payment,
  WalletTransaction,
  Subscription,
  Ticket,
  TicketMessage,
  TicketTransfer,
  SupplierSubmission,
  SiteSetting,
  SiteConfigRevision,
  LoginLog,
  AnalyticsEvent,
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
  'analytics',
] as const;
