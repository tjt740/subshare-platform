import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  api,
  fmtDate,
  fmtTime,
  money,
  ORDER_STATUS_TEXT,
  PROVIDERS,
} from '../api';
import { useApp } from '../store';
import { useI18n } from '../i18n';

interface SubView {
  id: number;
  status: string;
  startsAt: string;
  expiresAt: string;
  credentials: { username?: string; password?: string; note?: string } | null;
  planName: string;
  productTitle: string;
  orderId: number;
  orderNo: string;
  planId: number;
  deliveryMethod?: string;
  warranty?: string;
}
interface OrderItemView {
  planId: number;
  productTitle: string;
  planName: string;
  periodMonths: number;
  unitPrice: number;
  currency: string;
}
interface OrderView {
  id: number;
  orderNo: string;
  status: string;
  amount: number;
  currency: string;
  region: string;
  createdAt: string;
  planName: string;
  planId: number;
  periodMonths: number;
  productTitle: string;
  items?: OrderItemView[];
}

/** 打开客服悬浮窗并预填（售后一键直达） */
function openSupport(detail: {
  category?: string;
  subject?: string;
  content?: string;
  orderId?: number;
  subscriptionId?: number;
}) {
  window.dispatchEvent(new CustomEvent('ss-support', { detail }));
}
interface WalletView {
  balance: number;
  transactions: {
    id: number;
    type: string;
    amountUsd: number;
    note: string;
    createdAt: string;
  }[];
}

const SUB_STATUS: Record<string, string> = {
  active: '生效中',
  expired: '已到期',
  revoked: '已撤销',
};
const TXN_TYPE: Record<string, string> = {
  recharge: '充值',
  order_pay: '消费',
  refund: '退款',
};
const RECHARGE_AMOUNTS = [10, 25, 50, 100];
const AVATARS = ['😀','😎','🦊','🐱','🐻','🐼','🦄','👾','🤖','🍊','⚡','🌈'];

function CredentialRow({ label, value }: { label: string; value?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="cred-row">
      <span className="cred-label">{label}</span>
      <code>{value}</code>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? '✓' : '⧉'}
      </button>
    </div>
  );
}

/** 订阅剩余时长进度 */
function SubProgress({ sub }: { sub: SubView }) {
  const start = new Date(sub.startsAt).getTime();
  const end = new Date(sub.expiresAt).getTime();
  const now = Date.now();
  const total = Math.max(1, end - start);
  const leftMs = Math.max(0, end - now);
  const leftDays = Math.ceil(leftMs / 86400000);
  const usedPct = Math.min(100, Math.max(0, ((now - start) / total) * 100));
  return (
    <div className="progress-wrap">
      <div className="progress-info">
        <span>
          {fmtDate(sub.startsAt)} ~ {fmtDate(sub.expiresAt)}
        </span>
        <span>
          {sub.status === 'active' ? (
            <>
              <b>{leftDays}</b>d
            </>
          ) : (
            SUB_STATUS[sub.status]
          )}
        </span>
      </div>
      <div className="progress-bar">
        <i style={{ width: `${100 - usedPct}%`, float: 'right' }} />
      </div>
    </div>
  );
}

