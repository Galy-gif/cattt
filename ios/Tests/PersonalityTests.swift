import Foundation
/// 性格系统：四种气质在院子里作息、去处、看你、来门口、喝水时机、情绪时长都不一样。
/// 判据来自 docs/方案/性格系统优化-方案-2026-09-12.md 第 3 节。
/// 运行目录须是仓库根。
@main struct PersonalityTests {
    struct Log {
        var changes = 0
        var napFrames = 0
        var homeFrames = 0
        var frames = 0
    }
    /// 确定种子跑 seconds 秒白天，记录换地点次数、打盹帧、在蘑菇屋门口的帧。
    static func run(_ temperament: Temperament, seconds: Double, scene: WorldScene, seed: UInt64 = 42) -> Log {
        var s = WorldSimulation(scene: scene, seed: seed)
        s.setConditions(mood: .calm, night: false, allowed: [0, 1, 2, 3, 4, 5], bowlFull: false,
                        behavior: BehaviorParams.compile(temperament: temperament))
        var log = Log()
        var place = s.current
        let step = 1.0 / 30
        for _ in 0..<Int(seconds / step) {
            s.tick(step)
            log.frames += 1
            if s.current != place { log.changes += 1; place = s.current }
            if ["sleepyNod", "sleepBreathe"].contains(s.action) { log.napFrames += 1 }
            if s.current == 0 && !s.isMoving { log.homeFrames += 1 }
        }
        return log
    }

    static func main() throws {
        let scene = try JSONDecoder().decode(WorldScene.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))

        // 1) 参数表：气质给默认值，特征在默认值上挪一档
        let quiet = BehaviorParams.compile(temperament: .quiet), curious = BehaviorParams.compile(temperament: .curious)
        precondition(quiet.idleScale > curious.idleScale * 2, "安静的猫停留更久")
        precondition(quiet.sleepWeight > curious.sleepWeight && quiet.lookWeight < BehaviorParams.compile(temperament: .close).lookWeight)
        let lively = BehaviorParams.compile(temperament: .quiet, traits: [.energy: 2, .initiative: 1, .directness: 1, .closeness: 1])
        precondition(lively.idleScale < quiet.idleScale && lively.sleepWeight < quiet.sleepWeight, "活力高一档：停留短、睡得少")
        let warmClose = BehaviorParams.compile(temperament: .close, traits: [.energy: 1, .initiative: 1, .directness: 1, .closeness: 2])
        precondition(warmClose.lookWeight > BehaviorParams.compile(temperament: .close).lookWeight)
        precondition(warmClose.moodScale > 1.5 && warmClose.moodScale <= 2.0, "亲近表达高：情绪更久，但有上限")

        // 2) 慢热：前三天像安静的猫，第四天起按表
        for day in 0..<3 {
            let p = BehaviorParams.compile(temperament: .slow, daysSinceAdoption: day)
            precondition(!p.comesToDoor && p.lookWeight <= quiet.lookWeight, "慢热第 \(day + 1) 天不来门口")
        }
        precondition(BehaviorParams.compile(temperament: .slow, daysSinceAdoption: 3).comesToDoor, "慢热第 4 天起来门口")

        // 3) 确定种子模拟 30 分钟
        let q = run(.quiet, seconds: 1800, scene: scene)
        let c = run(.curious, seconds: 1800, scene: scene)
        let k = run(.close, seconds: 1800, scene: scene)
        let napQ = Double(q.napFrames) / Double(q.frames), napC = Double(c.napFrames) / Double(c.frames)
        let homeK = Double(k.homeFrames) / Double(k.frames)
        precondition(q.changes * 2 <= c.changes, "安静 \(q.changes) 次 ≤ 好奇 \(c.changes) 次的一半")
        precondition(napQ >= 0.60, "安静猫打盹帧占比 \(napQ)")
        precondition(napC <= 0.25, "好奇猫打盹帧占比 \(napC)")
        precondition(homeK >= 0.50, "黏人猫在蘑菇屋门口的时间占比 \(homeK)")

