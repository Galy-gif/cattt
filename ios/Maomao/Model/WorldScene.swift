import Foundation

/// Codable world coordinates are independent of screen size and texture resolution.
struct WorldPoint: Codable, Equatable {
    var x: Double
    var y: Double
    var cgPoint: CGPoint { CGPoint(x: x, y: y) }
    func distance(to p: Self, aspect: Double) -> Double { hypot((x-p.x)*aspect, y-p.y) }
    func interpolated(to p: Self, fraction: Double) -> Self {
        .init(x: x+(p.x-x)*fraction, y: y+(p.y-y)*fraction)
    }
}

struct WorldRect: Codable, Equatable {
    var x: Double; var y: Double; var width: Double; var height: Double
    func contains(_ p: WorldPoint) -> Bool { p.x >= x && p.x <= x+width && p.y >= y && p.y <= y+height }
    var center: WorldPoint { .init(x: x+width/2, y: y+height/2) }
}

struct WorldScene: Codable {
    struct Node: Codable { let id: String; let point: WorldPoint }
    struct Edge: Codable {
        let a: String; let b: String
        /// Half-width in normalized height units, matching the painted road.
        let width: Double
        let main: Bool
    }
    struct Object: Codable, Identifiable {
        let id: String; let image: String; let rect: WorldRect
        let depth: Double
        let target: Int?
        let hitRect: WorldRect?
        /// A front slice only occludes when cat's feet have entered behind its baseline.
        let occlusion: String?
        let parent: String?
        let sourceRect: WorldRect?
        let cutouts: [WorldRect]?
        let motion: String?
        let outline: [WorldPoint]?
        let cutoutPaths: [[WorldPoint]]?
        /// 点它不是让猫走过去，而是打开界面里的东西。目前只有 `mail`（信箱 → 日记）。
        let action: String?
    }
    struct Destination: Codable, Identifiable {
        let id: String; let name: String; let node: String
        let facingRight: Bool; let idle: String
        let contact: WorldRect?
        let cameraX: Double
    }
    struct Tile: Codable, Identifiable {
        let id: String; let image: String; let rect: WorldRect
    }
    let version: Int
    let width: Double; let height: Double
    let tiles: [Tile]
    let objects: [Object]
    let nodes: [Node]
    let edges: [Edge]
    let obstacles: [WorldRect]
    let destinations: [Destination]
    let nestSupport: WorldPoint?
    let railSupport: WorldPoint?
    let waterContact: WorldPoint?
    let waterOutline: [WorldPoint]?
    var aspect: Double { width/height }
    func node(_ id: String) -> Node? { nodes.first { $0.id == id } }
    func edge(_ a: String, _ b: String) -> Edge? { edges.first { ($0.a == a && $0.b == b) || ($0.a == b && $0.b == a) } }
    func objectRect(_ object: Object) -> WorldRect {
        guard let parentID = object.parent, let p = objects.first(where: {$0.id == parentID}) else { return object.rect }
        let r = objectRect(p)
        return .init(x: r.x+object.rect.x*r.width, y: r.y+object.rect.y*r.height,
                     width: object.rect.width*r.width, height: object.rect.height*r.height)
    }
    /// Dijkstra: no straight-line fallback through water or buildings.
    func route(from start: String, to end: String) -> [String]? {
        guard node(start) != nil, node(end) != nil else { return nil }
        var cost = [start: 0.0], previous: [String:String] = [:], remaining = Set(nodes.map(\.id))
        while let current = remaining.min(by: { cost[$0, default: .infinity] < cost[$1, default: .infinity] }) {
            guard let c = cost[current] else { break }
            if current == end {
                var result = [end]
                while let prev = previous[result[0]] { result.insert(prev, at: 0) }
                return result
            }
            remaining.remove(current)
            for e in edges where e.a == current || e.b == current {
                let next = e.a == current ? e.b : e.a
                guard remaining.contains(next), let a=node(current), let b=node(next) else { continue }
                let candidate=c+a.point.distance(to:b.point,aspect:aspect)
                if candidate < cost[next,default:.infinity] { cost[next]=candidate; previous[next]=current }
            }
        }
        return nil
    }
    func isWalkable(_ p: WorldPoint) -> Bool {
        guard !obstacles.contains(where:{$0.contains(p)}) else { return false }
        return edges.contains { e in
            guard let a=node(e.a)?.point,let b=node(e.b)?.point else {return false}
            let dx=(b.x-a.x)*aspect,dy=b.y-a.y
            let length=dx*dx+dy*dy
            let t=length > 0 ? max(0,min(1,((p.x-a.x)*aspect*dx+(p.y-a.y)*dy)/length)) : 0
            return a.interpolated(to:b,fraction:t).distance(to:p,aspect:aspect) <= e.width/2
        }
    }
    func validationErrors() -> [String] {
        var errors:[String]=[]
        guard width > 0,height > 0 else {return ["Invalid world dimensions"]}
        if Set(nodes.map(\.id)).count != nodes.count {errors.append("Duplicate node")}
        if destinations.count != 6 {errors.append("Six destinations required")}
        for o in objects {
            if let p=o.parent, !objects.contains(where:{$0.id == p && $0.parent == nil}) { errors.append("Invalid object parent: \(o.id)") }
            if let i=o.target, !destinations.indices.contains(i) {errors.append("Invalid target: \(o.id)")}
        }
        for e in edges {
            guard let a=node(e.a),let b=node(e.b), e.width > 0 else {errors.append("Invalid edge \(e.a)-\(e.b)");continue}
            for i in 0...100 where obstacles.contains(where:{$0.contains(a.point.interpolated(to:b.point,fraction:Double(i)/100))}) {
                errors.append("Obstacle on edge \(e.a)-\(e.b) sample \(i)");break
            }
        }
        for a in destinations { for b in destinations {
            if route(from:a.node,to:b.node) == nil {errors.append("Unreachable \(a.id) → \(b.id)")}
        }}
        return errors
    }
}

