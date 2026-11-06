import SwiftUI

/// A4 初次见面 3/3。全屏草丛场景，对话气泡逐条淡入。
///
/// 这一屏的意义：**第一句话由猫先说** —— 用户是被认领的一方，不是操作者。
struct FirstMeetingStep: View {
    @EnvironmentObject private var store: AppStore
    @FocusState private var focused: Bool
    @State private var keyboardHeight: CGFloat = 0

    var body: some View {
        GeometryReader { proxy in
            let contentWidth = proxy.size.width - Metrics.gutterOnboarding * 2

            ZStack {
                Image("meeting-3d")
                    .resizable()
                    .scaledToFill()
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .clipped()

                bubbles(maxBubbleWidth: contentWidth * 0.84)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)

                footer
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)

            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .ignoresSafeArea()
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillChangeFrameNotification)) { note in
            guard let frame = note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
            let duration = note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25
            withAnimation(.easeOut(duration: duration)) {
                keyboardHeight = max(0, UIScreen.main.bounds.height - frame.minY)
            }
        }
    }

    private func bubbles(maxBubbleWidth: CGFloat) -> some View {
        VStack(spacing: 10) {
            ForEach(store.meetLines) { line in
                HStack(spacing: 0) {
                    if !line.isCat { Spacer(minLength: 0) }

                    Text(line.text)
                        .font(Typo.sans(15.5))
                        .lineHeight(1.85, size: 15.5)
                        .foregroundStyle(Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 17)
                        .padding(.vertical, 14)
                        .background(
                            line.isCat ? Palette.card.opacity(0.96) : Palette.chatBubbleUser,
                            in: RoundedRectangle(cornerRadius: Metrics.radiusLg, style: .continuous)
                        )
                        .frame(maxWidth: maxBubbleWidth)

                    if line.isCat { Spacer(minLength: 0) }
                }
                .transition(.opacity)
            }
        }
        .padding(.horizontal, Metrics.gutterOnboarding)
        .padding(.bottom, keyboardHeight > 0 ? keyboardHeight + 80 : 116)
    }

    @ViewBuilder
    private var footer: some View {
        if store.meetDone {
            PrimaryButton(height: Metrics.primaryButtonShort, subtle: true) {
                store.enterYard()
            } label: {
                Text("进院子")
                    .font(Typo.sans(16))
                    .tracking(track(0.1, 16))
            }
            .padding(.horizontal, Metrics.gutterOnboarding)
            .padding(.bottom, keyboardHeight > 0 ? keyboardHeight + 12 : 44)
            .transition(.opacity)
        } else {
            HStack(spacing: 0) {
                TextField("说点什么", text: $store.meetDraft)
                    .font(Typo.sans(15))
                    .foregroundStyle(Palette.ink)
                    .focused($focused)
                    .submitLabel(.send)
                    .onSubmit { focused = false; store.sendMeetReply() }
                    .disabled(store.meetReplyPending)
                    .padding(.horizontal, 18)
                    .frame(height: Metrics.primaryButtonShort)


                Button {
                    focused = false
                    store.sendMeetReply()
                } label: {
                    Icons.sendArrow(color: store.meetDraft.trimmed.isEmpty ? Palette.ink4 : Palette.ink)
                        .frame(width: 50, height: 50)

                }
                .buttonStyle(PressScaleStyle())
                .accessibilityLabel("发送")
                .disabled(store.meetDraft.trimmed.isEmpty || store.meetReplyPending || store.creationSaveFailed)
            }
            .background(Palette.card.opacity(0.86), in: Capsule())
            .softShadow()
            .padding(.horizontal, Metrics.gutterOnboarding)
            .padding(.bottom, keyboardHeight > 0 ? keyboardHeight + 12 : 44)
        }
    }

}
