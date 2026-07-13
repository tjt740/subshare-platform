import React, { useEffect, useRef } from 'react';

/**
 * 全站背景层（固定在视口后方，随滚动做视差）
 *
 * 目标：滚动时背景与内容更协调，不喧宾夺主。与 Hero 流星/星点风格统一。
 * 元素：柔和光斑 orbs（慢速漂移）+ 细点阵网格 + 星点。三层不同视差速度形成纵深。
 * 性能：单个 rAF 节流的 scroll 监听，只写一个 CSS 变量 --sy，图层用 transform 消费（合成层）。
 * 尊重 prefers-reduced-motion：关闭视差与漂移，仅保留静态纹理。
 */
export default function SiteBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      raf = requestAnimationFrame(() => {
        ticking = false;
        // 只写一个变量，图层各自按倍率位移，避免多次布局
        el.style.setProperty('--sy', String(window.scrollY || 0));
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="site-bg" ref={ref} aria-hidden>
      {/* 柔和光斑：慢速漂移 + 最慢视差（最远） */}
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />
      {/* 细点阵网格：中速视差 */}
      <div className="bg-grid" />
      {/* 星点：较快视差（最近） */}
      <div className="bg-stars" />
    </div>
  );
}
