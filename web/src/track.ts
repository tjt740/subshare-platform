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

/** 页面浏览 */
export function trackPageView(extra: Record<string, unknown> = {}) {
  track('page_view', { title: document.title, ...extra });
}

/** 全局初始化：自动点击埋点 + 卸载兜底 */
export function initTracking() {
  // 点击埋点：任何带 data-track="事件名" 的元素
  document.addEventListener(
    'click',
    (e) => {
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

  // 页面隐藏/卸载时兜底发送
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
  window.addEventListener('pagehide', () => flush(true));
}
