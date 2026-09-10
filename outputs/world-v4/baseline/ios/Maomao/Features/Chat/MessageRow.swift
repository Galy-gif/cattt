import SwiftUI
import UIKit

struct MessageRow: View {
    @EnvironmentObject private var store: AppStore

    let message: ChatMessage
    let showsAvatar: Bool
    let availableWidth: CGFloat

    /// 猫在左最大 78%，用户在右最大 76%。
    private var maxBubbleWidth: CGFloat {
        availableWidth * (message.isCat ? 0.78 : 0.76)
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 9) {
            if message.isCat {
                avatarSlot
            } else {
                Spacer(minLength: 0)
            }

            VStack(alignment: message.isCat ? .leading : .trailing, spacing: 5) {
                bubble
                hint
            }
            .frame(maxWidth: maxBubbleWidth, alignment: message.isCat ? .leading : .trailing)

            if message.isCat {
                Spacer(minLength: 0)
            }
        }
    }

    // MARK: - 头像

    /// 头像位永远占 34pt，只有每段猫消息的第一条真的画图 —— 这样同一段里气泡左缘对齐。
    ///
    /// 缺口：现有资产只有全身图，缩到 34pt 偏「橘色团块」。等美术补一版头部裁切图后换掉。
    private var avatarSlot: some View {
        ZStack(alignment: .bottom) {
            if showsAvatar {
                Image(message.avatarImage)
                    .resizable()
                    .scaledToFit()
            }
        }
        .frame(width: 34, height: 34)
        .accessibilityHidden(true)
    }

    // MARK: - 气泡

    private var bubble: some View {
        Text(message.displayText)
            .font(Typo.sans(15))
            .lineHeight(1.7, size: 15)
            .foregroundStyle(Palette.ink)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(
                message.isCat ? Palette.chatBubbleCat : Palette.chatBubbleUser,
                in: bubbleShape
            )
            .overlay {
                if message.state == .failed || message.state == .timeout {
                    bubbleShape.stroke(Palette.accent, lineWidth: 1)
                }
            }
            .opacity(message.state == .sending ? 0.6 : 1)
            .contentShape(bubbleShape)
            .onLongPressGesture {
                store.messagePanel = AppStore.MessagePanel(id: message.id, isCat: message.isCat)
            }
    }

    /// 猫 `3px 12px 12px 12px`，用户 `12px 3px 12px 12px`。
    private var bubbleShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: message.isCat ? 3 : 12,
            bottomLeadingRadius: 12,
            bottomTrailingRadius: 12,
            topTrailingRadius: message.isCat ? 12 : 3
        )
    }

    // MARK: - 状态注

    @ViewBuilder
    private var hint: some View {
        if let text = message.hint {
            Text(text)
                .font(Typo.sans(11))
                .tracking(track(0.04, 11))
                .foregroundStyle(message.hintIsAction ? Palette.accent : Palette.chatHint)
                .contentShape(Rectangle())
                .onTapGesture {
                    switch message.state {
                    case .failed: store.retry(messageID: message.id)
                    case .timeout: store.retryAfterTimeout(messageID: message.id)
                    default: break
                    }
                }
                .accessibilityAddTraits(message.hintIsAction ? .isButton : [])
        }
    }
}

/// 长按气泡 → 底部菜单。猫消息多一项「不要再提」。
struct MessageActionSheet: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        BottomSheetScrim {
            store.messagePanel = nil
        } content: {
            VStack(spacing: 0) {
                row("复制") {
                    if let id = store.messagePanel?.id,
                       let message = store.messages.first(where: { $0.id == id }) {
                        UIPasteboard.general.string = message.text
                    }
                    store.messagePanel = nil
                }

                ListDivider(leading: 22)

                // TODO: 后端 —— 反馈要带上这条消息的 id 上报。
                row("反馈") { store.messagePanel = nil }

                ListDivider(leading: 22)

                row("删除") {
                    if let id = store.messagePanel?.id {
                        // TODO: 后端 —— 同步删除服务端这条消息。
                        store.messages.removeAll { $0.id == id }
                    }
                    store.messagePanel = nil
                }

                if store.messagePanel?.isCat == true {
                    ListDivider(leading: 22)
                    row("不要再提") { store.markBoundary() }
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 34)
        }
    }

    private func row(_ title: String, action: @escaping () -> Void) -> some View {
        Text(title)
            .font(Typo.sans(15))
            .foregroundStyle(Palette.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 22)
            .frame(minHeight: Metrics.minTap)
            .contentShape(Rectangle())
            .onTapGesture(perform: action)
            .accessibilityAddTraits(.isButton)
    }
}
