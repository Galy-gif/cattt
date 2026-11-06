import SwiftUI
import UIKit

/// 正式3D模型生成的局部动作。静止时没有逐帧时钟，后台/离屏/减少动态效果立即停播。
struct AnimatedCatPortrait: View {
    var animated = true
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var visible = false

    var body: some View {
        PortraitPlayback(active: animated && visible && scenePhase == .active && !reduceMotion)
            .aspectRatio(1, contentMode: .fit)
            .onAppear { visible = true }
            .onDisappear { visible = false }
            .accessibilityHidden(true)
    }
}

private struct PortraitPlayback: UIViewRepresentable {
    let active: Bool

    func makeUIView(context: Context) -> PortraitImageView {
        let view = PortraitImageView()
        view.contentMode = .scaleAspectFit
        view.isAccessibilityElement = false
        view.image = PortraitFrames.rest
        return view
    }

    func updateUIView(_ view: PortraitImageView, context: Context) {
        context.coordinator.update(view, active: active)
    }

    func makeCoordinator() -> Coordinator { Coordinator() }
    static func dismantleUIView(_ view: PortraitImageView, coordinator: Coordinator) {
        coordinator.stop(view)
    }

    @MainActor final class Coordinator {
        private var task: Task<Void, Never>?
        private var running = false

        func update(_ view: PortraitImageView, active: Bool) {
            guard active != running else { return }
            stop(view)
            guard active else { return }
            running = true
            task = Task { @MainActor [weak view] in
                do {
                    #if DEBUG
                    let review = ProcessInfo.processInfo.arguments.contains("-avatarReview")
                    #else
                    let review = false
                    #endif
                    try await Task.sleep(for: .seconds(review ? 1 : Double.random(in: 2...4)))
                    var blinks = 0
                    var nextLook = Int.random(in: 3...5)
                    while !Task.isCancelled {
                        guard let view else { return }
                        let look = review ? blinks % 2 == 1 : blinks >= nextLook
                        let frames = look ? PortraitFrames.look : PortraitFrames.blink
                        let duration = Double(frames.count) / 30
                        view.animationImages = frames
                        view.animationDuration = duration
                        view.animationRepeatCount = 1
                        view.startAnimating()
                        try await Task.sleep(for: .seconds(duration))
                        view.stopAnimating()
                        view.animationImages = nil
                        view.image = PortraitFrames.rest
                        if look && !review { blinks = 0; nextLook = Int.random(in: 3...5) }
                        else { blinks += 1 }
                        // 动作之间留白，不做匀速循环或持续摆头。
                        try await Task.sleep(for: .seconds(review ? 1.5 : Double.random(in: 4...7)))
                    }
                } catch { /* 离屏或后台取消，stop 已复位。 */ }
            }
        }

        func stop(_ view: PortraitImageView) {
            task?.cancel(); task = nil; running = false
            view.stopAnimating(); view.animationImages = nil
            view.image = PortraitFrames.rest
        }
    }
}

private final class PortraitImageView: UIImageView {
    override var intrinsicContentSize: CGSize { .zero }
}

/// 多处头像共享同一组解码图，不为每条聊天消息各存一份。
@MainActor private enum PortraitFrames {
    static let rest = UIImage(named: "avatar-motion-blink-00") ?? UIImage(named: "tuanzi-ui-portrait")
    static let blink = load("blink", count: 10)
    static let look = load("look", count: 73)
    private static func load(_ kind: String, count: Int) -> [UIImage] {
        (0..<count).compactMap { UIImage(named: String(format: "avatar-motion-%@-%02d", kind, $0)) }
    }
}
