import Foundation

/// Complete contact sequences; ground navigation remains separate from airborne/support poses.
struct WorldInteraction {
    enum Stage: String {
        case treeLook, nestPrepare, nestUp, nestEnter, nestLook, nestSleep, nestOut, nestDown, nestLand
        case flower, flowerWatch, railPrepare, railUp, railBalance, railLook, railSleep, railOut, railDown, railLand, done
    }
    private(set) var stage:Stage
    private(set) var elapsed=0.0
    private(set) var exiting=false
    let ground:WorldPoint
    let nest:WorldPoint
    let rail:WorldPoint
    let sleepingDuration:Double
    init(tree:Bool, ground:WorldPoint, nest:WorldPoint, rail:WorldPoint, sleepingDuration:Double=24) {
        stage=tree ? .treeLook:.flower
        self.ground=ground;self.nest=nest;self.rail=rail;self.sleepingDuration=sleepingDuration
    }
    var isTree:Bool {stage.rawValue.hasPrefix("nest") || stage == .treeLook}
    var isElevated:Bool { [.nestUp,.nestEnter,.nestLook,.nestSleep,.nestOut,.nestDown,.railUp,.railBalance,.railLook,.railSleep,.railOut,.railDown].contains(stage) }
    var inNest:Bool { [.nestEnter,.nestLook,.nestSleep,.nestOut].contains(stage) }
    var onRail:Bool { [.railBalance,.railLook,.railSleep,.railOut].contains(stage) }
    var airborne:Bool { [.nestUp,.nestDown,.railUp,.railDown].contains(stage) }
    var duration:Double {
        switch stage {
        case .treeLook: return 0.7
        case .nestPrepare,.railPrepare: return 0.28
        case .nestUp,.railUp: return 0.68
        case .nestEnter: return 0.7
        case .nestLook,.railLook: return 3.2
        case .nestSleep,.railSleep: return sleepingDuration
        case .nestOut,.railOut: return 0.35
        case .nestDown,.railDown: return 0.6
        case .nestLand,.railLand: return 0.28
        case .flower: return 4.8
        case .flowerWatch: return 1.2
        case .railBalance: return 0.7
        case .done: return 0
        }
    }
    var action:String {
        switch stage {
        case .nestPrepare,.railPrepare: return "jumpPrepare"
        case .nestUp,.railUp: return "jumpUp"
        case .nestEnter,.railBalance: return "climbIn"
        case .nestOut,.railOut: return "climbOut"
        case .nestDown,.railDown: return "jumpDown"
        case .nestLand,.railLand: return "land"
        case .nestLook,.railLook: return "perchLook"
        case .nestSleep,.railSleep: return "perchSleep"
        case .flower: return "flowerPlay"
        default: return "blinkLook"
        }
    }
    var progress:Double {min(1,elapsed/max(0.01,duration))}
    var point:WorldPoint {
        let support=isTree ? nest:rail
        if airborne {
            let up=stage == .nestUp || stage == .railUp
            let u=progress
            let catchPoint=WorldPoint(x:support.x,y:support.y+(up ? 0.075:0.035))
            let p=(up ? ground:catchPoint).interpolated(to:up ? catchPoint:ground,fraction:u)
            return WorldPoint(x:p.x,y:p.y-sin(u * .pi)*(up ? 0.045:0.025))
        }
        if stage == .nestEnter || stage == .railBalance {
            return WorldPoint(x:support.x,y:support.y+0.075*(1-progress))
        }
        if stage == .nestOut || stage == .railOut {return WorldPoint(x:support.x,y:support.y+0.035*progress)}
        return isElevated ? support:ground
    }
    var nestSwing:Double {
        guard inNest else {return 0}
        let t=elapsed + (stage == .nestEnter ? 0:stage == .nestLook ? 0.7:4)
        return sin(t*7)*exp(-t*1.3)*1.5
    }
    var flowerBend:Double {
        guard stage == .flower else {return 0}
        let t=elapsed.truncatingRemainder(dividingBy:1.6)-0.75
        return t>0 ? -sin(t*12)*exp(-t*4)*14:0
    }
    mutating func requestExit() {
        exiting=true
        if stage == .nestLook || stage == .nestSleep {set(.nestOut)}
        else if stage == .railLook || stage == .railSleep {set(.railOut)}
        else if stage == .flower || stage == .flowerWatch || stage == .treeLook || stage == .nestPrepare || stage == .railPrepare {set(.done)}
    }
    private mutating func set(_ next:Stage) {stage=next;elapsed=0}
    mutating func tick(_ dt:Double) {
        guard stage != .done else {return}
        elapsed += dt
        guard elapsed>=duration else {return}
        switch stage {
        case .treeLook: set(.nestPrepare)
        case .nestPrepare: set(.nestUp)
        case .nestUp: set(.nestEnter)
        case .nestEnter: set(exiting ? .nestOut:.nestLook)
        case .nestLook: set(.nestSleep)
        case .nestSleep: set(.nestOut)
        case .nestOut: set(.nestDown)
        case .nestDown: set(.nestLand)
        case .nestLand: set(.done)
        case .flower: set(exiting ? .done:.flowerWatch)
        case .flowerWatch: set(.railPrepare)
        case .railPrepare: set(.railUp)
        case .railUp: set(.railBalance)
        case .railBalance: set(exiting ? .railOut:.railLook)
        case .railLook: set(.railSleep)
        case .railSleep: set(.railOut)
        case .railOut: set(.railDown)
        case .railDown: set(.railLand)
        case .railLand,.done: set(.done)
        }
    }
}
