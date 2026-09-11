import SwiftUI

/// 院子里的六个地点。第一版（2026-09-09 起）它们是同一张长图上的六个落脚点，不再各配一张场景图。
/// 坐标是归一化的（相对整张毛毡长卷世界，与场景配置 world-scene-v4 同一坐标系）；换高清版不用改。
struct Location: Identifiable, Equatable {
    enum ID: String, CaseIterable {
        case mushroomHouse, treeHouse, catBed, grass, pond, fence
    }

    let id: ID
    let name: String
    /// 猫在此处落脚的点（脚底）。
    let spot: CGPoint
    /// 到位后朝向。
    let facing: Facing
    /// 到位后的待机动作。
    let idle: CatAction
    /// 地点轨点它时相机的中心 x。
    let cameraX: CGFloat
    /// 猫在此处时的状态句，轮换取用
    let lines: [String]
    /// 点猫的反应句，随机取一句，停留 2s
    let reactions: [String]

    static let all: [Location] = [
        Location(
            id: .mushroomHouse, name: "蘑菇屋",
            spot: CGPoint(x: 0.150, y: 0.665), facing: .right, idle: .sleepyNod, cameraX: 0.20,
            lines: ["团子在蘑菇屋门口打盹", "团子把脸埋进了垫子"],
            reactions: ["团子抬头看了你一眼", "团子耳朵动了一下"]
        ),
        Location(
            id: .treeHouse, name: "树屋",
            spot: CGPoint(x: 0.343, y: 0.595), facing: .right, idle: .treeScratch, cameraX: 0.36,
            lines: ["团子在树下磨爪子", "团子在树影里看远处"],
            reactions: ["团子把尾巴收了收", "团子低头看了看你"]
        ),
        Location(
            id: .catBed, name: "猫窝",
            spot: CGPoint(x: 0.235, y: 0.875), facing: .right, idle: .sleepBreathe, cameraX: 0.20,
            lines: ["团子睡在垫子上，呼吸很轻", "团子翻了个身"],
            reactions: ["团子睁了一下眼睛又闭上", "团子换了个姿势"]
        ),
        Location(
            id: .grass, name: "草丛",
            spot: CGPoint(x: 0.475, y: 0.800), facing: .left, idle: .tailChase, cameraX: 0.47,
            lines: ["团子在草里追自己的尾巴", "团子盯着一只虫子"],
            reactions: ["团子朝你这边看过来", "团子甩了甩尾巴"]
        ),
        Location(
            id: .pond, name: "池塘",
            spot: CGPoint(x: 0.560, y: 0.885), facing: .right, idle: .blinkLook, cameraX: 0.64,
            lines: ["团子在池塘边发呆", "团子看着水面上的影子"],
            reactions: ["团子伸了个懒腰", "团子转过头看你"]
        ),
        Location(
            id: .fence, name: "栅栏边",
            spot: CGPoint(x: 0.900, y: 0.710), facing: .left, idle: .blinkLook, cameraX: 0.86,
            lines: ["团子在栅栏边晒太阳", "团子在栅栏边打了个哈欠"],
            reactions: ["团子换了个坐姿", "团子看了你一眼"]
        ),
    ]

    static func index(of id: ID) -> Int { all.firstIndex { $0.id == id } ?? 0 }

    /// 相机 x 离哪个地点最近（地点轨高亮用）。
    static func nearest(toCamera x: CGFloat) -> Int {
        var best = 0
        var bestDistance = CGFloat.infinity
        for (i, location) in all.enumerated() {
            let d = abs(location.cameraX - x)
            if d < bestDistance { best = i; bestDistance = d }
        }
        return best
    }
}