/// Reproducible random sequence. No wall clock is consulted by the simulation.
struct WorldRandom {
    var state: UInt64
    mutating func unit() -> Double {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return Double(state >> 11) / Double(UInt64(1)<<53)
    }
    mutating func seconds(_ lo: Double,_ hi: Double) -> Double {lo+(hi-lo)*unit()}
}

struct WorldSimulation {
    enum Phase: String {case idle, moving, approaching, interacting, exiting}
    struct Leg {
        let from: WorldPoint; let to: WorldPoint; let endNode: String
        let action: String; var duration: Double; let length: Double
        var control1:WorldPoint? = nil
        var control2:WorldPoint? = nil
        var lengths:[Double] = []
        var easing=0.30
        func curve(_ t:Double)->WorldPoint {
            guard let a=control1,let b=control2 else {return from.interpolated(to:to,fraction:t)}
            let v=1-t
            return WorldPoint(x:v*v*v*from.x+3*v*v*t*a.x+3*v*t*t*b.x+t*t*t*to.x,
                              y:v*v*v*from.y+3*v*v*t*a.y+3*v*t*t*b.y+t*t*t*to.y)
        }
        func sample(_ fraction:Double)->WorldPoint {
            guard let total=lengths.last,total>0,lengths.count>1 else {return curve(fraction)}
            let target=total*fraction
            let i=min(lengths.count-1,max(1,lengths.firstIndex(where:{$0>=target}) ?? lengths.count-1))
            let local=(target-lengths[i-1])/max(0.000001,lengths[i]-lengths[i-1])
            return curve((Double(i-1)+local)/Double(lengths.count-1))
        }
    }
    let scene: WorldScene
    private(set) var point: WorldPoint
    private(set) var facingRight = true
    private(set) var current = 0
    private(set) var target = 0
    private(set) var phase: Phase = .idle
    private(set) var action = "sleepyNod"
    private(set) var actionTime = 0.0
    private(set) var time = 0.0
    private(set) var travelled = 0.0
    private(set) var speed = 0.0
    private(set) var interactionRemaining = 0.0
    private(set) var failure: String?
    private(set) var paused = false
    private(set) var revision = 0
    private var rng: WorldRandom
    private var currentNode: String
    private var legs: [Leg] = []
    private var legTime = 0.0
    private var pending: Int?
    private var idleRemaining = 120.0
    private var fidgetRemaining = 7.0
    private var transientRemaining = 0.0
    private var stopAtNode = false
    private var brakeRemaining=0.0
    private var brakeVelocity=0.0
    private var routeStart:WorldPoint?
    private var scratchEnding = false
    private var tailExcursion = false
    private(set) var interaction: WorldInteraction?
    private var turnRemaining=0.0
    private var turnFacing=true
    private var arrivalTurn=false
    private var nextFenceFlowers=false
    private var heading=WorldPoint(x:1,y:0)
    var renderPoint: WorldPoint { interaction?.point ?? point }
    var isTurning: Bool { turnRemaining>0 }
    var autonomous = true
    var bodyLength: Double = 100.9
    var isMoving: Bool {phase == .moving || phase == .approaching || (phase == .exiting && !legs.isEmpty)}
    var hiddenInGrass: Bool {current == 3 && currentNode == scene.destinations[3].node && !isMoving && phase != .exiting}
    var pendingTarget: Int? {pending}

