import Foundation
/// 逐帧 v6：喝水三段钉在碗前、时长与帧一致；情绪待机只在蘑菇屋门口换；夜里和雨天不去不该去的地方。
/// 运行目录须是仓库根（读动作目录 cat-actions-v2 的 JSON）。
@main struct WorldV6Tests {
    static func main() throws {
        let scene=try JSONDecoder().decode(WorldScene.self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1])))
        let catalogURL=URL(fileURLWithPath:"ios/Maomao/Assets.xcassets/cat-actions-v2.dataset/data.json")
        let catalog=try JSONSerialization.jsonObject(with:Data(contentsOf:catalogURL)) as! [String:Any]
        var seconds=[String:Double]()
        for a in catalog["actions"] as! [[String:Any]] {
            if let d=a["frameDurations"] as? [Double] {seconds[a["id"] as! String]=d.reduce(0,+)}
        }
        // 1) 硬编码的时长和帧时长之和一致
        precondition(abs(seconds["moodSadIn"]!-WorldSimulation.moodSadInDuration)<0.0001,"moodSadIn \(seconds["moodSadIn"]!)")
        precondition(abs(seconds["drinkDown"]!-WorldSimulation.drinkDownDuration)<0.0001,"drinkDown \(seconds["drinkDown"]!)")
        precondition(abs(seconds["drinkUp"]!-WorldSimulation.drinkUpDuration)<0.0001,"drinkUp \(seconds["drinkUp"]!)")
        precondition(abs(seconds["sitToStand"]!-WorldSimulation.sitToStandDuration)<0.0001 && abs(seconds["standToSit"]!-WorldSimulation.standToSitDuration)<0.0001)
        // 2) 碗前的节点连着家门口，且可走
        let bowl=scene.node("bowl")!,home=scene.node(scene.destinations[0].node)!
        precondition(scene.route(from:home.id,to:"bowl") == [home.id,"bowl"])
        precondition(scene.isWalkable(bowl.point) && scene.bowlHit != nil)
        // 3) 喝水：走过去 → 低头 → 舔 → 抬头 → 走回来；三段里猫钉在碗前朝右
        var w=WorldSimulation(scene:scene);w.autonomous=false
        w.setConditions(mood:.calm,night:false,allowed:[0,1,2,3,4,5],bowlFull:true)
        precondition(w.requestDrink(),"drink request accepted at home")
        var seen=[String]();var pinned=0
        for _ in 0..<6000 where w.drinkCount == 0 || w.isMoving {
            w.tick(1.0/60)
            if seen.last != w.action {seen.append(w.action)}
            if ["drinkDown","drinkLap","drinkUp"].contains(w.action) {
                precondition(w.point == bowl.point && w.facingRight,"drinking away from the bowl: \(w.point)")
                pinned += 1
            }
        }
        precondition(w.drinkCount == 1 && !w.isDrinking,"drank once and finished")
        precondition(seen.contains("drinkDown") && seen.contains("drinkLap") && seen.contains("drinkUp"),"\(seen)")
        precondition(seen.firstIndex(of:"drinkDown")! < seen.firstIndex(of:"drinkLap")! && seen.firstIndex(of:"drinkLap")! < seen.firstIndex(of:"drinkUp")!)
        precondition(w.current == 0 && w.point == home.point && pinned>200,"back home after drinking, pinned \(pinned) frames")
        precondition(seen.first == "sitToStand" && seen[1] == "walk","rises before walking: \(seen.prefix(4))")
        precondition(seen.contains("standToSit") && seen.lastIndex(of:"standToSit")! > seen.lastIndex(of:"walk")!,"sits down after walking home: \(seen)")
        // 4) 情绪换待机：委屈先播缩下去的两格再进循环；不高兴时背身
        var m=WorldSimulation(scene:scene);m.autonomous=false
        m.setConditions(mood:.sad,night:false,allowed:[0,1,2,3,4,5],bowlFull:false)
        var actions=[String]()
        for _ in 0..<(60*40) {m.tick(1.0/60); if actions.last != m.action {actions.append(m.action)}}
        precondition(actions.contains("moodSad"),"sad pool reached: \(actions)")
        if let i=actions.firstIndex(of:"moodSad") {precondition(i>0 && actions[i-1] == "moodSadIn","moodSadIn precedes moodSad: \(actions)")}
        precondition(Set(actions).isSubset(of:["sleepyNod","sitLook","moodSadIn","moodSad","moodSadOut"]),"only sad-pool actions: \(actions)")
        for (a,b) in zip(actions,actions.dropFirst()) where a == "moodSad" {precondition(b == "moodSadOut","leaving moodSad must pass moodSadOut, got \(b)")}
        m.setConditions(mood:.sulk,night:false,allowed:[0,1,2,3,4,5],bowlFull:false)
        actions=[]
        for _ in 0..<(60*40) {m.tick(1.0/60); if actions.last != m.action {actions.append(m.action)}}
        precondition(actions.contains("moodSulk") && Set(actions).isSubset(of:["moodSad","moodSadOut","moodSulk","groom"]),"sulk pool: \(actions)")
        precondition(abs(seconds["moodSadOut"]!-WorldSimulation.moodSadOutDuration)<0.0001)
        // 5) 夜里只在蘑菇屋和猫窝之间；雨天只在蘑菇屋和树屋之间
        for (allowed,label) in [(Set([0,2]),"night"),(Set([0,1]),"rain")] {
            var n=WorldSimulation(scene:scene,seed:9)
            n.setConditions(mood:.calm,night:label == "night",allowed:allowed,bowlFull:false)
            var visited=Set<Int>()
            for _ in 0..<(30*1800) {
                n.tick(1.0/30)
                if !n.isMoving {visited.insert(n.current)}
                precondition(allowed.contains(n.target),"\(label): headed to \(n.target)")
            }
            precondition(visited.isSubset(of:allowed) && visited.count == 2,"\(label) visited \(visited)")
        }
        print("PASS: v6 drink sequence pinned at the bowl (\(pinned) frames) with catalog-matched durations, mood idle pools, night/rain destination limits")
    }
}
