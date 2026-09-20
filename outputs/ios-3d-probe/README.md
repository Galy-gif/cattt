# iOS 第 0 轮验证证据

当前总判定：**缺测**。`simulator-*` 来自 iPhone 17 Pro / iOS 26.5 模拟器。`iphone16promax-compat-*` 来自真实 iPhone，但当时 USB 充电，只作为短时兼容性证据，不能用于通过正式性能闸门。

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

构建源码与模型摘要见每份记录的 `build`；渲染设置见 `options`。缺测项为 `null` 或列在 `missing`，不得解释为零或通过。截图和中间录屏留在临时目录，不纳入仓库。

实施、命令及真机待验矩阵见 [实施与验收](../../docs/specs/iOS-3D世界层与界面同步-实施与验收.md)。

数值只读复核：

```bash
python3 tools/summarize_yard_probe.py outputs/ios-3d-probe/iphone16promax-*.json
```

脚本不会把无失败原因的单份记录改成整轮“通过”，也不把多个网页进程的百分位取平均。


## 真机清晰度与选定配置

- [三档及四级降级的同机位对照页](clarity.html)；[原图尺寸、哈希及机位快照清单](clarity-manifest.json)。七组机位与世界状态一致。原尺寸截图仅用于本地验收，不作为可提交的压缩证据。
- 选择 ×1.5、MSAA 关、完整效果，60fps 目标；白天五分钟中位 / 最慢 1% = 58.8 / 47.6fps，最低倍率 0.90。
- [选定配置夜雨十分钟](iphone16promax-night-150-heat.json)：600.935 有效秒、34964 帧间隔、平均 58.18fps、中位 / 最慢 1% = 58.8 / 45.5fps、最低倍率 0.85。单一前台段、无暂停，热状态一直 nominal，App 峰值 59.77MiB，全程 unplugged、亮度 0.45；性能和热状态门槛通过。WebContent 内存不由这份记录得出。
- 完整第 0 轮仍为缺测；恢复与触摸已完成，尚缺可见首帧录屏、两进程合计内存与有效能耗。


## 真机恢复与触摸

- [后台 30 秒及十次往返](iphone16promax-recovery.json)：180.534 秒有效渲染，12 个前台段 / 11 个暂停段，11 对完整快照一致，无进程终止。
- [实体锁屏/解锁与手指拖动](iphone16promax-lock-touch.json)：59.458 秒有效渲染，2 对快照一致，219 次触摸记录最大 1 帧 / 12ms。用户确认在夜雨 3D 实测页中无白屏或镜头跳动。先前用户看到 2D 的操作不计入证据。
- [恢复汇总](recovery-summary.json)。帧差从网页收到触摸事件到镜头更新计，不是触屏硬件到光子的测量。
- [冷启动录屏尝试](cold-start-attempt.json)：CoreDevice 返回当前设备不支持 Screen Recording；USB QuickTime 后续也提示无法录制，未取得有效视频。原生截图显示App仍正常渲染，不能把采集黑屏当成App白屏，也不能宣称可见首帧或无白闪通过。


## 最终补验与工具边界

- [WebGL 上下文丢失/恢复](simulator-context-loss.json)：实际丢失并重建，状态一致，恢复后持续渲染。
- [内容进程被终止](simulator-process-terminated.json)：实际 SIGKILL 后重载，最近快照一致；报告正确判为未通过。
- [三次进入/退出及 2D 驱动证据](simulator-reentry-summary.json)：覆盖期间 2D 驱动暂停、时间不增长，退出恢复原有手动暂停状态。
- [Instruments App 内存](memory-instruments-summary.json)：独立 USB 采样，App 峰值 49.48MB；WebContent 和合计内存缺测。
- [工具采样尝试及失败原因](instrument-attempts.json)：无线分析连接失败，USB 的全进程内存和能耗未形成有效可导出数据。
- [最终安装版冒烟](iphone16promax-final-build-smoke.json)：源码摘要 `baa5b997d60e…`，30.910 秒，正常出图/保存；USB 充电且 QuickTime 预览，不计正式性能组。独立包名称为“猫猫实测”。

完整结论以[实施与验收](../../docs/specs/iOS-3D世界层与界面同步-实施与验收.md)为准：**缺测，第 1 轮未开始**。原始每轮 JSON 无失败时仍显示“缺测”，单组过线由此处矩阵判定，二者并不矛盾。
