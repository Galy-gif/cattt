import SwiftUI

struct RootView: View {
    @StateObject private var store = AppStore()

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Palette.bg.ignoresSafeArea()

                screen
                    .environment(\.screenInsets, proxy.safeAreaInsets)

                if store.showsTabBar {
                    VStack {
                        Spacer(minLength: 0)
                        TabBarView()
                    }
                    .ignoresSafeArea(edges: .bottom)
                    .environment(\.screenInsets, proxy.safeAreaInsets)
                }

                // 行内轻提示。同一时刻最多一条。
                if let toast = store.toast {
                    VStack {
                        Spacer(minLength: 0)
                        ToastView(text: toast)
                            .padding(.bottom, 120)
                    }
                    .allowsHitTesting(false)
                    .transition(.opacity)
                }

                #if DEBUG
                DebugChip()
                    .environment(\.screenInsets, proxy.safeAreaInsets)
                #endif
            }
        }
        .ignoresSafeArea()
        .environmentObject(store)
        .onAppear {
            #if DEBUG
            DebugScript.run(on: store)
            #endif
        }
        // 全套令牌只有浅色一版，深色模式会把院子的地面色冲掉。
        .preferredColorScheme(.light)
    }

    @ViewBuilder
    private var screen: some View {
        if store.onboarding != nil {
            OnboardingView()
        } else {
            switch store.screen {
            case .home: CompanionHomeView()
            case .chat: ChatView()
            case .diary: DiaryTodayView()
            case .me: MeView()
            }
        }
    }
}

struct ToastView: View {
    let text: String

    var body: some View {
        Text(text)
            .font(Typo.sans(13))
            .tracking(track(0.06, 13))
            .foregroundStyle(Palette.toastText)
            .padding(.horizontal, 18)
            .padding(.vertical, 9)
            .background(Palette.toastFill, in: RoundedRectangle(cornerRadius: Metrics.radiusCard))
    }
}
