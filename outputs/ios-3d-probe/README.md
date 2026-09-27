# iOS 第 0 轮验证证据

当前总判定：**通过**。用户原始真机录屏中的 12 次运行期 WebGL 画布闪空已经固化为自动基线；修复构建已通过模拟器回归，并在 iPhone 16 Pro Max 完成 7 分 34 秒正常运行、自由浏览/找团子和六处路线人工复验。用户确认无白闪、镜头回弹/跳动或穿模；报告记录 114 个倍率阶段事件、0 次穿透。最终系统录屏逐帧补齐真正冷启动、倍率循环、内容进程恢复和三次重开，四组均无白屏或意外闪空。App 与 WebContent 合计峰值 281.27MB；拔线能耗样本中位 12.23%/小时、亮度 52%、热状态 fair。内容进程终止后的视觉恢复通过，但该故障注入报告按硬规则保持“未通过”，不计作正常运行通过。结论只覆盖这台 iPhone 16 Pro Max，不代表最低支持机型。`simulator-*` 来自 iPhone 17 Pro / iOS 26.5 模拟器。`iphone16promax-compat-*` 来自真实 iPhone，但当时 USB 充电，只作为短时兼容性证据。

| 文件 | 用途 |
|---|---|
| iphone16promax-day-200-fallback4.json | ×2 再将绒毛降至两层，本组性能门槛通过；未采用 30fps |
| iphone16promax-day-200-fallback3.json | ×2 再将草量减半，仍未通过：最慢 1% 帧 34.5fps |
| iphone16promax-day-200-fallback2.json | ×2 在关辉光后阴影降到 1024，仍未通过：最慢 1% 帧 37fps |
| iphone16promax-day-200-fallback1.json | ×2 仅关辉光，五分钟，未通过：最慢 1% 帧 37fps |
| iphone16promax-day-200.json | 白天晴 ×2 五分钟，未通过：分辨率倍率触底 0.75 |
| iphone16promax-day-150.json | 白天晴 ×1.5，五分钟，本组性能门槛通过 |
| iphone16promax-night-125.json | 夜晚雨 ×1.25，五分钟，本组性能门槛通过 |
| iphone16promax-day-125.json | 白天晴 ×1.25，五分钟，单组性能门槛通过；不代表总验收 |
| iphone16promax-compat-msaa-off.json | 真机多重采样关，30 秒兼容性通过，USB 充电 |
| iphone16promax-compat-msaa-on.json | 真机多重采样开，30 秒兼容性通过，USB 充电 |
| simulator-model-missing.json | 真团子模型 404 时明确失败 |
| simulator-no-first-frame.json | 无首帧十秒超时，保存失败记录 |
| simulator-report-timeout.json | 报告三秒无响应，保存心跳部分数据并标记失败 |
| simulator-night-rain.json | 夜晚雨 15 秒渲染冒烟 |
| simulator-day-thirty.json | 白天晴主动 30fps 15 秒渲染冒烟 |
| simulator-lifecycle.json | 保留修正前后台回调超时的失败证据 |
| simulator-lifecycle-ten-cycles.json | 修正后后台 30 秒及十次切换，11 对状态一致、90.443 秒有效数据 |
| runtime-blank-baseline.json | 用户 54.688 秒原始录屏的逐帧基线：12 次淡蓝露底、0 次整页白屏 |
| simulator-cold-launch-fixed.json | 专用 Launch Screen 后冷启动白屏 0 次；启动天空兜底 1 段 |
| simulator-scale-cycle-fixed.json | 强制倍率循环；进入 3D 后运行期露底 0 次、白屏 0 次 |
| simulator-context-loss-fixed.json | 实际 WebGL 上下文丢失/恢复录屏；白屏 0 次，由原生天空承接 |
| simulator-process-termination-fixed.json | 可重复内容进程终止恢复路径；约 0.5 秒回到同一状态，白屏 0 次；该轮按规则标记失败 |
| simulator-reopen-3x-fixed.json | 连续三次终止/冷启动，白屏 0 次；每次启动由原生天空承接 |
| simulator-route-clearance-fixed.json | ×1.5 完整效果、MSAA 关自动实走 75.05 秒：4488 帧，实体膨胀边界净距 0.00175 m，穿透 0 次 |
| iphone16pm-fix-normal-20260920.json | 最终修复版真机正常运行 453.601 秒：26300 帧，中位/最慢 1% 为 58.8/45.5fps，触摸最大 1 帧，净距 0.00175 m，穿透 0 次 |
| iphone16pm-fix-process-recovery-20260920.json | 真机内容进程在 0.879 秒终止，1.197 秒恢复首帧及原快照；按规则判为未通过，恢复后继续运行 325.725 秒 |
| iphone16pm-final-screen-recording-fixed.json | 最终系统录屏逐帧结果：冷启动、倍率循环、内容进程恢复与三次重开画面均通过；原始 MOV 只记哈希和元数据 |
| iphone16pm-memory-final-20260926.json | 最终全进程内存采样：App + WebContent 同时峰值 281.27MB，低于 450MiB；连 WebKit GPU 一并保守计算也为 384.32MB |
| iphone16pm-energy-final-20260926.json | 最终拔线 Power Profiler 采样：×1.5、MSAA 关、夜雨完整效果；11 个样本中位 12.23%/小时，亮度 52%、热状态 fair |

