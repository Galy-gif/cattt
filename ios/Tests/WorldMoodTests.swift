import Foundation
/// 情绪、时段、天气的规则测试（docs/方案/情绪-喝水-时段与雨天-方案-2026-09-12.md 第 2.2、4.1、4.3 节）。
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
        // 2) 天气：三种模式；真实天气取不到时是晴天；WMO 码只有降水类算雨
        precondition(WeatherMode.real.resolve(real:nil) == .clear,"no real weather yet → clear, never random rain")
        precondition(WeatherMode.real.resolve(real:.rain) == .rain && WeatherMode.real.resolve(real:.clear) == .clear)
        precondition(WeatherMode.clear.resolve(real:.rain) == .clear && WeatherMode.rain.resolve(real:.clear) == .rain && WeatherMode.rain.resolve(real:nil) == .rain)
        for code in [51,55,61,63,65,66,67,80,81,82,95,96,99] {precondition(Weather.fromWMO(code) == .rain,"wmo \(code) is rain")}
        for code in [0,1,2,3,45,48,71,73,75,77,85,86] {precondition(Weather.fromWMO(code) == .clear,"wmo \(code) is not rain")}
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
        // 4b) 状态条：猫垫上下雨不能说成树窝
        precondition(!(MoodCopy.phaseLine(.night,weather:.rain,atHome:false) ?? "").contains("树窝"),"cushion rain line must not mention the nest")
        precondition(MoodCopy.phaseLine(.night,weather:.rain,atHome:false)?.contains("垫子") == true)
        // 5) 去处限制
        precondition(MoodRules.allowedDestinations(phase:.night,weather:.clear) == [0,2])
        precondition(MoodRules.allowedDestinations(phase:.day,weather:.rain) == [0,1])
        precondition(MoodRules.allowedDestinations(phase:.dusk,weather:.clear).count == 6)
        print("PASS: day phases, weather modes and WMO mapping, mood rules and priorities, idle pools, destination limits")
    }
}
