import SwiftUI

struct YardControlFrames: PreferenceKey {
    static var defaultValue: [String: CGRect] = [:]
    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) { value.merge(nextValue(), uniquingKeysWith: { _, new in new }) }
}
extension View {
    func yardControl(_ name: String) -> some View {
        background(GeometryReader { proxy in Color.clear.preference(key: YardControlFrames.self, value: [name: proxy.frame(in: .named("yard-home"))]) })
    }
}

/// 宿主放在 RootView 中；聊天、日记、我的不创建第二个网页，也不启动 2D 时钟。
struct YardHomeSurface: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.screenInsets) private var insets
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        if let runtime = store.world.yard3D {
            YardWebSurface(controller: runtime.web)
                .overlay {
                    if let failure = runtime.web.failure {
                        VStack(spacing: 12) {
                            Text("小院暂时无法打开").font(Typo.sans(14))
                            Button("重试") { runtime.retry() }.font(Typo.sans(14))
                        }
                        .padding(20).background(.regularMaterial, in: RoundedRectangle(cornerRadius: Metrics.radiusCard))
                        .accessibilityHint(failure)
                    }
                }
                .onAppear { update(runtime) }
                .onChange(of: insets) { update(runtime) }
                .onChange(of: reduceMotion) { update(runtime) }
                .ignoresSafeArea()
        }
    }
    private func update(_ runtime: YardRuntime) {
        runtime.send(["type": "viewport", "insets": ["top": max(112, insets.top + 42), "bottom": max(insets.bottom, 16) + 94, "left": 62, "right": 16]])
        runtime.send(["type": "previewMotion", "on": reduceMotion])
    }
}
