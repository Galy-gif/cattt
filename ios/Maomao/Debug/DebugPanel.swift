#if DEBUG
import SwiftUI

/// 调试入口。**只进 DEBUG 构建**，Release 里整个文件是空的。
///
/// 原型是手机右边一块常驻面板；真机上没有那块地方，所以收成右上角一枚小胶囊，
/// 点开是底部抽屉。胶囊可以收起成一个几乎看不见的小点，再点一下又出来 ——
/// 不会挡住界面，也不会找不回来。
struct DebugChip: View {
    @EnvironmentObject private var store: AppStore
    @AppStorage("debug.chipVisible") private var chipVisible = true
    @State private var showPanel = false

    var body: some View {
        ZStack(alignment: .topTrailing) {
            if showPanel {
                // 点面板以外的地方收起。透明层，不压暗画面。
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture { close() }

                DebugPanel(onDismiss: close)
                    .environmentObject(store)
                    .frame(width: 272)
                    .frame(maxHeight: 520, alignment: .top)
                    .designTopInset(240)
                    .padding(.trailing, 12)
                    .transition(.opacity)
            }

            handle
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
    }

    /// 常驻的只是一枚小点：认得出、点得到、不抢画面。长按彻底收起，再点回来。
    private var handle: some View {
        Circle()
            .fill(Palette.onSceneRail)
            .frame(width: chipVisible ? 13 : 7, height: chipVisible ? 13 : 7)
            .overlay {
                if chipVisible {
                    Circle().strokeBorder(Palette.onSceneNodeRule, lineWidth: 1)
                }
            }
            .opacity(chipVisible ? 1 : 0.45)
            .padding(11)
            .contentShape(Rectangle())
            .onTapGesture {
                if chipVisible {
                    withAnimation(.easeOut(duration: Metrics.fadeFast)) { showPanel.toggle() }
                } else {
                    chipVisible = true
                }
            }
            .onLongPressGesture {
                showPanel = false
                chipVisible = false
            }
            .padding(.trailing, 6)
            // 右上角 52 那格是「我的」头像钮、112 撞日记纸的关闭钮（2026-09-10），小点挪到右边中段：
            // 院子那里是树，纸那里是空白，聊天那里最多碰到气泡边。
            .designTopInset(200)
            .accessibilityLabel("调试面板")
    }

    private func close() {
        withAnimation(.easeOut(duration: Metrics.fadeFast)) { showPanel = false }
    }
}

/// 右侧半透明悬浮面板。原来是底部抽屉，占掉半屏；改成贴右边一块小板，
/// 后面的界面还看得见 —— 调试时要看的正是界面本身的变化。
struct DebugPanel: View {
    @EnvironmentObject private var store: AppStore
    var onDismiss: () -> Void = {}

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 0) {
                    Text(store.backend.isRemote ? "DEBUG · 本机后端" : "DEBUG · MOCK")
                        .font(Typo.mono(10))
                        .tracking(track(0.14, 10))
                        .foregroundStyle(Palette.ink4)
                    Spacer(minLength: 8)
                    Icons.close(size: 13, color: Palette.ink3)
                        .padding(4)
                        .contentShape(Rectangle())
                        .onTapGesture { onDismiss() }
                        .accessibilityLabel("关闭调试面板")
                }

                group("后端") {
                    toggle("本地模拟，不连后端", isOn: store.backend.mode == .mock) { store.setBackendMode(.mock) }
                    toggle("本机后端 localhost:8787", isOn: store.backend.mode == .local) { store.setBackendMode(.local) }
                    if store.backend.isRemote {
                        TextField("开发者 token", text: $store.backend.token)
                            .font(Typo.mono(11))
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .submitLabel(.done)
                            .onSubmit { store.connectBackend() }
                            .padding(.horizontal, 11)
                            .frame(minHeight: 36)
                            .background(Palette.bg, in: RoundedRectangle(cornerRadius: Metrics.radiusCard))
                            .overlay(
                                RoundedRectangle(cornerRadius: Metrics.radiusCard)
                                    .stroke(Palette.rule, lineWidth: 1)
                            )
                        action("重新连接、拉聊天记录") { store.connectBackend() }
                        note(store.backendStatus ?? "token 在 server/ 下跑 pnpm create-dev-user 生成。")
                    }
                }

