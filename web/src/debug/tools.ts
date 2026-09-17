import * as THREE from 'three';
import type { Renderer } from '../render/renderer';
import type { Atmosphere, TimeSlot, Weather } from '../yard/atmosphere';
import { applyCatGlow, type Walker, type YardCat } from '../yard/cat';
import { PLACE_ORDER } from '../yard/layout';
import type { Rig } from '../yard/rig';
import type { World } from '../yard/world';

/**
 * 验收工具，只在 ?debug=1 时加载，挂在 window.__yard 上，从控制台或验收脚本里调。
 * 不依赖页面帧率：每次都自己把状态推到位、渲染一帧、再取数。
 */
export interface Handles {
  rig: Rig;
  walker: Walker;
  cat: YardCat;
  atmosphere: Atmosphere;
  world: World;
  renderer: Renderer;
}

export interface Pose {
  shot: number;
  time: TimeSlot;
  weather: Weather;
}

export function makeTools(h: Handles) {
  /** 把院子直接摆到某个机位、某个天色，渲染一帧 */
  async function pose({ shot, time, weather }: Pose, settle = 40) {
    h.atmosphere.choose(time, weather, true);
    h.rig.snap(shot);
    if (shot >= 1 && shot <= PLACE_ORDER.length) h.walker.teleport(PLACE_ORDER[shot - 1]!);
    else h.walker.teleport('house');
    for (let i = 0; i < settle; i++) {
      h.atmosphere.update(1 / 30);
      h.cat.update(1 / 30);
      h.world.update(1 / 30, h.atmosphere, h.rig.camera, false);
      await null;
    }
    h.rig.update(0);
    h.renderer.gl.toneMappingExposure = h.atmosphere.current.exposure;
    applyCatGlow(h.cat, h.atmosphere.current.catGlow);
    // 画两遍：换天色、换机位后取到的第一帧偶尔是黑的（原因没查清），第二帧是稳的；阴影隔帧更新也需要两帧
    h.renderer.render(h.world.scene, h.rig.camera, 1);
    h.renderer.render(h.world.scene, h.rig.camera, 1);
  }

  /** 当前画布缩到 width 宽，存成一张 2D 画布（只有 3D 画面，不含页面文字） */
  function grab(width = 960) {
    const source = h.renderer.gl.domElement;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.round((width * source.height) / source.width);
    canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  /** 把一帧发给本机的收图小服务（验收时临时起的，地址见实施记录），返回是否送达 */
  async function shoot(name: string, p: Pose, width = 960, endpoint = 'http://127.0.0.1:8799') {
    await pose(p);
    const blob = await new Promise<Blob | null>((resolve) => grab(width).toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) return false;
    await fetch(`${endpoint}/${name}.jpg`, { method: 'POST', body: blob, mode: 'cors' });
    return true;
  }

  /** 十个预设 × 八个机位里挑几张代表，拼成一张总览发出去 */
  async function sheet(name: string, poses: Pose[], columns: number, cell = 480, endpoint = 'http://127.0.0.1:8799') {
    const first = await (async () => {
      await pose(poses[0]!);
      return grab(cell);
    })();
    const rows = Math.ceil(poses.length / columns);
    const canvas = document.createElement('canvas');
    canvas.width = cell * columns;
    canvas.height = first.height * rows;
    const context = canvas.getContext('2d')!;
    for (let i = 0; i < poses.length; i++) {
      await pose(poses[i]!);
      context.drawImage(grab(cell), (i % columns) * cell, Math.floor(i / columns) * first.height);
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) return false;
    await fetch(`${endpoint}/${name}.jpg`, { method: 'POST', body: blob, mode: 'cors' });
    return true;
  }

  // ── 量数（方案第 8 节的判据）──────────────────────────────────────────

  const SLOTS: TimeSlot[] = ['dawn', 'day', 'dusk', 'evening', 'night'];
  const WEATHERS: Weather[] = ['clear', 'rain'];

  function pixels() {
    const canvas = grab(720);
    return { data: canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height), scale: canvas.width / innerWidth };
  }

  const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = (r: number, g: number, b: number) => 0.2126 * linear(r / 255) + 0.7152 * linear(g / 255) + 0.0722 * linear(b / 255);
  const lightness = (y: number) => (y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y);

  /**
   * 一小块区域的代表色：按亮度排序后取中间一半求平均。
   * 直接求平均会被团子的眼睛、条纹、草叶的缝这类小黑点带偏（第一版就是这样量出"团子全黑"的）。
   */
  function patch(image: ImageData, cx: number, cy: number, half: number) {
    const samples: [number, number, number, number][] = [];
    for (let y = Math.max(0, Math.round(cy - half)); y <= Math.min(image.height - 1, Math.round(cy + half)); y++) {
      for (let x = Math.max(0, Math.round(cx - half)); x <= Math.min(image.width - 1, Math.round(cx + half)); x++) {
        const i = (y * image.width + x) * 4;
        const r = image.data[i]!, g = image.data[i + 1]!, b = image.data[i + 2]!;
        samples.push([r, g, b, 0.2126 * r + 0.7152 * g + 0.0722 * b]);
      }
    }
    if (!samples.length) return { r: 0, g: 0, b: 0 };
    samples.sort((p, q) => p[3] - q[3]);
    const middle = samples.length > 8 ? samples.slice(Math.floor(samples.length * 0.25), Math.ceil(samples.length * 0.75)) : samples;
    const sum = middle.reduce((acc, s) => [acc[0]! + s[0], acc[1]! + s[1], acc[2]! + s[2]], [0, 0, 0]);
    return { r: sum[0]! / middle.length, g: sum[1]! / middle.length, b: sum[2]! / middle.length };
  }

  /** sRGB → CIELAB（D65） */
  function lab({ r, g, b }: { r: number; g: number; b: number }) {
    const R = linear(r / 255), G = linear(g / 255), B = linear(b / 255);
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
    const Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
    const Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
    return { L: 116 * Y - 16, a: 500 * (X - Y), b: 200 * (Y - Z) };
  }

  function project(point: THREE.Vector3, image: ImageData) {
    const p = point.clone().project(h.rig.camera);
    return { x: (p.x * 0.5 + 0.5) * image.width, y: (-p.y * 0.5 + 0.5) * image.height };
  }

  /**
   * 团子看得见：身体那一块和脚边两侧地面的色差（CIELAB ΔE）与团子自己的明度。
   * 站在地面上的四章都量，各取最不利的一章。
   */
  async function catContrast() {
    const out: Record<string, { deltaE: number; catL: number; groundL: number }> = {};
    for (const time of SLOTS) for (const weather of WEATHERS) {
      let worst = { deltaE: Infinity, catL: Infinity, groundL: 0 };
      for (const shot of [1, 3, 5, 6]) {
        await pose({ shot, time, weather });
        const { data } = pixels();
        const feet = new THREE.Vector3().copy(h.cat.position);
        const body = project(feet.clone().setY(0.17), data);
        const half = Math.max(3, Math.abs(project(feet.clone().setY(0.34), data).y - body.y) * 0.55);
        const side = new THREE.Vector3().subVectors(h.rig.camera.position, feet).cross(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(0.34);
        const cat = lab(patch(data, body.x, body.y, half));
        const left = project(feet.clone().add(side), data);
        const right = project(feet.clone().sub(side), data);
        for (const spot of [left, right]) {
          const ground = lab(patch(data, spot.x, spot.y, half * 0.6));
          const deltaE = Math.hypot(cat.L - ground.L, cat.a - ground.a, cat.b - ground.b);
          if (deltaE < worst.deltaE) worst = { deltaE, catL: Math.min(worst.catL, cat.L), groundL: ground.L };
          else worst.catL = Math.min(worst.catL, cat.L);
        }
      }
      out[`${time}/${weather}`] = { deltaE: +worst.deltaE.toFixed(1), catL: +worst.catL.toFixed(1), groundL: +worst.groundL.toFixed(1) };
    }
    return out;
  }

  /** 文字对比度：把文字块的底色按透明度盖在它身后的画面上，取最不利的那一处，和字色比 */
  async function textContrast() {
    const sections = [...document.querySelectorAll<HTMLElement>('[data-cam]')];
    const parse = (css: string) => {
      const m = css.match(/[\d.]+/g)!.map(Number);
      return { r: m[0]!, g: m[1]!, b: m[2]!, a: m[3] ?? 1 };
    };
    const out: Record<string, { body: number; title: number; at: string }> = {};
    // 量的时候关掉过渡：换昼夜字色有 1.2 秒过渡，过渡途中读到的是半道上的颜色
    const freeze = document.createElement('style');
    freeze.textContent = '* { transition: none !important; }';
    document.head.append(freeze);
    for (const time of SLOTS) for (const weather of WEATHERS) {
      let body = Infinity, title = Infinity, at = '';
      for (let shot = 0; shot < sections.length; shot++) {
        await pose({ shot, time, weather }, 6);
        document.body.dataset.tone = h.atmosphere.dark ? 'night' : 'day';
        const section = sections[shot]!;
        scrollTo(0, shot === 0 ? 0 : section.offsetTop + section.offsetHeight / 2 - innerHeight / 2);
        const { data, scale } = pixels();
        const face = section.querySelector<HTMLElement>('.block');
        // 首屏和结尾没有面，字后面是一团羽化的柔光：结尾中心 0.86、六成半径处 0.7，保守按 0.7 算；首屏压在天上，柔光 0.72／0.58，按 0.58 算
        const scrim = getComputedStyle(document.body).getPropertyValue('--scrim').trim().split(/\s+/).map(Number);
        const faceColor = face ? parse(getComputedStyle(face).backgroundColor) : { r: scrim[0] ?? 0, g: scrim[1] ?? 0, b: scrim[2] ?? 0, a: shot === 0 ? 0.58 : 0.7 };
        const check = (el: HTMLElement | null, isTitle: boolean) => {
          if (!el) return;
          const ink = parse(getComputedStyle(el).color);
          const inkY = luminance(ink.r, ink.g, ink.b);
          const rect = el.getBoundingClientRect();
          const ratios: number[] = [];
          for (let y = rect.top; y <= rect.bottom; y += 6) for (let x = rect.left; x <= rect.right; x += 6) {
            const behind = patch(data, x * scale, y * scale, 1);
            const mix = (f: number, s: number) => f * faceColor.a + s * (1 - faceColor.a);
            const y2 = luminance(mix(faceColor.r, behind.r), mix(faceColor.g, behind.g), mix(faceColor.b, behind.b));
            ratios.push((Math.max(inkY, y2) + 0.05) / (Math.min(inkY, y2) + 0.05));
          }
          // 取第 10 百分位而不是最小值：一两个像素的草缝、星星不代表这行字读不读得清
          ratios.sort((p, q) => p - q);
          const worst = ratios[Math.floor(ratios.length * 0.1)] ?? Infinity;
          if (isTitle) { if (worst < title) title = worst; }
          else if (worst < body) { body = worst; at = `机位 ${shot} .${el.className.split(' ')[0]}`; }
        };
        check(section.querySelector<HTMLElement>('h1, h2'), true);
        section.querySelectorAll<HTMLElement>('.lede, .body, .note, .eyebrow').forEach((el) => check(el, false));
      }
      out[`${time}/${weather}`] = { body: +body.toFixed(2), title: +title.toFixed(2), at };
    }
    freeze.remove();
    scrollTo(0, 0);
    return out;
  }

  /** 没人操作也在动：首屏白天，静置 10 秒前后，五个区域的平均像素差（0–255） */
  async function idleMotion() {
    const tree = new THREE.Vector3(-0.81, 0, -0.6);
    // 树屋机位看得到草、树冠、吊窝和云；水面要到池塘机位才在画面里
    const first = await idleDiff(3, (image) => ({
      草: project(new THREE.Vector3(-0.29, 0.2, 0.7), image),
      树冠: project(tree.clone().add(new THREE.Vector3(0.62, 1.6, 0)), image),
      吊窝: project(new THREE.Vector3(-1.35, 0.78, -0.46), image),
      云: { x: image.width * 0.5, y: image.height * 0.12 },
    }));
    const second = await idleDiff(5, (image) => ({ 水面: project(new THREE.Vector3(1.0, 0.02, -0.4), image) }));
    return { ...first, ...second };
  }

  async function idleDiff(shot: number, pick: (image: ImageData) => Record<string, { x: number; y: number }>) {
    await pose({ shot, time: 'day', weather: 'clear' });
    const before = pixels().data;
    for (let i = 0; i < 300; i++) h.world.update(1 / 30, h.atmosphere, h.rig.camera, false);
    h.renderer.render(h.world.scene, h.rig.camera, 2);
    h.renderer.render(h.world.scene, h.rig.camera, 2);
    const after = pixels().data;
    const regions = pick(before);
    const out: Record<string, number> = {};
    for (const [name, c] of Object.entries(regions)) {
      let sum = 0, n = 0;
      const half = name === '云' ? 0 : 14;
      const x0 = name === '云' ? 0 : c.x - half, x1 = name === '云' ? before.width - 1 : c.x + half;
      const y0 = name === '云' ? 0 : c.y - half, y1 = name === '云' ? before.height * 0.3 : c.y + half;
      for (let y = Math.max(0, Math.round(y0)); y <= Math.min(before.height - 1, Math.round(y1)); y++) {
        for (let x = Math.max(0, Math.round(x0)); x <= Math.min(before.width - 1, Math.round(x1)); x++) {
          const i = (y * before.width + x) * 4;
          sum += Math.abs(before.data[i]! - after.data[i]!) + Math.abs(before.data[i + 1]! - after.data[i + 1]!) + Math.abs(before.data[i + 2]! - after.data[i + 2]!);
          n += 3;
        }
      }
      out[name] = +(sum / n).toFixed(2);
    }
    return out;
  }

  /** 天气过渡：从晴切到雨，雨量从 0 到 1 用了几秒，单步最大变化多少 */
  function transition() {
    h.atmosphere.choose('day', 'clear', true);
    h.atmosphere.choose('day', 'rain');
    let t = 0, previous = h.atmosphere.current.rain, biggest = 0;
    while (h.atmosphere.current.rain < 0.999 && t < 10) {
      h.atmosphere.update(1 / 60);
      t += 1 / 60;
      biggest = Math.max(biggest, h.atmosphere.current.rain - previous);
      previous = h.atmosphere.current.rain;
    }
    h.atmosphere.choose('day', 'clear', true);
    return { seconds: +t.toFixed(2), biggestStepPerFrame: +biggest.toFixed(4) };
  }

  /** 逐帧耗时：每个预设在最重的机位连画 n 帧，取 CPU 提交 + GPU 完成的平均毫秒（gl.finish 同步等） */
  async function frameTime(n = 40) {
    const gl = h.renderer.gl.getContext();
    const out: Record<string, { median: number; p90: number }> = {};
    const step = (i: number) => {
      h.world.update(1 / 60, h.atmosphere, h.rig.camera, false);
      h.cat.update(1 / 60);
      h.renderer.render(h.world.scene, h.rig.camera, i);
      gl.finish();
    };
    for (const [time, weather] of [['day', 'clear'], ['night', 'rain']] as [TimeSlot, Weather][]) {
      for (const shot of [0, 1, 4, 5]) {
        await pose({ shot, time, weather }, 4);
        // 先空跑几帧：换天色、换机位后头几帧带着着色器编译和阴影重算，不算数
        for (let i = 0; i < 8; i++) step(i);
        const times: number[] = [];
        for (let i = 0; i < n; i++) {
          const start = performance.now();
          step(i);
          times.push(performance.now() - start);
        }
        times.sort((a, b) => a - b);
        out[`${time}/${weather} 机位${shot}`] = { median: +times[Math.floor(n / 2)]!.toFixed(1), p90: +times[Math.floor(n * 0.9)]!.toFixed(1) };
      }
    }
    return out;
  }

  return { pose, grab, shoot, sheet, catContrast, textContrast, idleMotion, transition, frameTime, THREE };
}
