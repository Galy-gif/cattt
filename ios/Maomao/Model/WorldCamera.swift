import Foundation

/// One presented world coordinate; decorative depth derives from this same clock.
struct WorldCamera {
    enum Mode { case manual, gliding, returning, following }
    private(set) var x: Double = 0.20
    private(set) var velocity = 0.0
    private(set) var mode: Mode = .following
    private(set) var target = 0.20
    private var dragOrigin: Double?
    var followsCat: Bool { mode == .following || mode == .returning }
    func clamped(_ value: Double, half: Double) -> Double {
        min(max(value, min(0.5, half)), max(0.5, 1-half))
    }
    mutating func look(at value: Double, half: Double) {
        target=clamped(value,half:half);mode = .gliding;dragOrigin=nil
    }
    mutating func find() { mode = .returning;dragOrigin=nil }
    mutating func drag(_ translation: Double, width: Double, half: Double) {
        if dragOrigin == nil { dragOrigin=x }
        mode = .manual;velocity=0
        x=clamped((dragOrigin ?? x)-translation/max(1,width),half:half);target=x
    }
    mutating func endDrag(velocity screenVelocity: Double, width: Double, half: Double) {
        dragOrigin=nil;target=clamped(x-screenVelocity*0.12/max(1,width),half:half)
        mode = .gliding;velocity=0
    }
    mutating func tick(_ delta: Double, cat: Double, half: Double, reduceMotion: Bool = false) {
        x=clamped(x,half:half)
        if mode == .returning { target=clamped(cat,half:half) }
        if mode == .following {
            let deadZone=min(0.035,half*0.2)
            target=abs(cat-x)>deadZone ? cat-copysign(deadZone,cat-x):x
        }
        target=clamped(target,half:half)
        guard mode != .manual else { return }
        if reduceMotion { x=target;velocity=0 } else {
            let dt=min(max(delta,0),1.0/20)
            let omega=mode == .following ? 9.0:13.0
            let acceleration=min(5,max(-5,omega*omega*(target-x)-2*omega*velocity))
            velocity=min(0.95,max(-0.95,velocity+acceleration*dt))
            let next=x+velocity*dt
            if (target-x)*(target-next)<=0 {x=target;velocity=0} else {x=clamped(next,half:half)}
        }
        if abs(x-target)<0.0004 && abs(velocity)<0.005 {
            x=target;velocity=0
            if mode == .returning {mode = .following}
            else if mode == .gliding {mode = .manual}
        }
    }
}