        // 4) 打开 App 60 秒内：黏人的来门口坐下看你，安静的不来
        for (temperament, arrives) in [(Temperament.close, true), (.quiet, false), (.curious, true)] {
            var s = WorldSimulation(scene: scene, seed: 7)
            s.setConditions(mood: .calm, night: false, allowed: [0, 1, 2, 3, 4, 5], bowlFull: false,
                            behavior: BehaviorParams.compile(temperament: temperament))
            s.autonomous = false
            s.request(4)
            for _ in 0..<(30 * 120) where s.current != 4 || s.isMoving { s.tick(1.0 / 30) }
            precondition(s.current == 4, "\(temperament.name) 先去池塘")
            s.autonomous = true
            s.greet()
            var seated = false
            for _ in 0..<(30 * 60) {
                s.tick(1.0 / 30)
                if s.current == 0 && !s.isMoving && s.action == "sitLook" { seated = true; break }
            }
            precondition(seated == arrives, "\(temperament.name) 打开 App 后到门口坐下看你 = \(seated)")
        }
        // 慢热：前三天不来，第四天起来
        for (day, arrives) in [(0, false), (3, true)] {
            var s = WorldSimulation(scene: scene, seed: 7)
            s.setConditions(mood: .calm, night: false, allowed: [0, 1, 2, 3, 4, 5], bowlFull: false,
                            behavior: BehaviorParams.compile(temperament: .slow, daysSinceAdoption: day))
            s.autonomous = false; s.request(4)
            for _ in 0..<(30 * 120) where s.current != 4 || s.isMoving { s.tick(1.0 / 30) }
            s.autonomous = true; s.greet()
            var seated = false
            for _ in 0..<(30 * 60) {
                s.tick(1.0 / 30)
                if s.current == 0 && !s.isMoving && s.action == "sitLook" { seated = true; break }
            }
            precondition(seated == arrives, "慢热第 \(day + 1) 天来门口 = \(seated)")
        }

        // 5) 倒水之后：黏人的先到碗前，安静的慢
        var waits: [Temperament: Double] = [:]
        for temperament in [Temperament.close, .quiet] {
            var s = WorldSimulation(scene: scene, seed: 11)
            let behavior = BehaviorParams.compile(temperament: temperament)
            s.setConditions(mood: .calm, night: false, allowed: [0], bowlFull: false, behavior: behavior)
            s.setConditions(mood: .calm, night: false, allowed: [0], bowlFull: true, behavior: behavior)
            var waited = 0.0
            while s.drinkCount == 0 && waited < 300 { s.tick(1.0 / 30); waited += 1.0 / 30 }
            precondition(s.drinkCount == 1, "\(temperament.name) 去喝了水")
            waits[temperament] = waited
        }
        precondition(waits[.close]! < waits[.quiet]!, "黏人 \(waits[.close]!)s 比安静 \(waits[.quiet]!)s 先去喝水")

        // 6) 情绪时长 = 基准 × 倍数，上限五分钟
        let calendar = Calendar(identifier: .gregorian)
        let now = calendar.date(from: DateComponents(year: 2026, month: 9, day: 12, hour: 10))!
        func sadSeconds(_ scale: Double) -> Double {
            var seconds = 0.0
            while seconds < 400 {
                let input = MoodInput(now: now.addingTimeInterval(seconds), createdAt: now.addingTimeInterval(-86400 * 30),
                                      sessionStartedAt: now, previousVisitAt: now.addingTimeInterval(-86400 * 5),
                                      bowlFilledAt: now, lastDrinkAt: nil, pokeTimes: [], weather: .clear,
                                      interactedThisSession: false, moodScale: scale, calendar: calendar)
                if MoodRules.evaluate(input).mood != .sad { return seconds }
                seconds += 1
            }
            return seconds
        }
        precondition(abs(sadSeconds(1.0) - 180) <= 1, "默认委屈三分钟：\(sadSeconds(1.0))")
        precondition(abs(sadSeconds(1.5) - 270) <= 1, "黏人委屈 3 分钟 × 1.5：\(sadSeconds(1.5))")
        precondition(abs(sadSeconds(0.6) - 108) <= 1, "安静委屈 3 分钟 × 0.6：\(sadSeconds(0.6))")
        precondition(abs(sadSeconds(2.0) - 300) <= 1, "上限五分钟：\(sadSeconds(2.0))")

        // 7) 后端临时状态压在性格上：想安静就不来门口（WorldEngine.adjusted 的同一条规则）
        var hushed = BehaviorParams.compile(temperament: .close)
        hushed.lookWeight = 0; hushed.comesToDoor = false
        var s = WorldSimulation(scene: scene, seed: 7)
        s.setConditions(mood: .calm, night: false, allowed: [0, 1, 2, 3, 4, 5], bowlFull: false, behavior: hushed)
        s.autonomous = false; s.request(4)
        for _ in 0..<(30 * 120) where s.current != 4 || s.isMoving { s.tick(1.0 / 30) }
        s.autonomous = true; s.greet()
        precondition(s.pendingTarget != 0 && s.target != 0, "想安静时不来门口")

        print("PASS: 安静换地点 \(q.changes) 次 / 好奇 \(c.changes) 次；打盹占比 安静 \(String(format: "%.2f", napQ))、好奇 \(String(format: "%.2f", napC))；黏人在门口 \(String(format: "%.2f", homeK))；喝水 黏人 \(Int(waits[.close]!))s / 安静 \(Int(waits[.quiet]!))s")
    }
}
