import SwiftUI

/// 从已选定方向稿提取的颜色与光位；细纤维留在背景，不进入卡片或图标底座。
struct PageBackground: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Palette.bg
                RadialGradient(colors: [Palette.pageGlow, Palette.pageGlow.opacity(0)], center: .center,
                               startRadius: 0, endRadius: proxy.size.width * 0.85)
                    .scaleEffect(x: 1, y: 0.65)
                    .offset(x: proxy.size.width * 0.22, y: -proxy.size.height * 0.38)
                Canvas { context, size in
                    for i in 0..<1600 {
                        let x = CGFloat((i * 127 + 19) % 997) / 997 * size.width
                        let y = CGFloat((i * 233 + 41) % 991) / 991 * size.height
                        var fibre = Path()
                        fibre.move(to: CGPoint(x: x, y: y))
                        fibre.addLine(to: CGPoint(x: x + CGFloat(i % 3 + 1), y: y + 1))
                        context.stroke(fibre, with: .color(Palette.ink.opacity(0.025)), lineWidth: 0.5)
                    }
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
