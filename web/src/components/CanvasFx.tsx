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

/** Hero 流星雨（斜向划过 + 拖尾 + 星点闪烁；鼠标经过会撒出小流星）
 *
 * 性能要点（修复鼠标卡顿）：
 * 1) 主题色缓存 —— 原来每帧调 3 次 getComputedStyle，等于每秒 180 次强制样式重算，这是掉帧主因
 * 2) 渐变对象按长度分桶缓存 —— 原来每颗流星每帧 new 一个 CanvasGradient（GC 抖动）
 * 3) mousemove 不再调 getBoundingClientRect（强制回流）；rect 缓存，且按时间节流生成流星
 * 4) 位移改为 delta-time 驱动 + 60fps 上限 —— 120/144Hz 屏不再做双倍无用功
 * 5) 画布滚出视口 / 标签页隐藏时自动暂停 rAF
 * 6) 实测帧率低于 45fps 自动降载（减少流星、关掉鼠标拖尾）
 */
export function HeroCanvas({ height = 340 }: { height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    const still = reduceMotion();
    const host = canvas.parentElement ?? canvas;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const isMobile = window.innerWidth < 700;
    let w = 0;
    let h = 0;
    let raf = 0;
    let rect = canvas.getBoundingClientRect();
    let visible = true;
    let degraded = false;

    const BASE_METEORS = isMobile ? 4 : 8;
    let maxMeteors = isMobile ? 12 : 20; // 含鼠标流星的硬上限

    type Meteor = { x: number; y: number; len: number; speed: number; size: number; life: number; hot: boolean };
    type Star = { x: number; y: number; r: number; tw: number };
    let meteors: Meteor[] = [];
    let stars: Star[] = [];

    const ANGLE = Math.PI / 5.2; // 斜向下 ~35°
    const vx = Math.cos(ANGLE);
    const vy = Math.sin(ANGLE);

    /* —— 1. 主题色只在主题切换时读一次 —— */
    let C = { accent: '#f62c2b', orange: '#fb9920', ink: '#161412' };
    const readColors = () => {
      C = {
        accent: themeColor('--red', '#f62c2b'),
        orange: themeColor('--orange', '#fb9920'),
        ink: themeColor('--ink', '#161412'),
      };
      gradCache.clear();
    };
    const themeObserver = new MutationObserver(readColors);

    /* —— 2. 渐变按 20px 分桶缓存（局部坐标系，配合 translate/rotate 复用）—— */
    const gradCache = new Map<string, CanvasGradient>();
    const gradFor = (hot: boolean, len: number) => {
      const key = `${hot ? 1 : 0}:${len}`;
      let g = gradCache.get(key);
      if (!g) {
        const head = hot ? C.accent : C.orange;
        g = ctx.createLinearGradient(0, 0, -len, 0);
        g.addColorStop(0, head);
        g.addColorStop(0.35, head);
        g.addColorStop(1, 'transparent');
        gradCache.set(key, g);
      }
      return g;
    };
    const bucket = (n: number) => Math.max(20, Math.round(n / 20) * 20);

    const spawn = (hot = false, atX?: number, atY?: number): Meteor => ({
      x: atX ?? Math.random() * (w + h) - h * 0.6,
      y: atY ?? -20 - Math.random() * 80,
      len: bucket(hot ? 40 + Math.random() * 40 : 70 + Math.random() * 130),
      speed: hot ? 5 + Math.random() * 3 : 3.2 + Math.random() * 4.2,
      size: hot ? 1.2 : 1 + Math.random() * 1.5,
      life: 1,
      hot,
    });

    const measure = () => {
      rect = canvas.getBoundingClientRect();
    };

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round'; // 只设一次，不必每帧设
      measure();
      stars = Array.from({ length: isMobile ? 22 : 44 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.5,
        tw: Math.random() * Math.PI * 2,
      }));
      meteors = Array.from({ length: BASE_METEORS }, () => {
        const m = spawn();
        m.x = Math.random() * w;
        m.y = Math.random() * h;
        return m;
      });
    };

    /* —— 3. 鼠标：只读缓存的 rect，按时间节流 —— */
    let lastSpawn = 0;
    const onMove = (e: MouseEvent) => {
      if (still || degraded) return;
      const now = performance.now();
      if (now - lastSpawn < 90) return; // 节流：最多 ~11 颗/秒
      lastSpawn = now;
      if (meteors.length >= maxMeteors) return;
      meteors.push(spawn(true, e.clientX - rect.left, e.clientY - rect.top));
    };

    /* —— 4+5+6. 渲染：dt 驱动、60fps 上限、可见性暂停、低帧降载 —— */
    const FRAME = 1000 / 60;
    let last = 0;
    let fpsAcc = 0;
    let fpsCount = 0;

    const render = (dt: number) => {
      ctx.clearRect(0, 0, w, h);

      // 背景星点（呼吸闪烁）
      ctx.fillStyle = C.ink;
      for (const s of stars) {
        s.tw += 0.02 * dt;
        ctx.globalAlpha = 0.18 + Math.abs(Math.sin(s.tw)) * 0.3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 流星
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        if (!still) {
          m.x += vx * m.speed * dt;
          m.y += vy * m.speed * dt;
        }
        const head = m.hot ? C.accent : C.orange;

        // 局部坐标系里画（拖尾在 -len 处），复用缓存渐变
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(ANGLE);
        ctx.globalAlpha = m.hot ? 0.95 * m.life : 0.75;
        ctx.strokeStyle = gradFor(m.hot, m.len);
        ctx.lineWidth = m.size;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-m.len, 0);
        ctx.stroke();
        // 头部光点
        ctx.globalAlpha = m.hot ? m.life : 1;
        ctx.fillStyle = head;
        ctx.beginPath();
        ctx.arc(0, 0, m.size * 1.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (m.hot) {
          m.life -= 0.02 * dt;
          if (m.life <= 0) meteors.splice(i, 1);
        } else if (m.x - vx * m.len > w + 40 || m.y - vy * m.len > h + 40) {
          meteors[i] = spawn(); // 复用：从左上重新入场
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!last) last = now;
      const elapsed = now - last;
      if (elapsed < FRAME - 1) return; // 高刷屏跳帧：稳定 60fps，算力减半
      last = now;
      const dt = Math.min(elapsed, 50) / FRAME; // 卡顿/切后台回来不会瞬移

      render(dt);

      // 自适应降载：连续 60 帧平均低于 45fps 就削减特效
      if (!degraded) {
        fpsAcc += elapsed;
        if (++fpsCount >= 60) {
          if (fpsAcc / fpsCount > 22) {
            degraded = true;
            maxMeteors = BASE_METEORS;
            meteors = meteors.filter((m) => !m.hot).slice(0, BASE_METEORS);
            stars = stars.slice(0, 16);
          }
          fpsAcc = 0;
          fpsCount = 0;
        }
      }
    };

    const sync = () => {
      const shouldRun = visible && !document.hidden && !still;
      if (shouldRun && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      } else if (!shouldRun && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );

    readColors();
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    resize();
    if (still) render(0); // 减少动效：只画一帧静态星图

    io.observe(canvas);
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', measure, { passive: true });
    document.addEventListener('visibilitychange', sync);
    host.addEventListener('mousemove', onMove as EventListener, { passive: true });
    sync();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      themeObserver.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', measure);
      document.removeEventListener('visibilitychange', sync);
      host.removeEventListener('mousemove', onMove as EventListener);
      gradCache.clear();
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