export default function Account() {
  const { token, user, refreshUser } = useApp();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'subs';
  const [subs, setSubs] = useState<SubView[]>([]);
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [error, setError] = useState('');
  // 充值
  const [amount, setAmount] = useState(25);
  const [provider, setProvider] = useState('mock-card');
  const [recharging, setRecharging] = useState(false);
  // 个人资料
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('😀');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');

  useEffect(() => {
    if (user) {
      setNickname(user.nickname ?? '');
      setAvatar(user.avatar ?? '😀');
    }
  }, [user]);

  const load = useCallback(() => {
    if (!token) return;
    Promise.all([
      api<SubView[]>('/me/subscriptions', { token }),
      api<OrderView[]>('/me/orders', { token }),
      api<WalletView>('/wallet', { token }),
    ])
      .then(([s, o, w]) => {
        setSubs(s);
        setOrders(o);
        setWallet(w);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  useEffect(() => {
    if (!token) {
      navigate('/login', { state: { from: '/account' } });
      return;
    }
    load();
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function setTab(t: string) {
    setParams(t === 'subs' ? {} : { tab: t });
  }

  async function payAgain(order: OrderView) {
    try {
      const res = await api<{ paymentId: number }>(
        `/payments/${order.id}/checkout`,
        { method: 'POST', token, body: JSON.stringify({ provider: 'mock-card' }) },
      );
      navigate(`/pay/${res.paymentId}`);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function recharge() {
    setRecharging(true);
    setError('');
    try {
      const res = await api<{ paymentId: number }>('/payments/recharge', {
        method: 'POST',
        token,
        body: JSON.stringify({ amountUsd: amount, provider }),
      });
      navigate(`/pay/${res.paymentId}`);
    } catch (e: any) {
      setError(e.message);
      setRecharging(false);
    }
  }

  async function saveProfile() {
    setSavingProfile(true);
    setProfileMsg('');
    try {
      await api('/auth/profile', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ nickname, avatar }),
      });
      refreshUser();
      setProfileMsg(t('profile.saved'));
      setTimeout(() => setProfileMsg(''), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePwd() {
    if (newPwd !== confirmPwd) {
      setPwdMsg(t('profile.pwdMismatch'));
      return;
    }
    setChangingPwd(true);
    setPwdMsg('');
    try {
      await api('/auth/change-password', {
        method: 'POST',
        token,
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
      });
      setPwdMsg(t('profile.pwdChanged'));
      setOldPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (e: any) {
      setPwdMsg(e.message);
    } finally {
      setChangingPwd(false);
    }
  }

  /** 续费：同套餐再下一单，后端自动顺延到期时间 */
  function renew(sub: SubView) {
    navigate(`/checkout/${sub.planId}`);
  }

  return (
    <div>
      <h1 className="page-title">{t('account.title')}</h1>
      {user && (
        <p className="muted">
          {user.email} · {t('account.registered')} {fmtDate(user.createdAt as any)}
        </p>
      )}

      <div className="tabs">
        <button className={tab === 'subs' ? 'tab active' : 'tab'} onClick={() => setTab('subs')}>
          {t('tab.subs', { n: subs.length })}
        </button>
        <button className={tab === 'orders' ? 'tab active' : 'tab'} onClick={() => setTab('orders')}>
          {t('tab.orders', { n: orders.length })}
        </button>
        <button className={tab === 'wallet' ? 'tab active' : 'tab'} onClick={() => setTab('wallet')}>
          {t('tab.wallet', { n: wallet?.balance.toFixed(2) ?? '0.00' })}
        </button>
        <button className={tab === 'profile' ? 'tab active' : 'tab'} onClick={() => setTab('profile')}>
          {t('tab.profile')}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* ---------------- 我的订阅 ---------------- */}
      {tab === 'subs' && (
        <div className="sub-list">
          {subs.length === 0 && (
            <div className="empty">
              {t('subs.empty')}
              <br />
              <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => navigate('/')}>
                {t('cart.goShop')}
              </button>
            </div>
          )}
          {subs.map((s) => (
            <div className="sub-card" key={s.id}>
              <div className="sub-head">
                <div>
                  <h3>{s.productTitle}</h3>
                  <span className="muted small">
                    {s.planName} · {t('pay.orderNo')} {s.orderNo}
                  </span>
                  <div className="sub-meta">
                    <span>📦 {s.deliveryMethod ?? '账号凭据'}</span>
                    <span>🛡️ {s.warranty ?? '有效期内免费补发'}</span>
                  </div>
                </div>
                <span className={`badge badge-${s.status}`}>
                  {t(`sstatus.${s.status}`)}
                </span>
              </div>
              <SubProgress sub={s} />
              {s.credentials && (
                <div className="cred-box">
                  {revealed[s.id] ? (
                    <>
                      <CredentialRow label={'ACCT'} value={s.credentials.username} />
                      <CredentialRow label={'PWD'} value={s.credentials.password} />
                      {s.credentials.note && (
                        <div className="cred-note">📌 {s.credentials.note}</div>
                      )}
                    </>
                  ) : (
                    <button
                      className="btn btn-ghost"
                      onClick={() => setRevealed((r) => ({ ...r, [s.id]: true }))}
                    >
                      {t('subs.viewCred')}
                    </button>
                  )}
                </div>
              )}
              <div className="sub-actions">
                {s.status === 'active' && (
                  <button className="btn btn-primary btn-sm" onClick={() => renew(s)}>
                    {t('subs.renew')}
                  </button>
                )}
                {s.status === 'expired' && (
                  <button className="btn btn-primary btn-sm" onClick={() => renew(s)}>
                    {t('subs.reopen')}
                  </button>
                )}
                {s.status === 'active' && (
                  <>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        openSupport({
                          category: 'aftersales_reissue',
                          subject: `[补发] ${s.productTitle} · ${s.planName}`,
                          content: '账号异常，申请补发新凭据。',
                          orderId: s.orderId,
                          subscriptionId: s.id,
                        })
                      }
                    >
                      {t('subs.reissue')}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        openSupport({
                          category: 'aftersales_refund',
                          subject: `[退款] ${s.productTitle} · 订单 ${s.orderNo}`,
                          content: '申请退款至钱包余额，原因：',
                          orderId: s.orderId,
                          subscriptionId: s.id,
                        })
                      }
                    >
                      {t('subs.refund')}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        openSupport({
                          category: 'aftersales_swap',
                          subject: `[换车] ${s.productTitle} · ${s.planName}`,
                          content: '希望更换一个坑位，原因：',
                          orderId: s.orderId,
                          subscriptionId: s.id,
                        })
                      }
                    >
                      {t('subs.swap')}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- 我的订单 ---------------- */}
      {tab === 'orders' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('orders.orderNo')}</th>
                <th>{t('orders.items')}</th>
                <th>{t('orders.qty')}</th>
                <th>{t('orders.amount')}</th>
                <th>{t('orders.status')}</th>
                <th>{t('orders.time')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="mono">{o.orderNo}</td>
                  <td>
                    {(o.items ?? []).length > 0 ? (
                      (o.items ?? []).map((it) => (
                        <div key={it.planId}>
                          {it.productTitle}
                          <span className="muted small">
                            {' '}· {it.planName} · {it.periodMonths} 个月
                          </span>
                        </div>
                      ))
                    ) : (
                      <>
                        {o.productTitle}
                        <div className="muted small">{o.planName}</div>
                      </>
                    )}
                  </td>
                  <td>{(o.items ?? []).length || 1} 件</td>
                  <td>{money(o.amount, o.currency)}</td>
                  <td>
                    <span className={`badge badge-${o.status}`}>
                      {t(`ostatus.${o.status}`)}
                    </span>
                  </td>
                  <td className="muted small">{fmtTime(o.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {o.status === 'created' && (
                        <button className="btn btn-primary btn-sm" onClick={() => payAgain(o)}>
                          {t('orders.pay')}
                        </button>
                      )}
                      {['paid', 'delivered', 'allocating'].includes(o.status) && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            openSupport({
                              category: 'general',
                              subject: `[订单售后] ${o.orderNo}`,
                              content: '订单相关问题：',
                              orderId: o.id,
                            })
                          }
                        >
                          {t('orders.afterSale')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">{t('orders.empty')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------- 钱包 ---------------- */}
      {tab === 'wallet' && (
        <div>
          <div className="wallet-hero">
            <div>
              <div className="lbl">{t('wallet.balance')}</div>
              <div className="bal">${wallet?.balance.toFixed(2) ?? '0.00'}</div>
              <div className="lbl">{t('wallet.desc')}</div>
            </div>
          </div>

          <div className="panel">
            <h3>{t('wallet.quick')}</h3>
            <div className="recharge-grid">
              {RECHARGE_AMOUNTS.map((a) => (
                <div
                  key={a}
                  className={`amount-chip ${amount === a ? 'active' : ''}`}
                  onClick={() => setAmount(a)}
                >
                  ${a}
                  <small>≈ ¥{Math.round(a / 0.14)}</small>
                </div>
              ))}
            </div>
            <div className="provider-list">
              {PROVIDERS.map((p) => (
                <label
                  key={p.value}
                  className={`provider-item ${provider === p.value ? 'active' : ''}`}
                >
                  <input
                    type="radio"
                    name="rc-provider"
                    checked={provider === p.value}
                    onChange={() => setProvider(p.value)}
                  />
                  <span className="p-icon">{p.icon}</span>
                  <span className="p-name">
                    {p.name}
                    <div className="p-desc">{p.desc}</div>
                  </span>
                </label>
              ))}
            </div>
            <button
              className="btn btn-primary btn-lg btn-block"
              style={{ marginTop: 14 }}
              disabled={recharging}
              onClick={recharge}
            >
              {recharging ? t('wallet.creating') : t('wallet.recharge', { n: amount })}
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('wallet.type')}</th>
                  <th>{t('orders.amount')}</th>
                  <th>{t('wallet.note')}</th>
                  <th>{t('orders.time')}</th>
                </tr>
              </thead>
              <tbody>
                {(wallet?.transactions ?? []).map((x) => (
                  <tr key={x.id}>
                    <td>
                      <span className={`badge ${x.amountUsd >= 0 ? 'badge-active' : 'badge-created'}`}>
                        {t(`txn.${x.type}`)}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: x.amountUsd >= 0 ? 'var(--ok)' : 'var(--text)' }}>
                      {x.amountUsd >= 0 ? '+' : ''}
                      {x.amountUsd.toFixed(2)}
                    </td>
                    <td className="muted small">{x.note}</td>
                    <td className="muted small">{fmtTime(x.createdAt)}</td>
                  </tr>
                ))}
                {(wallet?.transactions ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">{t('wallet.empty')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- 个人资料 ---------------- */}
      {tab === 'profile' && user && (
        <div className="checkout-wrap" style={{ marginTop: 4 }}>
          <div className="panel">
            <h3>{t('profile.title')}</h3>
            <label className="field">
              <span>{t('profile.avatar')}</span>
            </label>
            <div className="avatar-grid">
              {AVATARS.map((a) => (
                <button
                  type="button"
                  key={a}
                  className={`avatar-chip ${avatar === a ? 'active' : ''}`}
                  onClick={() => setAvatar(a)}
                >
                  {a}
                </button>
              ))}
            </div>
            <label className="field" style={{ marginTop: 14 }}>
              <span>{t('profile.nickname')}</span>
              <input
                value={nickname}
                maxLength={24}
                placeholder={t('profile.nicknamePh')}
                onChange={(e) => setNickname(e.target.value)}
              />
            </label>
            <p className="tiny-note" style={{ textAlign: 'left' }}>
              {t('profile.emailNote')}（{user.email}）
            </p>
            {profileMsg && <div className="alert alert-ok">{profileMsg}</div>}
            <button
              className="btn btn-primary btn-block"
              disabled={savingProfile}
              onClick={saveProfile}
            >
              {savingProfile ? t('profile.saving') : t('profile.save')}
            </button>
          </div>

          <div className="panel">
            <h3>{t('profile.pwdTitle')}</h3>
            <label className="field">
              <span>{t('profile.oldPwd')}</span>
              <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
            </label>
            <label className="field">
              <span>{t('profile.newPwd')}</span>
              <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            </label>
            <label className="field">
              <span>{t('profile.confirmPwd')}</span>
              <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
            </label>
            {pwdMsg && (
              <div className={`alert ${pwdMsg.startsWith('✓') ? 'alert-ok' : 'alert-error'}`}>
                {pwdMsg}
              </div>
            )}
            <button
              className="btn btn-primary btn-block"
              disabled={changingPwd || !oldPwd || newPwd.length < 6 || !confirmPwd}
              onClick={changePwd}
            >
              {t('profile.pwdBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
