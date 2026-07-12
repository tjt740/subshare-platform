import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, money, starStr, toUsd } from '../api';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { Reveal, SaleCountdown } from '../components/fx';
import Icon, { CATEGORY_ICON_NAME } from '../components/Icon';

interface PlanView {
  id: number;
  name: string;
  type: string;
  periodMonths: number;
  price: number;
  currency: string;
  stock: number;
}
interface Detail {
  id: number;
  slug: string;
  title: string;
  category: string;
  description: string;
  rating: number;
  soldCount: number;
  meta: {
    badge?: string;
    officialPriceUsd?: number;
    features?: { icon: string; title: string; desc: string }[];
    faq?: { q: string; a: string }[];
    reviews?: { user: string; rating: number; date: string; content: string }[];
    delivery?: { method: string; time: string; steps?: string[] };
    sale?: { endsAt: string; label?: string } | null;
    warranty?: string;
    aftersales?: { issue: string; way: string; sla: string }[];
  };
  plans: PlanView[];
}

const DEFAULT_STEPS = ['支付成功', '系统自动分配', '发放凭据', '登录使用'];

export default function ProductDetail() {
  const { slug } = useParams();
  const { region, addToCart, cart } = useApp();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setError('');
    setDetail(null);
    api<Detail>(`/catalog/products/${slug}?region=${region}`)
      .then((d) => {
        setDetail(d);
        const first = d.plans.find((p) => p.stock > 0) ?? d.plans[0];
        setPlanId(first ? first.id : null);
      })
      .catch((e) => setError(e.message));
  }, [slug, region]);

  const selected = detail?.plans.find((p) => p.id === planId) || null;
  const inCart = !!selected && cart.some((c) => c.planId === selected.id);

  function goCheckout() {
    if (!selected) return;
    navigate(`/checkout/${selected.id}`);
  }

  function handleAddToCart() {
    if (!selected || !detail) return;
    if (inCart) {
      navigate('/cart');
      return;
    }
    addToCart({
      planId: selected.id,
      productTitle: detail.title,
      planName: selected.name,
      periodMonths: selected.periodMonths,
      category: detail.category,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  if (!detail) {
    return error ? (
      <div className="alert alert-error" role="alert">{error}</div>
    ) : (
      // 商品详情骨架屏（避免异步加载期间的空白主体）
      <div className="detail" aria-busy="true">
        <div>
          <div className="skeleton" style={{ height: 130, marginBottom: 20 }} />
          <div className="skeleton" style={{ height: 18, width: '80%', marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 24 }} />
          <div className="skeleton" style={{ height: 120, marginBottom: 14 }} />
          <div className="skeleton" style={{ height: 120 }} />
        </div>
        <div className="skeleton" style={{ height: 340 }} />
      </div>
    );
  }

  const meta = detail.meta || {};
  const monthlyUsd = selected
    ? toUsd(selected.price, selected.currency) / selected.periodMonths
    : null;
  const savePct =
    meta.officialPriceUsd && monthlyUsd
      ? Math.max(0, Math.round((1 - monthlyUsd / meta.officialPriceUsd) * 100))
      : null;

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/">首页</Link> / {detail.category} / <b>{detail.title}</b>
      </div>

      <div className="detail">
        <div className="detail-info">
          <div className="detail-hero">
            <div className="big-logo"><Icon name={CATEGORY_ICON_NAME[detail.category] ?? 'box'} size={42} /></div>
            <div>
              <h1>{detail.title}</h1>
              <div className="sub">
                <span className="stars">{starStr(detail.rating)} {detail.rating.toFixed(1)}</span>
                <span>{detail.soldCount.toLocaleString()} {t('card.sold')}</span>
                {meta.badge && <span>{meta.badge}</span>}
                <span><Icon name="bolt" size={13} /> 自动发货</span>
              </div>
            </div>
          </div>

          <p className="detail-desc">{detail.description}</p>

          {meta.features && meta.features.length > 0 && (
            <>
              <h2 className="section-title">{t('detail.features')}</h2>
              <div className="feature-grid">
                {meta.features.map((f, i) => (
                  <div className="feature-item fade-up" key={i} style={{ animationDelay: `${i * 0.05}s` }}>
                    <span className="fi">{f.icon}</span>
                    <div>
                      <b>{f.title}</b>
                      <span>{f.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <h2 className="section-title">{t('detail.delivery')}</h2>
          <div className="delivery-banner">
            <span className="chip">
              <Icon name="box" size={13} /> {meta.delivery?.method ?? '账号凭据'}
            </span>
            <span className="chip chip-ok">
              <Icon name="bolt" size={13} /> {meta.delivery?.time ?? '支付后自动交付'}
            </span>
          </div>
          <div className="flow-steps">
            {(meta.delivery?.steps ?? DEFAULT_STEPS).map((s, i) => (
              <div className="flow-step" key={i}>
                <span className="no">{i + 1}</span>
                <b>{s}</b>
              </div>
            ))}
          </div>

          {(meta.aftersales?.length || meta.warranty) && (
            <Reveal>
              <h2 className="section-title">{t('detail.aftersales')}</h2>
              {meta.warranty && (
                <div className="warranty-banner"><Icon name="shield" size={16} /> {meta.warranty}</div>
              )}
              <div className="as-list">
                {(meta.aftersales ?? []).map((a, i) => (
                  <div className="as-item" key={i}>
                    <b>{a.issue}</b>
                    <span>{a.way}</span>
                    <span className="badge badge-answered">{t('detail.respond', { t: a.sla })}</span>
                  </div>
                ))}
              </div>
              <p className="tiny-note" style={{ textAlign: 'left' }}>
                购买后在「我的订阅」订阅卡上可一键发起补发 / 退款 / 换车，全程工单跟踪。
              </p>
            </Reveal>
          )}

          {meta.faq && meta.faq.length > 0 && (
            <Reveal>
              <h2 className="section-title">{t('detail.faq')}</h2>
              <div className="faq-list">
                {meta.faq.map((f, i) => (
                  <details key={i} open={i === 0}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </Reveal>
          )}

          {meta.reviews && meta.reviews.length > 0 && (
            <Reveal>
              <h2 className="section-title">{t('detail.reviews')}</h2>
              <div className="review-list">
                {meta.reviews.map((r, i) => (
                  <div className="review-item" key={i}>
                    <div className="review-head">
                      <b>
                        {r.user} <span className="stars">{starStr(r.rating)}</span>
                      </b>
                      <span>{r.date}</span>
                    </div>
                    <p>{r.content}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          )}
        </div>

        <div className="detail-buy">
          <SaleCountdown
            endsAt={meta.sale?.endsAt}
            label={meta.sale?.label}
            className="detail-sale"
          />
          <h3>{t('detail.choosePlan')}</h3>
          <div className="plan-list">
            {detail.plans.map((p) => (
              <label
                key={p.id}
                className={`plan-item ${planId === p.id ? 'active' : ''} ${
                  p.stock === 0 ? 'disabled' : ''
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  checked={planId === p.id}
                  disabled={p.stock === 0}
                  onChange={() => setPlanId(p.id)}
                />
                <span className="plan-name">
                  {p.name}
                  <div className="plan-meta">
                    {p.stock > 0 ? t('detail.stockLeft', { n: p.stock }) : t('detail.oosDot')}
                    {t('detail.perMonth', { n: ((toUsd(p.price, p.currency)) / p.periodMonths).toFixed(2) })}
                  </div>
                </span>
                <span className="plan-price">{money(p.price, p.currency)}</span>
              </label>
            ))}
          </div>

          <div className="buy-summary">
            <div>
              <div className="muted small">{t('detail.handPrice')}</div>
              <div className="total">
                {selected ? money(selected.price, selected.currency) : '-'}
              </div>
              {savePct !== null && savePct > 0 && (
                <span className="save-tag">{t('card.save', { n: savePct })}</span>
              )}
            </div>
            {meta.officialPriceUsd && (
              <div style={{ textAlign: 'right' }}>
                <div className="muted small">{t('detail.officialMonthly')}</div>
                <div className="price-official" style={{ fontSize: 15 }}>
                  ${meta.officialPriceUsd.toFixed(2)}/月
                </div>
              </div>
            )}
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button
            className="btn btn-primary btn-lg btn-block buy-cta"
            disabled={!selected || selected.stock === 0}
            onClick={goCheckout}
          >
            {selected && selected.stock > 0 ? t('detail.buyNow') : t('detail.oos')}
          </button>
          <button
            className="btn btn-ghost btn-block buy-cta"
            style={{ marginTop: 10 }}
            disabled={!selected || selected.stock === 0}
            onClick={handleAddToCart}
          >
            {added ? t('detail.added') : inCart ? t('detail.inCart') : t('detail.addCart')}
          </button>
          <details className="price-note">
            <summary><Icon name="info" size={13} /> {t('price.title')}</summary>
            <ul>
              <li>{t('price.fx')}</li>
              <li>{t('price.renew')}</li>
              <li>{t('price.noauto')}</li>
              <li>
                {t('price.refund')} <Link to="/legal/refund">《{t('legal.refund')}》</Link>
              </li>
            </ul>
          </details>
          <div className="guarantee">
            <span>{t('detail.g1')}</span>
            <span>{t('detail.g2')}</span>
            <span>{t('detail.g3')}</span>
          </div>
          <p className="tiny-note">{t('detail.mockNote')}</p>
        </div>
      </div>

      {/* 移动端底部购买栏 */}
      <div className="mobile-buybar">
        <div>
          <div className="muted small">{t('detail.handPrice')}</div>
          <div className="total">
            {selected ? money(selected.price, selected.currency) : '-'}
          </div>
        </div>
        <button
          className="btn btn-ghost"
          disabled={!selected || selected.stock === 0}
          onClick={handleAddToCart}
          title="加入购物车"
        >
          <Icon name={inCart || added ? 'check' : 'cart'} size={18} />
        </button>
        <button
          className="btn btn-primary btn-lg"
          style={{ flex: 1 }}
          disabled={!selected || selected.stock === 0}
          onClick={goCheckout}
        >
          {selected && selected.stock > 0 ? t('detail.buyNowShort') : t('detail.oos')}
        </button>
      </div>
    </div>
  );
}
