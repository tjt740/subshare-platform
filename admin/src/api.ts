const TOKEN_KEY = 'ss_admin_token';
const USER_KEY = 'ss_admin_user';

export interface AdminProfile {
  id: number;
  email: string;
  role: 'admin' | 'super' | 'supplier' | 'user';
  permissions: string[];
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) => {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};
export const getProfile = (): AdminProfile | null => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
};
export const setProfile = (p: AdminProfile | null) => {
  if (p) localStorage.setItem(USER_KEY, JSON.stringify(p));
  else localStorage.removeItem(USER_KEY);
};

export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    setToken(null);
    setProfile(null);
    window.location.reload();
  }
  if (!res.ok) {
    const message = Array.isArray((data as any)?.message)
      ? (data as any).message[0]
      : (data as any)?.message || `请求失败 (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export const REGIONS = ['GLOBAL', 'US', 'EU', 'CN'];
export const CURRENCIES = ['USD', 'EUR', 'CNY'];

export const ORDER_STATUS: Record<string, { text: string; color: string }> = {
  created: { text: '待支付', color: 'orange' },
  paid: { text: '已支付', color: 'blue' },
  allocating: { text: '排队分配中', color: 'gold' },
  delivered: { text: '已交付', color: 'green' },
  refunded: { text: '已退款', color: 'red' },
  canceled: { text: '已取消', color: 'default' },
};

export const TICKET_STATUS: Record<string, { text: string; color: string }> = {
  open: { text: '待处理', color: 'orange' },
  answered: { text: '已回复', color: 'green' },
  closed: { text: '已关闭', color: 'default' },
};

export const TICKET_CATEGORY: Record<string, { text: string; color: string }> = {
  general: { text: '咨询', color: 'default' },
  aftersales_reissue: { text: '售后·补发', color: 'orange' },
  aftersales_refund: { text: '售后·退款', color: 'red' },
  aftersales_swap: { text: '售后·换车', color: 'blue' },
};

export const SUBMISSION_STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
};

/** 与后端 ADMIN_PERMISSIONS 对应 */
export const PERM_OPTIONS = [
  { value: 'dashboard', label: '数据看板' },
  { value: 'products', label: '商品与定价' },
  { value: 'inventory', label: '库存账号池' },
  { value: 'orders', label: '订单管理' },
  { value: 'users', label: '用户管理' },
  { value: 'tickets', label: '客服工单' },
  { value: 'suppliers', label: '供应商审核' },
  { value: 'settings', label: '站点设置' },
  { value: 'analytics', label: '数据埋点' },
];
