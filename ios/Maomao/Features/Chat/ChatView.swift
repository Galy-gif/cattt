import SwiftUI
import UIKit

/// 专注聊天。无 Tab 栏，全屏。背后是团子的院子，时段和天气跟院子一致。
struct ChatView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.screenInsets) private var insets
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var inputFocused: Bool
    /// 每按一次发送 +1，只用来触发轻触感。
    @State private var sendTicks = 0
    /// 键盘露出屏幕的高度。`RootView` 整个 ZStack 忽略了安全区（包括键盘），系统不会替这一页避让，只能自己量。
    @State private var keyboardHeight: CGFloat = 0

    private var tone: ChatTone { ChatTone.from(store.atmosphere) }

    /// 团子这会儿在（或正走去）院子的哪一处。背景取景和名字下那行都跟它走。
    private var catDestination: WorldScene.Destination {
        let simulation = store.world.simulation
        let index = simulation.isMoving ? simulation.target : simulation.current
        return store.world.scene.destinations[index]
    }

    var body: some View {
        ZStack {
            ChatBackground(atmosphere: store.atmosphere, tone: tone, cameraX: catDestination.cameraX)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                header
                sourceCard
                messageList
                inputBar
            }
            // 只忽略容器安全区，键盘照常避让。
            .ignoresSafeArea(.container, edges: [.top, .bottom])
        }
        .environment(\.chatTone, tone)
        .animation(.easeInOut(duration: 0.6), value: tone.isDark)
        .sensoryFeedback(.impact(weight: .light), trigger: sendTicks)
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillChangeFrameNotification)) { note in
            guard let frame = note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
            let screen = UIScreen.main.bounds.height
            let duration = note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25
            withAnimation(.easeOut(duration: duration)) {
                keyboardHeight = max(0, screen - frame.minY)
            }
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

            // TODO: 二级页 —— 对话记录，本版未做（见交接文档「本版未做」）。
            Text("记录")
                .font(Typo.sans(13))
                .foregroundStyle(tone.ink2)
                .padding(.horizontal, 10)
                .frame(minHeight: Metrics.minTap)
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

    private var messageList: some View {
        GeometryReader { proxy in
            ScrollViewReader { scroller in
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(Array(store.messages.enumerated()), id: \.element.id) { index, message in
                            let startsGroup = index == 0 || store.messages[index - 1].role != message.role
                            MessageRow(
                                message: message,
                                showsAvatar: message.isCat && startsGroup,
                                availableWidth: proxy.size.width - Metrics.gutterChat * 2
                            )
                            // 同一人连着说贴近一点，换人留出呼吸。
                            .padding(.top, index == 0 ? 0 : (startsGroup ? 16 : 5))
                            .id(message.id)
                            .transition(messageTransition)
                        }

                        if store.isWaiting {
                            TypingIndicator(showsAvatar: store.messages.last?.isCat != true)
                                .padding(.top, store.messages.last?.isCat == true ? 5 : 16)
                                .id(Self.waitingAnchor)
                                .transition(.opacity)
                        }
                    }
                    .padding(.horizontal, Metrics.gutterChat)
                    .padding(.top, 20)
                    .padding(.bottom, 12)
                    .animation(.easeOut(duration: 0.24), value: store.messages.count)
                    .animation(.easeOut(duration: Metrics.fadeFast), value: store.isWaiting)
                }
                .scrollDismissesKeyboard(.interactively)
                .simultaneousGesture(TapGesture().onEnded { inputFocused = false })
                // 消息滚到顶栏下方时淡出，而不是被一条硬边切掉。
                .mask(
                    LinearGradient(
                        stops: [.init(color: .clear, location: 0), .init(color: .black, location: 0.05)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .onChange(of: store.messages.count) { scrollToBottom(scroller) }
                .onChange(of: store.messages.last?.text) { scrollToBottom(scroller, animated: false) }
                .onChange(of: store.isWaiting) { scrollToBottom(scroller) }
                .onChange(of: keyboardHeight) { if keyboardHeight > 0 { scrollToBottom(scroller) } }
                .onAppear { scrollToBottom(scroller, animated: false) }
            }
        }
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

    // MARK: - 输入区

    private var canSend: Bool { !store.draft.trimmed.isEmpty }

    private var inputBar: some View {
        HStack(spacing: 4) {
            TextField("", text: $store.draft, prompt: Text("说点什么").foregroundStyle(tone.placeholder), axis: .vertical)
                .lineLimit(1...5)
                .font(Typo.sans(15))
                .foregroundStyle(tone.ink)
                .tint(Palette.accent)
                .focused($inputFocused)
                .submitLabel(.send)
                .onSubmit(send)
                .padding(.vertical, 14)

            // TODO: 后端 —— 语音输入走服务端转写。
            if !canSend && !store.isStreaming {
                Icons.mic(color: tone.placeholder)
                    .frame(width: 36, height: Metrics.minTap)
                    .transition(.opacity)
                    .accessibilityHidden(true)
            }

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
        .padding(.horizontal, 14)
        .padding(.top, 8)
        .padding(.bottom, keyboardHeight > 0 ? keyboardHeight + 8 : max(24, insets.bottom))
    }

    private func send() {
        guard canSend else { return }
        sendTicks += 1
        store.send()
    }
}

/// 等待回复：三点错开 0 / .18s / .36s。
struct TypingIndicator: View {
    @Environment(\.chatTone) private var tone
    let showsAvatar: Bool
    @State private var animating = false

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            CatWindowAvatar(image: "tuanzi-canonical")
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
        .onAppear { animating = true }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("团子正在回复")
    }
}
