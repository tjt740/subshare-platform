import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtTime } from '../api';
import { useApp } from '../store';
import { useI18n } from '../i18n';

interface TicketRow {
  id: number;
  subject: string;
  status: string;
  category?: string;
  updatedAt: string;
}

/* ---------- 值班客服（人格化：轮班制，增强真人在线感） ---------- */
const AGENTS = [
  { name: '小柚', emoji: '🍊', title: '交付专员' },
  { name: 'Lily', emoji: '👩‍💼', title: '售后主管' },
  { name: '阿哲', emoji: '🧑‍💻', title: '技术支持' },
  { name: '小北', emoji: '🐻', title: '客服专员' },
  { name: 'Momo', emoji: '🐱', title: '资深客服' },
];

/** 按 6 小时轮班 + 按天轮换，让"值班客服"随时间自然变化 */
export function onDutyAgent(offset = 0) {
  const now = new Date();
  const shiftIdx = Math.floor(now.getHours() / 6);
  const day = Math.floor(now.getTime() / 86400000);
  const agent = AGENTS[(day + shiftIdx + offset) % AGENTS.length];
  return { agent, shiftIdx };
}
/** 每张工单固定跟进客服（可信的一致性） */
const agentForTicket = (ticketId: number) => AGENTS[ticketId % AGENTS.length];

const CATEGORY_KEYS: Record<string, string> = {
  general: 'cs.cat.general',
  aftersales_reissue: 'cs.cat.reissue',
  aftersales_refund: 'cs.cat.refund',
  aftersales_swap: 'cs.cat.swap',
};
interface TicketDetail extends TicketRow {
  orderNo: string | null;
  messages: { id: number; senderRole: string; content: string; createdAt: string }[];
}
interface OrderOpt {
  id: number;
  orderNo: string;
  productTitle: string;
}

