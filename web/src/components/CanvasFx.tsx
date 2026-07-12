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

/** Hero 粒子星座背景 */
export function HeroCanvas({ height = 340 }: { height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || reduceMotion()) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const isMobile = window.innerWidth < 700;
    const COUNT = isMobile ? 26 : 54;
    let w = 0;
    let h = 0;
    let raf = 0;
    const mouse = { x: -999, y: -999 };

    type P = { x: number; y: number; vx: number; vy: number; r: number };
    let pts: P[] = [];

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pts = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 2.2 + 1,
      }));
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -999;
      mouse.y = -999;
    };

    const draw = () => {
      const accent = themeColor('--red', '#f62c2b');
      const ink = themeColor('--ink', '#161412');
      ctx.clearRect(0, 0, w, h);

      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        // 鼠标轻微吸引
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 130 * 130) {
          p.x += dx * 0.0016;
          p.y += dy * 0.0016;
        }
      }

      // 连线
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < 108) {
            ctx.globalAlpha = (1 - dist / 108) * 0.22;
            ctx.strokeStyle = ink;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }

      // 粒子
      for (const p of pts) {
        const near = Math.hypot(mouse.x - p.x, mouse.y - p.y) < 130;
        ctx.globalAlpha = near ? 0.95 : 0.55;
        ctx.fillStyle = near ? accent : ink;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
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