    init(scene: WorldScene,seed:UInt64=42) {
        self.scene=scene; rng=WorldRandom(state:seed)
        currentNode=scene.destinations[0].node
        point=scene.node(currentNode)!.point
        facingRight=scene.destinations[0].facingRight
        action=scene.destinations[0].idle
        idleRemaining=rng.seconds(120,180)
    }
    mutating func setPaused(_ value:Bool) {paused=value;revision += 1}
    mutating func seed(_ value:UInt64) {rng=WorldRandom(state:value)}
    mutating func request(_ index:Int) {
        guard scene.destinations.indices.contains(index) else {return}
        failure=nil
        if index == target && pending == nil && (isMoving || phase == .interacting) {return}
        if index == current && currentNode == scene.destinations[index].node && !isMoving && phase != .exiting {poke();return}
        pending=index;tailExcursion=false
        if interaction != nil {interaction?.requestExit();return}
        if turnRemaining>0 {return}
        if isMoving {if brakeRemaining<=0 {brakeRemaining=0.22;brakeVelocity=speed};return}
        if phase == .exiting {return}
        beginExit()
    }
    mutating func poke() {
        guard !isMoving,phase != .exiting,interaction == nil else {return}
        if current == 4 { beginPond(); return }
        if current == 5 { beginInteraction(tree:false); return }
        if current == 3 { setAction("blinkLook"); transientRemaining=1.2 }
        else if phase != .interacting { setAction("blinkLook"); transientRemaining=0.8 }
        revision += 1
    }
    mutating func preview(_ name:String) {
        if name == "tailChase",scene.node("clearing") != nil {currentNode="clearing";current=3;target=3}
        point=scene.node(currentNode)!.point;legs=[];interaction=nil;turnRemaining=0;phase = .idle;autonomous=false
        setAction(name);paused=true;revision += 1
    }
    #if DEBUG
    mutating func placeForReview(_ index:Int) {
        guard scene.destinations.indices.contains(index) else {return}
        interaction=nil;turnRemaining=0;pending=nil;legs=[];brakeRemaining=0;routeStart=nil
        target=index;current=index;currentNode=scene.destinations[index].node
        point=scene.node(currentNode)!.point;facingRight=scene.destinations[index].facingRight
        autonomous=false;arrive()
    }
    #endif
    mutating func stepFrame(_ duration:Double) { actionTime += duration;revision += 1 }
    private mutating func setAction(_ name:String) {
        let gaits=["walk","walkAway","walkToward","run"]
        let preserve=gaits.contains(action) && gaits.contains(name)
        action=name;actionTime=0
        if !preserve {travelled=0}
        revision += 1
    }
    private mutating func beginExit() {
        transientRemaining=0
        if current == 1 && (action == "treeScratch" || action == "scratchEnter") {
            phase = .exiting; scratchEnding=true; interactionRemaining=0.5;setAction("scratchExit")
        } else {
            phase = .exiting
            depart()
        }
    }
    private mutating func depart() {
        guard let next=pending else {settle();return}
        if currentNode == scene.destinations[next].node && routeStart == nil {
            target=next;pending=nil;stopAtNode=false;arrive();return
        }
        guard let nodes=scene.route(from:currentNode,to:scene.destinations[next].node) else {
            pending=nil;failure="这里暂时过不去";settle();return
        }
        target=next;pending=nil;stopAtNode=false;scratchEnding=false
        let distance=zip(nodes,nodes.dropFirst()).reduce(0.0){sum,pair in
            sum+scene.node(pair.0)!.point.distance(to:scene.node(pair.1)!.point,aspect:scene.aspect)*844
        }
        legs=zip(nodes,nodes.dropFirst()).map { a,b in
            let pa=scene.node(a)!.point,pb=scene.node(b)!.point
            let e=scene.edge(a,b)!
            let length=pa.distance(to:pb,aspect:scene.aspect)*844
            let dx=abs(pb.x-pa.x)*scene.aspect,dy=pb.y-pa.y
            let gait: String
            if e.main && distance > 780 {gait="run"}
            else if abs(dy) > dx*0.28 {gait=dy < 0 ? "walkAway" : "walkToward"}
            else {gait="walk"}
            let velocity=bodyLength*(gait == "run" ? 2.2:1.0)
            return Leg(from:pa,to:pb,endNode:b,action:gait,duration:max(0.35,length/velocity),length:length)
        }
        if let from=routeStart {
            let to=scene.node(currentNode)!.point
            let length=from.distance(to:to,aspect:scene.aspect)*844
            if length>0.01 {legs.insert(Leg(from:from,to:to,endNode:currentNode,action:"walk",duration:max(0.05,length/bodyLength),length:length),at:0)}
            routeStart=nil
        }
        smoothLegs()
        beginLeg(allowTurn:true)
    }
    private mutating func smoothLegs() {
        let original=legs
        for i in legs.indices {
            let leg=original[i]
            let before=i>0 ? original[i-1].from:leg.from
            let after=i+1<original.count ? original[i+1].to:leg.to
            func handle(_ anchor:WorldPoint,_ a:WorldPoint,_ b:WorldPoint,_ sign:Double)->WorldPoint {
                let length=a.distance(to:b,aspect:scene.aspect)
                let reach=min(leg.length/844/3,0.016)
                return WorldPoint(x:anchor.x+(b.x-a.x)/max(length,0.00001)*reach*sign,
                                  y:anchor.y+(b.y-a.y)/max(length,0.00001)*reach*sign)
            }
            var candidate=leg
            candidate.control1=handle(leg.from,before,leg.to,1)
            candidate.control2=handle(leg.to,leg.from,after,-1)
            if (0...40).allSatisfy({scene.isWalkable(candidate.curve(Double($0)/40))}) {
                candidate.lengths=[0]
                for k in 1...40 {
                    candidate.lengths.append(candidate.lengths.last!+candidate.curve(Double(k-1)/40).distance(to:candidate.curve(Double(k)/40),aspect:scene.aspect))
                }
                candidate.easing=i==original.count-1 ? 0.5:0
                candidate.duration=max(candidate.duration,(candidate.lengths.last ?? 0)*844/230*(1+candidate.easing))
                legs[i]=candidate
            }
        }
    }
    private mutating func beginLeg(allowTurn:Bool=false) {
        guard let leg=legs.first else {arrive();return}
        legTime=0
        phase = current == 3 && currentNode == scene.destinations[3].node ? .exiting : (legs.count == 1 ? .approaching:.moving)
        let dx=(leg.to.x-leg.from.x)*scene.aspect,dy=leg.to.y-leg.from.y
        let len=max(0.000001,hypot(dx,dy)),dot=(heading.x*dx+heading.y*dy)/len
        let nextFacing=abs(dx)>abs(dy)*0.7 ? dx>0:facingRight
        if allowTurn && dot < -0.85 && nextFacing != facingRight {
            turnFacing=nextFacing;turnRemaining=0.4;arrivalTurn=false;speed=0;setAction("turn")
        } else {orient(dx:dx,dy:dy,gait:leg.action)}
    }
    private mutating func orient(dx:Double,dy:Double,gait:String) {
        let len=hypot(dx,dy)
        guard len>0.000001 else {return}
        heading=WorldPoint(x:dx/len,y:dy/len)
        let ratio=abs(dy)/max(abs(dx),0.000001)
        let wasDepth=action == "walkToward" || action == "walkAway"
        let depth=ratio > (wasDepth ? 0.85:1.15)
        let name=depth ? (dy<0 ? "walkAway":"walkToward"):(gait == "run" ? "run":"walk")
        if !depth {facingRight=dx>0}
        if action != name {setAction(name)}
    }
    private mutating func arrive() {
        if tailExcursion && currentNode == "clearing" {
            phase = .idle;speed=0;setAction("tailChase");transientRemaining=32.0/12
            idleRemaining=rng.seconds(45,90);fidgetRemaining=20;return
        }
        current=target;currentNode=scene.destinations[current].node
        point=scene.node(currentNode)!.point
        speed=0;phase = .interacting
        if current == 1 {facingRight=false;setAction("scratchEnter");interactionRemaining=0.5}
        else if current == 3 {setAction("blinkLook");interactionRemaining=1.0}
        else if current == 5, scene.railSupport != nil {beginInteraction(tree:false)}
        else if current == 4, scene.waterContact != nil {beginPond()}
        else {settle()}
    }
    private mutating func settle() {
        phase = .idle;speed=0;scratchEnding=false
        setAction(scene.destinations[current].idle)
        idleRemaining = (current == 0 || current == 2) ? rng.seconds(120,180):rng.seconds(45,90)
        fidgetRemaining=rng.seconds(4,10)
    }
    private mutating func beginInteraction(tree:Bool) {
        guard let nest=scene.nestSupport,let rail=scene.railSupport else {settle();return}
        let kind:WorldInteraction.Kind=tree ? .tree:(nextFenceFlowers ? .flowers:.rail)
        if !tree {nextFenceFlowers.toggle()}
        interaction=WorldInteraction(kind:kind,ground:point,nest:nest,rail:rail,sleepingDuration:rng.seconds(20,32))
        facingRight = !tree;phase = .interacting;setAction(interaction!.action)
    }
    private mutating func beginPond() {
        interaction=WorldInteraction(kind:.pond,ground:point,nest:scene.nestSupport ?? point,rail:scene.railSupport ?? point)
        facingRight=false;phase = .interacting;setAction(interaction!.action)
    }
    mutating func tick(_ dt:Double) {
        guard !paused,dt>0 else {return}
        let dt=min(dt,0.1)
        time += dt;actionTime += dt
        if turnRemaining>0 {
            turnRemaining -= dt
            if turnRemaining<=0 {
                facingRight=turnFacing
                if pending != nil {routeStart=point;legs=[];depart()}
                else if arrivalTurn {arrive()}
                else if let leg=legs.first {setAction(leg.action)}
            }
            return
        }
        if var sequence=interaction {
            let stage=sequence.stage
            sequence.tick(dt);interaction=sequence
            if stage != sequence.stage {
                setAction(sequence.action)
                if sequence.stage == .nestReturn {facingRight=true}
                if sequence.stage == .nestPrepare {facingRight=false}
            }
            actionTime=sequence.elapsed
            if sequence.stage == .done {
                interaction=nil
                if pending != nil {depart()} else {settle()}
            }
            return
        }
        if brakeRemaining>0,let leg=legs.first {
            let used=min(dt,brakeRemaining),next=max(0,brakeRemaining-used)
            let d=brakeVelocity*(brakeRemaining+next)/0.44*used
            let remaining=point.distance(to:leg.to,aspect:scene.aspect)*844
            let fraction=remaining>0 ? min(1,d/remaining):1
            let previous=point;point=point.interpolated(to:leg.to,fraction:fraction)
            travelled += previous.distance(to:point,aspect:scene.aspect)*844
            speed=brakeVelocity*next/0.22;brakeRemaining=next
            if brakeRemaining<=0 || fraction>=1 {
                brakeRemaining=0
                if let pending {
                    let end=scene.destinations[pending].node
                    func cost(_ id:String)->Double {
                        guard let route=scene.route(from:id,to:end),let node=scene.node(id) else {return .infinity}
                        var distance=point.distance(to:node.point,aspect:scene.aspect)
                        for (a,b) in zip(route,route.dropFirst()) {distance += scene.node(a)!.point.distance(to:scene.node(b)!.point,aspect:scene.aspect)}
                        return distance
                    }
                    if cost(leg.endNode)<cost(currentNode) {currentNode=leg.endNode}
                    routeStart=point;legs=[];depart()
                }
            }
            return
        }
        if !legs.isEmpty {
            let leg=legs[0];let previous=point
            legTime += dt
            let u=min(1,legTime/leg.duration)
            // Maintain speed through road junctions; sprite phase uses actual travelled distance.
            let easing=leg.easing
            let distanceFraction=u-easing*sin(2 * .pi * u)/(2 * .pi)
            point=leg.sample(distanceFraction)
            orient(dx:(point.x-previous.x)*scene.aspect,dy:point.y-previous.y,gait:leg.action)
            let d=previous.distance(to:point,aspect:scene.aspect)*844
            travelled += d;speed=d/dt
            if u >= 1 {
                point=leg.to;currentNode=leg.endNode;legs.removeFirst()
                if stopAtNode, pending != nil {legs=[];depart()}
                else {beginLeg()}
            }
            return
        }
        if transientRemaining>0 {
            transientRemaining -= dt
            if transientRemaining<=0 {tailExcursion=false;setAction(scene.destinations[current].idle)}
            return
        }
        if phase == .exiting && scratchEnding {
            interactionRemaining -= dt
            if interactionRemaining<=0 {depart()}
            return
        }
        if phase == .interacting {
            interactionRemaining -= dt
            if interactionRemaining<=0 {
                if action == "scratchEnter" {setAction("treeScratch");interactionRemaining=rng.seconds(6,10)}
                else if action == "treeScratch" {setAction("scratchExit");interactionRemaining=0.5}
                else if action == "scratchExit", current == 1, scene.nestSupport != nil {beginInteraction(tree:true)}
                else {settle()}
            }
            return
        }
        idleRemaining -= dt; fidgetRemaining -= dt
        if autonomous && idleRemaining<=0 {
            let others=scene.destinations.indices.filter{$0 != current}
            let i=min(others.count-1,Int(rng.unit()*Double(others.count)))
            request(others[i]);return
        }
        if autonomous && fidgetRemaining<=0 && current != 0 && current != 2 {
            fidgetRemaining=rng.seconds(10,18)
            if current == 3 && currentNode == scene.destinations[3].node && rng.unit()<0.5,
               let route=scene.route(from:currentNode,to:"clearing"),route.count>1 {
                tailExcursion=true
                legs=zip(route,route.dropFirst()).map { a,b in
                    let from=scene.node(a)!.point,to=scene.node(b)!.point
                    let length=from.distance(to:to,aspect:scene.aspect)*844
                    return Leg(from:from,to:to,endNode:b,action:"walk",duration:max(0.35,length/bodyLength),length:length)
                }
                beginLeg()
            } else {setAction("blinkLook");transientRemaining=0.8}
        }
    }
}
