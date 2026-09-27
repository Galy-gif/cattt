export interface ScaleDecision {
  scale: number;
  reason: 'slow' | 'fast';
}

/**
 * 自适应分辨率只负责做决定，不直接重建画布。
 * 调用方在下一次 render 开头应用决定，保证 resize 后同一帧一定会绘制。
 */
export class AdaptiveScaleGovernor {
  private slowWindows = 0;
  private fastWindows = 0;
  private cooldownWindows = 0;
  readonly minimum: number;
  readonly step: number;
  readonly slowWindowsRequired: number;
  readonly fastWindowsRequired: number;
  readonly cooldownAfterChange: number;

  constructor(
    minimum = 0.75,
    step = 0.05,
    slowWindowsRequired = 2,
    fastWindowsRequired = 3,
    cooldownAfterChange = 3,
  ) {
    this.minimum = minimum;
    this.step = step;
    this.slowWindowsRequired = slowWindowsRequired;
    this.fastWindowsRequired = fastWindowsRequired;
    this.cooldownAfterChange = cooldownAfterChange;
  }

  reset() {
    this.slowWindows = 0;
    this.fastWindows = 0;
  }

  sample(fps: number, targetFps: number, scale: number): ScaleDecision | null {
    if (this.cooldownWindows > 0) {
      this.cooldownWindows--;
      this.reset();
      return null;
    }

    const slow = fps < targetFps * (55 / 60);
    const fast = fps > targetFps * 0.975;
    if (slow && scale > this.minimum) {
      this.fastWindows = 0;
      if (++this.slowWindows < this.slowWindowsRequired) return null;
      this.slowWindows = 0;
      this.cooldownWindows = this.cooldownAfterChange;
      return { scale: Math.max(this.minimum, roundScale(scale - this.step)), reason: 'slow' };
    }
    if (fast && scale < 1) {
      this.slowWindows = 0;
      if (++this.fastWindows < this.fastWindowsRequired) return null;
      this.fastWindows = 0;
      this.cooldownWindows = this.cooldownAfterChange;
      return { scale: Math.min(1, roundScale(scale + this.step)), reason: 'fast' };
    }
    this.reset();
    return null;
  }
}

function roundScale(value: number) {
  return Math.round(value * 100) / 100;
}
