import React from 'react';
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
import SupportWidget from './components/SupportWidget';
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

function Header() {
  const { user, region, setRegion, logout, cart } = useApp();
  const { t, tList } = useI18n();
  const navigate = useNavigate();
  const regionOptions = [
    { value: 'US', label: t('region.us') },
    { value: 'EU', label: t('region.eu') },
    { value: 'CN', label: t('region.cn') },
  ];
  return (
    <>
      <Marquee items={tList('announce.items')} className="announce" />
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">S</span> SubShare
          </Link>
          <nav className="nav">
            <Link to="/">{t('nav.products')}</Link>
            <Link to="/account">{t('nav.subs')}</Link>
            <Link to="/account?tab=wallet">{t('nav.wallet')}</Link>
          </nav>
          <div className="header-right">
            <Link to="/cart" className="cart-btn" title={t('tabbar.cart')}>
              🛒
              {cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
            </Link>
            <ThemePicker />
            <select
              className="region-select"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              {regionOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {user ? (
              <div className="user-chip">
                <span
                  className="balance-pill"
                  onClick={() => navigate('/account?tab=wallet')}
                >
                  💰 ${user.balance.toFixed(2)}
                </span>
                <span
                  className={`user-email lv-name lv${user.level ?? 1}`}
                  onClick={() => navigate('/account?tab=profile')}
                >
                  <i className={`lv-ring lv${user.level ?? 1}`}>{user.avatar ?? '😀'}</i>
                  {user.nickname || user.email}
                  <b className={`lv-badge lv${user.level ?? 1}`}>LV{user.level ?? 1}</b>
                </span>
                <button className="btn btn-ghost btn-sm" onClick={logout}>
                  {t('auth.logout')}
                </button>
              </div>
            ) : (
              <div className="auth-buttons">
                <Link className="btn btn-ghost btn-sm" to="/login">
                  {t('auth.login')}
                </Link>
                <Link className="btn btn-primary btn-sm" to="/register">
                  {t('auth.register')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
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
    { to: '/', icon: '🏠', label: t('tabbar.home'), active: location.pathname === '/' },
    { to: '/cart', icon: '🛒', label: t('tabbar.cart'), active: location.pathname === '/cart', badge: cart.length },
    { to: '/account', icon: '📦', label: t('tabbar.subs'), active: isAccount && !tab },
    { to: '/account?tab=wallet', icon: '💰', label: t('tabbar.wallet'), active: isAccount && tab === 'wallet' },
  ];
  return (
    <nav className="mobile-tabbar">
      {tabs.map((x) => (
        <Link key={x.label} to={x.to} className={`mtab ${x.active ? 'active' : ''}`}>
          <span className="mi">
            {x.icon}
            {!!x.badge && <span className="cart-badge">{x.badge}</span>}
          </span>
          {x.label}
        </Link>
      ))}
    </nav>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div className="footer-mega">SubShare✺</div>
      <Marquee
        items={['STREAM', 'MUSIC', 'AI TOOLS', 'OFFICE', 'SHARE THE PREMIUM', 'PAY LESS']}
        className="announce"
        reverse
      />
      <div className="container footer-inner">
        <div>
          <h4>{t('footer.about')}</h4>
          <p>{t('footer.aboutP1')}</p>
          <p>{t('footer.aboutP2')}</p>
        </div>
        <div>
          <h4>{t('footer.help')}</h4>
          <Link to="/account">{t('footer.mySubs')}</Link>
          <Link to="/account?tab=orders">{t('footer.orderQuery')}</Link>
          <Link to="/account?tab=wallet">{t('footer.recharge')}</Link>
        </div>
        <div>
          <h4>{t('footer.guarantee')}</h4>
          <p>{t('footer.g1')}</p>
          <p>{t('footer.g2')}</p>
          <p>{t('footer.g3')}</p>
        </div>
      </div>
      <div className="container">
        <StatusClock />
      </div>
      <div className="footer-copy">{t('footer.copy')}</div>
    </footer>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

export default function App() {
  const location = useLocation();
  return (
    <>
      <BootSplash />
      <Cursor />
      <ScrollToTop />
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
          </Routes>
        </div>
      </main>
      <Footer />
      <SupportWidget />
      <MobileTabbar />
    </>
  );
}
