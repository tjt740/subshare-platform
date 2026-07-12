/** 极简 API 客户端：自动携带 token，统一错误处理 */
export async function api<T = any>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...rest } = options;
  const res = await fetch(`/api${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = Array.isArray(data?.message)
      ? data.message[0]
      : data?.message || `请求失败 (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  EUR: '€',
  CNY: '¥',
};

export const REGION_OPTIONS = [
  { value: 'US', label: '🇺🇸 美国 / USD' },
  { value: 'EU', label: '🇪🇺 欧洲 / EUR' },
  { value: 'CN', label: '🇨🇳 中国 / CNY' },
];

export function money(amount: number | null, currency: string | null) {
  if (amount == null || !currency) return '-';
  return `${CURRENCY_SYMBOL[currency] ?? currency + ' '}${amount.toFixed(2)}`;
}

/** 与后端 FX_TO_USD 保持一致（演示用固定汇率） */
export const FX_TO_USD: Record<string, number> = { USD: 1, EUR: 1.08, CNY: 0.14 };
export const toUsd = (amount: number, currency: string) =>
  Math.round(amount * (FX_TO_USD[currency] ?? 1) * 100) / 100;

export const ORDER_STATUS_TEXT: Record<string, string> = {
  created: '待支付',
  paid: '已支付',
  allocating: '排队分配中',
  delivered: '已交付',
  refunded: '已退款',
  canceled: '已取消',
};

export const TICKET_STATUS_TEXT: Record<string, string> = {
  open: '处理中',
  answered: '客服已回复',
  closed: '已关闭',
};

export const PROVIDERS = [
  { value: 'mock-card', icon: 'card' as const, name: '银行卡', desc: 'Visa / Mastercard' },
  { value: 'mock-alipay', icon: 'alipay' as const, name: '支付宝', desc: '扫码支付' },
  { value: 'mock-usdt', icon: 'crypto' as const, name: 'USDT', desc: 'TRC20 / ERC20' },
];

export const CATEGORY_ICON: Record<string, string> = {
  流媒体: '🎬',
  音乐: '🎵',
  'AI 工具': '🤖',
  办公: '💼',
  学习: '📚',
  游戏: '🎮',
};
/* Supari 式明快色块（卡片横幅底色） */
export const CATEGORY_TINT: Record<string, [string, string]> = {
  流媒体: ['#fb9920', '#fb9920'],
  音乐: ['#5fc27e', '#5fc27e'],
  'AI 工具': ['#8f7bf1', '#8f7bf1'],
  办公: ['#4fb8d8', '#4fb8d8'],
  学习: ['#ffcf3f', '#ffcf3f'],
  游戏: ['#ff5d8f', '#ff5d8f'],
};

export function starStr(rating: number) {
  const full = Math.round(rating);
  return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
}

export function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('zh-CN');
}
export function fmtTime(d: string | Date) {
  return new Date(d).toLocaleString('zh-CN', { hour12: false });
}
