import Foundation

/// 时段、天气、情绪：纯逻辑，没有 SwiftUI，世界层测试直接编译它。
/// 依据 docs/specs/情绪-喝水-时段与雨天-方案-2026-09-12.md 第 2、4 节。

/// 一天五段。第一版按固定钟点，第二版换当地日出日落。
enum DayPhase: String, CaseIterable {
    case dawn, day, dusk, evening, night

    static func at(hour: Double) -> DayPhase {
        switch hour {
        case 6..<8: return .dawn
        case 8..<17: return .day
        case 17..<18.5: return .dusk
        case 18.5..<19.5: return .evening
        default: return .night
        }
    }
    static func at(_ date: Date, calendar: Calendar = .current) -> DayPhase {
        at(hour: Self.hour(of: date, calendar: calendar))
    }
    static func hour(of date: Date, calendar: Calendar = .current) -> Double {
        let c = calendar.dateComponents([.hour, .minute, .second], from: date)
        return Double(c.hour ?? 0) + Double(c.minute ?? 0) / 60 + Double(c.second ?? 0) / 3600
    }
    /// 团子睡觉的时段：只待在蘑菇屋门口或猫窝。
    var isNight: Bool { self == .night }
}

/// 天气。第一版按天随机（决策 09-12 补记第 9 条），换成 WeatherKit 时只换 `forDay`。
enum Weather: String {
    case clear, rain

    /// 同一天同一个种子永远同一个结果；约五分之一的天下雨。
    static func forDay(_ date: Date, seed: UInt64 = 7, calendar: Calendar = .current) -> Weather {
        let day = UInt64(calendar.ordinality(of: .day, in: .era, for: date) ?? 0)
        var x = (day &* 0x9E3779B97F4A7C15) ^ (seed &* 0xBF58476D1CE4E5B9)
        x ^= x >> 31; x = x &* 0x94D049BB133111EB; x ^= x >> 29
        return (x % 100) < 20 ? .rain : .clear
    }
}

/// 三种可见情绪，加默认的平常。
enum Mood: String, CaseIterable {
    case calm, happy, sulk, sad
}

/// 情绪的输入：全部是已经存下来的事件，没有一条是猜的。
struct MoodInput {
    var now: Date
    /// 猫被领养的那天（第一天不写不开心、不生气）。
    var createdAt: Date
    /// 这次打开 App 的时刻。
    var sessionStartedAt: Date
    /// 上一次来（这次之前）。nil = 第一次来。
    var previousVisitAt: Date?
    var bowlFilledAt: Date?
    var lastDrinkAt: Date?
    /// 最近几次点猫的时刻（只留 30 秒内的）。
    var pokeTimes: [Date] = []
    var weather: Weather = .clear
    /// 这次打开后用户有没有说过话或摸过它（提前结束"委屈"）。
    var interactedThisSession = false
    /// 情绪时长倍数，来自性格（亲近表达越高，委屈和开心持续越久）。
    var moodScale = 1.0
    var calendar: Calendar = .current
}

struct MoodEvaluation: Equatable {
    let mood: Mood
    /// 状态句里说出口的原因。平常时为空。
    let reason: String
    static let calm = MoodEvaluation(mood: .calm, reason: "")
}

enum MoodRules {
    static let absenceDays = 3
    static let sadGreetingSeconds = 180.0
    static let happyGreetingSeconds = 120.0
    /// 乘上性格倍数之后的上限（方案第 2.2 节：委屈最多五分钟）。
    static let moodSecondsCap = 300.0
    static func scaled(_ seconds: Double, _ scale: Double) -> Double { min(moodSecondsCap, seconds * scale) }
    static let happyAfterDrinkSeconds = 300.0
    static let pokeBurstCount = 4
    static let pokeBurstWindow = 30.0
    static let pokeSulkSeconds = 60.0

