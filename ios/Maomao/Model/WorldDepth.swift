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

    /// 猫能落脚的最远一行（最上）和前景行走带；纵深缩放在这两行之间插值。
    static let catFarY = 0.60
    static let catNearY = 0.82

    /// 纵深缩放里只跟位置有关的那一半（0.85–1.00）。
    /// 画猫时乘它；走路的帧相位要除掉它 —— 位移按参考屏 pt 累加，画出来的身子却被它缩过，不除脚会打滑。
    /// 换向判断（`WorldSimulation.atFootfall`）和视图的相位时钟必须用同一个值，不然"只在着地帧换向"就不成立。
    static func catScaleFactor(y: Double) -> Double {
        0.85 + 0.15 * min(max((y - catFarY) / (catNearY - catFarY), 0), 1)
    }

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
