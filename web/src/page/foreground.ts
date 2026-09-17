import type { Sky } from '../yard/atmosphere';
import './foreground.css';

/**
 * 近景剪影（方案 2.2 第 5 条）：每章在文字那一侧的下角升起一丛叶子，离场时下沉、缩小、虚化。
 * 结构借 Kage 的 DOM 近景层；叶片不是图片，是这里用代码生成的 SVG（用户 09-17 定：用程序生成叶片）。
 * 每处地点一种植物：蘑菇屋是蕨，猫窝是三叶草，树屋是宽叶枝条，草丛是长草，池塘是芦苇和香蒲，栅栏边是开花的草茎。
 * 颜色跟天色走：取地面补光色压暗，夜里自然变成深蓝绿的剪影。
 */

type Kind = 'fern' | 'clover' | 'broad' | 'blade' | 'reed' | 'bloom';

/**
 * 机位 1–6 各用哪种植物、放在哪个下角。放在**文字那一侧**的下角、压得很低：
 * 每章的主体（团子和那一处地点）在文字对面，第一版把叶子放在对面，正好挡住团子。
 */
const STAGES: { kind: Kind; side: 'left' | 'right' }[] = [
  { kind: 'fern', side: 'left' },
  { kind: 'clover', side: 'right' },
  { kind: 'broad', side: 'left' },
  { kind: 'blade', side: 'right' },
  { kind: 'reed', side: 'left' },
  { kind: 'bloom', side: 'right' },
];

function lcg(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const f = (n: number) => n.toFixed(1);

/** 一片叶子：从 (x, y) 沿 angle 方向伸出 length，最宽处 width，两条二次曲线围成 */
function leaf(x: number, y: number, angle: number, length: number, width: number) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const nx = -dy, ny = dx;
  const tx = x + dx * length, ty = y + dy * length;
  const mx = x + dx * length * 0.42, my = y + dy * length * 0.42;
  return `M${f(x)} ${f(y)}Q${f(mx + nx * width)} ${f(my + ny * width)} ${f(tx)} ${f(ty)}Q${f(mx - nx * width)} ${f(my - ny * width)} ${f(x)} ${f(y)}Z`;
}

/** 一根弯茎：从根部往上，逐段偏转。返回沿茎的采样点（位置 + 切线角），给叶子找落点 */
function stem(x: number, y: number, angle: number, length: number, bend: number, steps = 14) {
  const points: { x: number; y: number; a: number }[] = [];
  let a = angle;
  for (let i = 0; i <= steps; i++) {
    points.push({ x, y, a });
    a += bend / steps;
    x += Math.cos(a) * (length / steps);
    y += Math.sin(a) * (length / steps);
  }
  return points;
}

function stemPath(points: { x: number; y: number }[], width: number) {
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join('');
  return `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${f(width)}" stroke-linecap="round"/>`;
}

