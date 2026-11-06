import SwiftUI

/// A1 选外观 1/4。只有橘猫有定稿资产，其余三种画占位灰圆并标注「待定稿」。
struct PickAppearanceStep: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                Text("先看看是哪一只")
                    .font(Typo.serif(25, bold: true))
                    .foregroundStyle(Palette.ink)

                Text("外观和性格是分开的。挑哪只都不会影响它的脾气。")
                    .font(Typo.sans(13.5))
                    .lineHeight(1.85, size: 13.5)
                    .foregroundStyle(Palette.ink3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Metrics.gutterOnboarding)
            .padding(.top, 26)
            .padding(.bottom, 18)

            VStack(spacing: 11) {
                ForEach(CatAppearance.all) { appearance in
                    card(for: appearance)
                }
            }
            .padding(.horizontal, Metrics.gutterOnboarding)

            Spacer(minLength: 0)

            PrimaryButton {
                store.onboardingNext()
            } label: {
                Text("就它了")
                    .font(Typo.sans(16))
                    .tracking(track(0.1, 16))
            }
            .padding(.horizontal, Metrics.gutterOnboarding)
            .padding(.top, 18)
            .padding(.bottom, 44)
        }
    }

    private func card(for appearance: CatAppearance) -> some View {
        let selected = appearance.ready && store.pickedAppearance == appearance.id

        return HStack(spacing: 14) {
            ZStack {
                if appearance.ready {
                    Image("tuanzi-ui-full")
                        .resizable()
                        .scaledToFit()
                } else {
                    Circle()
                        .fill(Palette.pendingSwatch)
                        .frame(width: 40, height: 40)
                }
            }
            .frame(width: 56, height: 54)

            VStack(alignment: .leading, spacing: 4) {
                Text(appearance.name)
                    .font(Typo.sans(15.5, weight: .semibold))
                    .foregroundStyle(appearance.ready ? Palette.ink : Palette.ink3)

                Text(appearance.note)
                    .font(Typo.sans(12.5))
                    .lineHeight(1.6, size: 12.5)
                    .foregroundStyle(Palette.ink3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if selected {
                Icons.check(color: Palette.accent)
            }
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 14)
        .background(
            appearance.ready ? (selected ? Palette.paper : Palette.card) : Palette.pendingCard,
            in: RoundedRectangle(cornerRadius: Metrics.radiusControl)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Metrics.radiusControl)
                .stroke(selected ? Palette.accent : Palette.rule, lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            guard appearance.ready else { return }
            store.pickedAppearance = appearance.id
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityHint(appearance.ready ? "" : "美术待定稿，暂时不能选")
    }
}