    static func daysBetween(_ a: Date, _ b: Date, calendar: Calendar) -> Int {
        let da = calendar.startOfDay(for: a), db = calendar.startOfDay(for: b)
        return calendar.dateComponents([.day], from: da, to: db).day ?? 0
    }

    /// 优先级：委屈 > 不高兴 > 开心 > 平常。同一时刻只有一种情绪。
    static func evaluate(_ i: MoodInput) -> MoodEvaluation {
        let cal = i.calendar
        let firstDay = daysBetween(i.createdAt, i.now, calendar: cal) == 0
        let filledToday = i.bowlFilledAt.map { cal.isDate($0, inSameDayAs: i.now) } ?? false
        let emptyDays = i.bowlFilledAt.map { daysBetween($0, i.now, calendar: cal) } ?? daysBetween(i.createdAt, i.now, calendar: cal)
        let sinceSession = i.now.timeIntervalSince(i.sessionStartedAt)
        let hour = DayPhase.hour(of: i.now, calendar: cal)

        if !firstDay {
            // 委屈
            if let previous = i.previousVisitAt, daysBetween(previous, i.now, calendar: cal) >= absenceDays,
               sinceSession < scaled(sadGreetingSeconds, i.moodScale), !i.interactedThisSession {
                return MoodEvaluation(mood: .sad, reason: "团子把自己缩成一团，好几天没见到你了")
            }
            if emptyDays >= 2 {
                return MoodEvaluation(mood: .sad, reason: "团子缩成一团，碗已经空了两天")
            }
            if i.weather == .rain && !filledToday {
                return MoodEvaluation(mood: .sad, reason: "下雨了，团子缩在屋檐下")
            }
            // 不高兴
            if !filledToday && hour >= 12 {
                return MoodEvaluation(mood: .sulk, reason: "团子背对着门口，碗空了一整天")
            }
        }
        let recentPokes = i.pokeTimes.filter { i.now.timeIntervalSince($0) <= pokeBurstWindow + pokeSulkSeconds }
        if recentPokes.count >= pokeBurstCount, let last = recentPokes.max(), i.now.timeIntervalSince(last) < pokeSulkSeconds {
            return MoodEvaluation(mood: .sulk, reason: "团子背过身去，不想再被戳了")
        }
        // 开心
        if let drink = i.lastDrinkAt, i.now.timeIntervalSince(drink) < happyAfterDrinkSeconds, i.now >= drink {
            return MoodEvaluation(mood: .happy, reason: "团子尾巴翘得老高，刚喝过水")
        }
        if filledToday && i.weather == .clear && sinceSession < scaled(happyGreetingSeconds, i.moodScale) {
            return MoodEvaluation(mood: .happy, reason: "团子尾巴翘着，今天的水是满的")
        }
        return .calm
    }

    /// 调试强制某种情绪时用的原因句。
    static func debugReason(_ mood: Mood) -> String {
        switch mood {
        case .calm: return ""
        case .happy: return "团子尾巴翘得老高，刚喝过水"
        case .sulk: return "团子背对着门口，碗空了一整天"
        case .sad: return "团子把自己缩成一团，好几天没见到你了"
        }
    }

