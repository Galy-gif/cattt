import SwiftUI

/// A4 初次见面 4/4。全屏草丛场景，对话气泡逐条淡入。
///
/// 这一屏的意义：**第一句话由猫先说** —— 用户是被认领的一方，不是操作者。
struct FirstMeetingStep: View {
    @EnvironmentObject private var store: AppStore
    @FocusState private var focused: Bool

    var body: some View {
        GeometryReader { proxy in
            let contentWidth = proxy.size.width - Metrics.gutterOnboarding * 2

            ZStack {
                Image("scene-04")
                    .resizable()
                    .scaledToFill()
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .clipped()

                bubbles(maxBubbleWidth: contentWidth * 0.84)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)

                footer
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)

                skipLink
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .ignoresSafeArea()
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
                            in: UnevenRoundedRectangle(
                                topLeadingRadius: line.isCat ? 3 : 14,
                                bottomLeadingRadius: 14,
                                bottomTrailingRadius: 14,
                                topTrailingRadius: line.isCat ? 14 : 3
                            )
                        )
                        .frame(maxWidth: maxBubbleWidth)

                    if line.isCat { Spacer(minLength: 0) }
                }
                .transition(.opacity)
            }
        }
        .padding(.horizontal, Metrics.gutterOnboarding)
        .padding(.bottom, 116)
    }

    @ViewBuilder
    private var footer: some View {
        if store.meetDone {
            PrimaryButton(height: Metrics.primaryButtonShort) {
                store.enterYard()
            } label: {
                Text("进院子")
                    .font(Typo.sans(16))
                    .tracking(track(0.1, 16))
            }
            .padding(.horizontal, Metrics.gutterOnboarding)
            .padding(.bottom, 44)
            .transition(.opacity)
        } else {
            HStack(spacing: 11) {
                TextField("说点什么", text: $store.meetDraft)
                    .font(Typo.sans(15))
                    .foregroundStyle(Palette.ink)
                    .focused($focused)
                    .submitLabel(.send)
                    .onSubmit { store.sendMeetReply() }
                    .padding(.horizontal, 18)
                    .frame(height: Metrics.primaryButtonShort)
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
                    .softShadow()

                Button {
                    store.sendMeetReply()
                } label: {
                    Icons.sendArrow(color: Palette.accentInk)
                        .frame(width: 50, height: 50)
                        .background(Palette.accent, in: RoundedRectangle(cornerRadius: Metrics.radiusControl, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("发送")
            }
            .padding(.horizontal, Metrics.gutterOnboarding)
            .padding(.bottom, 44)
        }
    }

    @ViewBuilder
    private var skipLink: some View {
        if !store.meetDone {
            TextLink(
                text: "先不说",
                size: 12.5,
                color: Palette.ink2.opacity(0.6)
            ) {
                store.skipMeet()
            }
            .padding(.trailing, 26)
            .padding(.bottom, 104)
        }
    }
}
