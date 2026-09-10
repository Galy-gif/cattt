import Foundation
@main struct CameraTests {
    static func main() {
        let half=0.16
        var camera=WorldCamera()
        camera.look(at:0.90,half:half)
        var previous=camera.x
        for _ in 0..<180 {
            camera.tick(1.0/60,cat:0.2,half:half)
            precondition(camera.x>=previous-0.00001 && camera.x<=0.84)
            precondition(abs(camera.x-previous)<0.02)
            previous=camera.x
        }
        precondition(abs(camera.x-0.84)<0.001)
        camera.find()
        for frame in 0..<180 {
            let cat=0.2+Double(frame)*0.0008
            previous=camera.x;camera.tick(1.0/60,cat:cat,half:half)
            precondition(abs(camera.x-previous)<0.02,"Find moving cat jumped")
        }
        let beforeDrag=camera.x
        camera.drag(10,width:1200,half:half)
        precondition(abs(camera.x-(beforeDrag-10/1200))<0.00001)
        camera.drag(100000,width:1200,half:half);precondition(camera.x==half)
        camera.endDrag(velocity:0,width:1200,half:half)
        camera.find();camera.tick(0.016,cat:0.8,half:half,reduceMotion:true)
        precondition(camera.x==0.8 && camera.mode == .following)
        let stationary=camera.x
        for i in 0..<120 {camera.tick(1.0/60,cat:stationary+sin(Double(i))*0.01,half:half)}
        precondition(camera.x==stationary,"Dead zone should hold camera")
        var edge=WorldCamera()
        for _ in 0..<300 {edge.tick(1.0/60,cat:0.97,half:half)}
        precondition(abs(edge.x-0.84)<0.001,"Following must reach world boundary, not dead-zone before it")
        print("PASS: bounded long glide, moving target, drag takeover, edges, reduced motion, dead zone")
    }
}
