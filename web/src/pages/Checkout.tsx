import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, money, PROVIDERS, toUsd } from '../api';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import Icon, { CATEGORY_ICON_NAME } from '../components/Icon';

interface LineItem {
  planId: number;
  productTitle: string;
  planName: string;
  periodMonths: number;
  category: string;
  unitPrice: number;
  currency: string;
  stock: number;
}

/** 订单确认（单买 /checkout/:planId；购物车 /checkout/cart） */
export default function Checkout() {
  const { planId } = useParams();
  const isCart = planId === 'cart';
  const { region, token, user, refreshUser, cart, clearCart } = useApp();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [lines, setLines] = useState<LineItem[] | null>(null);
  const [provider, setProvider] = useState('mock-card');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      if (isCart) {
        if (cart.length === 0) {
          navigate('/cart');
          return;
        }
        const quote = await api<any>('/catalog/quote', {
          method: 'POST',
          body: JSON.stringify({ planIds: cart.map((c) => c.planId), region }),
        });
        setLines(
          quote.items
            .filter((i: any) => i.available && (i.stock ?? 0) > 0)
            .map((i: any) => ({
              planId: i.planId,
              productTitle: i.productTitle,
              planName: i.planName,
              periodMonths: i.periodMonths,
              category: i.category,
              unitPrice: i.unitPrice,
              currency: i.currency,
              stock: i.stock,
            })),
        );
      } else {
        const p = await api<any>(`/catalog/plans/${planId}?region=${region}`);
        setLines([
          {
            planId: p.id,
            productTitle: p.product.title,
            planName: p.name,
            periodMonths: p.periodMonths,
            category: p.product.category,
            unitPrice: p.price,
            currency: p.currency,
            stock: p.stock,
          },
        ]);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, [isCart, planId, region, cart, navigate]);

  useEffect(() => {
    if (!token) {
      navigate('/login', { state: { from: isCart ? '/cart' : `/checkout/${planId}` } });
      return;
    }
    load();
  }, [token, load, navigate, isCart, planId]);

  if (!lines) {
    return error ? (
      <div className="alert alert-error">{error}</div>
    ) : (
      <div className="checkout-wrap">
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    );
  }

  const total = Math.round(lines.reduce((s, l) => s + l.unitPrice, 0) * 100) / 100;
  const currency = lines[0]?.currency ?? 'USD';
  const usd = toUsd(total, currency);
  const balanceEnough = (user?.balance ?? 0) >= usd;

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const order = await api<{ id: number }>('/orders', {
        method: 'POST',
        token,
        body: JSON.stringify({
          planIds: lines!.map((l) => l.planId),
          // 兼容垫片：旧版本服务端要求单个 planId（避免新前端+旧服务端时报
          // "planId must be an integer number"，请同时重启前后端进程）
          planId: lines![0]?.planId,
          region,
        }),
      });
      const res = await api<{ paymentId: number; paid?: boolean }>(
        `/payments/${order.id}/checkout`,
        { method: 'POST', token, body: JSON.stringify({ provider }) },
      );
      if (isCart) clearCart();
      if (provider === 'balance') refreshUser();
      navigate(`/pay/${res.paymentId}`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="checkout-wrap">
      <div className="steps">
        <div className="step on"><span className="dot">1</span>{t('steps.confirm')}</div>
        <span className="line" />
        <div className="step"><span className="dot">2</span>{t('steps.pay')}</div>
        <span className="line" />
        <div className="step"><span className="dot">3</span>{t('steps.deliver')}</div>
      </div>

      <div className="panel">
        <h3>{t('checkout.list', { n: lines.length })}</h3>
        {lines.map((l) => (
          <div className="co-product" key={l.planId} style={{ marginBottom: 12 }}>
            <div className="card-logo"><Icon name={CATEGORY_ICON_NAME[l.category] ?? 'box'} size={24} /></div>
            <div style={{ flex: 1 }}>
              <b>{l.productTitle}</b>
              <span>
                {l.planName} · {t('checkout.months', { n: l.periodMonths })}
                {l.stock <= 3 ? ` · ${t('cart.lowStock', { n: l.stock })}` : ''}
              </span>
            </div>
            <b>{money(l.unitPrice, l.currency)}</b>
          </div>
        ))}
        <div className="co-rows">
          <div className="co-row">
            <span>{t('checkout.deliverMethod')}</span>
            <b>{t('checkout.deliverAuto')}</b>
          </div>
          <div className="co-row">
            <span>{t('checkout.afterSales')}</span>
            <b>{t('checkout.asPromise')}</b>
          </div>
          <div className="co-row total">
            <span>{t('checkout.total')}</span>
            <b>
              {money(total, currency)}
              {currency !== 'USD' && (
                <span className="muted small">（≈ ${usd.toFixed(2)}）</span>
              )}
            </b>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>{t('checkout.payMethod')}</h3>
        <div className="provider-list">
          <label
            className={`provider-item ${provider === 'balance' ? 'active' : ''} ${
              !balanceEnough ? 'disabled' : ''
            }`}
          >
            <input
              type="radio"
              name="provider"
              checked={provider === 'balance'}
              disabled={!balanceEnough}
              onChange={() => setProvider('balance')}
            />
            <span className="p-icon"><Icon name="money" size={20} /></span>
            <span className="p-name">
              {t('checkout.balance')}
              <div className="p-desc">
                {t('checkout.balanceDesc', {
                  b: user?.balance.toFixed(2) ?? '0.00',
                  n: usd.toFixed(2),
                })}
                {!balanceEnough && t('checkout.notEnough')}
              </div>
            </span>
            {balanceEnough && <span className="chip chip-ok">{t('checkout.instant')}</span>}
          </label>
          {PROVIDERS.map((p) => (
            <label
              key={p.value}
              className={`provider-item ${provider === p.value ? 'active' : ''}`}
            >
              <input
                type="radio"
                name="provider"
                checked={provider === p.value}
                onChange={() => setProvider(p.value)}
              />
              <span className="p-icon"><Icon name={p.icon} size={20} /></span>
              <span className="p-name">
                {p.name}
                <div className="p-desc">{p.desc}</div>
              </span>
            </label>
          ))}
        </div>
        {!balanceEnough && (
          <div className="topup-hint">
            <span>{t('checkout.needMore')}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/account?tab=wallet')}
            >
              <Icon name="wallet" size={14} /> {t('checkout.goRecharge')}
            </button>
            <span className="muted small">或直接选择上方银行卡 / 支付宝支付</span>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <button
        className="btn btn-primary btn-lg btn-block"
        disabled={submitting || lines.length === 0}
        onClick={submit}
      >
        {submitting
          ? t('checkout.creating')
          : t('checkout.submit', { amt: money(total, currency) })}
      </button>
      <p className="tiny-note terms-note">
        {t('checkout.agree2')}{' '}
        <Link to="/legal/terms">《{t('legal.terms')}》</Link>{' '}
        {t('checkout.and')}{' '}
        <Link to="/legal/refund">《{t('legal.refund')}》</Link>
        {' · '}
        <Link to="/legal/privacy">《{t('legal.privacy')}》</Link>
      </p>
      <div className="pay-safety">
        <Icon name="lock" size={12} /> 支付由第三方支付机构托管，平台不存储你的卡号与密码 · 全站 HTTPS 加密
      </div>
    </div>
  );
}
