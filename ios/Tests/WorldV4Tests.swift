import Foundation
@main struct WorldV4Tests {
    static func main() throws {
        let scene=try JSONDecoder().decode(WorldScene.self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1])))
        let ground=scene.node(scene.destinations[4].node)!.point
        let start=WorldInteraction(kind:.pond,ground:ground,nest:scene.nestSupport!,rail:scene.railSupport!)
        for step in [1.0/120,1.0/30,0.073] {
            var s=start
            for _ in 0..<2000 where s.stage != .done {
                precondition(s.point==ground && !s.isElevated,"Pond feet left the bank")
                s.tick(step)
            }
            precondition(s.stage == .done && s.waterContacts.count==2)
            precondition(abs(s.waterContacts[0]-1.78)<0.00001 && abs(s.waterContacts[1]-2.48)<0.00001,"Contact event drifted with display rate")
        }
        var s=start,seen=Set<String>()
        for _ in 0..<1000 where s.stage != .done {
            if seen.insert(s.stage.rawValue).inserted {
                var interrupted=s;interrupted.requestExit()
                for _ in 0..<500 where interrupted.stage != .done {interrupted.tick(1.0/60)}
                precondition(interrupted.stage == .done && interrupted.point==ground)
            }
            s.tick(1.0/60)
        }
        // On the long painted bend heading may change, but walking must not stop for each horizontal sign change.
        var walk=WorldSimulation(scene:scene);walk.autonomous=false;walk.request(5)
        var starts=0,wasTurning=false
        for _ in 0..<6000 {
            walk.tick(1.0/60)
            if walk.isTurning && !wasTurning {starts += 1}
            wasTurning=walk.isTurning
            if walk.current==5 && walk.interaction != nil {break}
        }
        precondition(walk.current==5 && starts==0,"Ordinary fence route inserted \(starts) turns")
        // A ledge contact remains fixed while the anatomy climbs over it.
        for tree in [true,false] {
            var seq=WorldInteraction(tree:tree,ground:scene.node(scene.destinations[tree ? 1:5].node)!.point,nest:scene.nestSupport!,rail:scene.railSupport!,sleepingDuration:0.2)
            for _ in 0..<2000 where seq.stage != .done {
                if seq.stage == .nestEnter {precondition(seq.point==scene.nestSupport!)}
                if seq.stage == .railBalance {precondition(seq.point==scene.railSupport!)}
                seq.tick(1.0/60)
            }
        }
        print("PASS: pond contacts frame-rate independent, planted feet, exit each stage, zero extra turns on fence bend, fixed ledge contact")
    }
}