构建源码与模型摘要见每份记录的 `build`；渲染设置见 `options`。缺测项为 `null` 或列在 `missing`，不得解释为零或通过。截图和中间录屏留在临时目录，不纳入仓库。

实施、命令及真机待验矩阵见 [实施与验收](../../docs/方案/iOS-3D世界层与界面同步-实施与验收-2026-09-20.md)。

数值只读复核：

```bash
python3 tools/summarize_yard_probe.py outputs/ios-3d-probe/iphone16promax-*.json
```

脚本不会把无失败原因的单份记录改成整轮“通过”，也不把多个网页进程的百分位取平均。


## 真机清晰度与选定配置

- [三档及四级降级的同机位对照页](clarity.html)；[原图尺寸、哈希及机位快照清单](clarity-manifest.json)。七组机位与世界状态一致。原尺寸截图仅用于本地验收，不作为可提交的压缩证据。
- 选择 ×1.5、MSAA 关、完整效果，60fps 目标；白天五分钟中位 / 最慢 1% = 58.8 / 47.6fps，最低倍率 0.90。
- [选定配置夜雨十分钟](iphone16promax-night-150-heat.json)：600.935 有效秒、34964 帧间隔、平均 58.18fps、中位 / 最慢 1% = 58.8 / 45.5fps、最低倍率 0.85。单一前台段、无暂停，热状态一直 nominal，App 峰值 59.77MiB，全程 unplugged、亮度 0.45；性能和热状态门槛通过。WebContent 内存不由这份记录得出。
- 最终修复版系统录屏已证明运行时画布闪空修复，并补齐真正冷启动可见首帧；恢复、触摸、两进程合计内存与有效能耗均已完成，第 0 轮通过。


## 真机恢复与触摸

