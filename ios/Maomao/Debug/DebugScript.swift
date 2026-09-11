import SwiftUI

#if DEBUG
/// 启动参数脚本：没有模拟器面板时也能驱动世界层做验收截图。
///
/// ```
/// xcrun simctl launch booted com.maomao.app -script "500:moveCat:4;9000:poke;12000:look:0;14000:findCat"
/// ```
/// 每条 `延迟ms:命令[:参数]`，延迟从启动起算。命令：moveCat:i、look:i、findCat、poke、drag:dx（pt）、screen:home|chat|mailbox|me、mail、reseed，
/// 以及聊天：backend:mock|local、send:文本（文本里不能有冒号和分号）、stop、boundary（把最后一条猫消息标成不要再提）。
enum DebugScript {
    static func run(on store: AppStore) {
        guard let raw = UserDefaults.standard.string(forKey: "script"), !raw.isEmpty else { return }
        for item in raw.split(separator: ";") {
            let parts = item.split(separator: ":").map(String.init)
            guard parts.count >= 2, let delay = Int(parts[0]) else { continue }
            let command = parts[1]
            let arg = parts.count > 2 ? parts[2] : ""
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: UInt64(delay) * 1_000_000)
                switch command {
                case "moveCat": if let i = Int(arg) { store.moveCat(to: i) }
                case "look": if let i = Int(arg) { store.look(at: i) }
                case "findCat": store.findCat()
                case "poke": store.poke()
                case "drag":
                    if let dx = Double(arg) {
                        store.dragCamera(translation: CGFloat(dx))
                        store.endDrag(velocity: 0)
                    }
                case "snapshot": store.world.writeSnapshot(label:arg);store.writeCameraSnapshot(label:arg)
                case "place": if let i=Int(arg) {store.world.placeForReview(i)}
                case "screen":
                    switch arg {
                    case "home":store.screen = .home
                    case "chat":store.screen = .chat
                    // 日记和我的不再是整屏：信箱抽纸 / 右上角 sheet。锚点给个信箱大概的位置。
                    case "mailbox":store.openMailbox(anchor:CGPoint(x:44,y:490))
                    case "me":store.showsMe = true
                    default:break
                    }
                case "mail": store.hasMail = true
                case "pause": store.world.togglePause()
                case "frame": store.world.stepFrame()
                case "seed": if let seed=UInt64(arg) {store.world.setSeed(seed)}
                case "action": if CatAction(rawValue:arg) != nil {store.world.preview(arg)}
                case "reseed": store.reseed()
                case "backend": if let mode = BackendConfig.Mode(rawValue: arg) { store.setBackendMode(mode) }
                case "send":
                    store.draft = arg
                    store.send()
                case "stop": store.stopStreaming()
                case "boundary":
                    if let last = store.messages.last(where: { $0.isCat }) {
                        store.messagePanel = AppStore.MessagePanel(id: last.id, isCat: true)
                        store.markBoundary()
                    }
                default: print("DebugScript: 未知命令 \(command)")
                }
            }
        }
    }
}
#endif
