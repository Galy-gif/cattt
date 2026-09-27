import AVFoundation
import CoreVideo
import Foundation

struct BlankEvent: Codable {
    let at: Double
    let frames: Int
    let duration: Double
}

struct Report: Codable {
    let schemaVersion = 2
    let file: String
    let duration: Double
    let frames: Int
    let blankCanvasEvents: [BlankEvent]
    let whiteCanvasEvents: [BlankEvent]
    let detector: String
}

guard CommandLine.arguments.count >= 2 else {
    fputs("用法：swift tools/analyze_yard_video.swift <录屏.mov/mp4> [结果.json]\n", stderr)
    exit(2)
}

let input = URL(fileURLWithPath: CommandLine.arguments[1])
let asset = AVURLAsset(url: input)
let tracks = try await asset.loadTracks(withMediaType: .video)
guard let track = tracks.first else { throw NSError(domain: "YardVideo", code: 1, userInfo: [NSLocalizedDescriptionKey: "没有视频轨"])}
let duration = try await asset.load(.duration).seconds
let reader = try AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
])
output.alwaysCopiesSampleData = false
guard reader.canAdd(output) else { throw NSError(domain: "YardVideo", code: 2, userInfo: [NSLocalizedDescriptionKey: "不能读取视频像素"])}
reader.add(output)
guard reader.startReading() else { throw reader.error ?? NSError(domain: "YardVideo", code: 3) }

var frameCount = 0
var events: [BlankEvent] = []
var whiteEvents: [BlankEvent] = []
var eventStart: Double?
var whiteEventStart: Double?
var eventFrames = 0
var whiteEventFrames = 0
var lastTime = 0.0

while let sample = output.copyNextSampleBuffer() {
    guard let pixel = CMSampleBufferGetImageBuffer(sample) else { continue }
    let at = CMSampleBufferGetPresentationTimeStamp(sample).seconds
    lastTime = at
    frameCount += 1
    let blank = isBlankCanvas(pixel)
    let white = isWhiteCanvas(pixel)
    if blank {
        if eventStart == nil { eventStart = at }
        eventFrames += 1
    } else if let start = eventStart {
        events.append(BlankEvent(at: start, frames: eventFrames, duration: max(0, at - start)))
        eventStart = nil
        eventFrames = 0
    }
    if white {
        if whiteEventStart == nil { whiteEventStart = at }
        whiteEventFrames += 1
    } else if let start = whiteEventStart {
        whiteEvents.append(BlankEvent(at: start, frames: whiteEventFrames, duration: max(0, at - start)))
        whiteEventStart = nil
        whiteEventFrames = 0
    }
}
if let start = eventStart {
    events.append(BlankEvent(at: start, frames: eventFrames, duration: max(0, lastTime - start)))
}
if let start = whiteEventStart {
    whiteEvents.append(BlankEvent(at: start, frames: whiteEventFrames, duration: max(0, lastTime - start)))
}
guard reader.status == .completed else { throw reader.error ?? NSError(domain: "YardVideo", code: 4) }

let report = Report(file: input.lastPathComponent, duration: duration, frames: frameCount,
                    blankCanvasEvents: events, whiteCanvasEvents: whiteEvents,
                    detector: "画面中央 4%–96% × 8%–83% 网格中，≥92% 像素接近院子淡蓝露底色且上下色差 <18，或 ≥96% 接近白色；有明确上下渐变的原生天空不计露底")
let data = try JSONEncoder.pretty.encode(report)
if CommandLine.arguments.count >= 3 {
    try data.write(to: URL(fileURLWithPath: CommandLine.arguments[2]), options: .atomic)
}
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data("\n".utf8))

func isBlankCanvas(_ pixel: CVPixelBuffer) -> Bool {
    let pale = sampledRatio(pixel) { r, g, b in
        let distance = abs(r - 207) + abs(g - 227) + abs(b - 234)
        return distance <= 58 && r >= 175 && g >= 195 && b >= 205
    }
    return pale >= 0.92 && verticalColorDelta(pixel) < 18
}

func isWhiteCanvas(_ pixel: CVPixelBuffer) -> Bool {
    sampledRatio(pixel) { r, g, b in r >= 244 && g >= 244 && b >= 244 } >= 0.96
}

func sampledRatio(_ pixel: CVPixelBuffer, matches: (Int, Int, Int) -> Bool) -> Double {
    CVPixelBufferLockBaseAddress(pixel, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixel, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(pixel) else { return 0 }
    let width = CVPixelBufferGetWidth(pixel)
    let height = CVPixelBufferGetHeight(pixel)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(pixel)
    let stride = max(12, min(width, height) / 90)
    let x0 = Int(Double(width) * 0.04), x1 = Int(Double(width) * 0.96)
    let y0 = Int(Double(height) * 0.08), y1 = Int(Double(height) * 0.83)
    var matching = 0, total = 0
    for y in Swift.stride(from: y0, to: y1, by: stride) {
        let row = base.advanced(by: y * bytesPerRow).assumingMemoryBound(to: UInt8.self)
        for x in Swift.stride(from: x0, to: x1, by: stride) {
            let b = Int(row[x * 4]), g = Int(row[x * 4 + 1]), r = Int(row[x * 4 + 2])
            total += 1
            if matches(r, g, b) { matching += 1 }
        }
    }
    return total > 0 ? Double(matching) / Double(total) : 0
}

func verticalColorDelta(_ pixel: CVPixelBuffer) -> Double {
    CVPixelBufferLockBaseAddress(pixel, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixel, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(pixel) else { return .infinity }
    let width = CVPixelBufferGetWidth(pixel)
    let height = CVPixelBufferGetHeight(pixel)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(pixel)
    let topY = Int(Double(height) * 0.18)
    let bottomY = Int(Double(height) * 0.78)
    let top = base.advanced(by: topY * bytesPerRow).assumingMemoryBound(to: UInt8.self)
    let bottom = base.advanced(by: bottomY * bytesPerRow).assumingMemoryBound(to: UInt8.self)
    var total = 0, samples = 0
    for x in stride(from: Int(Double(width) * 0.12), to: Int(Double(width) * 0.88), by: max(1, width / 24)) {
        for channel in 0..<3 { total += abs(Int(top[x * 4 + channel]) - Int(bottom[x * 4 + channel])) }
        samples += 1
    }
    return samples > 0 ? Double(total) / Double(samples) : .infinity
}

extension JSONEncoder {
    static var pretty: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return encoder
    }
}
