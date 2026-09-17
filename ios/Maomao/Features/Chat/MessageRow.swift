import SwiftUI
import UIKit

struct MessageRow: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.chatTone) private var tone

    let message: ChatMessage
    let showsAvatar: Bool
    let availableWidth: CGFloat

    /// 猫在左最大 78%，用户在右最大 76%。猫那边还要扣掉头像位。
    private var maxBubbleWidth: CGFloat {
        message.isCat
            ? (availableWidth - CatWindowAvatar.size - 8) * 0.86
            : availableWidth * 0.76
    }

    /// 回复里的空行拆成几个气泡，像连着说了几句。
    private var paragraphs: [String] {
        let parts = message.displayText
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        return parts.isEmpty ? [message.displayText] : parts
    }

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            if message.isCat {
                // 头像位永远占着，只有每组第一条真的画 —— 同一组里气泡左缘对齐。
                CatWindowAvatar(image: message.avatarImage)
                    .opacity(showsAvatar ? 1 : 0)
                    .accessibilityHidden(true)
            } else {
                Spacer(minLength: 0)
            }

            VStack(alignment: message.isCat ? .leading : .trailing, spacing: 5) {
                VStack(alignment: message.isCat ? .leading : .trailing, spacing: 5) {
                    ForEach(paragraphs.indices, id: \.self) { index in
                        bubble(paragraphs[index])
                    }
                }
                .contentShape(.contextMenuPreview, bubbleShape)
                .contextMenu { menu }

                hint
            }
            .frame(maxWidth: maxBubbleWidth, alignment: message.isCat ? .leading : .trailing)

            if message.isCat {
                Spacer(minLength: 0)
            }
        }
    }

    // MARK: - 气泡

    private func bubble(_ text: String) -> some View {
        Text(text)
            .font(Typo.sans(15))
            .lineHeight(1.55, size: 15)
            .foregroundStyle(tone.ink)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 15)
            .padding(.vertical, 10)
            .background(message.isCat ? tone.bubbleCat : tone.bubbleUser, in: bubbleShape)
            .shadow(color: tone.separation, radius: 10, x: 0, y: 3)
            .overlay {
                if message.state == .failed || message.state == .timeout {
                    bubbleShape.stroke(Palette.accent, lineWidth: 1)
                }
            }
            .opacity(message.state == .sending ? 0.6 : 1)
    }

    /// 猫和用户同一个圆角，不再用 3pt 的小尖角区分左右 —— 左右位置已经说清楚了。
    private var bubbleShape: RoundedRectangle {
        RoundedRectangle(cornerRadius: Metrics.radiusLg, style: .continuous)
    }

    // MARK: - 长按菜单

    /// 系统上下文菜单：气泡浮起、背后虚掉。猫消息多一项「不要再提」。
    @ViewBuilder
    private var menu: some View {
        Button {
            UIPasteboard.general.string = message.text
        } label: {
            Label("复制", systemImage: "doc.on.doc")
        }

        // TODO: 后端 —— 反馈要带上这条消息的 id 上报。
        Button {} label: {
            Label("反馈", systemImage: "exclamationmark.bubble")
        }

        if message.isCat && !message.boundary {
            Button {
                store.messagePanel = AppStore.MessagePanel(id: message.id, isCat: true)
                store.markBoundary()
            } label: {
                Label("不要再提", systemImage: "hand.raised")
            }
        }

        Button(role: .destructive) {
            // TODO: 后端 —— 同步删除服务端这条消息。
            store.messages.removeAll { $0.id == message.id }
        } label: {
            Label("删除", systemImage: "trash")
        }
    }

    // MARK: - 状态注

    @ViewBuilder
    private var hint: some View {
        if let text = message.hint {
            Text(text)
                .font(Typo.sans(11))
                .tracking(track(0.04, 11))
                .foregroundStyle(message.hintIsAction ? Palette.accent : tone.hint)
                .padding(.horizontal, 6)
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

/// 团子的圆窗头像：只露头，暖纸底，外面一圈半透明的窗沿。
///
/// 用的是全身定稿图，按头部位置放大裁进圆里（两张图头的位置一致：中心约在 50% / 34%）。
/// 扒着窗沿的前爪要美术另出，本版没有。
struct CatWindowAvatar: View {
    static let size: CGFloat = 36
    /// 头在原图里的中心和直径（占原图边长的比例）。
    private static let headCenter = CGPoint(x: 0.50, y: 0.345)
    private static let headDiameter: CGFloat = 0.50

    let image: String

    var body: some View {
        let inner = Self.size - 4
        let scaled = inner / Self.headDiameter
        Image(image)
            .resizable()
            .scaledToFit()
            .frame(width: scaled, height: scaled)
            .offset(x: (0.5 - Self.headCenter.x) * scaled, y: (0.5 - Self.headCenter.y) * scaled + inner * 0.06)
            .frame(width: inner, height: inner)
            .background(Palette.paper)
            .clipShape(Circle())
            .padding(2)
            .background(Color.white.opacity(0.55), in: Circle())
            .shadow(color: Palette.chatSeparation, radius: 6, x: 0, y: 2)
    }
}
