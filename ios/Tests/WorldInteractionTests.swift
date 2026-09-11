import Foundation
@main struct InteractionTests {
    static func main() throws {
        let scene=try JSONDecoder().decode(WorldScene.self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1])))
        for tree in [true,false] {
            let ground=scene.node(scene.destinations[tree ? 1:5].node)!.point
            let initial=WorldInteraction(tree:tree,ground:ground,nest:scene.nestSupport!,rail:scene.railSupport!,sleepingDuration:1)
            var natural=initial,seen=Set<String>(),snapshots=[WorldInteraction]()
            for _ in 0..<3000 where natural.stage != .done {
                if seen.insert(natural.stage.rawValue).inserted {snapshots.append(natural)}
                let p=natural.point,wasAirborne=natural.airborne;natural.tick(1.0/60)
                // 腾空段按真猫起跳速度走（v5：0.25 秒升约 95pt），允许每帧 16pt；支撑段仍须 < 8pt，抓的是接触点之间的跳位。
                let limit=(wasAirborne || natural.airborne) ? 16.0:8.0
                precondition(p.distance(to:natural.point,aspect:scene.aspect)*844<limit,"Support transition jumped: \(natural.stage)")
            }
            precondition(natural.stage == .done && natural.point==ground)
            precondition(seen.contains(tree ? "nestSleep":"railSleep"))
            for var interrupted in snapshots {
                interrupted.requestExit()
                for _ in 0..<600 where interrupted.stage != .done {interrupted.tick(1.0/60)}
                precondition(interrupted.stage == .done && interrupted.point==ground,"Exit stranded at \(interrupted.stage)")
            }
            print("PASS: \(tree ? "nest":"flower / rail"), \(seen.count) stages, continuity and exit from every stage")
        }
        // Every new sequence can be interrupted by a navigation request and reach the latest target.
        for target in [1,5] {
            var s=WorldSimulation(scene:scene);s.autonomous=false;s.request(target)
            for _ in 0..<5000 {s.tick(1.0/60);if s.interaction?.isElevated == true {break}}
            precondition(s.interaction?.isElevated == true)
            s.request(4);s.request(2)
            for _ in 0..<3600 {s.tick(1.0/60)}
            precondition(s.current==2 && s.interaction==nil)
        }
        print("PASS: elevated retarget preserves last request and lands before navigation")
    }
}
