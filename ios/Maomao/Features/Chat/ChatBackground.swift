import SwiftUI

/// 同一3D小院的离线镜头：六地点 × 五时段 × 晴雨。图中不烘焙猫。
/// 直接使用正式场景光色，不再叠旧2D天空、亮窗或重复调色。
struct ChatBackground: View {
    let tone: ChatTone
    let place: String
    let slot: String
    let weather: String
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private var imageName: String { "chat-3d-\(slot)-\(weather)-\(place)" }

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                tone.mist
                Image(imageName)
                    .resizable().scaledToFill()
                    .frame(width: proxy.size.width + 32, height: proxy.size.height + 32)
                    .blur(radius: 14)
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .clipped()
                    .id(imageName)
                    .transition(.opacity)
                tone.mist.opacity(tone.isDark ? 0.35 : 0.32)
                LinearGradient(stops: [
                    .init(color: tone.mist.opacity(0.72), location: 0),
                    .init(color: tone.mist.opacity(0.12), location: 0.24),
                    .init(color: tone.mist.opacity(0.12), location: 0.72),
                    .init(color: tone.mist.opacity(0.76), location: 1)
                ], startPoint: .top, endPoint: .bottom)
            }
            .animation(reduceMotion ? nil : .easeInOut(duration: 1.2), value: imageName)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
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
