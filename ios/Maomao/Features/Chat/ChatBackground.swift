import SwiftUI
import UIKit

/// 聊天背景：团子的院子在身后，虚化过，跟院子同一份时段和天气。
///
/// 底图是 `assets/tools/bake_chat_backdrop.py` 预烘的整幅院子全景（虚化已烘进去），
/// 按团子所在地点的 `cameraX` 左右取景：团子在蘑菇屋，身后就是蘑菇屋；它走去池塘，背景跟着慢慢移过去。
/// 调色、雨丝和院子共用 `AtmosphereGrade`、`RainStreaks`；月亮、星星、夕阳、雨云用院子同一批毛毡件，
/// 按这一屏的构图摆，跟底图一样虚着。上下两层雾托住顶栏和输入框，颜色随明暗换。
/// 方案见 `docs/方案/聊天页院子底-方案-2026-09-16.md`。
struct ChatBackground: View {
    let atmosphere: AtmosphereParams
    let tone: ChatTone
    /// 团子所在（或正走去的）地点在院子里的横向中心，0–1。
    let cameraX: Double

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// 全景的宽高比（烘焙脚本按院子比例出图）。
    private let backdropAspect: CGFloat = 5166.0 / 3444.0
    /// 亮窗在院子里的位置（courtyard-v4 scene.json 的 window-lit）。
    private static let litWindow = CGRect(x: 0.1805, y: 0.50573, width: 0.04722, height: 0.08966)
    /// 底图纵向是整张院子，地平线和草地起点就是院子里的比例。
    private let horizon = 0.50
    private let ground = 0.62
    /// 和院子页的 `scenerySaturation` 一致，两页不能一深一浅。
    private let scenerySaturation = 0.70

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            ZStack {
                ZStack {
                    let width = size.height * backdropAspect
                    // 让地点落在屏幕正中，到院子两头时贴边不露底。
                    let offset = min(0, max(size.width - width, size.width / 2 - cameraX * width))
                    Image("chat-backdrop")
                        .resizable()
                        .frame(width: width, height: size.height)
                        .offset(x: offset)
                        .frame(width: size.width, height: size.height, alignment: .leading)
                        .clipped()
                        .saturation(scenerySaturation)
                        .animation(reduceMotion ? nil : .easeInOut(duration: 1.6), value: cameraX)
                    if atmosphere != .day {
                        AtmosphereGrade(params: atmosphere, horizon: horizon, ground: ground)
                    }
                }
                .compositingGroup()

                // 蘑菇屋的亮窗：自己发光，不跟着夜色变暗，所以不烘进底图、也不走调色。
                if atmosphere.windowLit > 0.02, let lit = SkyTextures.image("world-v6-window-lit") {
                    let width = size.height * backdropAspect
                    let offset = min(0, max(size.width - width, size.width / 2 - cameraX * width))
                    let rect = Self.litWindow
                    Image(uiImage: lit)
                        .resizable()
                        .frame(width: rect.width * width, height: rect.height * size.height)
                        .blur(radius: 5)
                        .position(x: offset + rect.midX * width, y: rect.midY * size.height)
                        .frame(width: size.width, height: size.height)
                        .opacity(atmosphere.windowLit)
                        .animation(reduceMotion ? nil : .easeInOut(duration: 1.6), value: cameraX)
                }

                SkyProps(atmosphere: atmosphere, size: size)

                // 雨丝在雾下面：院子里下着雨，但不从字上划过去。
                if atmosphere.rain > 0.01 {
                    RainStreaks(amount: atmosphere.rain * (tone.isDark ? 0.42 : 0.6))
                }

                // 整屏一层薄雾，让院子退到对话后面；上下再各加一层。
                tone.mist.opacity(tone.isDark ? 0.16 : 0.22)
                LinearGradient(
                    stops: [
                        .init(color: tone.mist.opacity(tone.isDark ? 0.70 : 0.62), location: 0),
                        .init(color: tone.mist.opacity(0), location: 0.2),
                        .init(color: tone.mist.opacity(0), location: 0.76),
                        .init(color: tone.mist.opacity(tone.isDark ? 0.62 : 0.55), location: 1),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )

            }
            .frame(width: size.width, height: size.height)
            .animation(.easeInOut(duration: 0.6), value: tone.isDark)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// 天上的毛毡件。院子里是按世界坐标摆的，这里取景只有院子中段一条，所以按屏幕比例重新摆，避开顶栏正中。
private struct SkyProps: View {
    let atmosphere: AtmosphereParams
    let size: CGSize

    /// 避开左边头像那一列和顶栏正中。
    private static let stars: [(x: Double, y: Double, w: Double)] = [
        (0.52, 0.08, 11), (0.36, 0.24, 9), (0.62, 0.31, 12), (0.93, 0.27, 10),
        (0.47, 0.41, 9), (0.83, 0.43, 11), (0.70, 0.05, 9),
    ]

    var body: some View {
        let a = atmosphere
        let animated = (a.stars > 0.01 || a.rain > 0.01) && !UIAccessibility.isReduceMotionEnabled
        TimelineView(.animation(minimumInterval: 1 / 15, paused: !animated)) { timeline in
            let t = animated ? timeline.date.timeIntervalSinceReferenceDate : 0
            ZStack(alignment: .topLeading) {
                if a.sun > 0.01 { prop("world-v6-sun", x: 0.26, y: 0.43, width: 58, blur: 4, opacity: a.sun) }
                if a.moon > 0.01 { prop("world-v6-moon", x: 0.80, y: 0.17, width: 56, blur: 2.5, opacity: a.moon) }
                if a.stars > 0.01 {
                    ForEach(Self.stars.indices, id: \.self) { i in
                        let star = Self.stars[i]
                        let twinkle = 0.7 + 0.3 * sin(t * (0.9 + Double(i % 3) * 0.35) + Double(i) * 1.7)
                        prop("world-v6-star-\(i % 5 + 1)", x: star.x, y: star.y, width: star.w, blur: 1.2, opacity: a.stars * twinkle * 0.8)
                    }
                }
                if a.rain > 0.01 {
                    // 雨云不自己发光：跟天一起乘色，夜里是暗的，不会在浅色字背后垫一块亮斑。
                    let drift = (t * 0.006).truncatingRemainder(dividingBy: 1.6)
                    ZStack(alignment: .topLeading) {
                        prop("world-v6-raincloud-a", x: 0.30 - drift, y: 0.10, width: 230, blur: 5, opacity: a.rain)
                        prop("world-v6-raincloud-b", x: 0.95 - drift * 0.8, y: 0.24, width: 170, blur: 5, opacity: a.rain * 0.9)
                        prop("world-v6-raincloud-a", x: 1.55 - drift, y: 0.06, width: 210, blur: 5, opacity: a.rain)
                    }
                    .frame(width: size.width, height: size.height, alignment: .topLeading)
                    .colorMultiply(a.skyTop.color)
                }
            }
            .frame(width: size.width, height: size.height, alignment: .topLeading)
        }
    }

    @ViewBuilder
    private func prop(_ name: String, x: Double, y: Double, width: CGFloat, blur: CGFloat, opacity: Double) -> some View {
        if let image = SkyTextures.image(name) {
            let height = width * image.size.height / max(1, image.size.width)
            Image(uiImage: image)
                .resizable()
                .frame(width: width, height: height)
                .blur(radius: blur)
                .opacity(opacity)
                .position(x: x * size.width, y: y * size.height)
        }
    }
}

/// 天上几件毛毡件很小，聊天页自己读一次存着，不去牵院子那套按相机加载、淘汰的纹理缓存。
@MainActor
private enum SkyTextures {
    private static var cache: [String: UIImage] = [:]

    static func image(_ name: String) -> UIImage? {
        if let hit = cache[name] { return hit }
        guard let path = Bundle.main.path(forResource: name, ofType: "png"),
              let image = UIImage(contentsOfFile: path) else { return nil }
        cache[name] = image
        return image
    }
}

/// 聊天页的两套字面：院子亮的时候白玻璃深字，入夜以后冷白薄玻璃浅字。
struct ChatTone: Equatable {
    let isDark: Bool

    /// 地面乘色的亮度低于这条线就换暗字面：入夜、夜里、夜雨落在下面，黄昏和白天的雨在上面。
    static let darkThreshold = 0.55

    static func from(_ atmosphere: AtmosphereParams) -> ChatTone {
        ChatTone(isDark: atmosphere.ground.luminance < darkThreshold)
    }

    var mist: Color { isDark ? Palette.chatMistNight : Palette.chatMist }
    var ink: Color { isDark ? Palette.chatInkNight : Palette.ink }
    var ink2: Color { isDark ? Palette.chatInk2Night : Palette.ink2 }
    var hint: Color { isDark ? Palette.chatInk2Night : Palette.chatHint }
    var placeholder: Color { isDark ? Palette.chatPlaceholderNight : Palette.ink3 }
    var bubbleCat: Color { isDark ? Palette.chatBubbleCatNight : Palette.chatBubbleCat }
    var bubbleUser: Color { isDark ? Palette.chatBubbleUserNight : Palette.chatBubbleUser }
    var field: Color { isDark ? Palette.chatFieldNight : Palette.chatField }
    var dot: Color { isDark ? Palette.chatInk2Night : Palette.chatDot }
    var separation: Color { isDark ? .clear : Palette.chatSeparation }
}

private struct ChatToneKey: EnvironmentKey {
    static let defaultValue = ChatTone(isDark: false)
}

extension EnvironmentValues {
    var chatTone: ChatTone {
        get { self[ChatToneKey.self] }
        set { self[ChatToneKey.self] = newValue }
    }
}
