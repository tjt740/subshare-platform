import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from './api';

export interface Profile {
  id: number;
  email: string;
  nickname?: string;
  avatar?: string;
  avatarFrame?: string;
  level?: number;
  levels?: { lv: number; need: number }[];
  growthUsd?: number;
  nextLevelAt?: number | null;
  role: string;
  balance: number;
  createdAt: string;
}

export interface CartItem {
  planId: number;
  productTitle: string;
  planName: string;
  periodMonths: number;
  category: string;
}

interface AppState {
  siteCfg: any;
  token: string | null;
  user: Profile | null;
  region: string;
  setRegion: (r: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  /** 第三方登录回调：直接注入后端签发的 JWT 并拉取用户资料 */
  applyToken: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => void;
  // 购物车
  cart: CartItem[];
  addToCart: (item: CartItem) => boolean;
  removeFromCart: (planId: number) => void;
  clearCart: () => void;
}

const Ctx = createContext<AppState>(null as unknown as AppState);

function loadCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem('ss_cart') || '[]');
  } catch {
    return [];
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('ss_token'),
  );
  const [user, setUser] = useState<Profile | null>(null);
  const [region, setRegionState] = useState<string>(
    () => localStorage.getItem('ss_region') || 'US',
  );
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [siteCfg, setSiteCfg] = useState<any>({});

  // 站点配置：后台「站点设置」可实时修改前台文案
  useEffect(() => {
    fetch('/api/site-config')
      .then((r) => r.json())
      .then(setSiteCfg)
      .catch(() => undefined);
  }, []);

  // 后台站点编辑器实时预览：仅影响当前 iframe 内存状态，不写数据库、不发布。
  useEffect(() => {
    const onPreview = (event: MessageEvent) => {
      const allowed =
        event.origin === window.location.origin ||
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(event.origin);
      if (!allowed || event.data?.type !== 'SUBSHARE_SITE_PREVIEW') return;
      const config = event.data?.config;
      if (config && typeof config === 'object' && !Array.isArray(config)) {
        setSiteCfg(config);
      }
    };
    window.addEventListener('message', onPreview);
    return () => window.removeEventListener('message', onPreview);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    api<Profile>('/auth/me', { token })
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('ss_token');
        setToken(null);
      });
  }, [token]);

  const setRegion = useCallback((r: string) => {
    localStorage.setItem('ss_region', r);
    localStorage.setItem('ss_region_manual', '1'); // 手动选择后不再跟随 IP
    setRegionState(r);
  }, []);

  // 默认跟随 IP/地区（用户手动切换过则不覆盖）
  useEffect(() => {
    const handler = (e: Event) => {
      const suggested = (e as CustomEvent).detail as string;
      if (!localStorage.getItem('ss_region_manual') && suggested) {
        localStorage.setItem('ss_region', suggested);
        setRegionState(suggested);
      }
    };
    window.addEventListener('ss-geo-region', handler);
    return () => window.removeEventListener('ss-geo-region', handler);
  }, []);

  const applyAuth = (data: { token: string; user: Profile }) => {
    localStorage.setItem('ss_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const login = useCallback(async (email: string, password: string) => {
    applyAuth(
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    );
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    applyAuth(
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    );
  }, []);

  /** OAuth 回调用：token 由后端签发，落库后拉一次 /auth/me */
  const applyToken = useCallback(async (t: string) => {
    localStorage.setItem('ss_token', t);
    setToken(t);
    const profile = await api<Profile>('/auth/me', { token: t });
    setUser(profile);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('ss_token');
    // 清空购物车：避免共享/公用设备上下一位登录者继承上一位的购物车（错误下单+隐私）
    localStorage.removeItem('ss_cart');
    setCart([]);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(() => {
    const t = localStorage.getItem('ss_token');
    if (!t) return;
    api<Profile>('/auth/me', { token: t })
      .then(setUser)
      .catch(() => undefined);
  }, []);

  // ---------- 购物车（本地持久化，价格结算时实时报价） ----------
  const persistCart = (items: CartItem[]) => {
    localStorage.setItem('ss_cart', JSON.stringify(items));
    setCart(items);
  };
  const addToCart = useCallback(
    (item: CartItem) => {
      const exists = loadCart().some((c) => c.planId === item.planId);
      if (exists) return false;
      persistCart([...loadCart(), item]);
      return true;
    },
    [],
  );
  const removeFromCart = useCallback((planId: number) => {
    persistCart(loadCart().filter((c) => c.planId !== planId));
  }, []);
  const clearCart = useCallback(() => persistCart([]), []);

  const value = useMemo(
    () => ({
      siteCfg,
      token, user, region, setRegion, login, register, applyToken, logout, refreshUser,
      cart, addToCart, removeFromCart, clearCart,
    }),
    [siteCfg, token, user, region, setRegion, login, register, applyToken, logout, refreshUser, cart, addToCart, removeFromCart, clearCart],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);
