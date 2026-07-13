import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, money } from '../api';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import Icon, { CATEGORY_ICON_NAME } from '../components/Icon';
import BrandIcon from '../components/BrandIcon';
import { track } from '../track';

interface QuoteItem {
  planId: number;
  available: boolean;
  reason?: string;
  planName?: string;
  periodMonths?: number;
  productTitle?: string;
  category?: string;
  unitPrice?: number;
  currency?: string;
  stock?: number;
}
interface Quote {
  currency: string;
  total: number;
  items: QuoteItem[];
}

/** 购物车：实时按当前地区报价，合并一单结算 */
export default function Cart() {
  const { cart, removeFromCart, region, token } = useApp();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (cart.length === 0) {
      setQuote(null);
      return;
    }
    api<Quote>('/catalog/quote', {
      method: 'POST',
      body: JSON.stringify({ planIds: cart.map((c) => c.planId), region }),
    })
      .then(setQuote)
      .catch((e) => setError(e.message));
  }, [cart, region]);
  useEffect(load, [load]);

  const buyable =
    quote?.items.filter((i) => i.available && (i.stock ?? 0) > 0) ?? [];
  const hasUnavailable = (quote?.items.length ?? 0) > buyable.length;

  function checkout() {
    track('checkout_start', { source: 'cart', items: buyable.length, total: buyableTotal });
    if (!token) {
      navigate('/login', { state: { from: '/cart' } });
      return;
    }
    navigate('/checkout/cart');
  }

  const buyableTotal = buyable.reduce((s, i) => s + (i.unitPrice ?? 0), 0);

  return (
    <div>
      <div className="section-eyebrow">{t('cart.eyebrow')}</div>
      <h1 className="page-title">{t('cart.title', { n: cart.length })}</h1>

      {error && <div className="alert alert-error">{error}</div>}

      {cart.length === 0 ? (
        <div className="empty">
          {t('cart.empty')}
          <br />
          <Link className="btn btn-primary" style={{ marginTop: 14 }} to="/">
            {t('cart.goShop')}
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-list">
            {cart.map((c) => {
              const q = quote?.items.find((i) => i.planId === c.planId);
              return (
                <div className="cart-item" key={c.planId}>
                  <div className="card-logo">
                    {(q as any)?.brand ? (
                      <BrandIcon brand={(q as any).brand} size={24} />
                    ) : (
                      <Icon name={CATEGORY_ICON_NAME[c.category] ?? 'box'} size={24} />
                    )}
                  </div>
                  <div className="ci-info">
                    <b>{c.productTitle}</b>
                    <span className="muted small">{c.planName}</span>
                    {q && !q.available && (
                      <span className="badge badge-canceled">{q.reason}</span>
                    )}
                    {q?.available && (q.stock ?? 0) === 0 && (
                      <span className="badge badge-canceled">{t('cart.oosBadge')}</span>
                    )}
                    {q?.available && (q.stock ?? 0) > 0 && (q.stock ?? 0) <= 3 && (
                      <span className="badge badge-created">
                        {t('cart.lowStock', { n: q.stock! })}
                      </span>
                    )}
                  </div>
                  <div className="ci-price">
                    {q?.available && (q.stock ?? 0) > 0
                      ? money(q.unitPrice!, q.currency!)
                      : '--'}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      track('remove_from_cart', { productTitle: c.productTitle, planId: c.planId });
                      removeFromCart(c.planId);
                    }}
                  >
                    {t('cart.remove')}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="panel cart-summary">
            <h3>{t('cart.summary')}</h3>
            <div className="co-rows">
              <div className="co-row">
                <span>{t('cart.count')}</span>
                <b>{t('cart.items', { n: buyable.length })}</b>
              </div>
              <div className="co-row">
                <span>{t('checkout.deliverMethod')}</span>
                <b>{t('cart.deliverAuto')}</b>
              </div>
              <div className="co-row total">
                <span>{t('cart.total')}</span>
                <b>{quote ? money(buyableTotal, quote.currency) : '--'}</b>
              </div>
            </div>
            {hasUnavailable && <p className="tiny-note">{t('cart.unavail')}</p>}
            <button
              className="btn btn-primary btn-lg btn-block"
              style={{ marginTop: 14 }}
              disabled={buyable.length === 0}
              onClick={checkout}
            >
              {t('cart.checkout', { n: buyable.length })}
            </button>
            {!token && (
              <p className="tiny-note" style={{ marginTop: 8 }}>
                <Icon name="lock" size={12} /> {t('auth.loginNote')}
              </p>
            )}
            <div className="guarantee">
              <span>{t('detail.g1')}</span>
              <span>{t('detail.g2')}</span>
              <span>{t('detail.g3')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
