import SwiftUI

/// 三项：陪伴 / 日记 / 我的。聊天屏和创建流程不显示。
///
/// 参考图一的底栏：一条悬浮的白色圆角条，左右内缩，只有图标没有文字，
/// 选中项坐在一块珊瑚色圆角方块上 —— 那是全屏唯一的珊瑚实心块。
/// 内容在它底下穿过去，所以主页的场景图也直接铺到屏幕最底。
struct TabBarView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.screenInsets) private var insets

    static let barHeight: CGFloat = 60
    static let sideInset: CGFloat = 20
    static let selectedTile: CGFloat = 42

    /// 条离屏幕底边的距离：有 Home Indicator 的机型贴着安全区，平底机型留 16。
    static func bottomMargin(_ safeAreaBottom: CGFloat) -> CGFloat {
        max(safeAreaBottom, 16)
    }

    /// 内容要让出的高度：条本身 + 底边距 + 一点呼吸。
    static func height(bottomInset: CGFloat) -> CGFloat {
        barHeight + bottomMargin(bottomInset) + 8
    }

    var body: some View {
        HStack(spacing: 0) {
            item(.home, label: "陪伴") { Icons.tabCompanion(color: $0) }
            item(.diary, label: "日记", dot: store.diaryDot) { Icons.tabDiary(color: $0) }
            item(.me, label: "我的") { Icons.tabMe(color: $0) }
        }
        .padding(.horizontal, 10)
        .frame(height: Self.barHeight)
        // 2026-09-09：白条改原生玻璃，场景和列表从底下透上来；选中态仍是那块唯一的珊瑚实心。
        .liquidGlass(in: RoundedRectangle(cornerRadius: 22, style: .continuous), fallback: Palette.card)
        .padding(.horizontal, Self.sideInset)
        .padding(.bottom, Self.bottomMargin(insets.bottom))
    }

    private func item<Icon: View>(
        _ screen: AppStore.Screen,
        label: String,
        dot: Bool = false,
        @ViewBuilder icon: (Color) -> Icon
    ) -> some View {
        let selected = store.screen == screen
        return Button {
            store.screen = screen
            if screen == .diary { store.diaryDot = false }
        } label: {
            ZStack(alignment: .topTrailing) {
                icon(selected ? Palette.accentInk : Palette.ink2)
                    .frame(width: Self.selectedTile, height: Self.selectedTile)
                    .background {
                        if selected {
                            RoundedRectangle(cornerRadius: Metrics.radiusControl, style: .continuous)
                                .fill(Palette.accent)
                        }
                    }
                if dot {
                    Circle()
                        .fill(Palette.accent)
                        .frame(width: 7, height: 7)
                        .offset(x: 1, y: 1)
                }
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressScaleStyle())
        .animation(.easeOut(duration: Metrics.fadeFast), value: selected)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}
