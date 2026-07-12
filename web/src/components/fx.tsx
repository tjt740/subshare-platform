import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

/* ============ 跑马灯 ============ */
export function Marquee({
  items,
  className = '',
  reverse = false,
}: {
  items: string[];
  className?: string;
  reverse?: boolean;
}) {
  const content = items.join('  ✺  ') + '  ✺  ';
  return (
    <div className={`marquee ${className}`} aria-hidden>
      <div className={`marquee-track ${reverse ? 'reverse' : ''}`}>
        <span>{content}</span>
        <span>{content}</span>
        <span>{content}</span>
      </div>
    </div>
  );
}

/* ============ 首次加载开屏（轻量、纸色、不阻塞） ============ */
export function BootSplash() {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGone(true), 900);
    return () => clearTimeout(t);
  }, []);
  if (gone) return null;
  return (
    <div className="boot-splash">
      <div className="boot-logo">
        SUBSHARE <span className="spin-star">✺</span>
      </div>
    </div>
  );
}

/* ============ 自定义光标（仅桌面精准指针设备） ============ */
export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dot = dotRef.current!;
    const ring = ringRef.current!;
    let rx = -100, ry = -100, tx = -100, ty = -100, raf = 0;

    const move = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      dot.style.transform = `translate(${tx}px, ${ty}px)`;
      const target = e.target as HTMLElement;
      const hot = !!target.closest(
        'a, button, .plan-item, .provider-item, .product-card, .amount-chip, .cat-chip, .ticket-row, select, input, textarea, summary, .tab, .theme-swatch',
      );
      ring.classList.toggle('hot', hot);
    };
    const loop = () => {
      rx += (tx - rx) * 0.18;
      ry += (ty - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      raf = requestAnimationFrame(loop);
    };
    document.addEventListener('mousemove', move, { passive: true });
    raf = requestAnimationFrame(loop);
    document.body.classList.add('has-cursor');
    return () => {
      document.removeEventListener('mousemove', move);
      cancelAnimationFrame(raf);
      document.body.classList.remove('has-cursor');
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="cursor-ring" aria-hidden />
      <div ref={dotRef} className="cursor-dot" aria-hidden />
    </>
  );
}

