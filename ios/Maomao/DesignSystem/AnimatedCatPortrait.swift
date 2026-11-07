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
        #if DEBUG
        PortraitPerformance.views.add(view)
        #endif
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
                    var pause = review ? 1 : Double.random(in: 2...4)
                    var blinks = 0
                    var nextLook = Int.random(in: 3...5)
                    while !Task.isCancelled {
                        let look = review ? blinks % 2 == 1 : blinks >= nextLook
                        // 利用原有动作间留白准备下一段，共享任务避免多处头像重复解码。
                        let preparation = look ? PortraitFrames.look : PortraitFrames.blink
                        try await Task.sleep(for: .seconds(pause))
                        let frames = await preparation.value
                        try Task.checkCancellation()
                        guard let view else { return }
                        #if DEBUG
                        let setupStarted = ProcessInfo.processInfo.systemUptime
                        #endif
                        let duration = Double(frames.count) / 30
                        view.animationImages = frames
                        view.animationDuration = duration
                        view.animationRepeatCount = 1
                        view.startAnimating()
                        #if DEBUG
                        PortraitPerformance.starts.append(["clip": look ? "look" : "blink", "frames": frames.count,
                            "setupMilliseconds": (ProcessInfo.processInfo.systemUptime - setupStarted) * 1000,
                            "duration": duration])
                        if PortraitPerformance.starts.count > 100 { PortraitPerformance.starts.removeFirst() }
                        #endif
                        try await Task.sleep(for: .seconds(duration))
                        view.stopAnimating()
                        view.animationImages = nil
                        view.image = PortraitFrames.rest
                        if look && !review { blinks = 0; nextLook = Int.random(in: 3...5) }
                        else { blinks += 1 }
                        // 动作之间留白，不做匀速循环或持续摆头。
                        pause = review ? 1.5 : Double.random(in: 4...7)
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

/// 多处头像共享同一组异步准备的图，不为每条聊天消息各存一份。
@MainActor private enum PortraitFrames {
    static let rest = UIImage(named: "avatar-motion-blink-00") ?? UIImage(named: "tuanzi-ui-portrait")
    static let blink = Task { await load("blink", count: 10) }
    static let look = Task { await load("look", count: 73) }
    private static func load(_ kind: String, count: Int) async -> [UIImage] {
        #if DEBUG
        let started = ProcessInfo.processInfo.systemUptime
        var preparedCount = 0
        #endif
        var frames: [UIImage] = []
        for index in 0..<count {
            guard let image = UIImage(named: String(format: "avatar-motion-%@-%02d", kind, index)) else { continue }
            // 系统在后台解码；逐张等待，不为一组帧创建大量并发解码工作。
            let prepared = await image.byPreparingForDisplay()
            frames.append(prepared ?? image)
            #if DEBUG
            if prepared != nil { preparedCount += 1 }
            #endif
        }
        #if DEBUG
        PortraitPerformance.preparations.append(["clip": kind, "frames": frames.count, "preparedFrames": preparedCount,
            "milliseconds": (ProcessInfo.processInfo.systemUptime - started) * 1000])
        #endif
        return frames
    }
}

#if DEBUG
/// 显式脚本读取实际 UIImageView 状态，不用帧图数量冒充显示帧率。
@MainActor enum PortraitPerformance {
    static let views = NSHashTable<UIImageView>.weakObjects()
    static var starts: [[String: Any]] = []
    static var preparations: [[String: Any]] = []

    static func write(label: String) {
        let values: [String: Any] = ["starts": starts, "preparations": preparations,
            "views": views.allObjects.map { ["animating": $0.isAnimating, "heldFrames": $0.animationImages?.count ?? 0,
                                             "inWindow": $0.window != nil] }]
        let safe = label.filter { $0.isLetter || $0.isNumber || $0 == "-" }
        if let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
           let data = try? JSONSerialization.data(withJSONObject: values, options: .prettyPrinted) {
            try? data.write(to: directory.appendingPathComponent("avatar-performance-" + safe + ".json"), options: .atomic)
        }
    }
}
#endif
