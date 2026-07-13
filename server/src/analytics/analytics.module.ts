import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import {
  JwtAuthGuard,
  JwtUser,
  Perm,
  PermGuard,
  Roles,
  RolesGuard,
} from '../auth/auth.common';
import { AnalyticsEvent, User, effectiveLevel } from '../entities';
import { JwtService } from '@nestjs/jwt';

/**
 * 埋点系统（Analytics）
 * - POST /api/track      公开上报（匿名或登录用户；带 JWT 时自动关联 userId）
 * - GET  /api/admin/analytics/overview  后台统计（PV/UV/事件/漏斗/转化）
 * - GET  /api/admin/analytics/events    原始事件流（可按用户/事件/日期筛选）
 * - GET  /api/admin/analytics/user/:id  单用户行为轨迹
 */

/** 标准事件名（前端 track SDK 使用） */
export const EVENT_NAMES = [
  'page_view',
  'product_view',
  'add_to_cart',
  'remove_from_cart',
  'checkout_start',
  'checkout_submit',
  'payment_start',
  'payment_success',
  'payment_fail',
  'recharge_start',
  'recharge_success',
  'signup',
  'login',
  'search',
  'click',
  'support_open',
  'ticket_submit',
  'onboarding_start',
  'onboarding_skip',
  'onboarding_done',
  'page_leave',
  'scroll_depth',
  'rage_click',
  'js_error',
  'oauth_start',
] as const;

/** 下单漏斗定义 */
/** 安全解析 props（埋点字段是 JSON 字符串） */
const parseProps = (e: { props?: string }): any => {
  try {
    return JSON.parse(e.props || '{}');
  } catch {
    return {};
  }
};