    /// 蘑菇屋门口的待机池（方案第 2.4 节）。夜晚只睡觉。
    /// 平常和开心时按性格分打盹、看你、舔毛的权重；不高兴和委屈时情绪压过性格。
    static func housePool(mood: Mood, night: Bool, behavior: BehaviorParams = .default) -> [(action: String, weight: Double)] {
        if night { return [("sleepyNod", 1)] }
        let sleep = behavior.sleepWeight
        let tilt = behavior.lookWeight * behavior.tiltShare
        let sit = behavior.lookWeight - tilt
        let pool: [(action: String, weight: Double)]
        switch mood {
        case .calm: pool = [("sleepyNod", sleep), ("sitLook", sit), ("headTilt", tilt), ("groom", behavior.groomWeight)]
        case .happy:
            // 开心时高兴的那套动作占三成，剩下七成还是按性格分。
            let awake = sleep * 0.5 + sit + tilt + behavior.groomWeight * 0.5
            pool = [("sleepyNod", sleep * 0.5), ("sitLook", sit), ("headTilt", tilt), ("groom", behavior.groomWeight * 0.5), ("moodHappy", awake * 0.45)]
        case .sulk: pool = [("groom", 0.20), ("moodSulk", 0.80)]
        case .sad: pool = [("sitLook", 0.20), ("moodSad", 0.80)]
        }
        // 权重归一，外面按累加抽签时不用关心总和。
        let total = pool.reduce(0) { $0 + $1.weight }
        guard total > 0 else { return [("sleepyNod", 1)] }
        return pool.map { ($0.action, $0.weight / total) }
    }

    /// 时段与雨天限制猫去哪（地点序号同 Location.all：0 蘑菇屋、1 树屋、2 猫窝、3 草丛、4 池塘、5 栅栏边）。
    static func allowedDestinations(phase: DayPhase, weather: Weather) -> Set<Int> {
        if phase.isNight { return [0, 2] }
        if weather == .rain { return [0, 1] }
        return [0, 1, 2, 3, 4, 5]
    }
}

/// 状态条与点猫反应的文案，按情绪与时段。禁用打卡、任务、连续天数这类词。
enum MoodCopy {
    /// 平常时按气质说一套；有情绪时情绪先说（情绪压过气质，和状态条一致）。
    /// 慢热的猫头三天（familiar == false）用安静那套。
    static func reactions(_ mood: Mood, temperament: Temperament, familiar: Bool = true) -> [String] {
        guard mood == .calm else { return reactions(mood) }
        switch temperament {
        case .quiet: return ["团子耳朵动了一下", "团子看了你一眼，没动"]
        case .close: return ["团子蹭过来了", "团子往你这边挪了挪"]
        case .curious: return ["团子歪头看着你的手", "团子竖起耳朵，盯着你"]
        case .slow:
            return familiar ? ["团子抬头看了你一眼", "团子尾巴尖动了一下"] : ["团子耳朵动了一下", "团子看了你一眼，没动"]
        }
    }
    /// 平常、白天、晴天、在门口时状态条说的那句：按气质分四套。
    static func temperamentLine(_ temperament: Temperament, familiar: Bool = true) -> String {
        switch temperament {
        case .quiet: return "团子在门口眯着眼，没什么事"
        case .close: return "团子坐在门口，一直朝你这边看"
        case .curious: return "团子在门口东张西望"
        case .slow: return familiar ? "团子在门口坐着，偶尔看你一眼" : "团子在门口眯着眼，没什么事"
        }
    }
    static func reactions(_ mood: Mood) -> [String] {
        switch mood {
        case .calm: return ["团子抬头看了你一眼", "团子耳朵动了一下"]
        case .happy: return ["团子蹭了蹭你的方向", "团子尾巴尖弯了一下"]
        case .sulk: return ["团子没回头", "团子耳朵往后压了压"]
        case .sad: return ["团子抬眼看了看你，又低下头", "团子往你这边挪了一点点"]
        }
    }
    static func phaseLine(_ phase: DayPhase, weather: Weather, atHome: Bool) -> String? {
        if weather == .rain { return atHome ? "下雨了，团子在屋檐下看雨" : "下雨了，团子躲在树窝里" }
        switch phase {
        case .night: return atHome ? "窗户亮着，团子在门口打盹" : "夜深了，团子睡在垫子上"
        case .evening: return atHome ? "窗户刚亮起来，团子在门口坐着" : nil
        case .dusk: return atHome ? "天快黑了，团子在门口看夕阳" : nil
        case .dawn: return atHome ? "天刚亮，团子在门口打哈欠" : nil
        case .day: return nil
        }
    }
}
