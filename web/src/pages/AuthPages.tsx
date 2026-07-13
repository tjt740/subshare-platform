import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { track } from '../track';

function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useApp();
  const { t: t2 } = useI18n();
  const [showPwd, setShowPwd] = useState(false);
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'register' && password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        track('login', { email });
      } else {
        await register(email, password);
        track('signup', { email });
      }
      navigate(location.state?.from || '/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>{mode === 'login' ? '欢迎回来' : '创建账号'}</h2>
      <p className="auth-sub">
        {mode === 'login'
          ? '登录后管理你的订阅与订单'
          : '注册即可用更低价格享受高级订阅'}
      </p>
      <form onSubmit={submit}>
        <label className="field">
          <span>邮箱</span>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>密码</span>
          <div className="pwd-wrap">
            <input
              type={showPwd ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="至少 6 位"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          {mode === 'register' && password.length > 0 && (
            <span className={`pwd-strength s${password.length >= 12 ? 3 : password.length >= 8 ? 2 : 1}`}>
              强度：{password.length >= 12 ? '强' : password.length >= 8 ? '中' : '弱'}
            </span>
          )}
        </label>
        {mode === 'register' && (
          <label className="field">
            <span>确认密码</span>
            <input
              type="password"
              required
              minLength={6}
              placeholder="再次输入密码"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
        )}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button
          className="btn btn-primary btn-lg btn-block"
          disabled={submitting}
        >
          {submitting ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>
      </form>
      {mode === 'login' && (
        <p className="auth-switch">
          <Link to="/forgot">{t2('auth.forgot')}</Link>
        </p>
      )}
      <p className="auth-switch">
        {mode === 'login' ? (
          <>
            还没有账号？<Link to="/register">立即注册</Link>
          </>
        ) : (
          <>
            已有账号？<Link to="/login">直接登录</Link>
          </>
        )}
      </p>

    </div>
  );
}

export const LoginPage = () => <AuthForm mode="login" />;
export const RegisterPage = () => <AuthForm mode="register" />;
