import React from 'react';

/**
 * 品牌图标（风格化 SVG 复刻，用于演示）
 * 注意：这些是按各品牌视觉特征绘制的示意图标，非官方商标文件。
 * 正式商用请获取品牌方授权并替换为官方素材。
 */
export type BrandKey =
  | 'chatgpt' | 'claude' | 'elevenlabs' | 'notion'
  | 'canva' | 'figma' | 'autocad' | 'youtube';

export const BRAND_COLOR: Record<BrandKey, string> = {
  chatgpt: '#10a37f',
  claude: '#d97757',
  elevenlabs: '#111111',
  notion: '#000000',
  canva: '#00c4cc',
  figma: '#f24e1e',
  autocad: '#e51937',
  youtube: '#ff0000',
};

/** 卡片横幅底色（浅色调，配合黑描边设计） */
export const BRAND_TINT: Record<BrandKey, string> = {
  chatgpt: '#a7e8d6',
  claude: '#f6c9b3',
  elevenlabs: '#d6d6d6',
  notion: '#e6e6e6',
  canva: '#a6efF2',
  figma: '#ffc7b5',
  autocad: '#f8b3bd',
  youtube: '#ffb3b3',
};

const G: Record<BrandKey, React.ReactNode> = {
  // OpenAI 六瓣结（风格化）
  chatgpt: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
      <path d="M12 3.6l6 3.4v6.9l-6 3.5-6-3.5V7z" />
      <path d="M12 3.6v6.9l6 3.4M12 10.5L6 14M12 10.5v6.9" />
      <circle cx="12" cy="10.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M12 17.4l6 3.5M12 17.4l-6 3.5" opacity="0.5" />
    </g>
  ),
  // Claude 放射星芒
  claude: (
    <g fill="currentColor" stroke="none">
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i * Math.PI * 2) / 10;
        const x1 = 12 + Math.cos(a) * 3.2;
        const y1 = 12 + Math.sin(a) * 3.2;
        const x2 = 12 + Math.cos(a) * 9;
        const y2 = 12 + Math.sin(a) * 9;
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        );
      })}
      <circle cx="12" cy="12" r="2.4" />
    </g>
  ),
  // ElevenLabs 音频波纹条
  elevenlabs: (
    <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <line x1="6" y1="8" x2="6" y2="16" />
      <line x1="10" y1="5" x2="10" y2="19" />
      <line x1="14" y1="5" x2="14" y2="19" />
      <line x1="18" y1="8" x2="18" y2="16" />
    </g>
  ),
  // Notion N 方块
  notion: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.6" />
      <path d="M8.5 16.5V8l7 8.5V8" strokeWidth="2.1" strokeLinecap="round" />
    </g>
  ),
  // Canva C 环
  canva: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M15.4 9.3a3.9 3.9 0 0 0-5.9 1.1c-1.1 2-.7 4.2.9 4.9 1.3.6 2.6-.2 3.3-1.4" strokeWidth="2.2" strokeLinecap="round" />
    </g>
  ),
  // Figma 三段几何
  figma: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M9.4 3.5h2.6v5H9.4a2.5 2.5 0 0 1 0-5z" />
      <path d="M12 3.5h2.6a2.5 2.5 0 0 1 0 5H12z" />
      <path d="M9.4 8.5H12v5H9.4a2.5 2.5 0 0 1 0-5z" />
      <path d="M9.4 13.5H12v5a2.5 2.5 0 1 1-2.6-5z" />
      <circle cx="14.6" cy="11" r="2.5" />
    </g>
  ),
  // AutoCAD 立体图纸
  autocad: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M4 8l8-4 8 4-8 4z" />
      <path d="M4 8v8l8 4V12M20 8v8l-8 4" />
      <path d="M8 10.2v8M16 10.2v8" opacity="0.45" />
    </g>
  ),
  // YouTube 播放盾
  youtube: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10.2 9.6l5.2 2.9-5.2 2.9z" fill="currentColor" stroke="none" />
    </g>
  ),
};

export default function BrandIcon({
  brand,
  size = 28,
  colored = true,
  className = '',
}: {
  brand?: string;
  size?: number;
  colored?: boolean;
  className?: string;
}) {
  const key = (brand as BrandKey) in G ? (brand as BrandKey) : undefined;
  if (!key) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className={className}>
        <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`brand-ic ${className}`}
      style={colored ? { color: BRAND_COLOR[key] } : undefined}
      aria-hidden
      focusable="false"
    >
      {G[key]}
    </svg>
  );
}
