import SwiftUI

/// 专注聊天。无 Tab 栏，全屏。
struct ChatView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.screenInsets) private var insets
    @FocusState private var inputFocused: Bool

    var body: some View {
        ZStack {
            ChatBackground()
                .ignoresSafeArea()

            VStack(spacing: 0) {
                header
                sourceCard
                messageList
                inputBar
            }
            // 只忽略容器安全区，键盘照常避让。
            .ignoresSafeArea(.container, edges: [.top, .bottom])

            if store.messagePanel != nil {
                MessageActionSheet()
            }
        }
    }

    // MARK: - 顶栏

    private var header: some View {
        HStack(spacing: 12) {
            Button {
                store.screen = .home
                store.messagePanel = nil
            } label: {
                Icons.chevronLeft(color: Color(hex: 0x3F4B39))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("返回院子")

            Text(store.catName)
                .font(Typo.serif(16))
                .tracking(track(0.08, 16))
                .foregroundStyle(Palette.ink)
                .frame(maxWidth: .infinity, alignment: .leading)

            // TODO: 二级页 —— 对话记录，本版未做（见交接文档「本版未做」）。
            Text("记录")
                .font(Typo.sans(12.5))
                .foregroundStyle(Color(hex: 0x4C5945))
                .overlay(alignment: .bottom) {
                    Rectangle()
                        .fill(Color(hex: 0x4C5945, alpha: 0.5))
                        .frame(height: 1)
                        .offset(y: 2)
                }
        }
        .padding(.horizontal, Metrics.gutterChat)
        .designTopInset(52)
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
                    Icons.chevronUp(color: Palette.ink4)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("收起来源")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                Palette.paper.opacity(0.9),
                in: RoundedRectangle(cornerRadius: Metrics.radiusCard)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Metrics.radiusCard)
                    .stroke(Palette.paperRule.opacity(0.8), lineWidth: 1)
            )
            .padding(.horizontal, Metrics.gutterChat)
            .padding(.top, 12)
            .transition(.opacity)
        }
    }

    // MARK: - 消息列表

    private var messageList: some View {
        GeometryReader { proxy in
            ScrollViewReader { scroller in
                ScrollView {
                    LazyVStack(spacing: 13) {
                        ForEach(Array(store.messages.enumerated()), id: \.element.id) { index, message in
                            MessageRow(
                                message: message,
                                // 仅每段猫消息的第一条显示头像。
                                showsAvatar: message.isCat
                                    && (index == 0 || store.messages[index - 1].role != .cat),
                                availableWidth: proxy.size.width - Metrics.gutterChat * 2
                            )
                            .id(message.id)
                        }

                        if store.isWaiting {
                            TypingIndicator()
                                .id(Self.waitingAnchor)
                        }
                    }
                    .padding(.horizontal, Metrics.gutterChat)
                    .padding(.top, 18)
                    .padding(.bottom, 8)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: store.messages.count) { scrollToBottom(scroller) }
                .onChange(of: store.messages.last?.text) { scrollToBottom(scroller) }
                .onChange(of: store.isWaiting) { scrollToBottom(scroller) }
                .onAppear { scrollToBottom(scroller, animated: false) }
            }
        }
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

    private var inputBar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 10) {
                TextField("说点什么", text: $store.draft)
                    .font(Typo.sans(15))
                    .foregroundStyle(Palette.ink)
                    .focused($inputFocused)
                    .submitLabel(.send)
                    .onSubmit { store.send() }

                // TODO: 后端 —— 语音输入走服务端转写。
                Icons.mic(color: Palette.ink4)
            }
            .padding(.horizontal, 16)
            .frame(minHeight: Metrics.minTap)
            // 参考图二下半部分的行卡：白底、圆角 14 的矩形、软投影、不描边。不是药丸。
            .liquidGlass(
                in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous),
                fallback: Palette.chatField
            )

            Button {
                store.sendOrStop()
            } label: {
                ZStack {
                    if store.isStreaming {
                        Icons.stopSquare(color: Palette.accentInk)
                    } else {
                        Icons.sendArrow(color: Palette.accentInk)
                    }
                }
                .frame(width: Metrics.minTap, height: Metrics.minTap)
                // 参考图里唯一的珊瑚色实心块是底栏选中态，圆角方块 —— 发送键照它做。
                .liquidGlass(
                    in: RoundedRectangle(cornerRadius: Metrics.radiusControl, style: .continuous),
                    tint: Palette.accent,
                    interactive: true,
                    fallback: Palette.accent
                )
            }
            .buttonStyle(PressScaleStyle())
            .accessibilityLabel(store.isStreaming ? "停止" : "发送")
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .padding(.bottom, max(30, insets.bottom))
        // 参考图全图没有一条发丝线，输入栏靠卡片自己的投影和背景分开。
        // iOS 26 上底透掉，消息列表从玻璃底下穿过。
        .background(GlassAware.barFill)
    }
}

/// 等待回复：三点错开 0 / .18s / .36s。
struct TypingIndicator: View {
    @State private var animating = false

    var body: some View {
        HStack(spacing: 9) {
            Color.clear.frame(width: 34, height: 1)

            HStack(spacing: 5) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(Palette.chatDot)
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
            .padding(.vertical, 14)
            .background(
                Palette.chatBubbleCat,
                in: UnevenRoundedRectangle(
                    topLeadingRadius: 3,
                    bottomLeadingRadius: 12,
                    bottomTrailingRadius: 12,
                    topTrailingRadius: 12
                )
            )

            Spacer(minLength: 0)
        }
        .onAppear { animating = true }
        .accessibilityLabel("团子正在回复")
    }
}
