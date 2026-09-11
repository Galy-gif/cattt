// 从录屏抽帧：frames <视频> <输出目录> <起始秒> <结束秒> <间隔秒>
import AVFoundation
import AppKit
let a=CommandLine.arguments
let asset=AVURLAsset(url:URL(fileURLWithPath:a[1]))
let out=URL(fileURLWithPath:a[2]);try? FileManager.default.createDirectory(at:out,withIntermediateDirectories:true)
let from=Double(a[3])!,to=Double(a[4])!,step=Double(a[5])!
let gen=AVAssetImageGenerator(asset:asset);gen.appliesPreferredTrackTransform=true
gen.requestedTimeToleranceBefore = .zero;gen.requestedTimeToleranceAfter = .zero
gen.maximumSize=CGSize(width:604,height:1311)
var t=from,i=0
while t<=to {
    if let cg=try? gen.copyCGImage(at:CMTime(seconds:t,preferredTimescale:600),actualTime:nil) {
        let rep=NSBitmapImageRep(cgImage:cg)
        try rep.representation(using:.png,properties:[:])!.write(to:out.appendingPathComponent(String(format:"f%04d_%.2f.png",i,t)))
    }
    t+=step;i+=1
}
print("frames",i)