/** 右下角客服悬浮窗（工单式在线客服，对标 GamsGo 右下角聊天入口） */
export default function SupportWidget() {
  const { token } = useApp();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'new' | 'thread'>('list');
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [current, setCurrent] = useState<TicketDetail | null>(null);
  const [orders, setOrders] = useState<OrderOpt[]>([]);
  // 新工单
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [orderId, setOrderId] = useState<number | ''>('');
  const [category, setCategory] = useState('general');
  const [subscriptionId, setSubscriptionId] = useState<number | undefined>();
  // 回复
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(() => {
    if (!token) return;
    api<TicketRow[]>('/me/tickets', { token }).then(setTickets).catch(() => undefined);
  }, [token]);

  useEffect(() => {
    if (open) {
      loadList();
      if (token) {
        api<OrderOpt[]>('/me/orders', { token })
          .then((os: any[]) => setOrders(os.slice(0, 10)))
          .catch(() => undefined);
      }
    }
  }, [open, token, loadList]);

  // 售后一键直达：订阅卡/订单行触发，自动打开并预填
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      setOpen(true);
      setView('new');
      setCurrent(null);
      setSubject(d.subject ?? '');
      setContent(d.content ?? '');
      setOrderId(d.orderId ?? '');
      setCategory(d.category ?? 'general');
      setSubscriptionId(d.subscriptionId);
    };
    window.addEventListener('ss-support', handler);
    return () => window.removeEventListener('ss-support', handler);
  }, []);

  // 会话轮询（模拟实时客服）
  useEffect(() => {
    if (!open || view !== 'thread' || !current) return;
    const timer = setInterval(() => {
      api<TicketDetail>(`/tickets/${current.id}`, { token })
        .then(setCurrent)
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(timer);
  }, [open, view, current?.id, token]);

  useEffect(() => {
    bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight);
  }, [current?.messages?.length, view]);

  async function openTicket(id: number) {
    const detail = await api<TicketDetail>(`/tickets/${id}`, { token });
    setCurrent(detail);
    setView('thread');
  }

  async function createTicket() {
    if (!subject.trim() || !content.trim()) return;
    setBusy(true);
    try {
      const t = await api<{ id: number }>('/tickets', {
        method: 'POST',
        token,
        body: JSON.stringify({
          subject: subject.trim(),
          content: content.trim(),
          category,
          ...(orderId ? { orderId } : {}),
          ...(subscriptionId ? { subscriptionId } : {}),
        }),
      });
      setSubject('');
      setContent('');
      setOrderId('');
      setCategory('general');
      setSubscriptionId(undefined);
      await openTicket(t.id);
      loadList();
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!current || !reply.trim()) return;
    setBusy(true);
    try {
      const updated = await api<TicketDetail>(`/tickets/${current.id}/messages`, {
        method: 'POST',
        token,
        body: JSON.stringify({ content: reply.trim() }),
      });
      setCurrent(updated);
      setReply('');
    } finally {
      setBusy(false);
    }
  }

  async function closeTicket() {
    if (!current) return;
    await api(`/tickets/${current.id}/close`, { method: 'POST', token });
    await openTicket(current.id);
    loadList();
  }

  const { agent: duty, shiftIdx } = onDutyAgent();
  const shift = t(`cs.shift${shiftIdx}`);

  if (!open) {
    return (
      <button className="cs-fab" onClick={() => setOpen(true)} title={`${duty.name} · ${t('cs.online')}`}>
        💬
        <span className="fab-dot" />
      </button>
    );
  }

  const threadAgent = current ? agentForTicket(current.id) : duty;

  return (
    <>
      <button className="cs-fab" onClick={() => setOpen(false)} title="收起">
        ✕
      </button>
      <div className="cs-panel">
        <div className="cs-head">
          {view !== 'list' ? (
            <button
              className="cs-back"
              onClick={() => {
                setView('list');
                setCurrent(null);
                loadList();
              }}
            >
              {t('cs.back')}
            </button>
          ) : (
            <div className="cs-agent">
              <span className="cs-avatar">
                {duty.emoji}
                <i className="online-dot" />
              </span>
              <div>
                <b>{t('cs.duty', { name: duty.name, title: duty.title })}</b>
                <p>
                  <i className="online-dot inline" /> {t('cs.online')} · {t('cs.shiftDuty', { shift })} · {t('cs.avg')}
                </p>
              </div>
            </div>
          )}
          {view === 'new' && (
            <div className="cs-agent" style={{ marginTop: 6 }}>
              <span className="cs-avatar">
                {duty.emoji}
                <i className="online-dot" />
              </span>
              <div>
                <b>{t('cs.serving', { name: duty.name })}</b>
                <p>{t('cs.shiftDuty', { shift })} · {duty.title}</p>
              </div>
            </div>
          )}
          {view === 'thread' && current && (
            <div className="cs-agent" style={{ marginTop: 6 }}>
              <span className="cs-avatar">
                {threadAgent.emoji}
                <i className="online-dot" />
              </span>
              <div>
                <b>{current.subject}</b>
                <p>
                  {t('cs.following', { name: threadAgent.name })} · {t(`tstatus.${current.status}`)}
                  {current.orderNo ? ` · ${t('cs.order')} ${current.orderNo}` : ''}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 未登录 */}
        {!token && (
          <div className="cs-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <p className="muted" style={{ marginBottom: 12 }}>{t('cs.loginFirst')}</p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setOpen(false);
                  navigate('/login');
                }}
              >
                {t('cs.goLogin')}
              </button>
            </div>
          </div>
        )}

        {/* 工单列表 */}
        {token && view === 'list' && (
          <div className="cs-body">
            <div className="cs-shift-note">
              {t('cs.handover', { prev: t(`cs.shift${(shiftIdx + 3) % 4}`), a: onDutyAgent(-1).agent.name, b: duty.name })}
            </div>
            <button className="btn btn-primary btn-block cs-new-btn" onClick={() => setView('new')}>
              {t('cs.new')}
            </button>
            {tickets.length === 0 && (
              <div className="empty" style={{ padding: '28px 0' }}>
                {t('cs.empty')}
              </div>
            )}
            {tickets.map((tk) => (
              <div className="ticket-row" key={tk.id} onClick={() => openTicket(tk.id)}>
                <div className="t-head">
                  <b>{tk.subject}</b>
                  <span className={`badge badge-${tk.status}`}>
                    {t(`tstatus.${tk.status}`)}
                  </span>
                </div>
                <div className="muted small">
                  {tk.category && tk.category !== 'general' ? `${t(CATEGORY_KEYS[tk.category] ?? '')} · ` : ''}
                  {fmtTime(tk.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 新建工单 */}
        {token && view === 'new' && (
          <div className="cs-body">
            <div className="msg admin">
              <div className="bubble">
                {t('cs.greeting', { shift, name: duty.name, title: duty.title })}
              </div>
              <div className="m-time">
                {duty.emoji} {duty.name} · {t('cs.official')} · {t('cs.justNow')}
              </div>
            </div>
            <label className="field">
              <span>{t('cs.type')}</span>
              <select
                className="region-select"
                style={{ width: '100%' }}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {Object.entries(CATEGORY_KEYS).map(([v, k]) => (
                  <option key={v} value={v}>
                    {t(k)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('cs.subject')}</span>
              <input
                style={{ width: '100%' }}
                className="search-input"
                placeholder={t('cs.subjectPh')}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t('cs.linkOrder')}</span>
              <select
                className="region-select"
                style={{ width: '100%' }}
                value={orderId}
                onChange={(e) => setOrderId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">{t('cs.noOrder')}</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNo} · {o.productTitle}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('cs.desc')}</span>
              <textarea
                rows={4}
                style={{
                  width: '100%',
                  border: '1.5px solid var(--border)',
                  borderRadius: 10,
                  padding: '9px 12px',
                  fontSize: 13.5,
                  fontFamily: 'inherit',
                  resize: 'none',
                }}
                placeholder={t('cs.descPh')}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </label>
            <button
              className="btn btn-primary btn-block"
              disabled={busy || !subject.trim() || !content.trim()}
              onClick={createTicket}
            >
              {t('cs.submit')}
            </button>
          </div>
        )}

        {/* 会话 */}
        {token && view === 'thread' && current && (
          <>
            <div className="cs-body" ref={bodyRef}>
              {current.messages.map((m) => (
                <div className={`msg ${m.senderRole}`} key={m.id}>
                  <div className="bubble">{m.content}</div>
                  <div className="m-time">
                    {m.senderRole === 'admin'
                      ? `${threadAgent.emoji} ${threadAgent.name} · ${t('cs.official')} · `
                      : ''}
                    {fmtTime(m.createdAt)}
                  </div>
                </div>
              ))}
              {current.status === 'open' && (
                <div className="msg admin">
                  <div className="bubble typing">
                    <span className="typing-dots">
                      <i /><i /><i />
                    </span>
                    {t('cs.processing', { name: threadAgent.name })}
                  </div>
                </div>
              )}
              {current.status === 'closed' && (
                <div className="empty" style={{ padding: '14px 0', fontSize: 12.5 }}>
                  {t('cs.closedLine')}
                </div>
              )}
            </div>
            {current.status !== 'closed' && (
              <div className="cs-foot">
                <input
                  placeholder={t('cs.replyPh')}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                />
                <button className="btn btn-primary btn-sm" disabled={busy || !reply.trim()} onClick={sendReply}>
                  {t('cs.send')}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={closeTicket} title="关闭工单">
                  ✓
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
