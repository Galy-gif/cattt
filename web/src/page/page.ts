import { SLOT_NAMES, WEATHER_NAMES, type Atmosphere, type TimeSlot, type Weather } from '../yard/atmosphere';
import { PLACE_ORDER, place, type PlaceId } from '../yard/layout';
import { FluidHover } from './fluid-hover';

// ?reduce=1：没法在预览里打开系统的「减少动态效果」时，用它走同一条代码路径验收（样式表里的那部分仍只认系统设置）
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('reduce');
const FINE_POINTER = matchMedia('(hover: hover) and (pointer: fine)').matches;

/** 线条图标，单色细线（决策 09-12 第 12 条） */
const ICONS: Record<string, string> = {
  now: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  dawn: '<path d="M4 17h16M7 17a5 5 0 0 1 10 0M12 5v3M5.6 9.6l1.8 1.8M18.4 9.6l-1.8 1.8M9 20h6"/>',
  day: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
  dusk: '<path d="M4 16h16M7 16a5 5 0 0 1 10 0M12 4v4M9.8 6.2 12 8.4l2.2-2.2M8 19.5h8"/>',
  evening: '<path d="M4 17h16M8 17a4 4 0 0 1 8 0"/><path d="M17.5 5.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/><path d="M7 20h10"/>',
  night: '<path d="M18.5 14.5A7.5 7.5 0 0 1 9.5 5.5a7.5 7.5 0 1 0 9 9z"/>',
  clear: '<path d="M7 17.5a4 4 0 0 1 .6-7.96A5.5 5.5 0 0 1 18 11a3.3 3.3 0 0 1-.5 6.5z"/>',
  rain: '<path d="M7 14.5a4 4 0 0 1 .6-7.96A5.5 5.5 0 0 1 18 8a3.3 3.3 0 0 1-.5 6.5zM9 17.5l-1 2.5M13 17.5l-1 2.5M17 17.5l-1 2.5"/>',
};

export interface PageHooks {
  atmosphere: Atmosphere;
  /** 滚动进度（第几章的小数）变了 */
  onProgress(progress: number): void;
  /** 进入某一处地点的章节 */
  onPlace(id: PlaceId): void;
  onPointer(x: number, y: number): void;
}

/**
 * 页面上的 DOM 控件（方案 3.1 的 C1–C11）。只管 DOM；镜头、团子、天色通过 hooks 往外说。
 */
export class Page {
  readonly reduced = REDUCED;
  private sections = [...document.querySelectorAll<HTMLElement>('[data-cam]')];
  private anchors: number[] = [];
  private nav = document.getElementById('nav')!;
  private rail = document.getElementById('rail')!;
  private dock = document.getElementById('dock')!;
  private status = document.getElementById('status')!;
  private railButtons: HTMLButtonElement[] = [];
  private dockButtons: HTMLButtonElement[] = [];
  private lastScroll = 0;
  private chapter = -1;
  private motes: Motes | null = null;

  constructor(private hooks: PageHooks) {
    this.buildRail();
    this.buildDock();
    this.wireReveals();
    this.wireScroll();
    this.wirePointer();
    if (FINE_POINTER && !REDUCED) this.motes = new Motes(document.getElementById('motes') as HTMLCanvasElement);
    document.body.classList.add('is-locked');
    // 背景模糊默认开；?blur=0 关掉，用来对比帧率
    if (new URLSearchParams(location.search).get('blur') !== '0') document.documentElement.classList.add('blur-ok');
  }

  // ── C1 预载幕 ──
  setLoading(fraction: number) {
    document.getElementById('pre-fill')!.style.right = `${Math.round((1 - fraction) * 100)}%`;
  }

  reveal() {
    const pre = document.getElementById('pre')!;
    if (pre.classList.contains('done')) return;
    pre.classList.add('done');
    setTimeout(() => {
      document.body.classList.remove('is-locked');
      this.measure();
      this.onScroll();
    }, 340);
  }

  /** WebGL 起不来：退到静态背景，文字照常可读 */
  fallback() {
    document.documentElement.classList.add('no-webgl');
    this.reveal();
  }

  // ── C3 状态条 ──
  setStatus(placeId: PlaceId, slot: TimeSlot, weather: Weather) {
    const text = `团子 · ${place(placeId).name} · ${SLOT_NAMES[slot]} · ${WEATHER_NAMES[weather]}`;
    if (this.status.textContent !== text) this.status.textContent = text;
  }

  setTone(dark: boolean) {
    const tone = dark ? 'night' : 'day';
    if (document.body.dataset.tone !== tone) document.body.dataset.tone = tone;
  }

  update(dt: number) {
    this.motes?.update(dt);
  }

  /** 跳到第几个机位（调试、?shot=N） */
  jump(index: number, smooth = false) {
    this.measure();
    scrollTo({ top: this.anchors[index] ?? 0, behavior: smooth && !REDUCED ? 'smooth' : 'auto' });
  }

