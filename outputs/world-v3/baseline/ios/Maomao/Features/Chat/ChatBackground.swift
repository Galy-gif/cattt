import SwiftUI

/// 聊天背景：多层光斑拼出的院子光，模拟场景光但不放具体场景图。
///
/// 设计稿是五层 CSS `radial-gradient` 叠 `linear-gradient` 底。CSS 的径向渐变可以
/// 分别指定横竖半径（`120% 62%`），SwiftUI 的 `RadialGradient` 只有一个半径，
/// 所以这里画正圆再按比例拉成椭圆 —— 结果和设计稿一致。
struct ChatBackground: View {

    /// 一层光斑：中心位置、横竖半径（占画面宽/高的比例）、颜色、透明到底的位置。
    private struct Blob {
        let center: UnitPoint
        let radiusX: CGFloat
        let radiusY: CGFloat
        let color: Color
        let fade: CGFloat
    }

    private let blobs: [Blob] = [
        Blob(center: UnitPoint(x: 0.18, y: 0.06), radiusX: 1.20, radiusY: 0.62,
             color: Color(hex: 0xCFE3EA), fade: 0.58),
        Blob(center: UnitPoint(x: 0.88, y: 0.22), radiusX: 0.96, radiusY: 0.50,
             color: Color(hex: 0xC6D9C4), fade: 0.62),
        Blob(center: UnitPoint(x: 0.12, y: 0.74), radiusX: 1.10, radiusY: 0.56,
             color: Color(hex: 0x9FC0C2), fade: 0.60),
        Blob(center: UnitPoint(x: 0.82, y: 0.96), radiusX: 1.20, radiusY: 0.60,
             color: Color(hex: 0xB0C8AD), fade: 0.64),
    ]

    /// 画正圆用的名义半径，之后按 radiusX / radiusY 拉伸。
    private let unitRadius: CGFloat = 100

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                // linear-gradient(168deg, #C9DCC7, #AEC6AF)：几乎垂直，略向右偏。
                LinearGradient(
                    colors: [Color(hex: 0xC9DCC7), Color(hex: 0xAEC6AF)],
                    startPoint: UnitPoint(x: 0.396, y: 0.011),
                    endPoint: UnitPoint(x: 0.604, y: 0.989)
                )

                ForEach(blobs.indices, id: \.self) { index in
                    let blob = blobs[index]
                    RadialGradient(
                        gradient: Gradient(stops: [
                            .init(color: blob.color, location: 0),
                            .init(color: blob.color.opacity(0), location: blob.fade),
                        ]),
                        center: .center,
                        startRadius: 0,
                        endRadius: unitRadius
                    )
                    .frame(width: unitRadius * 2, height: unitRadius * 2)
                    .scaleEffect(
                        x: blob.radiusX * proxy.size.width / unitRadius,
                        y: blob.radiusY * proxy.size.height / unitRadius
                    )
                    .position(
                        x: blob.center.x * proxy.size.width,
                        y: blob.center.y * proxy.size.height
                    )
                }
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .clipped()
        }
        .background(Color(hex: 0xBCCFC0))
    }
}