- [后台 30 秒及十次往返](iphone16promax-recovery.json)：180.534 秒有效渲染，12 个前台段 / 11 个暂停段，11 对完整快照一致，无进程终止。
- [实体锁屏/解锁与手指拖动](iphone16promax-lock-touch.json)：59.458 秒有效渲染，2 对快照一致，219 次触摸记录最大 1 帧 / 12ms。用户确认在夜雨 3D 实测页中无白屏或镜头跳动。先前用户看到 2D 的操作不计入证据。
- [恢复汇总](recovery-summary.json)。帧差从网页收到触摸事件到镜头更新计，不是触屏硬件到光子的测量。
- [冷启动录屏尝试](cold-start-attempt.json)：CoreDevice 与 QuickTime 采集失败。用户后续系统录屏可以分析，但进入后 HUD 已有 4057 秒，属于后台恢复而非冷启动；这段录屏同时确认运行中画布闪空。视频和抽帧仅本地保留，仓库记录哈希、元数据和结论。
- [最终修复版正常运行](iphone16pm-fix-normal-20260920.json)：×1.5、MSAA 关、完整效果，453.601 秒有效渲染、26300 帧，中位 / 最慢 1% = 58.8 / 45.5fps，最低倍率 0.90，触摸 338 次且最大 1 帧 / 19ms，实体膨胀边界净距 0.00175 m、穿透 0 次，热状态 nominal，App 峰值 55.78MB。用户人工确认无白闪、镜头回弹/跳动或穿模。
- [最终修复版内容进程恢复](iphone16pm-fix-process-recovery-20260920.json)：0.879 秒注入终止，1.197 秒新页面首帧并确认恢复，位置、目标、镜头、时段和天气一致；报告正确记录失败原因，恢复后继续运行 325.725 秒、穿透 0 次。
- [最终系统录屏逐帧复核](iphone16pm-final-screen-recording-fixed.json)：228.002 秒、13638 帧。冷启动约 0.783 秒见到 3D、0.917 秒稳定；倍率循环连续 53.613 秒观察到 ×0.8 / ×1.0，白屏与意外闪空均为 0；内容进程终止后 0.383 秒见到 3D、0.517 秒稳定；三次重开分别在 0.894 / 0.867 / 0.876 秒稳定。自动检测的唯一 2 帧原始候选位于故障注入后的原生天空遮罩起点，经前后逐帧确认不是运行期 WebGL 闪空。
- 用户观察到团子没有蜷卧在猫窝里。这符合本轮已评审边界：当前只停在床前避免穿模，专用进床/蜷睡动作留到后续动作批次。


## 最终补验与工具边界

- [WebGL 上下文丢失/恢复](simulator-context-loss.json)：实际丢失并重建，状态一致，恢复后持续渲染。
- [内容进程被终止](simulator-process-terminated.json)：实际 SIGKILL 后重载，最近快照一致；报告正确判为未通过。
- [三次进入/退出及 2D 驱动证据](simulator-reentry-summary.json)：覆盖期间 2D 驱动暂停、时间不增长，退出恢复原有手动暂停状态。
- [Instruments App 内存](memory-instruments-summary.json)：早期独立 USB 采样只取得 App 峰值 49.48MB，当时 WebContent 和合计内存缺测。
- [最终全进程内存](iphone16pm-memory-final-20260926.json)：Activity Monitor 在稳定运行阶段取得 11 个同步样本；App 29.53MB、WebContent 251.79MB，同一时刻合计峰值 281.27MB，低于 450MiB，内存门槛通过。WebKit GPU 103.09MB 不属于原门槛；将其加入后同步峰值 384.32MB，仍低于门槛。
- [最终拔线能耗](iphone16pm-energy-final-20260926.json)：Power Profiler 在 ×1.5、MSAA 关、夜雨完整效果下取得 11 个未充电样本；耗电率中位 12.23%/小时、时长加权平均 14.25%/小时，亮度 52%、热状态 fair。原计划没有能耗数值上限，因此该项只关闭“有效样本缺测”，不临时发明高低阈值；正式十分钟发热门槛仍以无工具长测的 nominal 为准。
- [工具采样尝试及失败原因](instrument-attempts.json)：保留早期无线断开、USB 保存失败和模板错误等过程边界；最终内存与能耗结果以上述两份 09-26 证据为准。
- [最终安装版冒烟](iphone16promax-final-build-smoke.json)：源码摘要 `baa5b997d60e…`，30.910 秒，正常出图/保存；USB 充电且 QuickTime 预览，不计正式性能组。独立包名称为“猫猫实测”。

完整结论以[实施与验收](../../docs/方案/iOS-3D世界层与界面同步-实施与验收-2026-09-20.md)为准：**第 0 轮通过，第 1 轮六处竖屏构图待开始**。原始每轮 JSON 无失败时仍显示“缺测”，单组过线由完整矩阵判定，二者并不矛盾；内容进程故障注入组按硬规则单独保持“未通过”。
