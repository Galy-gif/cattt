import Foundation
/// 情绪、时段、天气的规则测试（docs/specs/情绪-喝水-时段与雨天-方案-2026-09-12.md 第 2.2、4.1、4.3 节）。
@main struct WorldMoodTests {
    static func main() throws {
        var cal=Calendar(identifier:.gregorian); cal.timeZone=TimeZone(identifier:"Asia/Shanghai")!
        func date(_ day:Int,_ hour:Double)->Date {
            var c=DateComponents(); c.year=2026; c.month=9; c.day=day; c.hour=Int(hour); c.minute=Int((hour-Double(Int(hour)))*60)
            return cal.date(from:c)!
        }
        // 1) 时段边界
        precondition(DayPhase.at(hour:5.99) == .night && DayPhase.at(hour:6) == .dawn && DayPhase.at(hour:8) == .day)
        precondition(DayPhase.at(hour:16.99) == .day && DayPhase.at(hour:17) == .dusk && DayPhase.at(hour:18.5) == .evening && DayPhase.at(hour:19.5) == .night)
        // 2) 天气：同一天同一结果；一千天里雨天占一到三成
        var rain=0
        for d in 0..<1000 {
            let day=cal.date(byAdding:.day,value:d,to:date(1,10))!
            precondition(Weather.forDay(day) == Weather.forDay(day.addingTimeInterval(3600*5)),"same day, same weather")
            if Weather.forDay(day) == .rain {rain += 1}
        }
        precondition(rain>100 && rain<300,"rain days \(rain)")
        // 3) 情绪规则
        let created=date(1,9)
        func input(now:Date,previous:Date?=nil,filled:Date?=nil,drink:Date?=nil,pokes:[Date]=[],weather:Weather = .clear,session:Date?=nil,interacted:Bool=false)->MoodInput {
            MoodInput(now:now,createdAt:created,sessionStartedAt:session ?? now.addingTimeInterval(-10),previousVisitAt:previous,bowlFilledAt:filled,lastDrinkAt:drink,pokeTimes:pokes,weather:weather,interactedThisSession:interacted,calendar:cal)
        }
        // 第一天：没水、下雨都不算，只有开心或平常
        precondition(MoodRules.evaluate(input(now:date(1,15),weather:.rain)).mood == .calm,"first day never sad")
        precondition(MoodRules.evaluate(input(now:date(1,15))).mood == .calm)
        precondition(MoodRules.evaluate(input(now:date(1,15),filled:date(1,14))).mood == .happy,"filled today → happy greeting")
        // 第二天起
        let d5=date(5,15)
        precondition(MoodRules.evaluate(input(now:d5,filled:date(5,9),session:d5.addingTimeInterval(-400))).mood == .calm,"filled, past greeting window → calm")
        precondition(MoodRules.evaluate(input(now:d5,filled:date(5,9))).mood == .happy,"filled, just opened → happy greeting")
        precondition(MoodRules.evaluate(input(now:d5,filled:date(4,9))).mood == .sulk,"empty after noon → sulk")
        precondition(MoodRules.evaluate(input(now:date(5,10),filled:date(4,9))).mood == .calm,"empty before noon → still calm")
        precondition(MoodRules.evaluate(input(now:d5,filled:date(3,9))).mood == .sad,"empty two days → sad")
        precondition(MoodRules.evaluate(input(now:d5,filled:date(5,9),weather:.rain,session:d5.addingTimeInterval(-400))).mood == .calm,"rain but has water → calm")
        precondition(MoodRules.evaluate(input(now:date(5,10),filled:date(4,9),weather:.rain)).mood == .sad,"rain and no water → sad")
        let absent=MoodRules.evaluate(input(now:d5,previous:date(1,20),filled:date(5,9)))
        precondition(absent.mood == .sad && absent.reason.contains("好几天"),"absent 3 days → sad greeting")
        precondition(MoodRules.evaluate(input(now:d5,previous:date(1,20),filled:date(5,9),interacted:true)).mood == .happy,"interaction ends the sad greeting")
        precondition(MoodRules.evaluate(input(now:d5,previous:date(1,20),filled:date(5,9),session:d5.addingTimeInterval(-400))).mood == .calm,"sad greeting lasts 3 minutes")
        precondition(MoodRules.evaluate(input(now:d5,previous:date(3,20),filled:date(5,9))).mood == .happy,"2 days away is not absence")
        let pokes=(0..<4).map{d5.addingTimeInterval(-Double($0)*5)}
        precondition(MoodRules.evaluate(input(now:d5,filled:date(5,9),pokes:pokes)).mood == .sulk,"poke burst → sulk")
        precondition(MoodRules.evaluate(input(now:d5.addingTimeInterval(90),filled:date(5,9),pokes:pokes)).mood == .happy,"poke sulk fades after 60s")
        precondition(MoodRules.evaluate(input(now:d5,filled:date(5,9),drink:d5.addingTimeInterval(-60))).mood == .happy,"just drank → happy")
        precondition(MoodRules.evaluate(input(now:d5,filled:date(4,9),drink:d5.addingTimeInterval(-60))).mood == .sulk,"sulk beats happy")
        precondition(MoodRules.evaluate(input(now:d5,filled:date(3,9),pokes:pokes)).mood == .sad,"sad beats sulk")
        // 4) 待机池权重都归一；夜里只睡觉
        for mood in Mood.allCases {
            let total=MoodRules.housePool(mood:mood,night:false).reduce(0){$0+$1.weight}
            precondition(abs(total-1)<0.0001,"pool \(mood) sums to \(total)")
        }
        precondition(MoodRules.housePool(mood:.sad,night:true).map(\.action) == ["sleepyNod"])
        // 5) 去处限制
        precondition(MoodRules.allowedDestinations(phase:.night,weather:.clear) == [0,2])
        precondition(MoodRules.allowedDestinations(phase:.day,weather:.rain) == [0,1])
        precondition(MoodRules.allowedDestinations(phase:.dusk,weather:.clear).count == 6)
        print("PASS: day phases, deterministic weather (\(rain)/1000 rainy days), mood rules and priorities, idle pools, destination limits")
    }
}
