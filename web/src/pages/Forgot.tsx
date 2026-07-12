import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

/** 忘记密码 → 获取重置令牌 → 设置新密码（演示环境令牌直接返回；生产走邮件） */
export default function Forgot() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ demoToken?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setStep(2);
      if (r.demoToken) {
        setToken(r.demoToken);
        setMsg('演示环境：重置令牌已自动填入（正式环境将发送到你的邮箱，30 分钟内有效）');
      } else {
        setMsg('如果该邮箱已注册，重置链接已发送，请查收邮件（30 分钟内有效）');
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (pwd !== pwd2) {
      setErr('两次输入的新密码不一致');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim(), newPassword: pwd }),
      });
      navigate('/login', { state: { notice: '密码已重置，请用新密码登录' } });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>找回密码</h2>
      <p className="auth-sub">
        {step === 1 ? '输入注册邮箱，我们会发送重置链接' : '填写令牌并设置新密码'}
      </p>

      {step === 1 ? (
        <form onSubmit={request}>
          <label className="field">
            <span>注册邮箱</span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {err && <div className="alert alert-error" role="alert">{err}</div>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? '提交中…' : '发送重置链接'}
          </button>
        </form>
      ) : (
        <form onSubmit={reset}>
          {msg && <div className="alert alert-ok">{msg}</div>}
          <label className="field">
            <span>重置令牌</span>
            <input
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="粘贴邮件中的令牌"
            />
          </label>
          <label className="field">
            <span>新密码（至少 6 位）</span>
            <div className="pwd-wrap">
              <input
                type={showPwd ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
              />
              <button
                type="button"
                className="pwd-toggle"
                aria-label={showPwd ? '隐藏密码' : '显示密码'}
                onClick={() => setShowPwd((s) => !s)}
              >
                {showPwd ? '🙈' : '👁'}
              </button>
            </div>
          </label>
          <label className="field">
            <span>确认新密码</span>
            <input
              type={showPwd ? 'text' : 'password'}
              required
              minLength={6}
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
            />
          </label>
          {err && <div className="alert alert-error" role="alert">{err}</div>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? '提交中…' : '重置密码'}
          </button>
        </form>
      )}

      <p className="auth-switch">
        想起来了？<Link to="/login">返回登录</Link>
      </p>
    </div>
  );
}
