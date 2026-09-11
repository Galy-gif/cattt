import Foundation
/// 逐帧 v5：逻辑阶段与动作帧对得上，支撑帧钉在接触点，走路只在着地帧换向。
/// 运行目录须是仓库根（读动作目录 cat-actions-v2 的 JSON）。
@main struct WorldV5Tests {
    static func main() throws {
        let scene=try JSONDecoder().decode(WorldScene.self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1])))
        let catalogURL=URL(fileURLWithPath:"ios/Maomao/Assets.xcassets/cat-actions-v2.dataset/data.json")
        let catalog=try JSONSerialization.jsonObject(with:Data(contentsOf:catalogURL)) as! [String:Any]
        var seconds=[String:Double]()
        for a in catalog["actions"] as! [[String:Any]] {
            if let d=a["frameDurations"] as? [Double] {seconds[a["id"] as! String]=d.reduce(0,+)}
        }
        precondition(WorldInteraction.useV5)
        let nest=scene.nestSupport!,ground=scene.node(scene.destinations[1].node)!.point
        var s=WorldInteraction(tree:true,ground:ground,nest:nest,rail:scene.railSupport!,sleepingDuration:3)
        var checked=Set<String>()
        // 1) 非循环阶段的时长 = 该动作全部帧时长之和；循环的"窝里看你"刚好一整轮。
        for _ in 0..<4000 where s.stage != .done {
            let stage=s.stage.rawValue,action=s.action
            if !checked.contains(stage), action.hasPrefix("v5"), s.stage != .nestSleep {
                precondition(abs((seconds[action] ?? -1)-s.duration)<0.0001,"\(stage) lasts \(s.duration)s but \(action) frames sum to \(seconds[action] ?? -1)s")
                checked.insert(stage)
            }
            // 2) 支撑帧钉在接触点
            switch s.stage {
            case .nestGrip,.nestEnter,.nestLook,.nestSleep,.nestOut,.nestLeap: precondition(s.point==nest,"\(stage) left the ledge")
            case .nestPrepare,.nestLand: precondition(s.point==s.launch,"\(stage) left the launch spot")
            default: break
            }
            s.tick(1.0/60)
        }
        precondition(s.stage == .done && checked.count == 9,"checked \(checked.sorted())")
        precondition(abs(s.launch.x-nest.x-0.013)<0.000001)
        // 3) 走路中换视角 / 左右只发生在着地帧（从站着出发的那一下除外）
        var changes=0
        var w=WorldSimulation(scene:scene);w.autonomous=false
        for to in [5,4,1,3,0,2,5] {
            w.request(to)
            var last=(w.action,w.facingRight,w.isMoving)
            for _ in 0..<9000 {
                // 换向判断在本帧位移累加之前做，所以按上一帧的行进距离检查相位
                let before=w.travelled
                w.tick(1.0/60)
                let gaits=["walk","walkAway","walkToward","run"]
                if last.2 && w.isMoving && gaits.contains(last.0) && gaits.contains(w.action) && (w.action != last.0 || w.facingRight != last.1) {
                    changes += 1
                    let cycle=last.0 == "run" ? 182.88:w.bodyLength   // 引擎按切换前的步态判断
                    precondition(WorldSimulation.atFootfall(travelled:before,bodyLength:cycle),"switched \(last.0)->\(w.action) mid-stride at \(before)")
                }
                last=(w.action,w.facingRight,w.isMoving)
                if w.current == to && !w.isMoving && w.pendingTarget == nil {break}
            }
            precondition(w.current == to,"did not reach \(to)")
        }
        print("PASS: v5 stage timing matches frames (\(checked.count) stages), ledge and launch pinned, \(changes) in-walk direction switches all on a footfall")
    }
}
