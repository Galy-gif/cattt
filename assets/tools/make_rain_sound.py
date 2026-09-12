#!/usr/bin/env python3
"""合成一段 30 秒可无缝循环的雨声，写成 AAC（ios/Maomao/Resources/Audio/rain-loop.m4a）。

不从网上下载：这是按种子生成的滤波噪声加零星雨滴，结果确定。
做法：白噪声 → 一阶低通两次（像远处的雨） + 高频细沙（近处雨丝） + 泊松分布的小雨滴敲击；首尾 1.5 秒交叉淡化做成环。
需要 macOS 的 afconvert。
"""
import subprocess, wave, struct
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'ios/Maomao/Resources/Audio'
SR, SECONDS = 22050, 30
rng = np.random.default_rng(20260912)
n = SR * SECONDS
white = rng.standard_normal(n)


def lowpass(x, alpha):
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc += alpha * (x[i] - acc); y[i] = acc
    return y


body = lowpass(lowpass(white, 0.12), 0.35)             # 远处的雨，闷
hiss = white - lowpass(white, 0.6)                     # 近处雨丝，沙
# 雨势慢慢起伏：0.05–0.2Hz 的包络
t = np.arange(n) / SR
swell = 0.75 + 0.25 * np.sin(2 * np.pi * 0.07 * t + 1.0) * np.sin(2 * np.pi * 0.023 * t)
mix = (body * 1.6 + hiss * 0.35) * swell
# 雨滴敲击：每秒约 12 滴，短促的衰减正弦，音高随机
drops = np.zeros(n)
count = int(12 * SECONDS)
for start in rng.integers(0, n - 2000, count):
    length = int(rng.integers(120, 600)); f = rng.uniform(900, 2600)
    k = np.arange(length)
    drops[start:start + length] += np.sin(2 * np.pi * f * k / SR) * np.exp(-k / (length / 4)) * rng.uniform(0.05, 0.22)
mix = mix + drops
# 首尾交叉淡化成环
fade = int(SR * 1.5)
head, tail = mix[:fade].copy(), mix[-fade:].copy()
ramp = np.linspace(0, 1, fade)
mix[:fade] = head * ramp + tail * (1 - ramp)
mix = mix[:-fade]
mix = mix / np.abs(mix).max() * 0.6
OUT.mkdir(parents=True, exist_ok=True)
wav = OUT / 'rain-loop.wav'
with wave.open(str(wav), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(struct.pack('<%dh' % len(mix), *(np.clip(mix * 32767, -32768, 32767).astype(np.int16))))
subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '64000', str(wav), str(OUT / 'rain-loop.m4a')], check=True)
wav.unlink()
print('wrote', OUT / 'rain-loop.m4a', (OUT / 'rain-loop.m4a').stat().st_size, 'bytes,', len(mix) / SR, 's')
