/**
 * 开发期横向溢出检测器（只在 dev 模式运行，生产自动摇树掉）
 *
 * 「移动端能左右滑动整个页面」的根因永远是：某个元素比视口宽。
 * 这个工具会把罪魁祸首直接打到控制台并高亮，省去逐个 F12 排查。
 *
 * 用法：控制台执行 __findOverflow() 随时手查；窄屏下加载后也会自动跑一次。
 */
export function initOverflowDetector() {
  if (!import.meta.env.DEV) return;

  const scan = () => {
    const vw = document.documentElement.clientWidth;
    const bad: { el: Element; right: number; width: number }[] = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const style = getComputedStyle(el);
      if (style.position === 'fixed') return; // 固定层不参与文档滚动宽度
      // 超出视口右边 1px 以上，或自身比视口还宽
      if (r.right > vw + 1 || r.width > vw + 1) {
        bad.push({ el, right: Math.round(r.right), width: Math.round(r.width) });
      }
    });
    if (bad.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`%c[overflow] ✔ 无横向溢出（视口 ${vw}px）`, 'color:#16a34a;font-weight:700');
      return [];
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[overflow] 发现 ${bad.length} 个元素超出视口（${vw}px），这会导致移动端可以左右滑动整页：`,
    );
    bad
      .sort((a, b) => b.right - a.right)
      .slice(0, 12)
      .forEach(({ el, right, width }) => {
        const sel =
          el.tagName.toLowerCase() +
          (el.id ? `#${el.id}` : '') +
          (el.className && typeof el.className === 'string'
            ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
            : '');
        // eslint-disable-next-line no-console
        console.warn(`  ${sel}  右边界 ${right}px / 宽 ${width}px`, el);
        (el as HTMLElement).style.outline = '2px dashed #f62c2b';
      });
    return bad;
  };

  (window as any).__findOverflow = scan;
  // 窄屏下自动跑一次（等布局稳定）
  if (window.innerWidth <= 820) {
    setTimeout(scan, 1200);
  }
}
