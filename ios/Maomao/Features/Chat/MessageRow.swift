import SwiftUI
import UIKit

struct MessageRow: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.chatTone) private var tone

    let message: ChatMessage
    let showsAvatar: Bool
    let availableWidth: CGFloat
    var animatesAvatar = false

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
                CatWindowAvatar(image: message.avatarImage, animated: showsAvatar && animatesAvatar)
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

        if message.isCat && !message.boundary {
            Button {
                store.messagePanel = AppStore.MessagePanel(id: message.id, isCat: true)
                store.markBoundary()
            } label: {
                Label("回避此话题", systemImage: "hand.raised")
            }
        }

        if store.backend.isRemote && !message.sourceWithdrawn, let id = message.serverID {
            Button { store.withdrawnSource = .source(id) } label: {
                Label("停用此消息", systemImage: "eye.slash")
            }
        }
        if !store.backend.isRemote {
        Button(role: .destructive) {
            // 本地模拟支持删除；远端模式等服务端删除契约实现后开放。
            store.messages.removeAll { $0.id == message.id }
        } label: {
            Label("删除", systemImage: "trash")
        }
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

/// 与院子同一3D模型的头部特写；窗口不再放大全身图。
struct CatWindowAvatar: View {
    static let size: CGFloat = 36
    let image: String
    var animated = true
    var body: some View {
        Group {
            if image == "tuanzi-ui-portrait" {
                AnimatedCatPortrait(animated: animated)
            } else {
                Image(image).resizable().scaledToFit()
            }
        }
            .frame(width: Self.size, height: Self.size)
            .background(Palette.paper.opacity(0.85), in: Circle())
            .clipShape(Circle())
            .accessibilityHidden(true)
    }
}
