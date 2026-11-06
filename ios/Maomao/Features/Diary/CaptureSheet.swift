import SwiftUI

/// 「记一下」底部抽屉。保存后按当前时间插入新碎片。
struct CaptureSheet: View {
    @EnvironmentObject private var store: AppStore
    @FocusState private var focused: Bool
    @State private var keyboardHeight: CGFloat = 0

    var body: some View {
        BottomSheetScrim {
            withAnimation(.easeOut(duration: Metrics.fadeFast)) { store.isCapturing = false }
        } content: {
            VStack(alignment: .leading, spacing: 14) {
                SectionTitle(text: "记一下")

                ZStack(alignment: .topLeading) {
                    if store.captureText.isEmpty {
                        Text("现在在想什么")
                            .font(Typo.sans(15))
                            .foregroundStyle(Palette.ink4)
                            .padding(.horizontal, 13)
                            .padding(.vertical, 12)
                            .allowsHitTesting(false)
                    }

                    TextEditor(text: $store.captureText)
                        .font(Typo.sans(15))
                        .lineHeight(1.7, size: 15)
                        .foregroundStyle(Palette.ink)
                        .scrollContentBackground(.hidden)
                        .focused($focused)
                        .accessibilityLabel("记录内容")
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                }
                .frame(minHeight: 92, maxHeight: 180)   // TextEditor 是贪心的，不封顶会把抽屉撑成整屏
                .background(Palette.bg, in: RoundedRectangle(cornerRadius: Metrics.radiusCard))
                .overlay(
                    RoundedRectangle(cornerRadius: Metrics.radiusCard)
                        .stroke(Palette.rule, lineWidth: 1)
                )

                if store.captureSaveFailed {
                    Text("保存未成功，内容还在，请重试。")
                        .font(Typo.sans(13))
                        .foregroundStyle(Palette.ink2)
                }
                if store.captureText.utf16.count > 10000 {
                    Text("这条记录太长了，请分成几条保存。")
                        .font(Typo.sans(13)).foregroundStyle(Palette.ink2)
                }

                if store.backend.isRemote {
                    Toggle("给\(store.catName)看", isOn: $store.captureForCat)
                        .font(Typo.sans(14))
                        .tint(Palette.accent)
                }

                HStack(spacing: 14) {
                    Text(store.backend.isRemote ? (store.captureForCat ? "同步后团子可以阅读" : "同步到云端，仅自己可见") : "仅保存在本机")
                        .font(Typo.sans(12))
                        .foregroundStyle(Palette.ink3)
                    Spacer(minLength: 0)

                    PrimaryButton(height: 44, horizontalPadding: 22) {
                        store.saveCapture()
                    } label: {
                        Text("收好")
                            .font(Typo.sans(15))
                            .tracking(track(0.08, 15))
                    }
                    .disabled(store.captureText.trimmed.isEmpty || store.captureText.utf16.count > 10000 || store.diaryLoadFailed)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, keyboardHeight > 0 ? keyboardHeight + 12 : 30)
        }
        .onAppear { focused = true }
        // 根视图忽略键盘安全区，和聊天页沿用同一屏幕坐标口径避让。
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillChangeFrameNotification)) { note in
            guard let frame = note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
            let duration = note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25
            withAnimation(.easeOut(duration: duration)) {
                keyboardHeight = max(0, UIScreen.main.bounds.height - frame.minY)
            }
        }
    }
}
