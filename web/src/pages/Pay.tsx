import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, money } from '../api';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { ConfettiBurst } from '../components/CanvasFx';
import Icon from '../components/Icon';
import { track } from '../track';

interface PaymentView {
  id: number;
  purpose: 'order' | 'recharge';
  provider: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  orderId: number | null;
  orderNo: string | null;
  orderStatus: string | null;
}

const PROVIDER_LABEL: Record<string, string> = {
  'mock-card': 'Visa / Mastercard',
  'mock-alipay': 'Alipay',
  'mock-usdt': 'USDT',
  balance: '钱包余额',
};

/** Mock 收银台 */
export default function Pay() {
  const { paymentId } = useParams();
  const { token, user, refreshUser } = useApp();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [payment, setPayment] = useState<PaymentView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [levelUp, setLevelUp] = useState<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (!token) {
      navigate('/login', { state: { from: `/pay/${paymentId}` } });
      return;
    }
    api<PaymentView>(`/payments/${paymentId}`, { token })
      .then(setPayment)
      .catch((e) => setError(e.message));
  }, [paymentId, token, navigate]);

  async function confirm(success: boolean) {
    if (!payment) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ paymentStatus: string; orderStatus: string | null }>(
        `/payments/mock/${payment.id}/confirm`,
        { method: 'POST', token, body: JSON.stringify({ success }) },
      );
      setPayment({
        ...payment,
        status: result.paymentStatus as PaymentView['status'],
        orderStatus: result.orderStatus,
      });
      track(
        success
          ? payment.purpose === 'recharge'
            ? 'recharge_success'
            : 'payment_success'
          : 'payment_fail',
        {
          paymentId: payment.id,
          orderNo: payment.orderNo,
          amount: payment.amount,
          currency: payment.currency,
          provider: payment.provider,
        },
      );
      // 成长值/等级变化提示（充值与消费都会累计成长值）
      const before = user?.level ?? 1;
      const fresh = await api<{ level: number }>('/auth/me', { token });
      if (success && fresh.level > before) {
        setLevelUp({ from: before, to: fresh.level });
      }
      refreshUser();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    if (!payment) return;
    setBusy(true);
    try {
      let res: { paymentId: number };
      if (payment.purpose === 'recharge') {
        res = await api('/payments/recharge', {
          method: 'POST',
          token,
          body: JSON.stringify({
            amountUsd: Math.round(payment.amount),
            provider: payment.provider,
          }),
        });
      } else if (payment.orderId) {
        res = await api(`/payments/${payment.orderId}/checkout`, {
          method: 'POST',
          token,
          body: JSON.stringify({ provider: payment.provider }),
        });
      } else {
        return;
      }
      navigate(`/pay/${res.paymentId}`);
      setPayment(await api<PaymentView>(`/payments/${res.paymentId}`, { token }));
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!payment) {
    return error ? (
      <div className="alert alert-error">{error}</div>
    ) : (
      <div className="pay-card"><div className="skeleton" style={{ height: 200 }} /></div>
    );
  }

  const isRecharge = payment.purpose === 'recharge';

  return (
    <div>
      <div className="steps">
        <div className="step on"><span className="dot">✓</span>{t('steps.confirm')}</div>
        <span className="line" />
        <div className="step on"><span className="dot">2</span>{t('steps.pay')}</div>
        <span className="line" />
        <div className={`step ${payment.status === 'succeeded' ? 'on' : ''}`}>
          <span className="dot">3</span>{isRecharge ? t('steps.arrive') : t('steps.deliver')}
        </div>
      </div>

      <div className="pay-card">
        <h2>{isRecharge ? t('pay.rechargeTitle') : t('pay.title')}</h2>
        <p className="pay-sub">{isRecharge ? t('pay.rechargeSub') : t('pay.sub')}</p>
        {payment.orderNo && (
          <div className="pay-row">
            <span>{t('pay.orderNo')}</span>
            <b className="mono">{payment.orderNo}</b>
          </div>
        )}
        <div className="pay-row">
          <span>{t('pay.method')}</span>
          <b>{PROVIDER_LABEL[payment.provider] ?? payment.provider}</b>
        </div>
        <div className="pay-row pay-amount">
          <span>{isRecharge ? t('pay.rechargeAmount') : t('pay.amount')}</span>
          <b>{money(payment.amount, payment.currency)}</b>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {payment.status === 'pending' && (
          <div className="pay-actions">
            <button
              className="btn btn-primary btn-lg btn-block"
              disabled={busy}
              onClick={() => confirm(true)}
            >
              {t('pay.success')}
            </button>
            <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => confirm(false)}>
              {t('pay.fail')}
            </button>
            <p className="tiny-note">{t('pay.note')}</p>
          </div>
        )}

        {payment.status === 'succeeded' && (
          <div className="pay-result ok">
            <ConfettiBurst fire={payment.status === 'succeeded'} />
            <span className="big-ic"><Icon name="check" size={48} /></span>
            <h3>{isRecharge ? t('pay.rechargedTitle') : t('pay.paidTitle')}</h3>
            <p>
              {isRecharge
                ? t('pay.recharged', { n: payment.amount.toFixed(2) })
                : payment.orderStatus === 'delivered'
                  ? t('pay.delivered')
                  : t('pay.queued')}
            </p>
            {levelUp && (
              <div className="alert alert-ok" style={{ textAlign: 'center' }}>
                {t('level.up')} LV{levelUp.from} → <b>LV{levelUp.to} {t(`lv.${levelUp.to}`)}</b>
              </div>
            )}
            <Link
              className="btn btn-primary btn-lg"
              to={isRecharge ? '/account?tab=wallet' : '/account'}
            >
              {isRecharge ? t('pay.viewWallet') : t('pay.viewSubs')}
            </Link>
          </div>
        )}

        {payment.status === 'failed' && (
          <div className="pay-result bad">
            <span className="big-ic"><Icon name="warn" size={44} /></span>
            <h3>{t('pay.failedTitle')}</h3>
            <p>{t('pay.failedDesc')}</p>
            <button className="btn btn-primary" disabled={busy} onClick={retry}>
              {t('pay.retry')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
