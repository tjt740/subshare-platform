/**
 * 前端埋点 SDK（零依赖）
 * - 自动：PV（路由变化）、点击（带 data-track 的元素）、会话/匿名 ID、设备类型、来源
 * - 手动：track('add_to_cart', { productTitle, planId, price })
 * - 批量上报（2 秒合批 + 页面隐藏时 sendBeacon 兜底）
 */

const ANON_KEY = 'ss_anon_id';
const SESSION_KEY = 'ss_session_id';
const SESSION_TS = 'ss_session_ts';
const SESSION_TTL = 30 * 60 * 1000; // 30 分钟无操作视为新会话

const uid = () =>
  `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

function anonId() {
  let v = localStorage.getItem(ANON_KEY);
  if (!v) {
    v = uid();
    localStorage.setItem(ANON_KEY, v);
  }
  return v;
}

function sessionId() {
  const now = Date.now();
  const last = Number(sessionStorage.getItem(SESSION_TS) || 0);
  let v = sessionStorage.getItem(SESSION_KEY);
  if (!v || now - last > SESSION_TTL) {
    v = uid();
    sessionStorage.setItem(SESSION_KEY, v);
  }
  sessionStorage.setItem(SESSION_TS, String(now));
  return v;
}

function deviceType() {
  const w = window.innerWidth;
  if (w < 640) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

type Ev = {
  name: string;
  anonId: string;
  sessionId: string;
  path: string;
  referrer: string;
  device: string;
  props: Record<string, unknown>;
};

let queue: Ev[] = [];
let timer: number | undefined;

function flush(useBeacon = false) {
  if (queue.length === 0) return;
  const body = JSON.stringify({ events: queue });
  queue = [];
  const token = localStorage.getItem('ss_token');

  if (useBeacon && navigator.sendBeacon) {
    // 页面卸载：Beacon 不支持自定义头，userId 由服务端按匿名 ID 归并
    navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    return;
  }
  fetch('/api/track', {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  }).catch(() => undefined);
}

/** 上报一个事件 */
export function track(name: string, props: Record<string, unknown> = {}) {
  try {
    queue.push({
      name,
      anonId: anonId(),
      sessionId: sessionId(),
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || '',
      device: deviceType(),
      props,
    });
    if (queue.length >= 10) {
      flush();
      return;
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(() => flush(), 2000);
  } catch {
    /* 埋点失败不影响业务 */
  }
}

/* ============ 页面停留 / 滚动深度 / 退出页 ============ */
let pageEnteredAt = Date.now();
let pageActiveMs = 0;      // 只累计「可见」时长，切后台不计入
let lastResume = Date.now();
let currentPath = typeof location !== 'undefined' ? location.pathname : '/';
let maxScrollPct = 0;
const scrollMarks = new Set<number>(); // 25/50/75/100 只报一次

function scrollPct() {
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 100;
  return Math.min(100, Math.round(((window.scrollY || 0) / scrollable) * 100));
}

let pageClosed = false; // 防止 visibilitychange + pagehide 重复结算

/** 结束上一个页面：发送停留时长 + 滚动深度（page_leave 也是退出页统计的依据） */
function closePage(reason: 'route' | 'exit') {
  if (pageClosed) return;
  pageClosed = true;
  if (document.visibilityState === 'visible') {
    pageActiveMs += Date.now() - lastResume;
  }
  const dwellMs = pageActiveMs;
  if (dwellMs < 300 && maxScrollPct === 0) return; // 一闪而过的中间态不记
  track('page_leave', {
    path: currentPath,
    dwellMs,
    dwellSec: Math.round(dwellMs / 1000),
    scrollPct: maxScrollPct,
    reason, // exit = 关闭/离开站点（退出页），route = 站内跳转
  });
}

/** 页面浏览（路由变化时调用；内部会先结算上一页的停留与滚动） */
export function trackPageView(extra: Record<string, unknown> = {}) {
  const path = window.location.pathname + window.location.search;
  if (path !== currentPath) {
    closePage('route');
    currentPath = path;
  }
  pageEnteredAt = Date.now();
  lastResume = Date.now();
  pageActiveMs = 0;
  maxScrollPct = 0;
  pageClosed = false;
  scrollMarks.clear();
  track('page_view', { title: document.title, ...extra });
}

/** 全局初始化：点击 / 滚动深度 / 停留 / 错误 / 暴力点击 / 卸载兜底 */
export function initTracking() {
  currentPath = window.location.pathname + window.location.search;

  // ---- 点击埋点：任何带 data-track 的元素 ----
  let lastClick = { x: 0, y: 0, t: 0, n: 0 };
  document.addEventListener(
    'click',
    (e) => {
      // 「暴力点击」：同一位置 1 秒内连点 ≥4 次 —— 通常意味着某处点了没反应
      const me = e as MouseEvent;
      const near =
        Math.abs(me.clientX - lastClick.x) < 24 && Math.abs(me.clientY - lastClick.y) < 24;
      lastClick = {
        x: me.clientX,
        y: me.clientY,
        t: Date.now(),
        n: near && Date.now() - lastClick.t < 1000 ? lastClick.n + 1 : 1,
      };
      if (lastClick.n === 4) {
        const el = e.target as HTMLElement;
        track('rage_click', {
          path: currentPath,
          tag: el?.tagName,
          label: el?.textContent?.trim().slice(0, 40),
        });
      }

      const el = (e.target as HTMLElement)?.closest?.('[data-track]') as HTMLElement | null;
      if (!el) return;
      const name = el.dataset.track || 'click';
      let props: Record<string, unknown> = {};
      if (el.dataset.trackProps) {
        try {
          props = JSON.parse(el.dataset.trackProps);
        } catch {
          props = { raw: el.dataset.trackProps };
        }
      }
      track(name, {
        label: el.dataset.trackLabel || el.textContent?.trim().slice(0, 40),
        ...props,
      });
    },
    { capture: true, passive: true },
  );

  // ---- 滚动深度：25/50/75/100 各上报一次（rAF 节流，不阻塞滚动）----
  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const p = scrollPct();
        if (p > maxScrollPct) maxScrollPct = p;
        for (const mark of [25, 50, 75, 100]) {
          if (p >= mark && !scrollMarks.has(mark)) {
            scrollMarks.add(mark);
            track('scroll_depth', { path: currentPath, depth: mark });
          }
        }
      });
    },
    { passive: true },
  );

  // ---- 前端异常：JS 错误 + 未捕获 Promise ----
  window.addEventListener('error', (e) => {
    track('js_error', {
      path: currentPath,
      message: String(e.message || '').slice(0, 200),
      source: `${e.filename || ''}:${e.lineno || 0}`,
    });
  });
  window.addEventListener('unhandledrejection', (e) => {
    track('js_error', {
      path: currentPath,
      kind: 'promise',
      message: String((e as PromiseRejectionEvent).reason ?? '').slice(0, 200),
    });
  });

  // ---- 可见性：只累计真正停留的时间 ----
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      pageActiveMs += Date.now() - lastResume;
      closePage('exit');
      flush(true);
    } else {
      // 回到本页：开启新的停留计时片段
      lastResume = Date.now();
      pageClosed = false;
    }
  });
  window.addEventListener('pagehide', () => {
    closePage('exit');
    flush(true);
  });
}

/** 供业务侧读取：当前页已停留秒数 */
export const dwellSeconds = () => Math.round((Date.now() - pageEnteredAt) / 1000);
