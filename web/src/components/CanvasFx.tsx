import React, { useEffect, useRef } from 'react';

/**
 * Canvas 动效（不依赖第三方库，尊重 prefers-reduced-motion，移动端自动降载）
 * - HeroCanvas：Hero 区漂浮粒子 + 连线星座（跟随鼠标轻微视差）
 * - ConfettiBurst：支付/交付成功时的礼花爆发（一次性）
 */

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function themeColor(varName: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

/** Hero 流星雨（斜向划过 + 拖尾 + 星点闪烁；鼠标经过会撒出小流星） */
export function HeroCanvas({ height = 340 }: { height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const still = reduceMotion();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const isMobile = window.innerWidth < 700;
    let w = 0;
    let h = 0;
    let raf = 0;

    type Meteor = { x: number; y: number; len: number; speed: number; size: number; life: number; hot: boolean };
    type Star = { x: number; y: number; r: number; tw: number };
    let meteors: Meteor[] = [];
    let stars: Star[] = [];

    const ANGLE = Math.PI / 5.2; // 斜向下 ~35°
    const vx = Math.cos(ANGLE);
    const vy = Math.sin(ANGLE);

    const spawn = (hot = false, atX?: number, atY?: number): Meteor => ({
      x: atX ?? Math.random() * (w + h) - h * 0.6,
      y: atY ?? -20 - Math.random() * 80,
      len: hot ? 40 + Math.random() * 40 : 70 + Math.random() * 130,
      speed: hot ? 5 + Math.random() * 3 : 3.2 + Math.random() * 4.2,
      size: hot ? 1.2 : 1 + Math.random() * 1.5,
      life: 1,
      hot,
    });

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: isMobile ? 22 : 44 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.5,
        tw: Math.random() * Math.PI * 2,
      }));
      meteors = Array.from({ length: isMobile ? 4 : 8 }, () => {
        const m = spawn();
        m.x = Math.random() * w;
        m.y = Math.random() * h;
        return m;
      });
    };

    const onMove = (e: MouseEvent) => {
      if (still || Math.random() > 0.12) return;
      const rect = canvas.getBoundingClientRect();
      meteors.push(spawn(true, e.clientX - rect.left, e.clientY - rect.top));
      if (meteors.length > 40) meteors.shift();
    };

    const draw = () => {
      const accent = themeColor('--red', '#f62c2b');
      const orange = themeColor('--orange', '#fb9920');
      const ink = themeColor('--ink', '#161412');
      ctx.clearRect(0, 0, w, h);

      // 背景星点（呼吸闪烁）
      for (const s of stars) {
        s.tw += 0.02;
        ctx.globalAlpha = 0.18 + Math.abs(Math.sin(s.tw)) * 0.3;
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 流星
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        if (!still) {
          m.x += vx * m.speed;
          m.y += vy * m.speed;
        }
        const tailX = m.x - vx * m.len;
        const tailY = m.y - vy * m.len;

        const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        const head = m.hot ? accent : orange;
        grad.addColorStop(0, head);
        grad.addColorStop(0.35, head);
        grad.addColorStop(1, 'transparent');

        ctx.globalAlpha = m.hot ? 0.95 : 0.75;
        ctx.strokeStyle = grad;
        ctx.lineWidth = m.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // 流星头部光点
        ctx.globalAlpha = 1;
        ctx.fillStyle = head;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size * 1.1, 0, Math.PI * 2);
        ctx.fill();

        if (m.hot) {
          m.life -= 0.02;
          if (m.life <= 0) meteors.splice(i, 1);
        } else if (m.x - vx * m.len > w + 40 || m.y - vy * m.len > h + 40) {
          meteors[i] = spawn(); // 复用：从左上重新入场
        }
      }

      ctx.globalAlpha = 1;
      if (!still) raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', onMove, { passive: true });
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMove);
    };
  }, []);

  return <canvas ref={ref} className="hero-canvas" style={{ height }} aria-hidden />;
}

/** 成功时的礼花（一次性，2 秒后自动消失） */
export function ConfettiBurst({ fire }: { fire: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire) return;
    const canvas = ref.current;
    if (!canvas || reduceMotion()) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = (canvas.width = canvas.clientWidth * dpr);
    const h = (canvas.height = canvas.clientHeight * dpr);
    ctx.scale(dpr, dpr);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    const colors = [
      themeColor('--red', '#f62c2b'),
      themeColor('--orange', '#fb9920'),
      themeColor('--yellow', '#ffcf3f'),
      themeColor('--ink', '#161412'),
    ];
    type C = { x: number; y: number; vx: number; vy: number; s: number; rot: number; vr: number; c: string };
    const parts: C[] = Array.from({ length: 90 }, () => ({
      x: W / 2,
      y: H * 0.38,
      vx: (Math.random() - 0.5) * 9,
      vy: Math.random() * -9 - 2,
      s: Math.random() * 6 + 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));

    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const t = Date.now() - start;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.24; // 重力
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - t / 2000);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (t < 2000) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire]);

  return <canvas ref={ref} className="confetti-canvas" aria-hidden />;
}

/** 客服「一直在线」信号动画（Canvas 声波脉冲） */
export function OnlinePulse({ size = 22 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const still = reduceMotion();

    let raf = 0;
    const start = Date.now();
    const draw = () => {
      const t = (Date.now() - start) / 1000;
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;
      // 呼吸波纹
      if (!still) {
        for (let i = 0; i < 2; i++) {
          const phase = (t * 0.8 + i * 0.5) % 1;
          ctx.beginPath();
          ctx.arc(cx, cy, 3 + phase * (size / 2 - 3), 0, Math.PI * 2);
          ctx.strokeStyle = '#4ade80';
          ctx.globalAlpha = (1 - phase) * 0.6;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }
      // 中心实心点
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = '#4ade80';
      ctx.fill();
      if (!still) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return <canvas ref={ref} style={{ width: size, height: size }} className="online-pulse" aria-hidden />;
}
