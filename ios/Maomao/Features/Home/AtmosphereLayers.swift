import SwiftUI
import UIKit

extension Tint {
    var color: Color { Color(red: min(1, max(0, r)), green: min(1, max(0, g)), blue: min(1, max(0, b))) }
    /// 感知亮度，0 黑 1 白。聊天页用它判断这会儿该用亮字面还是暗字面。
    var luminance: Double { 0.3 * r + 0.59 * g + 0.11 * b }
}

/// 时段分级：拼贴（天空、远山、草地）上乘一层从天顶到地面的颜色，再加一层暖光（黄昏的粉、傍晚地平线的一线桃色），
/// 雨天再盖一层灰雾。院子和聊天页共用这一份，`horizon`、`ground` 是地平线和草地起点在这块画面里的纵向比例。
/// 参数来自 Model/Atmosphere.swift（从四张方向图上量的）。
struct AtmosphereGrade: View {
    let params: AtmosphereParams
    let horizon: Double
    let ground: Double

    var body: some View {
        let a = params
        let multiply = LinearGradient(stops: [.init(color: a.skyTop.color, location: 0), .init(color: a.skyHorizon.color, location: horizon),
                                              .init(color: a.ground.color, location: ground), .init(color: a.ground.color, location: 1)],
                                      startPoint: .top, endPoint: .bottom)
        let glow = LinearGradient(stops: [.init(color: a.skyTopAdd.color, location: 0), .init(color: a.skyHorizonAdd.color, location: horizon),
                                          .init(color: .black, location: ground)],
                                  startPoint: .top, endPoint: .bottom)
        let cover = LinearGradient(stops: [.init(color: a.cover.color.opacity(a.coverTop), location: 0), .init(color: a.cover.color.opacity(a.coverHorizon), location: horizon),
                                           .init(color: a.cover.color.opacity(0), location: ground)],
                                   startPoint: .top, endPoint: .bottom)
        ZStack {
            Rectangle().fill(multiply).blendMode(.multiply)
            Rectangle().fill(glow).blendMode(.plusLighter)
            if a.coverTop > 0.001 { Rectangle().fill(cover) }
        }
    }
}

/// 雨丝：代码画的细线粒子，从上往下略斜；强度随雨的参数。开了"减少动态效果"就静止。
struct RainStreaks: View {
    let amount: Double

    var body: some View {
        let still = UIAccessibility.isReduceMotionEnabled
        TimelineView(.animation(minimumInterval: 1 / 30, paused: still)) { timeline in
            Canvas { context, size in
                let t = still ? 0 : timeline.date.timeIntervalSinceReferenceDate
                let count = Int(150 * amount)
                let length = size.height * 0.05, speed = size.height * 0.95
                for i in 0..<count {
                    let seed = Double(i) * 12.9898
                    let fx = abs((sin(seed) * 43758.5453).truncatingRemainder(dividingBy: 1))
                    let phase = abs((cos(seed * 1.7) * 7919.0).truncatingRemainder(dividingBy: 1))
                    let x = fx * size.width * 1.15 - size.width * 0.05
                    let y = ((t * speed * (0.8 + 0.4 * phase) + phase * size.height * 3).truncatingRemainder(dividingBy: size.height + length)) - length
                    var path = Path(); path.move(to: CGPoint(x: x, y: y)); path.addLine(to: CGPoint(x: x - length * 0.14, y: y + length))
                    context.stroke(path, with: .color(.white.opacity((0.22 + 0.22 * phase) * amount)), lineWidth: 1.1)
                }
            }
        }
    }
}
