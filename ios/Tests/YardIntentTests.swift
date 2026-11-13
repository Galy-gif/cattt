import Foundation

@main struct YardIntentTests {
    static func main() {
        var yard = YardIntent()
        yard.choose(4)
        let request = yard.request
        assert(yard.target == 4 && yard.moving)
        assert(!yard.tick(1000), "没有网页事实时不自行算到达")
        assert(!yard.observe(id: "old", nearest: "pond", moving: false, action: "idle", offscreen: false, cameraMode: "following"))
        assert(yard.observe(id: request.id, nearest: "pond", moving: false, action: "idle", offscreen: false, cameraMode: "following"))
        yard.conditions(mood: .sad, night: true, allowed: [0, 2], bowlFull: false, behavior: .default)
        assert(yard.tick(5)); assert([0, 2].contains(yard.target), "夜雨只选室内去处")
        yard.unavailable("恢复中"); assert(!yard.tick(1000))
        assert(!yard.drink(), "无水不能发出喝水意图")
        yard.choose(0)
        _ = yard.observe(id: yard.request.id, nearest: "house", moving: false, action: "idle", offscreen: false, cameraMode: "following")
        yard.conditions(mood: .calm, night: false, allowed: Set(0..<6), bowlFull: true, behavior: .default)
        assert(yard.drink()); assert(yard.request.activity == "drink" && yard.action == "idle")
        // 完整真实回执只计一次，迟到和降级回执不计。
        let drinkID = yard.request.id
        assert(yard.drinkCount == 0)
        _ = yard.observe(id: drinkID, nearest: "house", moving: false, action: "drink_lap", offscreen: false, cameraMode: "following", fallback: false, drinkDone: true)
        assert(yard.drinkCount == 0)
        for _ in 0..<3 {
            _ = yard.observe(id: drinkID, nearest: "house", moving: false, action: "idle", offscreen: false, cameraMode: "following", fallback: false, drinkDone: true)
        }
        assert(yard.drinkCount == 1)
        yard.choose(0)
        _ = yard.observe(id: drinkID, nearest: "house", moving: false, action: "idle", offscreen: false, cameraMode: "following", fallback: false, drinkDone: true)
        assert(yard.drinkCount == 1)
        var q = YardIntent(); q.conditions(mood: .calm, night: false, allowed: Set(0..<6), bowlFull: false, behavior: .compile(temperament: .quiet)); q.greet()
        assert(q.request.id == "initial")
        var c = YardIntent(); c.conditions(mood: .calm, night: false, allowed: Set(0..<6), bowlFull: false, behavior: .compile(temperament: .close)); c.greet()
        assert(c.request.activity == "watch" && c.request.id != "initial")
        for temperament in Temperament.allCases {
            var state = YardIntent(); state.seed(10)
            state.conditions(mood: .calm, night: false, allowed: Set(0..<6), bowlFull: false, behavior: .compile(temperament: temperament))
            for _ in 0..<50 {
                _ = state.observe(id: state.request.id, nearest: state.request.place, moving: false, action: "idle", offscreen: false, cameraMode: "following")
                assert(state.tick(1000)); assert((0..<6).contains(state.target))
            }
        }
        for mood in Mood.allCases {
            var state = YardIntent(); state.seed(71)
            state.conditions(mood: mood, night: false, allowed: Set(0..<6), bowlFull: false, behavior: .default)
            var choices = Set<String>()
            for _ in 0..<500 { state.choose(0); choices.insert(state.request.activity) }
            switch mood {
            case .calm: assert(choices.contains("tilt") && choices.contains("groom") && !choices.contains("sad"))
            case .happy: assert(choices.contains("happy") && choices.contains("groom"))
            case .sulk: assert(choices == ["sulk", "groom"])
            case .sad: assert(choices == ["sad", "watch"])
            }
            state.conditions(mood: mood, night: true, allowed: Set(0..<6), bowlFull: false, behavior: .default)
            state.choose(0); assert(state.request.activity == "rest")
        }
        // 同一句邀请：从草地来门口、留在草地，或夜里就近找允许的地方。
        for (temperament, seat) in [(Temperament.close, "house"), (.slow, "grass"), (.quiet, "grass")] {
            var yard = YardIntent()
            yard.choose(3)
            _ = yard.observe(id: yard.request.id, nearest: "grass", moving: false, action: "idle", offscreen: false, cameraMode: "following")
            yard.conditions(mood: .calm, night: false, allowed: Set(0..<6), bowlFull: false, behavior: .compile(temperament: temperament))
            assert(yard.companionSeat(quiet: false) == seat)
            assert(yard.companionSeat(quiet: true) == "grass")
            yard.conditions(mood: .sad, night: true, allowed: [0, 2], bowlFull: false, behavior: .compile(temperament: temperament))
            assert(yard.companionSeat(quiet: false) == "house")
            yard.choose(0, activity: "sit")
            _ = yard.observe(id: yard.request.id, nearest: "house", moving: false, action: "sit_idle", offscreen: false, cameraMode: "following")
            assert(!yard.tick(10), "坐稳后能安静陪一会儿")
            assert(yard.tick(300) && yard.request.activity != "sit", "之后自行恢复活动")
        }
        var playful = YardIntent(); playful.seed(12)
        var fenceChoices = Set<String>()
        for _ in 0..<100 { playful.choose(5); fenceChoices.insert(playful.request.activity) }
        assert(fenceChoices == ["watch", "flower"], "栅栏看院子和扑花都能自然选到")
        var treeChoices = Set<String>()
        for _ in 0..<100 { playful.choose(1); treeChoices.insert(playful.request.activity) }
        assert(treeChoices == ["watch", "scratch"], "树窝观察和抓树都能自然选到")
        var grassChoices = Set<String>()
        for _ in 0..<100 { playful.choose(3); grassChoices.insert(playful.request.activity) }
        assert(grassChoices == ["watch", "chase", "stretch", "run"], "草地观察、追尾巴、伸懒腰和小跑都能自然选到")
        print("PASS: 3D 意图、作息、四气质、迟到回执和降级饮水")
    }
}