                group("世界") {
                    ForEach(Array(Location.all.enumerated()), id: \.offset) { i,location in
                        action("去"+location.name) { store.interact(with:i) }
                    }
                    action(store.world.simulation.paused ? "继续世界":"暂停世界") {store.world.togglePause()}
                    action("下一帧") {store.world.stepFrame()}
                    action("固定随机种子 42") {store.world.setSeed(42)}
                    ForEach(CatAction.allCases, id: \.rawValue) { pose in
                        action("逐帧 · "+pose.rawValue) {store.world.preview(pose.rawValue)}
                    }
                    note(store.world.simulation.phase.rawValue+" / "+store.world.simulation.action)

                    action("让团子走去别处") {
                        // 随机换到另外五个地点之一，猫会走（远了跑）过去。
                        store.moveCat(to: (store.catIndex + Int.random(in: 1...5)) % Location.all.count)
                    }
                    action("镜头回到团子") { store.findCat() }
                    note("团子在\(store.catLocation.name)，你在看\(store.viewedLocation.name)" + (store.cameraFollowsCat ? "，镜头跟随中" : "，自由镜头"))
                }

                group("团子来过") {
                    action("下一条 → 读过（脚印）") { store.advanceVisit(to: .readNoComment) }
                    action("下一条 → 有留言") { store.advanceVisit(to: .commented) }
                    action("全部回到未读") {
                        for index in store.entries.indices {
                            store.entries[index].visit = .unread
                        }
                    }
                    note(visitSummary)
                }

                group("聊天") {
                    toggle("下一条发送失败", isOn: store.forceFail) { store.forceFail.toggle() }
                    toggle("下一条回复超时", isOn: store.forceTimeout) { store.forceTimeout.toggle() }
                    note(store.backend.isRemote
                         ? "这两个开关只管本地模拟。接后端时的失败态靠真的断网、停服务来看。"
                         : "打开后回主界面发一条消息，就能看到对应的失败态。")
                }

                group("提示") {
                    action("触发话题卡") {
                        store.screen = .home
                        withAnimation(.easeOut(duration: Metrics.fade)) { store.showTopicCard = true }
                        onDismiss()
                    }
                    action("信箱旗子立起来") {
                        store.hasMail = true
                        store.announce("团子往信箱里放了点东西")
                    }
                }

                group("数据") {
                    action("从零开始（走创建）") {
                        store.startOnboarding()
                        onDismiss()
                    }
                    action("重置为种子数据") {
                        store.reseed()
                        onDismiss()
                    }
                }
            }
            .padding(16)
        }
        .scrollIndicators(.hidden)
        .background(Palette.card.opacity(0.62))
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusControl))
        .overlay(
            RoundedRectangle(cornerRadius: Metrics.radiusControl)
                .stroke(Palette.rule.opacity(0.8), lineWidth: 1)
        )
        .preferredColorScheme(.light)
    }

    private var visitSummary: String {
        let commented = store.entries.filter { $0.visit == .commented }.count
        let footprints = store.entries.filter { $0.visit == .readNoComment }.count
        let unread = store.entries.filter { $0.visit == .unread }.count
        return "\(commented) 条有留言 · \(footprints) 条只留脚印 · \(unread) 条未读"
    }

    // MARK: - 零件

    private func group<Content: View>(
        _ title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(Typo.sans(11))
                .tracking(track(0.08, 11))
                .foregroundStyle(Palette.ink3)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func action(_ title: String, perform: @escaping () -> Void) -> some View {
        Text(title)
            .font(Typo.sans(12.5))
            .foregroundStyle(Palette.ink2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 11)
            .frame(minHeight: 36)
            .background(Palette.bg, in: RoundedRectangle(cornerRadius: Metrics.radiusCard))
            .overlay(
                RoundedRectangle(cornerRadius: Metrics.radiusCard)
                    .stroke(Palette.rule, lineWidth: 1)
            )
            .contentShape(Rectangle())
            .onTapGesture(perform: perform)
    }

    private func toggle(_ title: String, isOn: Bool, perform: @escaping () -> Void) -> some View {
        Text(title)
            .font(Typo.sans(12.5))
            .foregroundStyle(isOn ? Palette.accentDark : Palette.ink2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 11)
            .frame(minHeight: 36)
            .background(
                isOn ? Palette.paper : Palette.bg,
                in: RoundedRectangle(cornerRadius: Metrics.radiusCard)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Metrics.radiusCard)
                    .stroke(isOn ? Palette.accent : Palette.rule, lineWidth: 1)
            )
            .contentShape(Rectangle())
            .onTapGesture(perform: perform)
    }

    private func note(_ text: String) -> some View {
        Text(text)
            .font(Typo.sans(11.5))
            .lineHeight(1.6, size: 11.5)
            .foregroundStyle(Palette.ink4)
            .fixedSize(horizontal: false, vertical: true)
    }
}
#endif
