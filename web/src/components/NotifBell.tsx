import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtTime } from '../api';
import { useApp } from '../store';
import Icon from './Icon';

interface Notif {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

/** 站内通知铃铛（登录后显示）：到期提醒等，红点未读，点击标记已读并跳转 */
export default function NotifBell() {
  const { token } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!token) return;
    api<{ items: Notif[]; unread: number }>('/me/notifications', { token })
      .then((r) => {
        setItems(r.items);
        setUnread(r.unread);
      })
      .catch(() => undefined);
  }, [token]);

  useEffect(() => {
    load();
    if (!token) return;
    const timer = setInterval(load, 60_000); // 每分钟轮询一次
    return () => clearInterval(timer);
  }, [load, token]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  if (!token) return null;

  async function openItem(n: Notif) {
    setOpen(false);
    if (!n.read) {
      await api(`/me/notifications/${n.id}/read`, { method: 'POST', token }).catch(() => undefined);
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.link) navigate(n.link);
  }

  async function readAll() {
    await api('/me/notifications/read-all', { method: 'POST', token }).catch(() => undefined);
    setUnread(0);
    setItems((list) => list.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="notif-bell" ref={boxRef}>
      <button
        className="bell-btn"
        aria-label={`通知${unread ? `（${unread} 条未读）` : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" size={18} />
        {unread > 0 && <span className="bell-dot">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label="通知">
          <div className="notif-head">
            <b>通知</b>
            {unread > 0 && (
              <button className="link-btn" onClick={readAll}>
                全部已读
              </button>
            )}
          </div>
          <div className="notif-list">
            {items.length === 0 ? (
              <div className="notif-empty">暂无通知</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  className={`notif-item ${n.read ? '' : 'unread'}`}
                  onClick={() => openItem(n)}
                >
                  <div className="ni-title">{n.title}</div>
                  <div className="ni-body">{n.body}</div>
                  <div className="ni-time">{fmtTime(n.createdAt)}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
