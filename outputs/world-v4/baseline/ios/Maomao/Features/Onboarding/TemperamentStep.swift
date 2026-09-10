import SwiftUI

/// A2 气质 2/4。四个预设 + 可展开的四条三档细调。
struct TemperamentStep: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                Text("它是什么脾气")
                    .font(Typo.serif(25, bold: true))
                    .foregroundStyle(Palette.ink)

                Text("这决定它主不主动、话多不多、多久才跟你熟。之后还能改。")
                    .font(Typo.sans(13.5))
                    .lineHeight(1.85, size: 13.5)
                    .foregroundStyle(Palette.ink3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Metrics.gutterOnboarding)
            .padding(.top, 26)
            .padding(.bottom, 16)

            ScrollView {
                VStack(spacing: 11) {
                    ForEach(Temperament.allCases) { preset in
                        presetCard(preset)
                    }

                    if store.traitsOpen {
                        traitPanel
                    }
                }
                .padding(.horizontal, Metrics.gutterOnboarding)
            }

            VStack(spacing: 13) {
                TextLink(
                    text: store.traitsOpen ? "收起细调" : "想再细调四个特征",
                    color: Palette.ink3,
                    ruleColor: Color(hex: 0xA7B2A0),
                    underlineGap: 3
                ) {
                    withAnimation(.easeOut(duration: Metrics.fade)) { store.traitsOpen.toggle() }
                }

                PrimaryButton {
                    store.onboardingNext()
                } label: {
                    Text("下一步")
                        .font(Typo.sans(16))
                        .tracking(track(0.1, 16))
                }
            }
            .padding(.horizontal, Metrics.gutterOnboarding)
            .padding(.top, 16)
            .padding(.bottom, 44)
        }
    }

    private func presetCard(_ preset: Temperament) -> some View {
        let selected = store.temperament == preset

        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(preset.name)
                    .font(Typo.serif(17))
                    .tracking(track(0.06, 17))
                    .foregroundStyle(selected ? Palette.accentDark : Palette.ink)

                Spacer(minLength: 0)

                if selected {
                    Icons.check(color: Palette.accent)
                }
            }

            Text(preset.behavior)
                .font(Typo.sans(13.5))
                .lineHeight(1.8, size: 13.5)
                .foregroundStyle(Palette.ink2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 15)
        .background(
            selected ? Palette.paper : Palette.card,
            in: RoundedRectangle(cornerRadius: Metrics.radiusControl)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Metrics.radiusControl)
                .stroke(selected ? Palette.accent : Palette.rule, lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture { store.temperament = preset }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    /// 四条三档滑轨。档位控件是三段 6px 高、3px 圆角的横条。
    private var traitPanel: some View {
        VStack(spacing: 14) {
            ForEach(Trait.allCases) { trait in
                let level = store.traitLevels[trait] ?? 1

                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(trait.name)
                            .font(Typo.sans(14))
                            .foregroundStyle(Palette.ink)

                        Spacer(minLength: 0)

                        Text(Trait.levelNames[level])
                            .font(Typo.sans(12))
                            .foregroundStyle(Palette.ink3)
                    }

                    HStack(spacing: 6) {
                        ForEach(0..<3, id: \.self) { index in
                            RoundedRectangle(cornerRadius: Metrics.radiusCard)
                                .fill(level == index ? Palette.accent : Palette.rule)
                                .frame(height: 6)
                                .frame(maxWidth: .infinity)
                                // 6pt 太薄点不中，热区往外扩到最小点按高度。
                                .contentShape(Rectangle().inset(by: -18))
                                .onTapGesture {
                                    withAnimation(.easeOut(duration: Metrics.fadeFast)) {
                                        store.traitLevels[trait] = index
                                    }
                                }
                                .accessibilityLabel("\(trait.name) \(Trait.levelNames[index])")
                                .accessibilityAddTraits(
                                    level == index ? [.isButton, .isSelected] : .isButton
                                )
                        }
                    }

                    Text(trait.explanations[level])
                        .font(Typo.sans(12))
                        .lineHeight(1.7, size: 12)
                        .foregroundStyle(Palette.ink3)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 15)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Metrics.radiusControl))
        .overlay(
            RoundedRectangle(cornerRadius: Metrics.radiusControl)
                .stroke(Palette.rule, lineWidth: 1)
        )
        .transition(.opacity)
    }
}
