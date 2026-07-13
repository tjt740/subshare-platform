import React from 'react';

/**
 * 统一 SVG 图标系统（替代 emoji：跨平台一致、可换色、可动画、可无障碍）
 * 用法：<Icon name="cart" size={18} />
 */
export type IconName =
  | 'cart' | 'wallet' | 'box' | 'receipt' | 'user' | 'home' | 'menu' | 'close'
  | 'search' | 'palette' | 'chat' | 'shield' | 'bolt' | 'clock' | 'check'
  | 'copy' | 'eye' | 'eyeOff' | 'refresh' | 'wrench' | 'money' | 'swap'
  | 'lock' | 'info' | 'star' | 'fire' | 'gift' | 'truck' | 'sparkle' | 'plus'
  | 'stream' | 'music' | 'ai' | 'office' | 'study' | 'game' | 'tag' | 'upload'
  | 'card' | 'alipay' | 'crypto' | 'arrowRight' | 'send' | 'edit' | 'warn'
  | 'chevron-down' | 'google' | 'github' | 'microsoft' | 'bell'
  | 'pin' | 'crown' | 'leaf' | 'globe' | 'timer';

const P: Record<IconName, React.ReactNode> = {
  cart: <><circle cx="9" cy="20" r="1.6" /><circle cx="18" cy="20" r="1.6" /><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6" /></>,
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" /><rect x="3" y="7" width="18" height="12" rx="2" /><circle cx="16.5" cy="13" r="1.3" fill="currentColor" stroke="none" /></>,
  box: <><path d="M3 8l9-5 9 5v8l-9 5-9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  receipt: <><path d="M5 3h14v18l-2.5-1.6L14 21l-2-1.6L10 21l-2.5-1.6L5 21z" /><path d="M9 8h6M9 12h6" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  home: <><path d="M3 11l9-7 9 7" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5h4v5" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.4-2-.6-1.1.2-2 1.4-2H17a4 4 0 0 0 4-4c0-5-4-10-9-10z" /><circle cx="8" cy="11" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="8" r="1.2" fill="currentColor" stroke="none" /><circle cx="16" cy="10" r="1.2" fill="currentColor" stroke="none" /></>,
  chat: <><path d="M21 12a7.5 7.5 0 0 1-10.9 6.7L4 20l1.4-4.3A7.5 7.5 0 1 1 21 12z" /><path d="M9 11h6M9 14h4" /></>,
  shield: <><path d="M12 3l7 3v5c0 4.4-2.9 8.3-7 10-4.1-1.7-7-5.6-7-10V6z" /><path d="M9 12l2 2 4-4" /></>,
  bolt: <><path d="M13 2L5 13h5l-1 9 9-12h-6z" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /></>,
  check: <><path d="M4.5 12.5l5 5 10-11" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  eye: <><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  eyeOff: <><path d="M4 4l16 16" /><path d="M9.5 5.9A9.6 9.6 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.3 4.1M6.4 7.7A16.6 16.6 0 0 0 2 12s3.6 6.5 10 6.5c1 0 1.9-.1 2.7-.4" /></>,
  refresh: <><path d="M20 11a8 8 0 1 0-1.6 5.6" /><path d="M20 5v6h-6" /></>,
  wrench: <><path d="M15 7a4.5 4.5 0 0 0 5.6 5.8L14 19.4a2.5 2.5 0 1 1-3.5-3.5L17 9.3A4.5 4.5 0 0 0 15 7z" /><path d="M15 7l2-2a4.5 4.5 0 0 0-6 6" /></>,
  money: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4" /></>,
  swap: <><path d="M4 8h13l-3-3M20 16H7l3 3" /></>,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
  star: <><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z" /></>,
  fire: <><path d="M12 3s1 3-1.5 5.5S7 13 7 15a5 5 0 0 0 10 0c0-2.5-1.5-4-1.5-4S15 14 13 14c0-3-1-5-1-11z" /></>,
  gift: <><rect x="3" y="9" width="18" height="11" rx="2" /><path d="M3 13h18M12 9v11" /><path d="M12 9S9 3 6.5 5.5 12 9 12 9zM12 9s3-6 5.5-3.5S12 9 12 9z" /></>,
  truck: <><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17.5" cy="18" r="1.8" /></>,
  sparkle: <><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M18.5 15l.9 2.2 2.1.8-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.8z" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  'chevron-down': <><path d="M6 9l6 6 6-6" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  pin: <><path d="M12 17v5" /><path d="M9 3h6l-1 6 3.5 3v2h-11v-2L10 9z" /></>,
  crown: <><path d="M3 8l3.5 3L12 5l5.5 6L21 8v9H3z" /><path d="M3 20h18" /></>,
  leaf: <><path d="M4 20c0-8 5-13 16-14 0 10-5 15-13 15H4z" /><path d="M4 20c3-4 6-6 10-8" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" /></>,
  timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2" /><path d="M9 2h6" /></>,
  google: <><path d="M21 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3.1c1.8-1.7 2.7-4.2 2.7-7.2z" /><path d="M12 21.5c2.6 0 4.7-.9 6.3-2.3l-3.1-2.4c-.9.6-2 .9-3.2.9-2.5 0-4.6-1.7-5.3-3.9H3.5v2.5A9.5 9.5 0 0 0 12 21.5z" /><path d="M6.7 13.8a5.7 5.7 0 0 1 0-3.6V7.7H3.5a9.5 9.5 0 0 0 0 8.6z" /><path d="M12 6.3c1.4 0 2.7.5 3.7 1.5l2.7-2.7A9.2 9.2 0 0 0 12 2.5a9.5 9.5 0 0 0-8.5 5.2l3.2 2.5c.7-2.2 2.8-3.9 5.3-3.9z" /></>,
  github: <><path d="M9 19c-4 1.3-4-2.2-6-2.7m12 5.4v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.3 3.5 5.3 3.8 5.3 3.8a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 3.9 10.2c0 4.6 2.7 5.7 5.5 6-.5.6-.5 1.2-.5 2v3.5" /></>,
  microsoft: <><rect x="3.5" y="3.5" width="7.5" height="7.5" /><rect x="13" y="3.5" width="7.5" height="7.5" /><rect x="3.5" y="13" width="7.5" height="7.5" /><rect x="13" y="13" width="7.5" height="7.5" /></>,
  stream: <><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M10 9.5l4.5 2.5L10 14.5z" fill="currentColor" stroke="none" /><path d="M8 20h8" /></>,
  music: <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.6" /><circle cx="16.5" cy="16" r="2.6" /></>,
  ai: <><rect x="5" y="6" width="14" height="12" rx="3" /><circle cx="9.5" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="14.5" cy="12" r="1.3" fill="currentColor" stroke="none" /><path d="M12 6V3M8 21h8" /></>,
  office: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></>,
  study: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19v14H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M8 8h7" /></>,
  game: <><rect x="3" y="8" width="18" height="10" rx="4" /><path d="M8 11v4M6 13h4M16 12h.01M18.5 14.5h.01" /></>,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" /></>,
  upload: <><path d="M12 16V4M7.5 8.5L12 4l4.5 4.5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6 15h4" /></>,
  alipay: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M7 14c2.5 2.5 7 2 9-1M7.5 8h7M11 6v6" /></>,
  crypto: <><circle cx="12" cy="12" r="8.5" /><path d="M8 9h8M12 9v8M9.5 12h5" /></>,
  arrowRight: <><path d="M4 12h15M13 6l6 6-6 6" /></>,
  send: <><path d="M21 3L10.5 13.5M21 3l-7 18-3.5-7.5L3 10z" /></>,
  edit: <><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z" /><path d="M14.5 6.5l3 3" /></>,
  warn: <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>,
};

export default function Icon({
  name,
  size = 18,
  className = '',
  label,
}: {
  name: IconName;
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      className={`ic ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {P[name]}
    </svg>
  );
}

/** 分类 → 图标名 */
export const CATEGORY_ICON_NAME: Record<string, IconName> = {
  流媒体: 'stream',
  音乐: 'music',
  'AI 工具': 'ai',
  办公: 'office',
  学习: 'study',
  游戏: 'game',
};
