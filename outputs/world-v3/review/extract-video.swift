import Foundation
import AVFoundation
import AppKit
let input=URL(fileURLWithPath:CommandLine.arguments[1]),output=URL(fileURLWithPath:CommandLine.arguments[2])
let asset=AVURLAsset(url:input)
let generator=AVAssetImageGenerator(asset:asset)
generator.appliesPreferredTrackTransform=true
generator.maximumSize=CGSize(width:402,height:874)
generator.requestedTimeToleranceBefore = .zero;generator.requestedTimeToleranceAfter = .zero
try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
for time in CommandLine.arguments.dropFirst(3).compactMap(Double.init) {
    let image=try generator.copyCGImage(at:CMTime(seconds:time,preferredTimescale:600),actualTime:nil)
    let bitmap=NSBitmapImageRep(cgImage:image)
    try bitmap.representation(using:.png,properties:[:])!.write(to:output.appendingPathComponent(String(format:"frame-%06.2f.png",time)))
}
