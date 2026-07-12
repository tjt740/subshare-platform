import React from 'react';

/**
 * 头像系统（仿 Notion AI 风格）：
 * - 预置 SVG 表情：手绘线条脸 + 单色装饰件，值形如 'sv:spark'
 * - 自定义上传：value 为 data:image/... base64
 * - emoji：直接渲染字符
 * - 装饰框 frame：none / gold / neon / leaf / crown / ring
 */

export const AVATAR_FRAMES = [
  { id: 'none', name: '无边框' },
  { id: 'ring', name: '细描边' },
  { id: 'gold', name: '金环' },
  { id: 'neon', name: '霓虹' },
  { id: 'leaf', name: '叶饰' },
  { id: 'crown', name: '皇冠' },
] as const;

/** 手绘 SVG 表情（黑线条 + 一个彩色小配件，走 Notion AI 的极简手绘感） */
const FACES: Record<string, (c: string) => React.ReactNode> = {
  spark: (c) => (
    <>
      <path d="M30 34c2-8 6-12 10-10" />
      <circle cx="42" cy="40" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="60" cy="40" r="2.2" fill="currentColor" stroke="none" />
      <path d="M40 58q10 8 20 0" />
      <path d="M64 22l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill={c} stroke="none" />
    </>
  ),
  duck: (c) => (
    <>
      <circle cx="40" cy="42" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="58" cy="42" r="2.2" fill="currentColor" stroke="none" />
      <path d="M42 58q7 6 14 0" />
      <path d="M44 66q6 8 12 0" fill={c} stroke={c} />
      <path d="M30 30q8-10 18-6" />
    </>
  ),
  cat: (c) => (
    <>
      <path d="M28 32l6 10M72 32l-6 10" />
      <circle cx="40" cy="46" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="60" cy="46" r="2.2" fill="currentColor" stroke="none" />
      <path d="M46 56h8M50 56v4" />
      <path d="M42 62q8 6 16 0" />
      <circle cx="66" cy="60" r="4" fill={c} stroke="none" opacity="0.85" />
    </>
  ),
  flower: (c) => (
    <>
      <circle cx="42" cy="44" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="60" cy="44" r="2.2" fill="currentColor" stroke="none" />
      <path d="M42 60q9 7 18 0" />
      <g fill={c} stroke="none">
        <circle cx="66" cy="26" r="4" />
        <circle cx="74" cy="32" r="4" />
        <circle cx="66" cy="38" r="4" />
        <circle cx="58" cy="32" r="4" />
      </g>
      <circle cx="66" cy="32" r="2.6" fill="#fff" stroke="none" />
    </>
  ),
  hat: (c) => (
    <>
      <path d="M24 34h52" />
      <path d="M34 34q16-14 32 0" fill={c} stroke={c} />
      <circle cx="42" cy="50" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="60" cy="50" r="2.2" fill="currentColor" stroke="none" />
      <path d="M42 62q9 7 18 0" />
    </>
  ),
  bolt: (c) => (
    <>
      <circle cx="40" cy="44" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="58" cy="44" r="2.2" fill="currentColor" stroke="none" />
      <path d="M40 60q10 8 20-2" />
      <path d="M66 20l-10 16h8l-6 14 14-20h-8l6-10z" fill={c} stroke="none" />
    </>
  ),
  pencil: (c) => (
    <>
      <circle cx="40" cy="46" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="58" cy="46" r="2.2" fill="currentColor" stroke="none" />
      <path d="M40 60h20" />
      <path d="M62 20l12 12-22 22-14 2 2-14z" fill={c} stroke="currentColor" />
    </>
  ),
  moon: (c) => (
    <>
      <path d="M36 46q4-6 8 0M56 46q4-6 8 0" />
      <path d="M42 60q8 6 16 0" />
      <path d="M70 22a10 10 0 1 0 8 14 12 12 0 0 1-8-14z" fill={c} stroke="none" />
    </>
  ),
  robot: (c) => (
    <>
      <rect x="32" y="34" width="36" height="30" rx="8" />
      <circle cx="43" cy="47" r="2.6" fill="currentColor" stroke="none" />
      <circle cx="57" cy="47" r="2.6" fill="currentColor" stroke="none" />
      <path d="M44 57h12" />
      <path d="M50 34v-8" />
      <circle cx="50" cy="22" r="4" fill={c} stroke="none" />
    </>
  ),
  crownface: (c) => (
    <>
      <circle cx="42" cy="48" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="60" cy="48" r="2.2" fill="currentColor" stroke="none" />
      <path d="M42 62q9 7 18 0" />
      <path d="M32 32l6 8 12-12 12 12 6-8v10H32z" fill={c} stroke="currentColor" />
    </>
  ),
  leafface: (c) => (
    <>
      <circle cx="42" cy="48" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="60" cy="48" r="2.2" fill="currentColor" stroke="none" />
      <path d="M40 60q10 8 20 0" />
      <path d="M60 20q18 4 14 20-16 4-14-20z" fill={c} stroke="currentColor" />
    </>
  ),
  wave: (c) => (
    <>
      <path d="M36 44q5-5 10 0M54 44q5-5 10 0" />
      <path d="M40 60q10 9 20-2" />
      <path d="M24 70q8-8 16 0t16 0 16 0" stroke={c} />
    </>
  ),
};

export const AVATAR_PRESETS = [
  { id: 'sv:spark', color: '#f59e0b' },
  { id: 'sv:duck', color: '#fbbf24' },
  { id: 'sv:cat', color: '#f472b6' },
  { id: 'sv:flower', color: '#ec4899' },
  { id: 'sv:hat', color: '#ef4444' },
  { id: 'sv:bolt', color: '#8b5cf6' },
  { id: 'sv:pencil', color: '#f97316' },
  { id: 'sv:moon', color: '#6366f1' },
  { id: 'sv:robot', color: '#06b6d4' },
  { id: 'sv:crownface', color: '#eab308' },
  { id: 'sv:leafface', color: '#22c55e' },
  { id: 'sv:wave', color: '#0ea5e9' },
];

const colorOf = (id: string) =>
  AVATAR_PRESETS.find((p) => p.id === id)?.color ?? '#f59e0b';

export default function Avatar({
  value,
  frame = 'none',
  size = 40,
  className = '',
}: {
  value?: string;
  frame?: string;
  size?: number;
  className?: string;
}) {
  const v = value || 'sv:spark';
  let inner: React.ReactNode;

  if (v.startsWith('data:image/')) {
    inner = (
      <img
        src={v}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
      />
    );
  } else if (v.startsWith('sv:')) {
    const key = v.slice(3);
    const face = FACES[key] ?? FACES.spark;
    inner = (
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden>
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {face(colorOf(v))}
        </g>
      </svg>
    );
  } else {
    inner = <span style={{ fontSize: size * 0.55, lineHeight: 1 }}>{v}</span>;
  }

  return (
    <span
      className={`av av-frame-${frame} ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="av-inner">{inner}</span>
      {frame === 'crown' && <span className="av-deco av-crown">👑</span>}
      {frame === 'leaf' && <span className="av-deco av-leaf">🌿</span>}
    </span>
  );
}
