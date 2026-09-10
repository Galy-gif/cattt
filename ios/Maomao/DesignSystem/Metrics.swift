import SwiftUI

/// 尺寸 / 圆角 / 投影 / 动效时长。设计交接里的最终值。
enum Metrics {
    /// 设计稿的参考机型：390 × 844（iPhone 12–15 一档）。
    /// 屏幕边距全是相对这个尺寸给的绝对值。
    static let referenceWidth: CGFloat = 390
    static let referenceHeight: CGFloat = 844

    // 页面左右留白
    static let gutterOnboarding: CGFloat = 24
    static let gutterDiary: CGFloat = 22
    static let gutterChat: CGFloat = 16

    // 圆角。2026-09-08 晚从 3 / 4 两档改成四档：原来那两档是印刷品的语言，
    // 参考图（travel app）整套在 10–18 之间，长条一律满圆胶囊。
    static let radiusSm: CGFloat = 10       // 图标底座、时间片、小标签
    static let radiusControl: CGFloat = 12  // 按钮、输入框
    static let radiusCard: CGFloat = 14     // 行卡、气泡、列表容器、轻提示
    static let radiusLg: CGFloat = 18       // 大卡：日记条目、外观卡、抽屉

    // 图标容器三档，配 radiusSm 的圆角方块或正圆。
    // 层级靠容器变，图标玻璃本身只有 IconSize 的两档。
    static let iconSlotSm: CGFloat = 28     // 卡片角上的收藏、行内小标记
    static let iconSlotMd: CGFloat = 36     // 信息片、列表行左侧
    static let iconSlotLg: CGFloat = 44     // 顶栏主操作：返回、搜索、菜单

    // 点按目标
    static let minTap: CGFloat = 46
    static let primaryButton: CGFloat = 52
    static let primaryButtonShort: CGFloat = 50
    /// 场景上的「聊会儿」胶囊。比 minTap 矮，热区用 PrimaryButton 的 tapSlop 补。
    static let chatPill: CGFloat = 38

    // 动效
    static let fade: Double = 0.3           // mm-fade，轻提示 / 场景切换 / 留言纸
    static let fadeFast: Double = 0.2
    static let fadeSlow: Double = 0.35
    static let pokeScale: CGFloat = 1.02    // 点猫，场景轻推
    static let pokeDuration: Double = 0.35
    static let progressBar: Double = 0.3
    /// 按下缩放的时长。再快看不见，再慢像卡住。
    static let press: Double = 0.12
    /// 相机滑向地点 / 滑回猫身边。比淡入长一截，因为它是位移，眼睛要跟。
    static let cameraGlide: Double = 0.6
}

/// CSS `letter-spacing: Xem` → SwiftUI `.tracking` 的 pt 值。
func track(_ em: CGFloat, _ size: CGFloat) -> CGFloat { em * size }

extension View {
    /// 卡片的软投影。参考图（travel app）的卡片全靠这一层浮起来，不描边。
    func softShadow() -> some View {
        shadow(color: Palette.shadow, radius: 14, x: 0, y: 6)
    }

    /// 设计稿给的顶部绝对偏移（从屏幕上沿量起），但不让内容钻进状态栏。
    /// 参考机型上安全区顶部 47pt，设计值 52–60 都大于 47 + 5，所以这里恒等于设计值；
    /// 换成刘海更深的机型（如 iPhone 16 Pro）才会顶下来。
    func designTopInset(_ value: CGFloat) -> some View {
        modifier(DesignTopInset(value: value))
    }
}

private struct DesignTopInset: ViewModifier {
    @Environment(\.screenInsets) private var insets
    let value: CGFloat

    func body(content: Content) -> some View {
        content.padding(.top, max(value, insets.top + 5))
    }
}

/// 全屏安全区。由 `RootView` 量一次塞进环境 —— 各屏自己套 GeometryReader 会撑坏布局。
private struct ScreenInsetsKey: EnvironmentKey {
    static let defaultValue = EdgeInsets()
}

extension EnvironmentValues {
    var screenInsets: EdgeInsets {
        get { self[ScreenInsetsKey.self] }
        set { self[ScreenInsetsKey.self] = newValue }
    }
}
