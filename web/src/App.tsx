import React, { useState } from 'react';
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { useApp } from './store';
import { useI18n } from './i18n';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import Checkout from './pages/Checkout';
import Cart from './pages/Cart';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import Pay from './pages/Pay';
import Account from './pages/Account';
import Legal from './pages/Legal';
import Forgot from './pages/Forgot';
import OAuthCallback from './pages/OAuthCallback';
import Avatar from './components/Avatar';
import Icon from './components/Icon';
import Onboarding, { openOnboarding } from './components/Onboarding';
import { track, trackPageView } from './track';
import SupportWidget from './components/SupportWidget';
import NotifBell from './components/NotifBell';
import SiteBackground from './components/SiteBackground';
import {
  BootSplash,
  Cursor,
  Marquee,
  StatusClock,
  ThemePicker,
} from './components/fx';

/**
 * URL 语言切换：/zh /en 前缀 = 手动锁定语言；/auto = 恢复跟随 IP/地区。
 * 例：/zh/cart -> 锁定中文并跳转 /cart；无前缀时语言自动跟随地区。
 */
function LocalePath() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setPref } = useI18n();
  React.useEffect(() => {
    const m = location.pathname.match(/^\/(zh|en|auto)(\/|$)/);
    if (!m) return;
    setPref(m[1] === 'auto' ? 'auto' : (m[1] as 'zh' | 'en'));
    const rest =
      location.pathname.slice(m[0].length - (m[2] === '/' ? 1 : 0)) || '/';
    navigate(rest + location.search, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  return null;
}

const sc = (v: any, fb: string) => (typeof v === 'string' && v.trim() ? v : fb);

function Header() {
  const { user, region, setRegion, logout, cart, siteCfg } = useApp();
  const { t, tList } = useI18n();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const regionOptions = [
    { value: 'US', label: t('region.us') },
    { value: 'EU', label: t('region.eu') },
    { value: 'CN', label: t('region.cn') },
  ];
  return (
    <>
      <Marquee
        items={
          Array.isArray(siteCfg?.announce) && siteCfg.announce.length
            ? siteCfg.announce
            : tList('announce.items')
        }
        className="announce"
      />
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="SubShare 首页" data-track="click" data-track-label="logo">
            <span className="brand-mark" aria-hidden>S</span>
            <span className="brand-name">
              <span className="bn-base">SubShare</span>
              <span className="bn-shine" aria-hidden>SubShare</span>
            </span>
          </Link>
          <nav className="nav" aria-label="主导航">
            <Link to="/">{t('nav.products')}</Link>
            <Link to="/account">{t('nav.subs')}</Link>
            <Link to="/account?tab=wallet">{t('nav.wallet')}</Link>
          </nav>
          <div className="header-right">
            {user && <NotifBell />}
            <Link to="/cart" className="cart-btn" aria-label={`${t('tabbar.cart')}（${cart.length}）`}>
              <Icon name="cart" size={18} />
              {cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
            </Link>
            {/* 桌面端完整控件 */}
            <span className="desk-only"><ThemePicker /></span>
            <select
              className="region-select desk-only"
              value={region}
              aria-label="选择地区与币种"
              onChange={(e) => setRegion(e.target.value)}
            >
              {regionOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {user ? (
              <>
                <span
                  className="balance-pill desk-only"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/account?tab=wallet')}
                  onKeyDown={(e) => e.key === 'Enter' && navigate('/account?tab=wallet')}
                >
                  <Icon name="wallet" size={14} /> ${user.balance.toFixed(2)}
                </span>
                {/* 用户入口（移动端也保留） */}
                <button
                  className={`user-email lv-name lv${user.level ?? 1}`}
                  aria-label="个人中心"
                  onClick={() => navigate('/account?tab=profile')}
                >
                  <Avatar value={user.avatar} frame={user.avatarFrame} size={30} className={`lv${user.level ?? 1}`} />
                  <span className="uname desk-only">{user.nickname || user.email}</span>
                  <b className={`lv-badge lv${user.level ?? 1}`}>LV{user.level ?? 1}</b>
                </button>
                <button className="btn btn-ghost btn-sm desk-only" onClick={logout}>
                  {t('auth.logout')}
                </button>
              </>
            ) : (
              <div className="auth-buttons desk-only">
                <Link className="btn btn-ghost btn-sm" to="/login">{t('auth.login')}</Link>
                <Link className="btn btn-primary btn-sm" to="/register">{t('auth.register')}</Link>
              </div>
            )}
            {/* 移动端菜单按钮 */}
            <button
              className="menu-btn mob-only"
              aria-label={t('nav.menu')}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Icon name={menuOpen ? 'close' : 'menu'} size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* 移动端菜单抽屉：地区/主题/登录退出/条款 */}
      {menuOpen && (
        <>
          <div className="menu-mask" onClick={() => setMenuOpen(false)} />
          <div className="menu-sheet" role="dialog" aria-label={t('nav.menu')}>
            <div className="ms-row">
              <span>地区 / 币种</span>
              <select
                className="region-select"
                value={region}
                aria-label="选择地区与币种"
                onChange={(e) => setRegion(e.target.value)}
              >
                {regionOptions.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="ms-row">
              <span>界面主题</span>
              <ThemePicker />
            </div>
            {user ? (
              <>
                <div className="ms-row">
                  <span>钱包余额</span>
                  <b>${user.balance.toFixed(2)}</b>
                </div>
                <button className="btn btn-ghost btn-block" onClick={() => { setMenuOpen(false); logout(); }}>
                  {t('auth.logout')}
                </button>
              </>
            ) : (
              <div className="ms-actions">
                <Link className="btn btn-ghost" to="/login" onClick={() => setMenuOpen(false)}>{t('auth.login')}</Link>
                <Link className="btn btn-primary" to="/register" onClick={() => setMenuOpen(false)}>{t('auth.register')}</Link>
              </div>
            )}
            <div className="ms-legal">
              <a href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); openOnboarding(); }}>新手引导</a>
              <Link to="/legal/terms" onClick={() => setMenuOpen(false)}>{t('legal.terms')}</Link>
              <Link to="/legal/privacy" onClick={() => setMenuOpen(false)}>{t('legal.privacy')}</Link>
              <Link to="/legal/refund" onClick={() => setMenuOpen(false)}>{t('legal.refund')}</Link>
              <Link to="/legal/about" onClick={() => setMenuOpen(false)}>{t('legal.about')}</Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function MobileTabbar() {
  const location = useLocation();
  const [params] = useSearchParams();
  const { cart } = useApp();
  const { t } = useI18n();
  const tab = params.get('tab');
  const isAccount = location.pathname === '/account';
  const tabs = [
    { to: '/', icon: 'home' as const, label: t('tabbar.home'), active: location.pathname === '/' },
    { to: '/cart', icon: 'cart' as const, label: t('tabbar.cart'), active: location.pathname === '/cart', badge: cart.length },
    { to: '/account', icon: 'box' as const, label: t('tabbar.subs'), active: isAccount && !tab },
    { to: '/account?tab=wallet', icon: 'wallet' as const, label: t('tabbar.wallet'), active: isAccount && tab === 'wallet' },
  ];
  return (
    <nav className="mobile-tabbar">
      {tabs.map((x) => (
        <Link key={x.label} to={x.to} className={`mtab ${x.active ? 'active' : ''}`}>
          <span className="mi">
            <Icon name={x.icon} size={20} />
            {!!x.badge && <span className="cart-badge">{x.badge}</span>}
          </span>
          {x.label}
        </Link>
      ))}
    </nav>
  );
}

/** 媒体查询 hook（用于移动端折叠页脚） */
function useMedia(query: string) {
  const [match, setMatch] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/**
 * 页脚分栏：桌面端保持四栏平铺；
 * 移动端折叠成手风琴（默认收起，只留一行标题），大幅压缩底部占位
 */
function FootCol({
  title,
  mobile,
  children,
}: {
  title: string;
  mobile: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="foot-col" open={!mobile}>
      <summary>
        <h4>{title}</h4>
        <span className="foot-caret" aria-hidden>
          <Icon name="chevron-down" size={15} />
        </span>
      </summary>
      <div className="foot-body">{children}</div>
    </details>
  );
}

function Footer() {
  const { t } = useI18n();
  const { siteCfg } = useApp();
  const f = siteCfg?.footer ?? {};
  const mobile = useMedia('(max-width: 760px)');

  return (
    <footer className="site-footer">
      <div className="footer-mega">SubShare✺</div>
      <Marquee
        items={['STREAM', 'MUSIC', 'AI TOOLS', 'OFFICE', 'SHARE THE PREMIUM', 'PAY LESS']}
        className="announce"
        reverse
      />
      <div className="container footer-inner">
        <FootCol title={t('footer.about')} mobile={mobile}>
          <p>{sc(f.aboutP1, t('footer.aboutP1'))}</p>
          <p>{sc(f.aboutP2, t('footer.aboutP2'))}</p>
        </FootCol>
        <FootCol title={t('footer.help')} mobile={mobile}>
          <a href="#" onClick={(e) => { e.preventDefault(); openOnboarding(); }}>新手引导</a>
          <Link to="/account">{t('footer.mySubs')}</Link>
          <Link to="/account?tab=orders">{t('footer.orderQuery')}</Link>
          <Link to="/account?tab=wallet">{t('footer.recharge')}</Link>
        </FootCol>
        <FootCol title="条款与政策" mobile={mobile}>
          <Link to="/legal/terms">{t('legal.terms')}</Link>
          <Link to="/legal/privacy">{t('legal.privacy')}</Link>
          <Link to="/legal/refund">{t('legal.refund')}</Link>
          <Link to="/legal/about">{t('legal.about')}</Link>
        </FootCol>
        <FootCol title={t('footer.guarantee')} mobile={mobile}>
          <p>{sc(f.g1, t('footer.g1'))}</p>
          <p>{sc(f.g2, t('footer.g2'))}</p>
          <p>{sc(f.g3, t('footer.g3'))}</p>
        </FootCol>
      </div>
      {/* 时钟在移动端隐藏（CSS 控制），避免底部堆高 */}
      <div className="container footer-clock">
        <StatusClock />
      </div>
      <div className="footer-copy">{t('footer.copy')}</div>
    </footer>
  );
}

function NotFound() {
  return (
    <div className="empty" style={{ padding: '80px 0' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 64, lineHeight: 1, color: 'var(--red)' }}>
        404
      </div>
      <p style={{ marginTop: 12, fontWeight: 700 }}>页面不存在或已失效</p>
      <p className="muted small" style={{ marginBottom: 18 }}>
        链接可能已过期，或你输入了错误的地址。
      </p>
      <Link className="btn btn-primary" to="/">
        <Icon name="home" size={15} /> 回首页逛逛
      </Link>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

/** 路由变化自动上报 PV */
function PageTracker() {
  const location = useLocation();
  React.useEffect(() => {
    trackPageView({ path: location.pathname });
  }, [location.pathname, location.search]);
  return null;
}

export default function App() {
  const location = useLocation();
  return (
    <>
      <SiteBackground />
      <BootSplash />
      <Cursor />
      <ScrollToTop />
      <PageTracker />
      <LocalePath />
      <Header />
      <main className="container main">
        <div className="page-enter" key={location.pathname}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/p/:slug" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout/:planId" element={<Checkout />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/pay/:paymentId" element={<Pay />} />
            <Route path="/account" element={<Account />} />
            <Route path="/forgot" element={<Forgot />} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            <Route path="/legal/:kind" element={<Legal />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
      <Footer />
      <SupportWidget />
      <MobileTabbar />
      <Onboarding />
    </>
  );
}
