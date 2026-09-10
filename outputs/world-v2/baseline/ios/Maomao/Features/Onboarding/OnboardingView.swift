import SwiftUI

/// 创建流程：欢迎 → 选外观 1/4 → 气质 2/4 → 命名 3/4 → 初次见面 4/4。
struct OnboardingView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()

            VStack(spacing: 0) {
                if let step = store.onboarding, step != .welcome, step != .firstMeeting {
                    progressHeader(step: step)
                }

                switch store.onboarding {
                case .welcome: WelcomeStep()
                case .pickCat: PickAppearanceStep()
                case .temperament: TemperamentStep()
                case .naming: NamingStep()
                case .firstMeeting: FirstMeetingStep()
                case nil: EmptyView()
                }
            }
            .ignoresSafeArea(.container, edges: [.top, .bottom])
        }
    }

    /// 返回箭头 + 3px 进度轨（宽度 = 步数 × 25%）+ 右侧 n / 4 计数。
    private func progressHeader(step: AppStore.OnboardingStep) -> some View {
        HStack(spacing: 14) {
            Button { store.onboardingBack() } label: {
                Icons.chevronLeft(color: Palette.ink3)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("上一步")

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Palette.rule)
                    Capsule()
                        .fill(Palette.accent)
                        .frame(width: proxy.size.width * CGFloat(step.stepNumber) * 0.25)
                }
            }
            .frame(height: 3)

            Text("\(step.stepNumber) / 4")
                .font(Typo.sans(11.5))
                .tabularNumbers()
                .foregroundStyle(Palette.ink3)
        }
        .padding(.horizontal, Metrics.gutterOnboarding)
        .designTopInset(56)
    }
}

/// A0 欢迎 —— 反预期声明，是产品定位的一部分，不要删。
struct WelcomeStep: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)

            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 16) {
                    Text("养一只\n只属于你的猫")
                        .font(Typo.serif(32, bold: true))
                        .lineHeight(1.42, size: 32)
                        .foregroundStyle(Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)

                    Text("它有自己的性格，会记得你说过的事，\n也会在你不在的时候过自己的日子。")
                        .font(Typo.sans(15))
                        .lineHeight(1.95, size: 15)
                        .foregroundStyle(Palette.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Rectangle()
                    .fill(Palette.rule)
                    .frame(height: 1)

                VStack(alignment: .leading, spacing: 13) {
                    Text("这里没有")
                        .font(Typo.sans(12.5))
                        .tracking(track(0.1, 12.5))
                        .foregroundStyle(Palette.ink3)

                    WrappingChips(
                        items: ["每日打卡", "等级和金币", "喂养任务", "连续天数"],
                        chipSize: 13.5,
                        chipColor: Palette.ink3,
                        verticalPadding: 6,
                        horizontalPadding: 12
                    )

                    Text("你几天不来，它不会掉状态，也不会怪你。")
                        .font(Typo.sans(13.5))
                        .lineHeight(1.9, size: 13.5)
                        .foregroundStyle(Palette.ink3)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 30)

            Spacer(minLength: 0)

            VStack(spacing: 15) {
                PrimaryButton {
                    store.onboardingNext()
                } label: {
                    Text("去认领一只")
                        .font(Typo.sans(16))
                        .tracking(track(0.1, 16))
                }

                // TODO: 后端 —— 登录流程本版未做。
                TextLink(
                    text: "已经有猫了，登录",
                    size: 13.5,
                    color: Palette.ink3,
                    ruleColor: Color(hex: 0xA7B2A0),
                    underlineGap: 3
                ) {
                    store.flash("登录还没接")
                }
            }
            .padding(.horizontal, 30)
            .padding(.bottom, 44)
        }
    }
}