const FUNNEL = [
  { key: 'product_view', label: '浏览商品' },
  { key: 'add_to_cart', label: '加入购物车' },
  { key: 'checkout_start', label: '进入结算' },
  { key: 'checkout_submit', label: '提交订单' },
  { key: 'payment_success', label: '支付成功' },
];

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly events: Repository<AnalyticsEvent>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async track(
    data: {
      name: string;
      anonId?: string;
      sessionId?: string;
      path?: string;
      referrer?: string;
      props?: Record<string, unknown>;
      device?: string;
    },
    ctx: { userId: number | null; ip: string; ua: string },
  ) {
    if (!data?.name) return { ok: false };
    await this.events.save(
      this.events.create({
        name: String(data.name).slice(0, 40),
        userId: ctx.userId,
        anonId: (data.anonId || '').slice(0, 40),
        sessionId: (data.sessionId || '').slice(0, 40),
        path: (data.path || '').slice(0, 200),
        referrer: (data.referrer || '').slice(0, 200),
        device: (data.device || '').slice(0, 20),
        props: JSON.stringify(data.props ?? {}).slice(0, 2000),
        ip: ctx.ip.slice(0, 60),
        userAgent: ctx.ua.slice(0, 200),
      }),
    );
    return { ok: true };
  }

  /** 后台总览：PV/UV/事件分布/漏斗/热门商品/来源/设备/近 14 天趋势 */
  async overview(days = 14) {
    const since = new Date(Date.now() - days * 86400000);
    const all = await this.events.find({ order: { id: 'DESC' }, take: 20000 });
    const rows = all.filter((e) => new Date(e.createdAt) >= since);

    const visitorKey = (e: AnalyticsEvent) =>
      e.userId ? `u${e.userId}` : `a${e.anonId || e.ip}`;

    const pv = rows.filter((e) => e.name === 'page_view').length;
    const uv = new Set(rows.map(visitorKey)).size;
    const sessions = new Set(rows.map((e) => e.sessionId).filter(Boolean)).size;

    const byName: Record<string, number> = {};
    for (const e of rows) byName[e.name] = (byName[e.name] || 0) + 1;

    // 漏斗：按访客去重
    const funnel = FUNNEL.map((step) => ({
      key: step.key,
      label: step.label,
      users: new Set(rows.filter((e) => e.name === step.key).map(visitorKey)).size,
    }));
    const top = funnel[0]?.users || 0;
    const funnelWithRate = funnel.map((f, i) => ({
      ...f,
      rate: top ? Math.round((f.users / top) * 100) : 0,
      dropFromPrev:
        i === 0 || !funnel[i - 1].users
          ? 0
          : Math.round((1 - f.users / funnel[i - 1].users) * 100),
    }));

    // 商品热度
    const productHits: Record<string, { views: number; carts: number; buys: number }> = {};
    for (const e of rows) {
      let props: any = {};
      try {
        props = JSON.parse(e.props || '{}');
      } catch {
        props = {};
      }
      const title = props.productTitle || props.slug;
      if (!title) continue;
      productHits[title] ||= { views: 0, carts: 0, buys: 0 };
      if (e.name === 'product_view') productHits[title].views++;
      if (e.name === 'add_to_cart') productHits[title].carts++;
      if (e.name === 'payment_success') productHits[title].buys++;
    }
    const topProducts = Object.entries(productHits)
      .map(([title, v]) => ({ title, ...v }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8);

    // 页面 Top
    const pageHits: Record<string, number> = {};
    for (const e of rows.filter((x) => x.name === 'page_view')) {
      pageHits[e.path || '/'] = (pageHits[e.path || '/'] || 0) + 1;
    }
    const topPages = Object.entries(pageHits)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // 设备与来源
    const devices: Record<string, number> = {};
    const referrers: Record<string, number> = {};
    for (const e of rows) {
      devices[e.device || 'unknown'] = (devices[e.device || 'unknown'] || 0) + 1;
      const ref = e.referrer ? new URL(e.referrer, 'http://x').host || 'direct' : 'direct';
      referrers[ref] = (referrers[ref] || 0) + 1;
    }

    // 趋势
    const trend = Array.from({ length: days }, (_, i) => {
      const day = new Date(Date.now() - (days - 1 - i) * 86400000);
      const key = day.toISOString().slice(0, 10);
      const dayRows = rows.filter(
        (e) => new Date(e.createdAt).toISOString().slice(0, 10) === key,
      );
      return {
        date: key,
        pv: dayRows.filter((e) => e.name === 'page_view').length,
        uv: new Set(dayRows.map(visitorKey)).size,
        orders: dayRows.filter((e) => e.name === 'payment_success').length,
      };
    });

    /* ===== 参与度：停留时长 / 滚动深度 / 退出页 / 跳出率 ===== */
    const leaves = rows.filter((e) => e.name === 'page_leave').map((e) => ({
      e,
      p: parseProps(e),
    }));
    const dwellByPath: Record<string, { total: number; n: number }> = {};
    const exitHits: Record<string, number> = {};
    let dwellSum = 0;
    for (const { e, p } of leaves) {
      const path = String(p.path || e.path || '/');
      const ms = Number(p.dwellMs) || 0;
      dwellSum += ms;
      dwellByPath[path] ||= { total: 0, n: 0 };
      dwellByPath[path].total += ms;
      dwellByPath[path].n++;
      if (p.reason === 'exit') exitHits[path] = (exitHits[path] || 0) + 1;
    }
    const avgDwellSec = leaves.length ? Math.round(dwellSum / leaves.length / 1000) : 0;

    // 跳出率：只看过一个页面就走的会话占比
    const sessionPages: Record<string, Set<string>> = {};
    for (const e of rows.filter((x) => x.name === 'page_view')) {
      const s = e.sessionId || `a${e.anonId}`;
      (sessionPages[s] ||= new Set()).add(e.path || '/');
    }
    const sessList = Object.values(sessionPages);
    const bounceRate = sessList.length
      ? Math.round((sessList.filter((s) => s.size <= 1).length / sessList.length) * 1000) / 10
      : 0;

    // 滚动深度分布
    const scrollDist: Record<string, number> = { '25': 0, '50': 0, '75': 0, '100': 0 };
    for (const e of rows.filter((x) => x.name === 'scroll_depth')) {
      const d = String(parseProps(e).depth ?? '');
      if (d in scrollDist) scrollDist[d]++;
    }

    const engagement = {
      avgDwellSec,
      bounceRate,
      scrollDist: Object.entries(scrollDist).map(([depth, count]) => ({ depth, count })),
      dwellByPage: Object.entries(dwellByPath)
        .map(([path, v]) => ({ path, avgSec: Math.round(v.total / v.n / 1000), views: v.n }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 8),
      exitPages: Object.entries(exitHits)
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    };

    /* ===== 搜索词 ===== */
    const terms: Record<string, number> = {};
    for (const e of rows.filter((x) => x.name === 'search')) {
      const q = String(parseProps(e).q || parseProps(e).query || '').trim().toLowerCase();
      if (q) terms[q] = (terms[q] || 0) + 1;
    }
    const searchTerms = Object.entries(terms)
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    /* ===== 注册/登录来源（密码 vs Google/GitHub/Microsoft）===== */
    const authSrc: Record<string, { logins: number; signups: number }> = {};
    for (const e of rows) {
      if (e.name !== 'login' && e.name !== 'signup' && e.name !== 'oauth_start') continue;
      const p = parseProps(e);
      const m = String(p.method || p.provider || 'password');
      authSrc[m] ||= { logins: 0, signups: 0 };
      if (e.name === 'login') authSrc[m].logins++;
      if (e.name === 'signup') authSrc[m].signups++;
    }
    const authSources = Object.entries(authSrc)
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.logins + b.signups - (a.logins + a.signups));

    /* ===== 前端异常 & 暴力点击（可用性问题定位）===== */
    const errAgg: Record<string, { count: number; path: string }> = {};
    for (const e of rows.filter((x) => x.name === 'js_error')) {
      const p = parseProps(e);
      const key = String(p.message || 'unknown').slice(0, 80);
      errAgg[key] ||= { count: 0, path: String(p.path || e.path || '') };
      errAgg[key].count++;
    }
    const errors = Object.entries(errAgg)
      .map(([message, v]) => ({ message, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const rageAgg: Record<string, number> = {};
    for (const e of rows.filter((x) => x.name === 'rage_click')) {
      const p = parseProps(e);
      const key = `${p.path || e.path} · ${p.label || p.tag || ''}`;
      rageAgg[key] = (rageAgg[key] || 0) + 1;
    }
    const rageClicks = Object.entries(rageAgg)
      .map(([where, count]) => ({ where, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      range: { days, since: since.toISOString() },
      totals: {
        pv,
        uv,
        sessions,
        events: rows.length,
        conversion: top
          ? Math.round(
              ((funnel[funnel.length - 1]?.users || 0) / top) * 1000,
            ) / 10
          : 0,
        avgDwellSec,
        bounceRate,
      },
      byName: Object.entries(byName)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      funnel: funnelWithRate,
      topProducts,
      topPages,
      devices: Object.entries(devices).map(([k, v]) => ({ name: k, count: v })),
      referrers: Object.entries(referrers)
        .map(([k, v]) => ({ name: k, count: v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      trend,
      engagement,
      searchTerms,
      authSources,
      errors,
      rageClicks,
    };
  }

  /** 原始事件流 */
  async list(q: { name?: string; userId?: number; page?: number; pageSize?: number }) {
    const page = Math.max(1, q.page || 1);
    const pageSize = Math.min(100, q.pageSize || 30);
    const where: any = {};
    if (q.name) where.name = q.name;
    if (q.userId) where.userId = q.userId;
    const [items, total] = await this.events.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const userIds = [...new Set(items.map((x) => x.userId).filter(Boolean))] as number[];
    const users = userIds.length ? await this.users.findByIds(userIds) : [];
    const emailMap = new Map(users.map((u) => [u.id, u.email]));
    return {
      total,
      page,
      pageSize,
      items: items.map((e) => ({
        ...e,
        userEmail: e.userId ? emailMap.get(e.userId) ?? '-' : null,
        props: (() => {
          try {
            return JSON.parse(e.props || '{}');
          } catch {
            return {};
          }
        })(),
      })),
    };
  }

  /** 单用户行为轨迹（含画像统计） */
  async userTrail(userId: number) {
    const user = await this.users.findOneBy({ id: userId });
    const rows = await this.events.find({
      where: { userId },
      order: { id: 'DESC' },
      take: 200,
    });
    const byName: Record<string, number> = {};
    for (const e of rows) byName[e.name] = (byName[e.name] || 0) + 1;
    return {
      user: user
        ? {
            id: user.id,
            email: user.email,
            nickname: user.nickname,
            // 等级要按「人工覆盖 → 否则按成长值算」，不能只看 levelOverride
            level: effectiveLevel(user),
            balance: user.balance,
            growthUsd: user.growthUsd,
            provider: user.provider || 'local', // 注册来源：local / google / github / microsoft
            status: user.status,
            createdAt: user.createdAt,
          }
        : null,
      stats: {
        events: rows.length,
        firstSeen: rows.length ? rows[rows.length - 1].createdAt : null,
        lastSeen: rows.length ? rows[0].createdAt : null,
        byName: Object.entries(byName).map(([name, count]) => ({ name, count })),
      },
      trail: rows.map((e) => ({
        id: e.id,
        name: e.name,
        path: e.path,
        device: e.device,
        createdAt: e.createdAt,
        props: (() => {
          try {
            return JSON.parse(e.props || '{}');
          } catch {
            return {};
          }
        })(),
      })),
    };
  }
}

/** 公开上报端点（带 JWT 时自动关联用户） */
@Controller('track')
export class TrackController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly jwt: JwtService,
  ) {}

  @Post()
  track(@Body() body: any, @Req() req: Request) {
    let userId: number | null = null;
    const header = (req.headers['authorization'] as string) || '';
    if (header.startsWith('Bearer ')) {
      try {
        userId = this.jwt.verify<JwtUser>(header.slice(7)).sub;
      } catch {
        userId = null;
      }
    }
    const ip =
      ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '';
    const ua = (req.headers['user-agent'] as string) || '';
    // 支持批量上报
    const items = Array.isArray(body?.events) ? body.events : [body];
    return Promise.all(
      items.slice(0, 20).map((e: any) => this.analytics.track(e, { userId, ip, ua })),
    ).then(() => ({ ok: true }));
  }
}

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
@Roles('admin', 'super')
export class AnalyticsAdminController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @Perm('analytics')
  overview(@Query('days') days?: string) {
    return this.analytics.overview(Math.min(90, Number(days) || 14));
  }

  @Get('events')
  @Perm('analytics')
  list(
    @Query('name') name?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.analytics.list({
      name: name || undefined,
      userId: Number(userId) || undefined,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 30,
    });
  }

  @Get('user/:id')
  @Perm('analytics')
  userTrail(@Query('id') _q: string, @Req() req: Request) {
    const id = Number(req.params.id);
    return this.analytics.userTrail(id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEvent, User])],
  providers: [AnalyticsService],
  controllers: [TrackController, AnalyticsAdminController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
