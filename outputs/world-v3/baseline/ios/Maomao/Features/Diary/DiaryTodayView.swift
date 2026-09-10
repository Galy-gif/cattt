import SwiftUI

/// 日记 · 今天。
struct DiaryTodayView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.screenInsets) private var insets

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()

            VStack(spacing: 0) {
                header
                entryList
                captureButton
            }
            .ignoresSafeArea(.container, edges: [.top, .bottom])

            if store.isCapturing {
                CaptureSheet()
            }
        }
    }

    // MARK: - 顶部

    /// 参考图一的页首：一行圆角方块按钮，两行衬线大标题（一轻一重），一颗信息片，一排筛选片。
    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                IconTile(size: Metrics.iconSlotLg, circular: true, glass: true) {
                    Image("tuanzi-canonical")
                        .resizable()
                        .scaledToFit()
                        .padding(5)
                }
                .accessibilityHidden(true)

                Spacer(minLength: 0)

                // TODO: 二级页 —— 搜索，本版未做。
                IconTile(size: Metrics.iconSlotLg, glass: true) { Icons.search(color: Palette.ink) }
                    .accessibilityLabel("搜索")
            }

            VStack(alignment: .leading, spacing: 0) {
                Text(SeedData.diaryDateKicker)
                    .font(Typo.serif(22))
                    .tracking(track(0.02, 22))
                    .foregroundStyle(Palette.ink)
                Text("今天")
                    .font(Typo.serif(34, bold: true))
                    .tracking(track(0.02, 34))
                    .foregroundStyle(Palette.ink)
            }

            infoPill

            filterRow
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Metrics.gutterDiary)
        .padding(.bottom, 8)
        .designTopInset(58)
    }

    /// 参考图一「27 May」那颗：白底小胶囊，一个小图标一段字。
    private var infoPill: some View {
        HStack(spacing: 7) {
            IconTile(size: 24, fill: Palette.bg, circular: true) {
                Icons.clock(size: IconSize.sm, color: Palette.ink2)
            }
            Text("\(shownEntries.count) 条")
                .font(Typo.sans(12.5))
                .tabularNumbers()
                .foregroundStyle(Palette.ink)
        }
        .padding(.leading, 5)
        .padding(.trailing, 13)
        .padding(.vertical, 5)
        .liquidGlass(in: Capsule(style: .continuous), fallback: Palette.card)
    }

    // MARK: - 筛选

    private enum Filter: CaseIterable {
        case all, voice, photo, privateOnly

        var label: String {
            switch self {
            case .all: "全部"
            case .voice: "语音"
            case .photo: "照片"
            case .privateOnly: "只留给自己"
            }
        }

        func matches(_ entry: DiaryEntry) -> Bool {
            switch self {
            case .all: true
            case .voice: entry.kind == .voice
            case .photo: entry.kind == .photo
            case .privateOnly: entry.isPrivate
            }
        }
    }

    @State private var filter: Filter = .all

    private var shownEntries: [DiaryEntry] {
        store.entries.filter(filter.matches)
    }

    /// 参考图一「Mountains / Forests / Tours」那排：白底胶囊，小图标 + 字，横向滚。
    private var filterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Filter.allCases, id: \.self) { item in
                    filterChip(item)
                }
            }
            .padding(.horizontal, Metrics.gutterDiary)
            .padding(.vertical, 8)   // 给投影留地方，不然会被 ScrollView 裁掉
        }
        .padding(.horizontal, -Metrics.gutterDiary)
        .padding(.vertical, -8)
    }

    @ViewBuilder
    private func filterIcon(_ item: Filter, color: Color) -> some View {
        switch item {
        case .all: Icons.tabDiary(size: IconSize.sm, color: color)
        case .voice: Icons.waveform(size: IconSize.sm, color: color)
        case .photo: Icons.photo(size: IconSize.sm, color: color)
        case .privateOnly: Icons.lock(size: IconSize.sm, color: color)
        }
    }

    private func filterChip(_ item: Filter) -> some View {
        let selected = filter == item
        return Button {
            withAnimation(.easeOut(duration: Metrics.fadeFast)) { filter = item }
        } label: {
            HStack(spacing: 6) {
                filterIcon(item, color: selected ? Palette.accent : Palette.ink3)
                Text(item.label)
                    .font(Typo.sans(13, weight: selected ? .medium : .regular))
                    .foregroundStyle(selected ? Palette.ink : Palette.ink3)
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 8)
            .background(selected ? Palette.card : Palette.chip, in: Capsule(style: .continuous))
            .modifier(ConditionalSoftShadow(enabled: selected))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    // MARK: - 碎片列表

    private var entryList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 15) {
                ForEach(shownEntries) { entry in
                    DiaryEntryRow(entry: entry)
                }

                thisMonth
            }
            .padding(.horizontal, Metrics.gutterDiary)
            .padding(.top, 10)
            .padding(.bottom, 12)
        }
    }

    private var thisMonth: some View {
        VStack(alignment: .leading, spacing: 9) {
            SectionTitle(text: "这个月")

            ListContainer {
                ForEach(Array(SeedData.monthRows.enumerated()), id: \.element.id) { index, row in
                    if index > 0 { ListDivider(leading: 45) }

                    HStack(spacing: 12) {
                        Text(row.date)
                            .font(Typo.sans(12))
                            .tabularNumbers()
                            .foregroundStyle(Palette.ink3)
                            .frame(width: 44, alignment: .leading)

                        Text(row.firstLine)
                            .font(Typo.sans(14))
                            .foregroundStyle(Palette.ink)
                            .lineLimit(1)
                            .truncationMode(.tail)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        Text("\(row.count) 条")
                            .font(Typo.sans(12))
                            .foregroundStyle(Palette.ink4)
                    }
                    .padding(.horizontal, 15)
                    .padding(.vertical, 13)
                    .frame(minHeight: Metrics.minTap)
                }
            }
        }
        .padding(.top, 4)
    }

    // MARK: - 记一下

    private var captureButton: some View {
        HStack {
            Spacer(minLength: 0)
            PrimaryButton(height: Metrics.minTap, horizontalPadding: 19) {
                store.captureText = ""
                withAnimation(.easeOut(duration: Metrics.fadeFast)) { store.isCapturing = true }
            } label: {
                HStack(spacing: 7) {
                    Icons.plus(color: Palette.accentInk)
                    Text("记一下")
                        .font(Typo.sans(14.5))
                        .tracking(track(0.08, 14.5))
                }
            }
        }
        .padding(.horizontal, Metrics.gutterDiary)
        .padding(.top, 8)
        // 原型里这颗按钮被绝对定位的 Tab 栏盖住了；这里给它让出 Tab 栏的高度。
        .padding(.bottom, 10 + TabBarView.height(bottomInset: insets.bottom))
    }
}

private struct ConditionalSoftShadow: ViewModifier {
    let enabled: Bool

    @ViewBuilder
    func body(content: Content) -> some View {
        if enabled { content.softShadow() } else { content }
    }
}