/** 画布 600×520，根在底边，往上长。side === 'left' 时整体镜像。 */
function plant(kind: Kind, seed: number) {
  const rand = lcg(seed);
  const up = -Math.PI / 2;
  const parts: string[] = [];
  const sprays: string[] = [];
  const spray = (body: string, originX: number, delay: number) =>
    sprays.push(`<g class="fg-spray" style="transform-origin:${f(originX)}px 520px;--sway-delay:${delay}s">${body}</g>`);

  if (kind === 'blade' || kind === 'reed' || kind === 'bloom') {
    const count = kind === 'blade' ? 26 : 16;
    for (let i = 0; i < count; i++) {
      const x = 40 + rand() * 470;
      const lean = (rand() - 0.5) * 0.7;
      const length = 230 + rand() * 240;
      const points = stem(x, 530, up + lean, length, (rand() - 0.35) * 0.9 * Math.sign(lean || 1));
      // 长草叶：沿弯茎两侧各走一遍，根宽梢尖
      const width = 9 + rand() * 9;
      const left = points.map((p, j) => ({ x: p.x + Math.cos(p.a + Math.PI / 2) * width * (1 - j / points.length), y: p.y + Math.sin(p.a + Math.PI / 2) * width * (1 - j / points.length) }));
      const right = points.map((p, j) => ({ x: p.x - Math.cos(p.a + Math.PI / 2) * width * (1 - j / points.length), y: p.y - Math.sin(p.a + Math.PI / 2) * width * (1 - j / points.length) })).reverse();
      let body = `<path d="${[...left, ...right].map((p, j) => `${j ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join('')}Z"/>`;
      const tip = points[points.length - 1]!;
      if (kind === 'reed' && i % 3 === 0) {
        // 香蒲：茎梢一段粗棒
        const at = points[points.length - 4]!;
        body += `<rect x="${f(at.x - 9)}" y="${f(at.y - 62)}" width="18" height="70" rx="9" transform="rotate(${f((at.a - up) * 57.3)} ${f(at.x)} ${f(at.y)})"/>`;
      }
      if (kind === 'bloom' && i % 3 === 0) {
        // 小花：五片圆瓣
        for (let k = 0; k < 5; k++) body += `<path d="${leaf(tip.x, tip.y, (k / 5) * Math.PI * 2 + rand(), 26, 13)}"/>`;
        body += `<circle cx="${f(tip.x)}" cy="${f(tip.y)}" r="7" class="fg-heart"/>`;
      }
      spray(body, x, -rand() * 20);
    }
  } else {
    const stems = kind === 'clover' ? 9 : kind === 'fern' ? 6 : 5;
    for (let i = 0; i < stems; i++) {
      const x = 70 + (i / (stems - 1)) * 400 + (rand() - 0.5) * 50;
      const lean = (i / (stems - 1) - 0.5) * 1.1 + (rand() - 0.5) * 0.3;
      const length = kind === 'clover' ? 150 + rand() * 170 : 300 + rand() * 190;
      const points = stem(x, 530, up + lean, length, lean * 1.1 + (rand() - 0.5) * 0.4);
      let body = stemPath(points, kind === 'clover' ? 4 : 6);
      if (kind === 'fern') {
        // 蕨：沿茎两侧一对对小羽片，越往梢越短
        points.forEach((p, j) => {
          if (j < 2) return;
          const size = 78 * (1 - j / (points.length + 1)) + 10;
          body += `<path d="${leaf(p.x, p.y, p.a + 1.15, size, size * 0.2)}"/><path d="${leaf(p.x, p.y, p.a - 1.15, size, size * 0.2)}"/>`;
        });
      } else if (kind === 'broad') {
        // 宽叶：茎上交错的大椭圆叶，梢头一片
        points.forEach((p, j) => {
          if (j < 3 || j % 2) return;
          const size = 96 + rand() * 50;
          const sideSign = (j / 2) % 2 ? 1 : -1;
          body += `<path d="${leaf(p.x, p.y, p.a + sideSign * (0.75 + rand() * 0.3), size, size * 0.34)}"/>`;
        });
        const tip = points[points.length - 1]!;
        body += `<path d="${leaf(tip.x, tip.y, tip.a, 110, 38)}"/>`;
      } else {
        // 三叶草：茎梢三片心形叶（用两片短胖叶拼）
        const tip = points[points.length - 1]!;
        for (let k = 0; k < 3; k++) {
          const a = tip.a + ((k - 1) * Math.PI * 2) / 3;
          body += `<path d="${leaf(tip.x, tip.y, a - 0.22, 46, 24)}"/><path d="${leaf(tip.x, tip.y, a + 0.22, 46, 24)}"/>`;
        }
      }
      spray(body, x, -rand() * 20);
    }
  }
  parts.push(...sprays);
  return `<svg viewBox="0 0 600 520" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${parts.join('')}</svg>`;
}

export class Foreground {
  private host: HTMLElement;
  private stages: HTMLElement[] = [];
  private active = -1;
  private retiring: number | null = null;
  private lastTint = '';

  constructor(private reduced: boolean) {
    this.host = document.createElement('div');
    this.host.id = 'fg';
    this.host.setAttribute('aria-hidden', 'true');
    STAGES.forEach(({ kind, side }, i) => {
      const stage = document.createElement('div');
      stage.className = `fg-stage fg-${side}`;
      // 两丛叠一起：后面一丛淡一点、矮一点，有前后
      stage.innerHTML = `<div class="fg-piece fg-back">${plant(kind, 101 + i * 7)}</div><div class="fg-piece fg-front">${plant(kind, 211 + i * 13)}</div>`;
      this.host.append(stage);
      this.stages.push(stage);
    });
    // 放在画布之上、页面文字之下
    document.getElementById('gl')!.after(this.host);
  }

  /** 进入第几个机位。1–6 才有剪影，首屏和结尾没有（首屏有院子前沿那排真草） */
  activate(shot: number) {
    const next = shot >= 1 && shot <= STAGES.length ? shot - 1 : -1;
    if (next === this.active) return;
    const previous = this.active;
    this.active = next;
    if (previous >= 0) {
      const stage = this.stages[previous]!;
      stage.classList.remove('fg-active');
      stage.classList.add('fg-retiring');
      if (this.retiring !== null) clearTimeout(this.retiring);
      this.retiring = window.setTimeout(() => stage.classList.remove('fg-retiring'), this.reduced ? 0 : 820);
    }
    if (next >= 0) {
      const stage = this.stages[next]!;
      stage.classList.remove('fg-retiring');
      // 强制回流，让入场过渡每次都从头播
      void stage.offsetWidth;
      stage.classList.add('fg-active');
    }
  }

  /** 剪影的颜色跟着天色：白天是深叶绿，越暗越压黑，入夜带一点天空补光的蓝 */
  tint(sky: Sky) {
    const brightness = (0.2126 * sky.fill.r + 0.7152 * sky.fill.g + 0.0722 * sky.fill.b) * sky.fillIntensity;
    const k = Math.min(1, Math.max(0.22, brightness / 1.3));
    const r = 0x24 * k * 0.8 + sky.fill.r * 255 * 0.1 * (1 - k);
    const g = 0x5a * k * 0.8 + sky.fill.g * 255 * 0.1 * (1 - k);
    const b = 0x27 * k * 0.8 + sky.fill.b * 255 * 0.22 * (1 - k);
    const css = `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
    if (css === this.lastTint) return;
    this.lastTint = css;
    this.host.style.setProperty('--fg-color', css);
  }
}
