import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { track } from '../track';
import Icon from '../components/Icon';

/**
 * 第三方登录回调落地页：/oauth/callback#token=...&provider=...&next=...
 *
 * token 放在 URL fragment（# 后面）而不是 query：
 * fragment 不会发给服务器，也不会出现在 Referer 头和访问日志里。
 * 读取后立刻用 replaceState 抹掉，避免留在浏览器历史中。
 */
export default function OAuthCallback() {
  const { applyToken } = useApp();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const frag = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = frag.get('token');
    const provider = frag.get('provider') || 'oauth';
    const next = frag.get('next') || '/';
    const demo = frag.get('demo') === '1';

    // 立刻从地址栏与历史记录中清掉 token
    window.history.replaceState(null, '', '/oauth/callback');

    if (!token) {
      setError('未收到登录凭证，请重新登录');
      return;
    }

    applyToken(token)
      .then(() => {
        track('login', { method: provider, oauth: true, demo });
        navigate(next.startsWith('/') ? next : '/', { replace: true });
      })
      .catch((e: any) => setError(e?.message || '登录失败，请重试'));
  }, [applyToken, navigate]);

  return (
    <div className="auth-card oauth-landing">
      {error ? (
        <>
          <h2>登录失败</h2>
          <div className="alert alert-error" role="alert">{error}</div>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/login')}>
            返回登录
          </button>
        </>
      ) : (
        <>
          <div className="oauth-spin" aria-hidden>
            <Icon name="refresh" size={28} />
          </div>
          <h2>正在完成登录…</h2>
          <p className="auth-sub">已收到第三方授权，正在为你建立会话</p>
        </>
      )}
    </div>
  );
}