  // ── C6 地点轨 ──
  private buildRail() {
    PLACE_ORDER.forEach((id, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = `<span>${place(id).name}</span><i></i>`;
      button.setAttribute('aria-label', `去${place(id).name}`);
      button.addEventListener('click', () => this.jump(i + 1, true));
      this.rail.append(button);
      this.railButtons.push(button);
    });
    if (FINE_POINTER) new FluidHover(this.rail, this.railButtons, 'y');
  }

  // ── C7 天色盘 ──
  private buildDock() {
    const { atmosphere } = this.hooks;
    const add = (key: string, label: string, group: string, pick: () => void, pressed: () => boolean) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = group;
      button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[key]}</svg>${label}`;
      button.addEventListener('click', (event) => {
        pick();
        this.refreshDock();
        this.motes?.burst(event.clientX, event.clientY);
      });
      (button as HTMLButtonElement & { pressed?: () => boolean }).pressed = pressed;
      this.dock.append(button);
      this.dockButtons.push(button);
    };
    const separator = (extra = '') => {
      const s = document.createElement('i');
      s.className = `sep ${extra}`;
      this.dock.append(s);
    };
    add('now', '跟着现在', 'time-group', () => atmosphere.choose(null, atmosphere.weather), () => atmosphere.slot === null);
    separator();
    for (const slot of Object.keys(SLOT_NAMES) as TimeSlot[]) {
      add(slot, SLOT_NAMES[slot], 'time-group', () => atmosphere.choose(slot, atmosphere.weather), () => atmosphere.slot === slot);
    }
    separator('weather-sep');
    add('clear', '晴', 'weather-group', () => atmosphere.choose(atmosphere.slot, 'clear'), () => atmosphere.weather === 'clear');
    add('rain', '雨', 'weather-group', () => atmosphere.choose(atmosphere.slot, 'rain'), () => atmosphere.weather === 'rain');
    this.refreshDock();
    if (FINE_POINTER) new FluidHover(this.dock, this.dockButtons, 'x');
    if (FINE_POINTER && !REDUCED) this.wireDockProximity();
  }

  refreshDock() {
    for (const button of this.dockButtons) {
      const pressed = (button as HTMLButtonElement & { pressed?: () => boolean }).pressed?.() ?? false;
      button.setAttribute('aria-pressed', String(pressed));
    }
  }

  /** 鼠标靠近时图标放大：接近度过一个二阶弹簧（做法借 Sylva 的 dock）。放大幅度在样式表里，和 Fluid 高亮并用时调小（方案 A） */
  private wireDockProximity() {
    const reach = 96;
    const state = this.dockButtons.map(() => ({ value: 0, velocity: 0, target: 0 }));
    let pointerX: number | null = null;
    let running = false;
    let previous = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      let moving = false;
      this.dockButtons.forEach((button, i) => {
        const s = state[i]!;
        const rect = button.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        const closeness = pointerX === null ? 0 : Math.max(0, 1 - Math.abs(pointerX - center) / reach);
        s.target = closeness * closeness * (3 - 2 * closeness);
        s.velocity += (s.target - s.value) * 190 * dt;
        s.velocity *= Math.exp(-23 * dt);
        s.value = Math.min(1.08, s.value + s.velocity * dt);
        if (Math.abs(s.target - s.value) > 0.001 || Math.abs(s.velocity) > 0.004) moving = true;
        button.style.setProperty('--near', s.value.toFixed(3));
      });
      running = moving;
      if (moving) requestAnimationFrame(tick);
    };
    const kick = () => {
      if (running) return;
      running = true;
      previous = performance.now();
      requestAnimationFrame(tick);
    };
    const wrap = this.dock.parentElement!;
    addEventListener('pointermove', (event) => {
      const rect = this.dock.getBoundingClientRect();
      const inside = event.clientX > rect.left - 48 && event.clientX < rect.right + 48 && event.clientY > rect.top - 44;
      pointerX = inside ? event.clientX : null;
      kick();
    });
    wrap.addEventListener('pointerleave', () => {
      pointerX = null;
      kick();
    });
  }

  // ── C5 文字出现 ──
  private wireReveals() {
    const items = [...document.querySelectorAll<HTMLElement>('[data-rv]')];
    if (REDUCED) {
      items.forEach((el) => el.classList.add('rv-in'));
      return;
    }
    const byParent = new Map<Element, number>();
    for (const el of items) {
      const parent = el.parentElement!;
      const index = byParent.get(parent) ?? 0;
      byParent.set(parent, index + 1);
      el.style.setProperty('--rv-delay', `${index * 85}ms`);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) entry.target.classList.toggle('rv-in', entry.isIntersecting);
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.04 },
    );
    items.forEach((el) => observer.observe(el));
  }

  // ── 滚动 → 第几章 ──
  private measure() {
    const viewport = innerHeight;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - viewport);
    let previous = 0;
    this.anchors = this.sections.map((section, i) => {
      let y = i === 0 ? 0 : section.offsetTop + section.offsetHeight * 0.5 - viewport * 0.5;
      y = Math.min(maxScroll, Math.max(previous, y));
      previous = y;
      return y;
    });
  }

  private progressFor(y: number) {
    const a = this.anchors;
    if (a.length < 2) return 0;
    for (let i = 0; i < a.length - 1; i++) {
      if (y <= a[i + 1]!) return i + (a[i + 1]! > a[i]! ? (y - a[i]!) / (a[i + 1]! - a[i]!) : 0);
    }
    return a.length - 1;
  }

  private wireScroll() {
    addEventListener('scroll', () => this.onScroll(), { passive: true });
    addEventListener('resize', () => {
      this.measure();
      this.onScroll();
    });
    this.measure();
  }

  private onScroll() {
    const y = scrollY;
    const progress = this.progressFor(y);
    this.hooks.onProgress(progress);

    // C2：首屏没有底；滚动后加底；向下滚收起，向上滚出现
    this.nav.classList.toggle('stuck', y > 24);
    this.nav.classList.toggle('hide', y > this.lastScroll + 4 && y > innerHeight * 0.6);
    if (y < this.lastScroll - 4) this.nav.classList.remove('hide');
    this.lastScroll = y;

    const chapter = Math.round(progress);
    const onPlace = chapter >= 1 && chapter <= PLACE_ORDER.length;
    this.rail.classList.toggle('off', chapter === 0 && progress < 0.35);
    this.railButtons.forEach((button, i) => button.classList.toggle('on', i + 1 === chapter));
    if (chapter !== this.chapter) {
      this.chapter = chapter;
      if (onPlace) this.hooks.onPlace(PLACE_ORDER[chapter - 1]!);
      else if (chapter === 0 || chapter > PLACE_ORDER.length) this.hooks.onPlace('house');
    }
  }

  private wirePointer() {
    if (!FINE_POINTER) return;
    addEventListener('pointermove', (event) => {
      this.hooks.onPointer((event.clientX / innerWidth) * 2 - 1, -((event.clientY / innerHeight) * 2 - 1));
      this.motes?.move(event.clientX, event.clientY);
    });
  }
}

/**
 * C9 光标微粒：鼠标划过带起几粒绒絮，点天色盘时一小簇。
 * 按指针走过的距离发射（每 9 像素一粒、每帧封顶 10 粒），环形缓冲，不动就不画。
 */
class Motes {
  private context: CanvasRenderingContext2D;
  private pool = Array.from({ length: 160 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, age: 1, life: 1, size: 1 }));
  private cursor = 0;
  private last: { x: number; y: number } | null = null;
  private live = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.context = canvas.getContext('2d')!;
    const resize = () => {
      const ratio = Math.min(devicePixelRatio, 2);
      canvas.width = innerWidth * ratio;
      canvas.height = innerHeight * ratio;
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    addEventListener('resize', resize);
  }

  move(x: number, y: number) {
    if (this.last) {
      const d = Math.hypot(x - this.last.x, y - this.last.y);
      const n = Math.min(10, Math.floor(d / 9));
      for (let i = 0; i < n; i++) {
        const t = (i + 1) / n;
        this.spawn(this.last.x + (x - this.last.x) * t, this.last.y + (y - this.last.y) * t, 1);
      }
      if (n === 0) return;
    }
    this.last = { x, y };
  }

  burst(x: number, y: number) {
    for (let i = 0; i < 26; i++) this.spawn(x, y, 2.4);
  }

  update(dt: number) {
    if (!this.live) return;
    const c = this.context;
    c.clearRect(0, 0, innerWidth, innerHeight);
    this.live = 0;
    const night = document.body.dataset.tone === 'night';
    for (const p of this.pool) {
      if (p.age >= p.life) continue;
      p.age += dt;
      this.live++;
      const u = p.age / p.life;
      p.vx *= 1 - 1.4 * dt;
      p.vy = p.vy * (1 - 1.4 * dt) - 14 * dt;
      p.x += p.vx * dt + Math.sin(p.age * 2.6 + p.size * 9) * 10 * dt;
      p.y += p.vy * dt;
      const alpha = Math.min(1, u / 0.1) * (1 - Math.max(0, (u - 0.4) / 0.6)) * 0.7;
      c.fillStyle = night ? `rgba(255,236,190,${alpha})` : `rgba(255,252,240,${alpha})`;
      c.beginPath();
      c.arc(p.x, p.y, p.size * (1 + u * 0.5), 0, Math.PI * 2);
      c.fill();
    }
    if (!this.live) c.clearRect(0, 0, innerWidth, innerHeight);
  }

  private spawn(x: number, y: number, boost: number) {
    const p = this.pool[this.cursor]!;
    this.cursor = (this.cursor + 1) % this.pool.length;
    p.x = x + (Math.random() - 0.5) * 10 * boost;
    p.y = y + (Math.random() - 0.5) * 10 * boost;
    p.vx = (Math.random() - 0.5) * 38 * boost;
    p.vy = -(6 + Math.random() * 30) * boost;
    p.age = 0;
    p.life = 0.9 + Math.random() * 0.9;
    p.size = 1 + Math.random() * 1.8;
    this.live++;
  }
}
