import SwiftUI

/// 陪伴主页。层次自下而上：世界（长图 + 猫层）→ 状态条 → 地点轨 → 话题卡 → 找团子 → 聊会儿 → Tab 栏。
/// 猫的点按热区在 `WorldView` 里跟着猫走。
struct CompanionHomeView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        WorldView()
            .overlay(alignment: .top) { statusBar }
            .overlay(alignment: .topLeading) { LocationRail() }
            .overlay(alignment: .bottom) { topicCard }
            .overlay(alignment: .bottomLeading) { findCatLink }
            .overlay(alignment: .bottomTrailing) { chatButton }
            .ignoresSafeArea()
    }

    // MARK: - 顶部状态条

    private var statusBar: some View {
        Text(store.statusText)
            .font(Typo.sans(12.5))
            .tracking(track(0.06, 12.5))
            .foregroundStyle(Palette.ink2)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            // 和 Tab 栏同一层玻璃，只是收成一颗胶囊。
            .liquidGlass(in: Capsule(style: .continuous))
            .padding(.horizontal, 60)
            .designTopInset(58)
            .animation(.easeOut(duration: Metrics.fadeFast), value: store.statusText)
    }

    // MARK: - 话题卡

    @ViewBuilder
    private var topicCard: some View {
        // 同一时刻最多一条轻提示 —— 猫不在眼前时不弹。
        if store.showTopicCard && !store.isLost {
            HStack(spacing: 11) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("昨天没说完的")
                        .font(Typo.sans(10.5))
                        .tracking(track(0.06, 10.5))
                        .foregroundStyle(Palette.paperInk)
                    Text(SeedData.topicText)
                        .font(Typo.sans(13.5))
                        .foregroundStyle(Palette.ink)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                TextLink(text: "接着聊") { store.openTopicCard() }

                Button {
                    withAnimation(.easeOut(duration: Metrics.fadeFast)) {
                        store.showTopicCard = false
                    }
                } label: {
                    Icons.close(color: Palette.paperInk)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("关闭话题卡")
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 12)
            .background(Palette.onSceneTopic, in: RoundedRectangle(cornerRadius: Metrics.radiusCard))
            .overlay(
                RoundedRectangle(cornerRadius: Metrics.radiusCard)
                    .stroke(Palette.onSceneTopicRule, lineWidth: 1)
            )
            .padding(.horizontal, 16)
            .padding(.bottom, 186)
            .transition(.opacity)
        }
    }

    // MARK: - 找团子

    /// 猫不在这屏时才出现。原来是一行 12px 文字链，压在插画的碎绿上基本看不见 ——
    /// 换成一枚纸底圆钮，和右边的「聊会儿」同一条水平线。
    @ViewBuilder
    private var findCatLink: some View {
        if store.isLost {
            Button {
                store.findCat()
            } label: {
                Icons.findCat(color: Palette.accent)
                    .frame(width: 42, height: 42)
                    .liquidGlass(in: Circle(), interactive: true, fallback: Palette.onSceneRailOn)
                    .contentShape(Circle())
            }
            .buttonStyle(PressScaleStyle())
            .padding(.leading, 18)
            .padding(.bottom, 124)
            .transition(.opacity)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("找团子")
            .accessibilityAddTraits(.isButton)
        }
    }

    // MARK: - 聊会儿

    /// 场景上唯一的实心按钮：做成胶囊，只留字。
    /// 图标去掉了 —— 「聊会儿」三个字已经说清楚，气泡图标只是在重复一遍。
    /// 胶囊只有 38pt 高（比 minTap 矮），少压掉一条草地；热区靠 tapSlop 补到 46。
    private var chatButton: some View {
        PrimaryButton(
            height: Metrics.chatPill,
            horizontalPadding: 24,
            cornerRadius: Metrics.chatPill / 2,
            shadow: false,
            tapSlop: (Metrics.minTap - Metrics.chatPill) / 2,
            glass: true
        ) {
            store.screen = .chat
        } label: {
            Text("聊会儿")
                .font(Typo.sans(15))
                .tracking(track(0.08, 15))
        }
        .padding(.trailing, 18)
        .padding(.bottom, 118)
    }
}