/* ============ 滚动显现 ============ */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add('in');
            io.disconnect();
          }
        });
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`rv ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ============ 主题系统：5 套预置配色/风格 ============ */
export const THEMES = [
  { id: 'supari', name: '红橙海报', desc: '大胆 · 贴纸 · 硬阴影', dots: ['#f62c2b', '#fb9920', '#f6f1e7'] },
  { id: 'mono', name: '极简黑白', desc: '克制 · 留白 · 细线条', dots: ['#111111', '#666666', '#ffffff'] },
  { id: 'noir', name: '午夜霓虹', desc: '深色 · 紫青 · 柔光', dots: ['#7c5cff', '#00d4c4', '#0e0e13'] },
  { id: 'pastel', name: '奶油马卡龙', desc: '柔和 · 圆润 · 甜感', dots: ['#e879a6', '#63c7a6', '#fdf6f9'] },
  { id: 'ocean', name: '清爽科技蓝', desc: '干净 · 商务 · 信任感', dots: ['#2563eb', '#06b6d4', '#f2f6fb'] },
  { id: 'forest', name: '苔原森林', desc: '自然 · 治愈 · 墨绿', dots: ['#2f7d4f', '#8bc34a', '#f1f5ec'] },
  { id: 'grape', name: '葡萄气泡', desc: '轻盈 · 紫粉 · 活泼', dots: ['#8b5cf6', '#f472b6', '#f5f2fc'] },
  { id: 'coffee', name: '复古咖啡', desc: '温暖 · 复古 · 焦糖', dots: ['#a0522d', '#d4a373', '#efe6da'] },
];

/* ============ 表盘时钟（24h 语义下的模拟表盘，本地时区） ============ */
export function AnalogClock({ size = 66 }: { size?: number }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const s = now.getSeconds();
  const m = now.getMinutes();
  const h = now.getHours() % 12;
  const sd = s * 6;
  const md = m * 6 + s * 0.1;
  const hd = h * 30 + m * 0.5;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="aclock" aria-hidden>
      <circle cx="50" cy="50" r="46" className="ac-face" />
      {Array.from({ length: 12 }).map((_, i) => (
        <line
          key={i}
          x1="50" y1="8" x2="50" y2={i % 3 === 0 ? 17 : 12.5}
          className={`ac-tick ${i % 3 === 0 ? 'big' : ''}`}
          transform={`rotate(${i * 30} 50 50)`}
        />
      ))}
      <line x1="50" y1="50" x2="50" y2="27" className="ac-hand hour" transform={`rotate(${hd} 50 50)`} />
      <line x1="50" y1="50" x2="50" y2="17" className="ac-hand min" transform={`rotate(${md} 50 50)`} />
      <line x1="50" y1="56" x2="50" y2="13" className="ac-hand sec" transform={`rotate(${sd} 50 50)`} />
      <circle cx="50" cy="50" r="3.4" className="ac-dot" />
    </svg>
  );
}

/* ============ 运行状态时钟（本地时区 + API 心跳 + 运行时长） ============ */
export function StatusClock({ compact = false }: { compact?: boolean }) {
  const { t, locale } = useI18n();
  const [now, setNow] = useState(() => new Date());
  const [ok, setOk] = useState(true);
  const baseRef = useRef<{ at: number; uptimeSec: number } | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    const poll = () =>
      fetch('/api/health')
        .then((r) => r.json())
        .then((h) => {
          if (!alive) return;
          setOk(true);
          baseRef.current = { at: Date.now(), uptimeSec: h.uptimeSec ?? 0 };
          force((x) => x + 1);
        })
        .catch(() => alive && setOk(false));
    poll();
    const timer = setInterval(poll, 20000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const timeStr = now.toLocaleTimeString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    hour12: false,
  });
  const up = baseRef.current
    ? baseRef.current.uptimeSec +
      Math.floor((Date.now() - baseRef.current.at) / 1000)
    : 0;
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmtUp = (s: number) =>
    `${Math.floor(s / 86400) > 0 ? Math.floor(s / 86400) + 'd ' : ''}${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

  if (compact) {
    return (
      <span
        className={`clock-chip ${ok ? '' : 'bad'}`}
        title={`${t(ok ? 'status.ok' : 'status.degraded')} · ${t('status.uptime', { t: fmtUp(up) })} · ${tz}`}
      >
        <i className={`status-dot ${ok ? '' : 'bad'}`} />
        {timeStr}
      </span>
    );
  }
  return (
    <div className="status-strip">
      <AnalogClock />
      <div className="status-lines">
        <span>
          <i className={`status-dot ${ok ? '' : 'bad'}`} />
          {t(ok ? 'status.ok' : 'status.degraded')}
        </span>
        <span>
          🕐 {timeStr} · 🌍 {tz} · ⏱ {t('status.uptime', { t: fmtUp(up) })}
        </span>
      </div>
    </div>
  );
}

export function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem('ss_theme') || 'supari',
  );
  const boxRef = useRef<HTMLDivElement>(null);

  function apply(id: string) {
    setTheme(id);
    localStorage.setItem('ss_theme', id);
    document.documentElement.dataset.theme = id;
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="theme-picker" ref={boxRef}>
      <button
        className="theme-btn"
        title="切换主题风格"
        onClick={() => setOpen((o) => !o)}
      >
        🎨
      </button>
      {open && (
        <div className="theme-panel">
          <div className="theme-panel-title">选择界面风格</div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-swatch ${theme === t.id ? 'active' : ''}`}
              onClick={() => apply(t.id)}
            >
              <span className="dots">
                {t.dots.map((c, i) => (
                  <i key={i} style={{ background: c }} />
                ))}
              </span>
              <span className="tp-name">
                {t.name}
                <small>{t.desc}</small>
              </span>
              {theme === t.id && <span className="tp-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
