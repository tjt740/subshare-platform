import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  CATEGORY_ICON,
  CATEGORY_TINT,
  money,
  starStr,
  toUsd,
} from '../api';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { Marquee, Reveal, SaleCountdown } from '../components/fx';

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
  sale?: { endsAt: string; label?: string } | null;
}

function savePercent(p: ProductCard) {
  if (!p.officialPriceUsd) return null;
  const usd = toUsd(p.fromPrice, p.currency);
  const pct = Math.round((1 - usd / p.officialPriceUsd) * 100);
  return pct > 0 ? pct : null;
}

export default function Home() {
  const { region } = useApp();
  const { t, tList } = useI18n();
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('__all__');
  const [keyword, setKeyword] = useState('');

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
  const filtered = products.filter(
    (p) =>
      (cat === '__all__' || p.category === cat) &&
      (keyword === '' ||
        p.title.toLowerCase().includes(keyword.toLowerCase()) ||
        p.description.includes(keyword)),
  );

  return (
    <div>
      <section className="hero">
        <div className="hero-emojis">
          <span style={{ right: '22%', top: '58%', ['--r' as any]: '8deg' }}>🎬</span>
          <span style={{ right: '10%', top: '66%', animationDelay: '0.8s', ['--r' as any]: '-10deg' }}>🎵</span>
          <span style={{ right: '30%', top: '20%', animationDelay: '1.6s', ['--r' as any]: '6deg' }}>🤖</span>
        </div>
        <div className="spin-badge">{t('hero.badge')}</div>
        <span className="eyebrow">{t('hero.eyebrow')}</span>
        <h1>
          {t('hero.t1')}
          <span className="hollow">{t('hero.t2')}</span>
          <br />
          {t('hero.t3')}
          <span className="tilt">80%</span>
          <span className="red">.</span>
        </h1>
        <p>{t('hero.p')}</p>
      </section>

      <Marquee className="strip" items={tList('strip.items')} />

      <Reveal>
        <div className="trust-bar">
          <div className="trust-item"><b>50,000+</b><span>{t('trust.users')}</span></div>
          <div className="trust-item"><b>99.6%</b><span>{t('trust.rate')}</span></div>
          <div className="trust-item"><b>&lt; 60s</b><span>{t('trust.deliver')}</span></div>
          <div className="trust-item"><b>7×24</b><span>{t('trust.support')}</span></div>
        </div>
      </Reveal>

      <div className="section-eyebrow">{t('catalog.eyebrow')}</div>
      <h2 className="section-heading">{t('catalog.heading')}</h2>

      <div className="catalog-tools">
        <div className="cat-chips">
          {categories.map((c) => (
            <button
              key={c}
              className={`cat-chip ${cat === c ? 'active' : ''}`}
              onClick={() => setCat(c)}
            >
              {c === '__all__' ? t('catalog.all') : `${CATEGORY_ICON[c] ?? '📦'} ${c}`}
            </button>
          ))}
        </div>
        <input
          className="search-input"
          placeholder={t('catalog.searchPh')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
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
            const tint = CATEGORY_TINT[p.category] ?? ['#fb9920', '#fb9920'];
            const pct = savePercent(p);
            return (
              <Link
                className="product-card"
                to={`/p/${p.slug}`}
                key={p.id}
                style={{ animationDelay: `${i * 0.06}s` } as React.CSSProperties}
              >
                <div
                  className="card-banner"
                  style={{ '--tint1': tint[0], '--tint2': tint[1] } as React.CSSProperties}
                >
                  <div className="card-logo">{CATEGORY_ICON[p.category] ?? '📦'}</div>
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
        <div className="empty">{t('catalog.empty')}</div>
      )}
    </div>
  );
}
