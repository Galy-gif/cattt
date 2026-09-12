import Foundation
import CoreGraphics

/// Decorative projection only. Ground, contact points, paths and hit testing keep
/// WorldGeometry's camera exactly; only the two distant planes and edge leaves differ.
enum WorldDepth {
    static let origin = 0.25
    static let skyRate = 0.60
    static let ridgeRate = 0.82
    static let groundStart = 0.56
    static let foregroundRate = 1.18

    /// Detect the continuous green skyline once from the existing plate. We classify
    /// only the boundary, not each rendered pixel: cream clouds must remain whole,
    /// and highlights within mountains must never become transparent holes.
    static func skyline(from image:CGImage)->[Float] {
        let width=768, height=512, count=257
        var pixels=[UInt8](repeating:0,count:width*height*4)
        let rendered=pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:width,height:height,
                bitsPerComponent:8,bytesPerRow:width*4,space:CGColorSpaceCreateDeviceRGB(),
                bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else {return false}
            context.draw(image,in:CGRect(x:0,y:0,width:width,height:height))
            return true
        }
        guard rendered else {return []}
        var samples=[Float]()
        for i in 0..<count {
            let x=i*(width-1)/(count-1)
            var edge=Int(Double(height)*0.5)
            for y in Int(Double(height)*0.26)..<Int(Double(height)*0.54) {
                var green=0
                for dy in 0..<4 {
                    let p=((y+dy)*width+x)*4
                    let r=Int(pixels[p]),g=Int(pixels[p+1]),b=Int(pixels[p+2])
                    if g>r+2 && g>b+6 {green += 1}
                }
                if green>=3 {edge=y;break}
            }
            samples.append(Float(edge)/Float(height))
        }
        return samples.indices.map { i in
            let neighbors=Array(samples[max(0,i-1)...min(count-1,i+1)]).sorted()
            return neighbors[neighbors.count/2]
        }
    }

    static func camera(_ camera: Double, rate: Double, enabled: Bool = true) -> Double {
        enabled ? origin+(camera-origin)*rate : camera
    }

    static func foregroundX(_ x: Double, camera: Double, enabled: Bool = true) -> Double {
        x - camera - (camera-0.5)*(enabled ? foregroundRate-1:0)
    }
}
