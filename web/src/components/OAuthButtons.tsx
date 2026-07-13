import React, { useEffect, useState } from 'react';
import Icon, { IconName } from './Icon';
import { track } from '../track';

/**
 * 第三方登录入口（Google / GitHub / Microsoft）
 *
 * 流程与后端一致：直接把浏览器导航到 /api/auth/oauth/:provider/start，
 * 后端要么 302 到厂商授权页（已配置密钥），要么 302 回演示回调（未配置密钥）。
 * 前端两种情况完全一样，不需要分支。
 */
interface Provider {
  name: 'google' | 'github' | 'microsoft';
  label: string;
  configured: boolean;
  mode: 'oauth' | 'demo';
}

const ICON: Record<string, IconName> = {
  google: 'google',
  github: 'github',
  microsoft: 'microsoft',
};

export default function OAuthButtons({ next = '/' }: { next?: string }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/auth/oauth/providers')
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => setProviders([]));

    // 后端授权失败会重定向回 /login?oauth_error=...
    const q = new URLSearchParams(window.location.search);
    const e = q.get('oauth_error');
    if (e) setErr(e);
  }, []);

  if (!providers.length) return null;
  const demoMode = providers.some((p) => p.mode === 'demo');

  const go = (p: Provider) => {
    track('oauth_start', { provider: p.name, mode: p.mode });
    // 整页跳转（OAuth 必须走浏览器导航，不能用 fetch）
    window.location.href = `/api/auth/oauth/${p.name}/start?next=${encodeURIComponent(next)}`;
  };

  return (
    <div className="oauth-box">
      {err && (
        <div className="alert alert-error" role="alert">
          第三方登录失败：{err}
        </div>
      )}
      <div className="oauth-sep">
        <span>或使用第三方账号</span>
      </div>
      <div className="oauth-grid">
        {providers.map((p) => (
          <button
            key={p.name}
            type="button"
            className={`btn btn-ghost oauth-btn oa-${p.name}`}
            onClick={() => go(p)}
            data-track="click"
            data-track-label={`oauth_${p.name}`}
          >
            <Icon name={ICON[p.name]} size={17} />
            <span>{p.label}</span>
          </button>
        ))}
      </div>
      {demoMode && (
        <p className="tiny-note oauth-note">
          <Icon name="info" size={12} /> 未配置 OAuth 密钥的渠道当前为演示模式：点击即模拟第三方授权并登录。
          在 <code>server/.env</code> 填入 Client ID / Secret 后自动切换为真实登录。
        </p>
      )}
    </div>
  );
}
