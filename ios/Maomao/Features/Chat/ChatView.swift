import SwiftUI
import UIKit

/// 专注聊天。无 Tab 栏，全屏。背后是团子的院子，时段和天气跟院子一致。
struct ChatView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var inputFocused: Bool
    /// 每按一次发送 +1，只用来触发轻触感。
    @State private var sendTicks = 0
    @State private var composerHeight: CGFloat = 0
    @State private var resizeScroll: Task<Void, Never>?
    @State private var browsingHistory = false
    @State private var draggingMessages = false
    @State private var nearBottom = true
    @State private var rowFrames: [String: CGRect] = [:]

    private var tone: ChatTone { ChatTone.from(store.atmosphere) }

    /// 团子这会儿在（或正走去）院子的哪一处。背景取景和名字下那行都跟它走。
    private var catDestination: WorldScene.Destination {
        let simulation = store.world.simulation
        if store.world.uses3D { return store.world.scene.destinations[store.world.moving ? store.world.targetIndex : store.world.currentIndex] }
        let index = simulation.isMoving ? simulation.target : simulation.current
        return store.world.scene.destinations[index]
    }

    var body: some View {
        ZStack {
            ChatBackground(tone: tone, place: catDestination.id, slot: store.dayPhase.rawValue, weather: store.weather.rawValue)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                header
                sourceCard
                messageList
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                inputBar
            }
            .ignoresSafeArea(.container, edges: .top)
        }
        .sheet(item: $store.withdrawnSource) { action in
            MemoryImpactView(action: action) { await store.refreshCounts() }
        }
        .environment(\.chatTone, tone)
        .animation(.easeInOut(duration: 0.6), value: tone.isDark)
        .sensoryFeedback(.impact(weight: .light), trigger: sendTicks)
        .onPreferenceChange(ComposerHeightKey.self) { composerHeight = $0 }
        .task {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-uiFocus") {
                try? await Task.sleep(for: .milliseconds(500))
                inputFocused = true
            }
            #endif
        }
    }

    // MARK: - 顶栏

    private var header: some View {
        HStack(spacing: 10) {
            Button {
                inputFocused = false
                store.screen = .home
            } label: {
                IconTile(size: Metrics.iconSlotLg, fill: tone.field, circular: true, glass: true) {
                    Icons.chevronLeft(color: tone.ink)
                }
                .contentShape(Circle())
            }
            .buttonStyle(PressScaleStyle())
            .accessibilityLabel("返回院子")

            VStack(alignment: .leading, spacing: 1) {
                Text(store.catName)
                    .font(Typo.serif(17))
                    .tracking(track(0.06, 17))
                    .foregroundStyle(tone.ink)
                Text(conditionsLine)
                    .font(Typo.sans(11.5))
                    .tracking(track(0.04, 11.5))
                    .foregroundStyle(tone.ink2)
                    .contentTransition(.opacity)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)


        }
        .padding(.leading, 12)
        .padding(.trailing, 6)
        .designTopInset(50)
    }

    /// 名字下面一行：团子在哪、这会儿是什么时候、什么天，交代背景为什么是这个样子。
    private var conditionsLine: String {
        let phase: String
        switch store.dayPhase {
        case .dawn: phase = "清晨"
        case .day: phase = "白天"
        case .dusk: phase = "黄昏"
        case .evening: phase = "入夜"
        case .night: phase = "夜里"
        }
        let weather = store.weather == .rain ? "下着雨" : "晴"
        return "\(catDestination.name) · \(phase) · \(weather)"
    }

    // MARK: - 来源卡

    @ViewBuilder
    private var sourceCard: some View {
        if let source = store.chatSource {
            HStack(spacing: 10) {
                Icons.paw(color: Palette.pawMark)

                VStack(alignment: .leading, spacing: 2) {
                    Text(source.kicker)
                        .font(Typo.sans(10.5))
                        .tracking(track(0.06, 10.5))
                        .foregroundStyle(Palette.paperInk)
                    Text(source.text)
                        .font(Typo.sans(13))
                        .foregroundStyle(Palette.ink)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Button {
                    withAnimation(.easeOut(duration: Metrics.fadeFast)) {
                        store.chatSource = nil
                    }
                } label: {
                    Icons.chevronUp(color: Palette.paperInk)
                        .frame(width: Metrics.minTap, height: Metrics.minTap)
                        .contentShape(Rectangle())
                }
                .buttonStyle(PressScaleStyle())
                .accessibilityLabel("收起来源")
            }
            .padding(.leading, 14)
            .padding(.vertical, 2)
            // 团子的留言纸是暖色重音，不跟底色和明暗走。
            .background(
                Palette.paper.opacity(0.94),
                in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous)
            )
            .shadow(color: Palette.chatSeparation, radius: 10, x: 0, y: 3)
            .padding(.horizontal, Metrics.gutterChat)
            .padding(.top, 10)
            .transition(.opacity)
        }
    }

    // MARK: - 消息列表

    private var latestCatGroupID: String? {
        var candidate: String?
        for message in store.messages.reversed() {
            if message.isCat { candidate = message.id }
            else if candidate != nil { break }
        }
        return candidate
    }

    private var messageList: some View {
        let animatedID = latestCatGroupID
        return GeometryReader { proxy in
            ScrollViewReader { scroller in
                ScrollView {
                    LazyVStack(spacing: 0) {
                        if store.backend.isRemote && !store.messages.isEmpty {
                            Button {
                                browsingHistory = true
                                // 取下一条可见消息，避开第一页首行在插入后新增的分组间距。
                                let candidates = store.messages.dropFirst().compactMap { message -> (String, CGRect)? in
                                    guard let frame = rowFrames[message.id], frame.minY >= 0, frame.minY < proxy.size.height else { return nil }
                                    return (message.id, frame)
                                }
                                let anchor = candidates.min { $0.1.minY < $1.1.minY }
                                let generation = store.historyGeneration
                                Task { @MainActor in
                                    guard await store.loadEarlierMessages(), store.historyGeneration == generation,
                                          let (id, frame) = anchor else { return }
                                    // 先让旧页进入布局，再显式恢复同一消息的屏幕位置。
                                    await Task.yield()
                                    let y = frame.minY / max(1, proxy.size.height - frame.height)
                                    var transaction = Transaction()
                                    transaction.disablesAnimations = true
                                    withTransaction(transaction) {
                                        scroller.scrollTo(id, anchor: UnitPoint(x: 0.5, y: y))
                                    }
                                }
                            } label: {
                                HStack(spacing: 6) {
                                    if store.isLoadingEarlierMessages { ProgressView().tint(tone.ink2) }
                                    Text(store.historyLoadError ?? (store.isLoadingEarlierMessages ? "正在加载…" : (store.hasEarlierMessages ? "更早的消息" : "已经到最早的消息了")))
                                        .font(Typo.sans(11.5))
                                }
                                .foregroundStyle(tone.ink2)
                                .frame(maxWidth: .infinity, minHeight: Metrics.minTap)
                            }
                            .buttonStyle(.plain)
                            .disabled(!store.hasEarlierMessages || store.isLoadingEarlierMessages)
                        }
                        ForEach(Array(store.messages.enumerated()), id: \.element.id) { index, message in
                            let startsGroup = index == 0 || store.messages[index - 1].role != message.role
                            MessageRow(
                                message: message,
                                showsAvatar: message.isCat && startsGroup,
                                availableWidth: proxy.size.width - Metrics.gutterChat * 2,
                                animatesAvatar: message.id == animatedID && !store.isWaiting
                            )
                            // 同一人连着说贴近一点，换人留出呼吸。
                            .padding(.top, index == 0 ? 0 : (startsGroup ? 16 : 5))
                            .id(message.id)
                            .background(GeometryReader { row in
                                Color.clear.preference(key: ChatRowFramesKey.self, value: [message.id: row.frame(in: .named("chat-scroll"))])
                            })
                            .transition(messageTransition)
                        }

                        if store.isWaiting {
                            TypingIndicator(showsAvatar: store.messages.last?.isCat != true)
                                .padding(.top, store.messages.last?.isCat == true ? 5 : 16)
                                .id(Self.waitingAnchor)
                                .transition(.opacity)
                        }
                    }
                    .scrollTargetLayout()
                    .padding(.horizontal, Metrics.gutterChat)
                    .padding(.top, 20)
                    .padding(.bottom, 12)
                    .background(GeometryReader { content in
                        Color.clear.preference(key: ChatBottomKey.self, value: content.frame(in: .named("chat-scroll")).maxY)
                    })
                    .animation(.easeOut(duration: 0.24), value: store.messages.count)
                    .animation(.easeOut(duration: Metrics.fadeFast), value: store.isWaiting)
                }
                .coordinateSpace(name: "chat-scroll")
                .scrollDismissesKeyboard(.interactively)
                .simultaneousGesture(TapGesture().onEnded { inputFocused = false })
                .simultaneousGesture(DragGesture(minimumDistance: 4)
                    .onChanged { _ in
                        draggingMessages = true
                        browsingHistory = !nearBottom
                    }
                    .onEnded { _ in draggingMessages = false }
                )
                // 消息滚到顶栏下方时淡出，而不是被一条硬边切掉。
                .mask(
                    LinearGradient(
                        stops: [.init(color: .clear, location: 0), .init(color: .black, location: 0.05)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .onPreferenceChange(ChatRowFramesKey.self) { rowFrames = $0 }
                .onPreferenceChange(ChatBottomKey.self) { bottom in
                    nearBottom = bottom <= proxy.size.height + 48
                    // 只有用户拖动才进入翻历史；键盘、草稿和新消息改变尺寸时继续跟随。
                    if draggingMessages || nearBottom { browsingHistory = !nearBottom }
                }
                .onChange(of: store.notificationMessageID) { _, id in
                    guard let id else { return }
                    browsingHistory = true
                    scroller.scrollTo(id, anchor: .center)
                }
                .onChange(of: store.backend) { browsingHistory = false }
                .onChange(of: store.messages.last?.id) { if !browsingHistory { scrollToBottom(scroller) } }
                .onChange(of: store.messages.last?.text) { if !browsingHistory { scrollToBottom(scroller, animated: false) } }
                .onChange(of: store.isWaiting) { if !browsingHistory { scrollToBottom(scroller) } }
                .onChange(of: composerHeight) { if !browsingHistory { scrollAfterResize(scroller) } }
                .onChange(of: proxy.size.height) { if !browsingHistory { scrollAfterResize(scroller) } }
                .onDisappear { resizeScroll?.cancel() }
                .onAppear {
                    if let id = store.notificationMessageID { browsingHistory = true; scroller.scrollTo(id, anchor: .center) }
                    else { browsingHistory = false; scrollToBottom(scroller, animated: false) }
                }
            }
        }
        .clipped()
    }

    /// 新消息从下方 8pt 淡入；减少动态效果时只淡入。
    private var messageTransition: AnyTransition {
        reduceMotion ? .opacity : .opacity.combined(with: .offset(y: 8))
    }

    private static let waitingAnchor = "waiting"

    private func scrollToBottom(_ scroller: ScrollViewProxy, animated: Bool = true) {
        let target = store.isWaiting ? Self.waitingAnchor : store.messages.last?.id
        guard let target else { return }
        if animated {
            withAnimation(.easeOut(duration: Metrics.fadeFast)) {
                scroller.scrollTo(target, anchor: .bottom)
            }
        } else {
            scroller.scrollTo(target, anchor: .bottom)
        }
    }

    /// 键盘与多行输入改变可用高度后，再定位最后一条，避免使用动画前的列表尺寸。
    private func scrollAfterResize(_ scroller: ScrollViewProxy) {
        resizeScroll?.cancel()
        resizeScroll = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            scrollToBottom(scroller, animated: false)
        }
    }

    // MARK: - 输入区

    private var canSend: Bool { !store.draft.trimmed.isEmpty }

    private var inputBar: some View {
        HStack(spacing: 4) {
            TextField("", text: $store.draft, prompt: Text("说点什么").foregroundStyle(tone.placeholder), axis: .vertical)
                .lineLimit(1...5)
                .frame(maxWidth: .infinity, alignment: .leading)
                .font(Typo.sans(15))
                .foregroundStyle(tone.ink)
                .tint(Palette.accent)
                .focused($inputFocused)
                .submitLabel(.send)
                .onSubmit(send)
                .padding(.vertical, 14)

            // 发送键收在框里：视觉是 30pt 的珊瑚圆，热区仍是 minTap。没字时变浅、不可点。
            Button {
                if store.isStreaming { store.stopStreaming() } else { send() }
            } label: {
                ZStack {
                    Circle()
                        .fill(Palette.accent)
                        .frame(width: 30, height: 30)
                    if store.isStreaming {
                        Icons.stopSquare(size: IconSize.sm, color: Palette.accentInk)
                    } else {
                        Icons.sendArrow(size: IconSize.sm, color: Palette.accentInk)
                    }
                }
                .opacity(canSend || store.isStreaming ? 1 : 0.38)
                .frame(width: Metrics.minTap, height: Metrics.minTap)
                .contentShape(Rectangle())
            }
            .buttonStyle(PressScaleStyle())
            .disabled(!canSend && !store.isStreaming)
            .accessibilityLabel(store.isStreaming ? "停止" : "发送")
        }
        .padding(.leading, 18)
        .padding(.trailing, 2)
        .animation(.easeOut(duration: Metrics.fadeFast), value: canSend)
        // 和气泡同一种面：半透明、不描边、不发光，只有一层极轻的软投影。
        .background(tone.field, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: tone.separation, radius: 12, x: 0, y: 4)
        .background(GeometryReader { proxy in
            Color.clear.preference(key: ComposerHeightKey.self, value: proxy.size.height)
        })
        .padding(.horizontal, 14)
        .padding(.top, 8)
        .padding(.bottom, 8)
    }

    private func send() {
        guard canSend else { return }
        browsingHistory = false
        sendTicks += 1
        store.send()
    }
}

/// 等待回复：三点错开 0 / .18s / .36s。
struct TypingIndicator: View {
    @Environment(\.chatTone) private var tone
    let showsAvatar: Bool
    @State private var animating = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            CatWindowAvatar(image: "tuanzi-ui-portrait", animated: showsAvatar)
                .opacity(showsAvatar ? 1 : 0)

            HStack(spacing: 5) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(tone.dot)
                        .frame(width: 6, height: 6)
                        .opacity(animating ? 1 : 0.3)
                        .animation(
                            .easeInOut(duration: 0.55)
                                .repeatForever(autoreverses: true)
                                .delay(Double(index) * 0.18),
                            value: animating
                        )
                }
            }
            .padding(.horizontal, 16)
            .frame(height: 42)
            .background(tone.bubbleCat, in: RoundedRectangle(cornerRadius: Metrics.radiusLg, style: .continuous))
            .shadow(color: tone.separation, radius: 10, x: 0, y: 3)

            Spacer(minLength: 0)
        }
        .onAppear { animating = !reduceMotion }
        .onChange(of: reduceMotion) { animating = !reduceMotion }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("团子正在回复")
    }
}

private struct ComposerHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

private struct ChatBottomKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

private struct ChatRowFramesKey: PreferenceKey {
    static var defaultValue: [String: CGRect] = [:]
    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
        value.merge(nextValue(), uniquingKeysWith: { _, new in new })
    }
}
