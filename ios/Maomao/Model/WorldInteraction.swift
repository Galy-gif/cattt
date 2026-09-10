import Foundation

/// Contact sequences share a world clock. Height never changes the cat's physical scale.
struct WorldInteraction {
    enum Kind { case tree, rail, flowers, pond }
    enum Stage: String {
        case treeLook, nestApproach, nestPrepare, nestUp, nestEnter, nestLook, nestSleep, nestOut, nestDown, nestLand, nestReturn
        case flower, flowerWatch, railPrepare, railUp, railBalance, railLook, railSleep, railOut, railDown, railLand
        case pondLook, pondReach, pondTap, pondWatch, pondShake, pondRest, pondRecover, done
    }
    let kind: Kind
    private(set) var stage: Stage
    private(set) var elapsed = 0.0
    private(set) var totalTime = 0.0
    private(set) var exiting = false
    private(set) var waterContacts: [Double] = []
    let ground: WorldPoint
    let nest: WorldPoint
    let rail: WorldPoint
    let sleepingDuration: Double
    init(kind: Kind, ground: WorldPoint, nest: WorldPoint, rail: WorldPoint, sleepingDuration: Double = 24) {
        self.kind=kind; self.ground=ground; self.nest=nest; self.rail=rail; self.sleepingDuration=sleepingDuration
        switch kind {
        case .tree: stage = .treeLook
        case .rail: stage = .railPrepare
        case .flowers: stage = .flower
        case .pond: stage = .pondLook
        }
    }
    init(tree: Bool, ground: WorldPoint, nest: WorldPoint, rail: WorldPoint, sleepingDuration: Double = 24) {
        self.init(kind: tree ? .tree:.rail, ground:ground, nest:nest, rail:rail, sleepingDuration:sleepingDuration)
    }
    var isTree: Bool { kind == .tree }
    var isPond: Bool { kind == .pond }
    var isElevated: Bool { [.nestUp,.nestEnter,.nestLook,.nestSleep,.nestOut,.nestDown,.railUp,.railBalance,.railLook,.railSleep,.railOut,.railDown].contains(stage) }
    var inNest: Bool { [.nestEnter,.nestLook,.nestSleep,.nestOut].contains(stage) }
    var onRail: Bool { [.railBalance,.railLook,.railSleep,.railOut].contains(stage) }
    var airborne: Bool { [.nestUp,.nestDown,.railDown].contains(stage) }
    var isWalking: Bool { stage == .nestApproach || stage == .nestReturn }
    var duration: Double {
        switch stage {
        case .treeLook: return 0.5
        case .nestApproach,.nestReturn: return 1.25
        case .nestPrepare: return 0.36
        case .nestUp: return 0.6
        case .nestEnter: return 0.84
        case .nestLook,.railLook: return 2.6
        case .nestSleep,.railSleep: return sleepingDuration
        case .nestOut: return 0.65
        case .nestDown,.railDown: return 0.6
        case .nestLand,.railLand: return 0.32
        case .railPrepare: return 0.48
        case .railUp: return 0.88
        case .railBalance: return 0.72
        case .railOut: return 0.65
        case .flower: return 4.8
        case .flowerWatch: return 1.2
        case .pondLook: return 0.7
        case .pondReach: return 0.8
        case .pondTap: return 1.6
        case .pondWatch: return 0.8
        case .pondShake: return 0.9
        case .pondRest: return 1.6
        case .pondRecover: return 0.5
        case .done: return 0
        }
    }
    var action: String {
        switch stage {
        case .nestApproach,.nestReturn: return "walk"
        case .nestPrepare: return "jumpPrepare"
        case .nestUp: return "jumpUp"
        case .nestEnter: return "climbIn"
        case .nestOut,.railOut: return "climbOut"
        case .nestDown,.railDown: return "jumpDown"
        case .nestLand,.railLand: return "land"
        case .nestLook: return "nestLook"
        case .nestSleep: return "nestSleep"
        case .railPrepare: return "railReach"
        case .railUp: return "railClimb"
        case .railBalance: return "railSettle"
        case .railLook: return "perchLook"
        case .railSleep: return "perchSleep"
        case .flower: return "flowerPlay"
        case .pondLook: return "waterLook"
        case .pondReach: return "waterReach"
        case .pondTap: return "waterTap"
        case .pondWatch: return "waterWatch"
        case .pondShake: return "waterShake"
        case .pondRest: return "waterRest"
        case .pondRecover: return "waterRecover"
        default: return "blinkLook"
        }
    }
    var progress: Double { min(1,elapsed/max(0.01,duration)) }
    static func ease(_ t: Double) -> Double { t*t*(3-2*t) }
    var launch: WorldPoint { WorldPoint(x:nest.x+0.022,y:ground.y) }
    var point: WorldPoint {
        let u=Self.ease(progress)
        switch stage {
        case .nestApproach: return ground.interpolated(to:launch,fraction:u)
        case .nestPrepare: return launch
        case .nestUp:
            return arc(from:launch,to:nest,progress:progress,lift:0.025)
        case .nestEnter,.nestLook,.nestSleep: return nest
        case .nestOut: return nest
        case .nestDown: return arc(from:nest,to:launch,progress:progress,lift:0.012)
        case .nestLand: return launch
        case .nestReturn: return launch.interpolated(to:ground,fraction:u)
        case .railUp: return ground.interpolated(to:rail,fraction:u)
        case .railBalance,.railLook,.railSleep,.railOut: return rail
        case .railDown: return arc(from:rail,to:ground,progress:progress,lift:0.012)
        default: return ground
        }
    }
    private func arc(from: WorldPoint, to: WorldPoint, progress t: Double, lift: Double) -> WorldPoint {
        let p=from.interpolated(to:to,fraction:Self.ease(t))
        return WorldPoint(x:p.x,y:p.y-pow(sin(t * .pi),2)*lift)
    }
    /// Both art and cat use one elapsed contact clock, so stage changes do not restart the swing.
    var nestSwing: Double {
        guard inNest else { return 0 }
        let t:Double
        switch stage {
        case .nestEnter: t=elapsed
        case .nestLook: t=0.84+elapsed
        case .nestSleep: t=3.44+elapsed
        default: return 0
        }
        return sin(t*6)*exp(-t*1.8)*0.7
    }
    var flowerBend: Double {
        guard stage == .flower else { return 0 }
        let t=elapsed.truncatingRemainder(dividingBy:1.6)-0.75
        return t>0 ? -sin(t*12)*exp(-t*4)*14:0
    }
    var rippleAges: [Double] { waterContacts.map { totalTime-$0 }.filter { $0>=0 && $0<1.6 } }
    mutating func requestExit() {
        exiting=true
        switch stage {
        case .nestLook,.nestSleep: set(.nestOut)
        case .railLook,.railSleep: set(.railOut)
        // Finish contact/retract before leaving; never skip from a raised paw to walking.
        case .pondRest: set(.pondRecover)
        case .treeLook,.flowerWatch: set(.done)
        default: break
        }
    }
    private mutating func set(_ next: Stage) { stage=next; elapsed=0 }
    mutating func tick(_ dt: Double) {
        guard stage != .done,dt>0 else { return }
        var remaining=dt
        while remaining>0 && stage != .done {
            let used=min(remaining,max(0,duration-elapsed)),old=elapsed
            elapsed += used; totalTime += used; remaining -= used
            if stage == .pondTap {
                for contact in [0.28,0.98] where old<contact && elapsed>=contact {
                    waterContacts.append(totalTime-(elapsed-contact))
                }
            }
            guard elapsed>=duration-0.0000001 else { break }
            switch stage {
            case .treeLook: set(.nestApproach)
            case .nestApproach: set(exiting ? .nestReturn:.nestPrepare)
            case .nestPrepare: set(exiting ? .nestReturn:.nestUp)
            case .nestUp: set(.nestEnter)
            case .nestEnter: set(exiting ? .nestOut:.nestLook)
            case .nestLook: set(.nestSleep)
            case .nestSleep: set(.nestOut)
            case .nestOut: set(.nestDown)
            case .nestDown: set(.nestLand)
            case .nestLand: set(.nestReturn)
            case .nestReturn: set(.done)
            case .flower: set(.flowerWatch)
            case .flowerWatch: set(.done)
            case .railPrepare: set(.railUp)
            case .railUp: set(.railBalance)
            case .railBalance: set(exiting ? .railOut:.railLook)
            case .railLook: set(.railSleep)
            case .railSleep: set(.railOut)
            case .railOut: set(.railDown)
            case .railDown: set(.railLand)
            case .railLand: set(.done)
            case .pondLook: set(.pondReach)
            case .pondReach: set(.pondTap)
            case .pondTap: set(.pondWatch)
            case .pondWatch: set(.pondShake)
            case .pondShake: set(.pondRest)
            case .pondRest: set(.pondRecover)
            case .pondRecover,.done: set(.done)
            }
        }
    }
}
