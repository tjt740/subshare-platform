import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  CATEGORY_TINT,
  money,
  starStr,
  toUsd,
} from '../api';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { Marquee, Reveal, SaleCountdown } from '../components/fx';
import { HeroCanvas } from '../components/CanvasFx';
import Icon, { CATEGORY_ICON_NAME } from '../components/Icon';
import BrandIcon, { BRAND_TINT } from '../components/BrandIcon';
import { track } from '../track';

interface ProductCard {
  id: number;
  slug: string;
  title: string;
  category: string;
  description: string;
  rating: number;
  soldCount: number;
  badge: string | null;
  officialPriceUsd: number | null;
  fromPrice: number;
  currency: string;
  totalStock: number;
  brand?: string | null;
  sale?: { endsAt: string; label?: string } | null;
}

function savePercent(p: ProductCard) {
  if (!p.officialPriceUsd) return null;
  const usd = toUsd(p.fromPrice, p.currency);
  const pct = Math.round((1 - usd / p.officialPriceUsd) * 100);
  return pct > 0 ? pct : null;
}

const sc = (v: any, fb: string) => (typeof v === 'string' && v.trim() ? v : fb);

export default function Home() {
  const { region, siteCfg } = useApp();
  const { t, tList } = useI18n();
  const hero = siteCfg?.hero ?? {};
  const trust: { b?: string; s?: string }[] = Array.isArray(siteCfg?.trust)
    ? siteCfg.trust
    : [];
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('__all__');
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState('default');
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => {
    setLoading(true);
    api<ProductCard[]>(`/catalog/products?region=${region}`)
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [region]);

  const categories = useMemo(
    () => ['__all__', ...Array.from(new Set(products.map((p) => p.category)))],
    [products],
  );
  const filtered = products
    .filter(
      (p) =>
        (cat === '__all__' || p.category === cat) &&
        (!inStockOnly || p.totalStock > 0) &&
        (keyword === '' ||
          p.title.toLowerCase().includes(keyword.toLowerCase()) ||
          p.description.includes(keyword)),
    )
    .sort((a, b) => {
      if (sort === 'sales') return b.soldCount - a.soldCount;
      if (sort === 'priceAsc') return toUsd(a.fromPrice, a.currency) - toUsd(b.fromPrice, b.currency);
      if (sort === 'priceDesc') return toUsd(b.fromPrice, b.currency) - toUsd(a.fromPrice, a.currency);
      return 0;
    });
  const hot = [...products].sort((a, b) => b.soldCount - a.soldCount).slice(0, 3);

  return (
    <div>
      <section className="hero">
        <HeroCanvas height={360} />
        <span className="eyebrow">{t('hero.eyebrow')}</span>
        <h1>
          {sc(hero.t1, t('hero.t1'))}
          <span className="hollow">{sc(hero.t2, t('hero.t2'))}</span>
          <br />
          {sc(hero.t3, t('hero.t3'))}
          <span className="tilt">{sc(hero.pct, '80%')}</span>
          <span className="red">.</span>
        </h1>
        <p>{sc(hero.p, t('hero.p'))}</p>
        <a className="btn btn-primary btn-lg hero-cta" href="#catalog">
          {t('catalog.heading')} <Icon name="arrowRight" size={16} />
        </a>
      </section>

      <Marquee className="strip" items={tList('strip.items')} />

      <Reveal>
        <div className="trust-bar">
          <div className="trust-item"><b>{sc(trust[0]?.b, '50,000+')}</b><span>{sc(trust[0]?.s, t('trust.users'))}</span></div>
          <div className="trust-item"><b>{sc(trust[1]?.b, '99.6%')}</b><span>{sc(trust[1]?.s, t('trust.rate'))}</span></div>
          <div className="trust-item"><b>{sc(trust[2]?.b, '< 60s')}</b><span>{sc(trust[2]?.s, t('trust.deliver'))}</span></div>
          <div className="trust-item"><b>{sc(trust[3]?.b, '7×24')}</b><span>{sc(trust[3]?.s, t('trust.support'))}</span></div>
        </div>
      </Reveal>

      <div className="section-eyebrow" id="catalog">{t('catalog.eyebrow')}</div>
      <h2 className="section-heading">{t('catalog.heading')}</h2>

      <div className="catalog-tools">
        <div className="cat-chips">
          {categories.map((c) => (
            <button
              key={c}
              className={`cat-chip ${cat === c ? 'active' : ''}`}
              onClick={() => setCat(c)}
            >
              {c === '__all__' ? (
                <><Icon name="tag" size={14} /> {t('catalog.all')}</>
              ) : (
                <><Icon name={CATEGORY_ICON_NAME[c] ?? 'box'} size={14} /> {c}</>
              )}
            </button>
          ))}
        </div>
        <div className="tool-right">
          <select
            className="region-select"
            aria-label="排序方式"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="default">{t('sort.default')}</option>
            <option value="sales">{t('sort.sales')}</option>
            <option value="priceAsc">{t('sort.priceAsc')}</option>
            <option value="priceDesc">{t('sort.priceDesc')}</option>
          </select>
          <button
            className={`cat-chip ${inStockOnly ? 'active' : ''}`}
            aria-pressed={inStockOnly}
            onClick={() => setInStockOnly((v) => !v)}
          >
            {t('sort.stock')}
          </button>
          <input
            className="search-input"
            aria-label={t('catalog.searchPh')}
            placeholder={t('catalog.searchPh')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onBlur={(e) => e.target.value && track('search', { keyword: e.target.value })}
          />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="product-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 280 }} />
          ))}
        </div>
      ) : (
        <div className="product-grid">
          {filtered.map((p, i) => {
            const brandTint = p.brand ? (BRAND_TINT as any)[p.brand] : null;
            const tint = brandTint
              ? [brandTint, brandTint]
              : CATEGORY_TINT[p.category] ?? ['#fb9920', '#fb9920'];
            const pct = savePercent(p);
            return (
              <Link
                className="product-card"
                to={`/p/${p.slug}`}
                key={p.id}
                style={{ animationDelay: `${i * 0.06}s` } as React.CSSProperties}
                onClick={() =>
                  track('click', { target: 'product_card', slug: p.slug, productTitle: p.title })
                }
              >
                <div
                  className="card-banner"
                  style={{ '--tint1': tint[0], '--tint2': tint[1] } as React.CSSProperties}
                >
                  <div className="card-logo">
                    {p.brand ? (
                      <BrandIcon brand={p.brand} size={28} />
                    ) : (
                      <Icon name={CATEGORY_ICON_NAME[p.category] ?? 'box'} size={26} />
                    )}
                  </div>
                  <div>
                    <span className="chip">{p.category}</span>{' '}
                    <span className={`chip ${p.totalStock > 0 ? 'chip-ok' : 'chip-warn'}`}>
                      {p.totalStock > 0
                        ? t('card.stock', { n: p.totalStock })
                        : t('card.oos')}
                    </span>
                  </div>
                  {p.badge && <span className="badge-float">{p.badge}</span>}
                  <SaleCountdown endsAt={p.sale?.endsAt} label={p.sale?.label} className="on-card" />
                </div>
                <div className="card-body">
                  <h3>{p.title}</h3>
                  <div className="card-rating">
                    <span className="stars">{starStr(p.rating)}</span>
                    <span>{p.rating.toFixed(1)}</span>
                    <span>· {p.soldCount.toLocaleString()} {t('card.sold')}</span>
                  </div>
                  <p className="card-desc">{p.description}</p>
                  <div className="card-bottom">
                    <div>
                      <div className="price">
                        {money(p.fromPrice, p.currency)}
                        <small> {t('card.from')}</small>
                        {pct && <span className="save-tag">{t('card.save', { n: pct })}</span>}
                      </div>
                      {p.officialPriceUsd && (
                        <div className="price-official">
                          {t('card.official', { n: p.officialPriceUsd.toFixed(2) })}
                        </div>
                      )}
                    </div>
                    <span className="btn btn-primary btn-sm">{t('card.view')}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="empty">
          <p>{t('catalog.empty')}</p>
          <p className="muted small" style={{ marginTop: 10 }}>{t('catalog.hot')}</p>
          <div className="hot-links">
            {hot.map((p) => (
              <Link key={p.id} className="btn btn-ghost btn-sm" to={`/p/${p.slug}`}>
                <Icon name={CATEGORY_ICON_NAME[p.category] ?? 'box'} size={14} /> {p.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
