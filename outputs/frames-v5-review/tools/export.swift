// 压缩录屏：export <输入> <输出> <起始秒> <结束秒>
import AVFoundation
let a=CommandLine.arguments
let asset=AVURLAsset(url:URL(fileURLWithPath:a[1]))
let out=URL(fileURLWithPath:a[2]);try? FileManager.default.removeItem(at:out)
let s=AVAssetExportSession(asset:asset,presetName:AVAssetExportPreset960x540)!
s.outputURL=out;s.outputFileType = .mp4
s.timeRange=CMTimeRange(start:CMTime(seconds:Double(a[3])!,preferredTimescale:600),end:CMTime(seconds:Double(a[4])!,preferredTimescale:600))
let sem=DispatchSemaphore(value:0)
s.exportAsynchronously {sem.signal()}
sem.wait()
print(s.status == .completed ? "ok":"failed \(String(describing:s.error))")
