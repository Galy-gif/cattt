import SwiftUI

/// A3 命名 2/3。木牌实时预览 + 建议名 + 1–8 字校验。
struct NamingStep: View {
    @EnvironmentObject private var store: AppStore
    @FocusState private var focused: Bool
    @State private var keyboardHeight: CGFloat = 0

    private var trimmed: String { store.nameDraft.trimmed }

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                Text("给它起个名字")
                    .font(Typo.serif(25, bold: true))
                    .foregroundStyle(Palette.ink)

                Text("它会用这个名字认自己。以后也能改。")
                    .font(Typo.sans(13.5))
                    .lineHeight(1.85, size: 13.5)
                    .foregroundStyle(Palette.ink3)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Metrics.gutterOnboarding)
            .padding(.top, 26)

            woodSign
                .padding(.top, 30)

            nameField
                .padding(.horizontal, Metrics.gutterOnboarding)
                .padding(.top, 26)

            Spacer(minLength: 0)

            HStack {
                Spacer()
                OnboardingNextButton(enabled: store.isNameValid) {
                    store.onboardingNext()
                }
            }
            .padding(.horizontal, Metrics.gutterOnboarding)
            .padding(.bottom, keyboardHeight > 0 ? keyboardHeight + 12 : 44)
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillChangeFrameNotification)) { note in
            guard let frame = note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
            let duration = note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25
            withAnimation(.easeOut(duration: duration)) {
                keyboardHeight = max(0, UIScreen.main.bounds.height - frame.minY)
            }
        }
    }

    // MARK: - 木牌

    private var woodSign: some View {
        VStack(spacing: 0) {
            Text(trimmed.isEmpty ? "还没有名字" : trimmed)
                .font(trimmed.isEmpty ? Typo.sans(17) : Typo.serif(30, bold: true))
                .tracking(trimmed.isEmpty ? 0 : track(0.16, 30))
                .foregroundStyle(trimmed.isEmpty ? Palette.signPlaceholder : Palette.ink2)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .frame(minHeight: 34)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 18)
                .padding(.vertical, 22)
                .background(Palette.signFace, in: RoundedRectangle(cornerRadius: 5))
                .overlay(
                    RoundedRectangle(cornerRadius: 5)
                        .strokeBorder(Palette.signEdge, lineWidth: 2)
                )

            // 牌柱。顶边和牌面底边重合，所以这里不用特意去掉它。
            UnevenRoundedRectangle(bottomLeadingRadius: 3, bottomTrailingRadius: 3)
                .fill(Palette.signPost)
                .overlay(
                    UnevenRoundedRectangle(bottomLeadingRadius: 3, bottomTrailingRadius: 3)
                        .strokeBorder(Palette.signEdge, lineWidth: 2)
                )
                .frame(width: 13, height: 42)
        }
        .frame(width: 244)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(trimmed.isEmpty ? "还没有名字" : "名字预览：\(trimmed)")
    }

    // MARK: - 输入 + 建议名

    private var nameField: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                TextField("输入名字", text: $store.nameDraft)
                    .font(Typo.sans(17))
                    .tracking(track(0.06, 17))
                    .foregroundStyle(Palette.ink)
                    .focused($focused)
                    .submitLabel(.done)
                    // 输入即清错。长度校验在「下一步」时做，不打断输入。
                    .onChange(of: store.nameDraft) { store.nameError = nil }

                Text("\(trimmed.count) / 8")
                    .font(Typo.sans(12))
                    .tabularNumbers()
                    .foregroundStyle(Palette.ink4)
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 54)
            .background(Palette.card.opacity(0.86), in: Capsule())
            .softShadow()

            if let error = store.nameError {
                Text(error)
                    .font(Typo.sans(12.5))
                    .foregroundStyle(Palette.accent)
                    .padding(.top, 8)
            }

            FlowLayout(spacing: 8) {
                ForEach(store.nameSuggestions, id: \.self) { name in
                    Text(name)
                        .font(Typo.sans(13.5))
                        .foregroundStyle(Palette.ink2)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background(Palette.card, in: RoundedRectangle(cornerRadius: Metrics.radiusCard))

                        .contentShape(Rectangle())
                        .onTapGesture {
                            store.nameDraft = name
                            store.nameError = nil
                        }
                        .accessibilityAddTraits(.isButton)
                }

                Chip(text: "再换一批", size: 13.5, color: Palette.ink3, horizontalPadding: 14)
                    .contentShape(Rectangle())
                    .onTapGesture { store.rerollNames() }
                    .accessibilityAddTraits(.isButton)
            }
            .padding(.top, 14)
        }
    }
}
