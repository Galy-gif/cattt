import Foundation

/// 团子每天自己写的那一条（方案第 10 节）。第一版本地模板：只从事实表里填空，一到三句，团子口吻。
/// 禁用词：打卡、任务、连续天数。不指责、不问"为什么不来"。
enum CatDiary {
    struct Facts {
        var day: Date
        var isFirstDay = false
        var mood: Mood = .calm
        var weather: Weather = .clear
        var filledToday = false
        var drankToday = false
        var visitedToday = false
        /// 用户离上次来隔了几天（今天来了就是 0）。
        var absenceDays = 0
        var emptyDays = 0
        /// 今天聊天里用户最后说的一句（截短），可能没有。
        var chatSnippet: String?
        /// 今天团子看过的一条非私密碎片（截短），可能没有。
        var fragmentSnippet: String?
        /// 今天去过的地方名，按顺序。
        var places: [String] = []
        /// 写几句：由表达直接度决定（性格系统优化方案第 2.1 节）。
        var sentences = 2
        var calendar: Calendar = .current
    }

    /// 同一天同一事实永远同一句：按日期取模板，不用随机数。
    static func compose(_ f: Facts) -> String {
        let day = f.calendar.ordinality(of: .day, in: .era, for: f.day) ?? 0
        func pick(_ options: [String]) -> String { options[day % max(1, options.count)] }
        let sky: String = {
            switch f.weather {
            case .rain: return pick(["下了一天雨。", "雨下到傍晚才小。", "今天一直在下雨。"])
            case .clear: return pick(["天晴着。", "今天太阳很好。", "风不大。"])
            }
        }()
        let place: String? = f.places.dropFirst().first.map { name in
            pick(["下午去了\(name)。", "在\(name)待了一会儿。", "\(name)那边坐了坐。"])
        }
        // 句数按性格收；开头那句天气留着，砍掉中间不那么具体的。
        func fit(_ parts: [String]) -> String {
            let kept = parts.filter { !$0.isEmpty }
            let budget = max(2, min(3, f.sentences))
            guard kept.count > budget else { return kept.joined() }
            return ([kept[0]] + kept.suffix(budget - 1)).joined()
        }
        let water: String = f.drankToday ? pick(["水是新的，喝了两次。", "碗里有水，喝过了。"]) :
            f.filledToday ? "碗里有水。" : pick(["碗是空的。", "碗空了一天。"])

        if f.isFirstDay {
            return [sky, "你来了。", "我先在门口坐着。"].joined()
        }
        switch f.mood {
        case .sad:
            if f.absenceDays >= MoodRules.absenceDays || !f.visitedToday {
                return fit([sky, f.filledToday ? "" : "碗是空的。", pick(["今天也没有人来。", "门口没有人来过。", "等了一天。"])])
            }
            if f.emptyDays >= 2 { return fit([sky, pick(["碗空了两天了。", "碗还是空的。"]), "我去看了三次。"]) }
            return fit([sky, "碗是空的。", "缩在屋檐下看了一天雨。"])
        case .sulk:
            return fit([pick(["碗空了一整天，我去看了三次。", "碗一直是空的。"]), sky])
        case .happy:
            var parts = [String]()
            if let chat = f.chatSnippet { parts.append(pick(["今天你说\(chat)。", "你提到\(chat)。"])) }
            else if let frag = f.fragmentSnippet { parts.append(pick(["你写了\(frag)。", "看到你记的\(frag)。"])) }
            else { parts.append(pick(["今天你来了。", "你来过了。"])) }
            parts.append(f.drankToday ? "我没出去过，但水是新的，喝了两次。" : water)
            return fit(parts)
        case .calm:
            var parts = [sky]
            if let place { parts.append(place) }
            if let chat = f.chatSnippet { parts.append("你说\(chat)。") }
            else if f.visitedToday { parts.append(pick(["你来了一下。", "你来过。"])) }
            else { parts.append(pick(["门口很安静。", "没什么事。"])) }
            if parts.count < 3 { parts.append(water) }
            return fit(parts)
        }
    }

    /// 聊天或碎片截短成能放进句子里的一小段：去掉标点、最多十二个字。
    static func snippet(_ text: String) -> String? {
        let cleaned = text.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\n", with: " ")
        guard !cleaned.isEmpty else { return nil }
        let cut = cleaned.prefix(while: { !"。！？!?，,；;".contains($0) })
        let s = String(cut.prefix(12)).trimmingCharacters(in: .whitespaces)
        return s.isEmpty ? nil : "「\(s)」"
    }

    /// 团子写日记的时刻：夜晚开始（19:30）。
    static let writeHour = 19.5
}
