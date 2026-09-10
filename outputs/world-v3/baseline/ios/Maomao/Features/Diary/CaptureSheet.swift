import SwiftUI

/// 「记一下」底部抽屉。保存后按当前时间插入新碎片。
struct CaptureSheet: View {
    @EnvironmentObject private var store: AppStore
    @FocusState private var focused: Bool

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
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                }
                .frame(minHeight: 92)
                .background(Color(hex: 0xFBFAF2), in: RoundedRectangle(cornerRadius: Metrics.radiusCard))
                .overlay(
                    RoundedRectangle(cornerRadius: Metrics.radiusCard)
                        .stroke(Palette.rule, lineWidth: 1)
                )

                HStack(spacing: 14) {
                    // TODO: 后端 —— 语音碎片走服务端转写。
                    Icons.mic(color: Palette.ink4)

                    Spacer(minLength: 0)

                    PrimaryButton(height: 44, horizontalPadding: 22) {
                        store.saveCapture()
                    } label: {
                        Text("收好")
                            .font(Typo.sans(15))
                            .tracking(track(0.08, 15))
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 30)
        }
        .onAppear { focused = true }
    }
}
