/**
 * Fluid Hover 的原生实现（规则借 Fluid Functionalism 的 use-fluid-hover，不搬代码、不引 React）。
 * 方案：docs/specs/网页版-控件细节借鉴Fluid-方案-2026-09-17.md 第 4 节。
 *
 * 一块高亮在各项之间移动：
 * - 光标在某项里面 → 那项；在缝隙、内边距里 → 离中心最近那项，所以高亮不会在项之间闪没。
 * - 进入容器时在目标项上淡入，不从上次的位置滑过来。
 * - 点在缝隙里 → 转成对亮着那项的点击。
 * - 量尺寸用 offset*，不受项自身 transform（天色盘的放大）影响。
 * - 「减少动态效果」时只淡入淡出，不位移（由样式表处理）。
 */

type Axis = 'x' | 'y';

interface Rect { left: number; top: number; width: number; height: number }

export const ACTIVE_ATTR = 'data-fh-active';

export class FluidHover {
  private highlight = document.createElement('div');
  private rects: Rect[] = [];
  private active: number | null = null;
  private pointer: { x: number; y: number } | null = null;
  private frame = 0;
  private shown = false;

  constructor(
    private container: HTMLElement,
    private items: HTMLElement[],
    private axis: Axis,
  ) {
    this.highlight.className = 'fh-highlight';
    this.highlight.setAttribute('aria-hidden', 'true');
    container.prepend(this.highlight);

    container.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      this.measure();
      this.pointer = { x: event.clientX, y: event.clientY };
      this.schedule();
    });
    container.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      this.pointer = { x: event.clientX, y: event.clientY };
      this.schedule();
    });
    container.addEventListener('pointerleave', () => {
      this.pointer = null;
      if (!container.contains(document.activeElement)) this.setActive(null);
    });
    // 点在缝隙里：交给亮着的那项
    container.addEventListener('click', (event) => {
      if (this.active === null) return;
      const target = event.target as HTMLElement;
      if (this.items.some((item) => item.contains(target))) return;
      this.items[this.active]?.click();
    });
    // 键盘聚焦用同一块高亮
    this.items.forEach((item, i) => item.addEventListener('focus', () => {
      if (item.matches(':focus-visible')) { this.measure(); this.setActive(i); }
    }));
    container.addEventListener('focusout', (event) => {
      if (!this.pointer && !container.contains(event.relatedTarget as Node | null)) this.setActive(null);
    });
    new ResizeObserver(() => this.measure(true)).observe(container);
  }

  private schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.pointer) this.setActive(this.pick(this.pointer.x, this.pointer.y));
    });
  }

  /** 在里面的那项优先，否则取中心最近的；并列取靠前的 */
  private pick(clientX: number, clientY: number): number | null {
    const box = this.container.getBoundingClientRect();
    const x = clientX - box.left - this.container.clientLeft;
    const y = clientY - box.top - this.container.clientTop;
    let best: number | null = null;
    let bestDistance = Infinity;
    this.rects.forEach((r, i) => {
      if (this.items[i]!.offsetParent === null) return; // 被隐藏的项（小屏收起的晴雨）
      if (x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height) {
        if (bestDistance > -1) { best = i; bestDistance = -1; }
        return;
      }
      const d = this.axis === 'x' ? Math.abs(x - (r.left + r.width / 2)) : Math.abs(y - (r.top + r.height / 2));
      if (d < bestDistance) { best = i; bestDistance = d; }
    });
    return best;
  }

  private measure(reposition = false) {
    this.rects = this.items.map((item) => ({
      left: item.offsetLeft, top: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight,
    }));
    if (reposition && this.active !== null) this.place(this.active, false);
  }

  private place(index: number, travel: boolean) {
    const r = this.rects[index];
    if (!r) return;
    const s = this.highlight.style;
    if (!travel) this.highlight.classList.add('fh-snap');
    s.width = `${r.width}px`;
    s.height = `${r.height}px`;
    s.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
    if (!travel) {
      void this.highlight.offsetWidth; // 先落位再恢复过渡
      this.highlight.classList.remove('fh-snap');
    }
  }

  private setActive(index: number | null) {
    if (index === this.active) return;
    if (this.active !== null) this.items[this.active]?.removeAttribute(ACTIVE_ATTR);
    this.active = index;
    if (index === null) {
      this.shown = false;
      this.highlight.classList.remove('fh-on');
      return;
    }
    this.items[index]!.setAttribute(ACTIVE_ATTR, '');
    // 新一轮悬停：直接落在目标上淡入；已经亮着：弹簧移过去
    this.place(index, this.shown);
    if (!this.shown) {
      this.shown = true;
      this.highlight.classList.add('fh-on');
    }
  }
}
