import Foundation
import ImageIO

@main struct WorldDepthTests {
    static func main() {
        precondition(WorldDepth.skyRate < WorldDepth.ridgeRate && WorldDepth.ridgeRate < 1)
        precondition(WorldDepth.foregroundRate > 1)
        // A decorative camera always stays inside the same bounded world viewport.
        for half in [0.12, 0.16, 0.24] {
            for camera in stride(from: half, through: 1-half, by: 0.005) {
                for rate in [WorldDepth.skyRate,WorldDepth.ridgeRate,1] {
                    let projected=WorldDepth.camera(camera,rate:rate)
                    precondition(projected >= half && projected <= 1-half)
                    precondition(WorldDepth.camera(camera,rate:rate,enabled:false)==camera)
                }
                // The physical plane is always exactly the existing camera.
                precondition(abs(WorldDepth.camera(camera,rate:1)-camera)<1e-12)
            }
        }
        for rate in [WorldDepth.skyRate,WorldDepth.ridgeRate,1] {
            let difference=WorldDepth.camera(0.7,rate:rate)-WorldDepth.camera(0.4,rate:rate)
            precondition(abs(difference-0.3*rate)<1e-12,"Rigid layers must move at a constant rate")
        }
        let delta=WorldDepth.foregroundX(0.5,camera:0.6)-WorldDepth.foregroundX(0.5,camera:0.5)
        precondition(abs(delta + 0.1*WorldDepth.foregroundRate)<1e-12)
        if CommandLine.arguments.count > 1 {
            let url=URL(fileURLWithPath:CommandLine.arguments[1])
            let source=CGImageSourceCreateWithURL(url as CFURL,nil)!
            let image=CGImageSourceCreateImageAtIndex(source,0,nil)!
            let boundary=WorldDepth.skyline(from:image)
            precondition(boundary.count==257)
            precondition(boundary.allSatisfy {$0>0.30 && $0<0.51})
            for (a,b) in zip(boundary,boundary.dropFirst()) {
                precondition(abs(a-b)<0.02,"Skyline must not jump into a cloud")
            }
            print("PASS: original plate skyline, 257 samples, bounded continuous outline")
        }
        print("PASS: rigid depth ordering, exact physical camera, bounded edges, reduced motion, foreground speed")
    }
}
