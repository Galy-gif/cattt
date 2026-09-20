/** 无 DOM 依赖的测量核心；所有时间来自同一单调时钟。 */
export class FramePacer {
  private next: number | null = null;
  readonly fps: number;
  constructor(fps: number) { this.fps = fps; }
  reset() { this.next = null; }
  due(now: number) {
    const step = 1000 / this.fps;
    if (this.next === null) this.next = now;
    if (now + 0.01 < this.next) return false;
    this.next = now - this.next > step * 2 ? now + step : this.next + step;
    return true;
  }
}

export interface PerfReport {
  seconds: number;
  frames: number;
  medianFps: number;
  low1Fps: number;
  hitches: number;
  longestFrameMs: number;
  minScale: number | null;
  perSecond: number[];
  segments: { startMs: number; endMs: number; frames: number }[];
  pauses: { startMs: number; endMs: number | null; reason: string }[];
  touch: { samples: number; maxFrameDelay: number | null; maxMs: number | null };
}

export class PerfRecorder {
  private durations: number[] = [];
  private previous: number | null = null;
  private segments: PerfReport['segments'] = [];
  private pauses: PerfReport['pauses'] = [];
  private minimum: number | null = null;
  private secondMs = 0;
  private secondFrames = 0;
  private perSecond: number[] = [];
  private touchFrames: number[] = [];
  private touchTimes: number[] = [];

  frame(now: number, scale: number) {
    this.minimum = Math.min(this.minimum ?? scale, scale);
    if (this.previous === null) {
      this.segments.push({ startMs: now, endMs: now, frames: 0 });
      const pause = this.pauses.at(-1);
      if (pause && pause.endMs === null) pause.endMs = now;
    } else {
      const ms = now - this.previous;
      if (ms > 0) {
        this.durations.push(ms);
        this.secondMs += ms;
        this.secondFrames++;
        if (this.secondMs >= 1000) {
          this.perSecond.push(this.secondFrames * 1000 / this.secondMs);
          this.secondMs = 0; this.secondFrames = 0;
        }
        const segment = this.segments.at(-1)!;
        segment.endMs = now;
        segment.frames++;
      }
    }
    this.previous = now;
  }

  pause(now: number, reason: string) {
    if (this.previous === null) return;
    this.previous = null;
    this.secondMs = 0; this.secondFrames = 0;
    this.pauses.push({ startMs: now, endMs: null, reason });
  }

  touch(frames: number, ms: number) { this.touchFrames.push(frames); this.touchTimes.push(ms); }

  report(): PerfReport {
    const sorted = [...this.durations].sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
    const fps = (ms: number) => ms > 0 ? Math.round(10000 / ms) / 10 : 0;
    return {
      seconds: this.durations.reduce((sum, ms) => sum + ms, 0) / 1000,
      frames: sorted.length, medianFps: fps(at(0.5)), low1Fps: fps(at(0.99)),
      hitches: sorted.filter(ms => ms > 33).length, longestFrameMs: sorted.at(-1) ?? 0,
      minScale: this.minimum, perSecond: [...this.perSecond],
      segments: this.segments.map(s => ({ ...s })), pauses: this.pauses.map(p => ({ ...p })),
      touch: { samples: this.touchFrames.length,
        maxFrameDelay: this.touchFrames.length ? Math.max(...this.touchFrames) : null,
        maxMs: this.touchTimes.length ? Math.max(...this.touchTimes) : null },
    };
  }
}
