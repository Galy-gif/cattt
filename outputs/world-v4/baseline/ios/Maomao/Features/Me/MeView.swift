import SwiftUI

struct MeView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.screenInsets) private var insets

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    headerBlock

                    VStack(alignment: .leading, spacing: 22) {
                        howWeGetAlong
                        whatItRemembers
                        settings
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 22)
                    .padding(.bottom, 30 + TabBarView.height(bottomInset: insets.bottom))
                }
            }
            .ignoresSafeArea(.container, edges: [.top, .bottom])
        }
    }

    // MARK: - 头区

    private var headerBlock: some View {
        VStack(spacing: 10) {
            Image("tuanzi-canonical")
                .resizable()
                .scaledToFit()
                .frame(width: 150, height: 150)
                .accessibilityHidden(true)

            VStack(spacing: 5) {
                Text(store.catName)
                    .font(Typo.serif(25, bold: true))
                    .tracking(track(0.06, 25))
                    .foregroundStyle(Palette.ink)

                Text("在一起 \(SeedData.togetherDays) 天")
                    .font(Typo.sans(12.5))
                    .tracking(track(0.04, 12.5))
                    .tabularNumbers()
                    .foregroundStyle(Palette.ink3)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Metrics.gutterDiary)
        .padding(.bottom, 20)
        .designTopInset(54)
        .background(
            LinearGradient(
                stops: [
                    .init(color: Palette.meHeaderTop, location: 0),
                    .init(color: Palette.meHeaderMid, location: 0.78),
                    .init(color: Palette.bg, location: 1),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }

    // MARK: - 我们怎么相处

    private var howWeGetAlong: some View {
        VStack(alignment: .leading, spacing: 11) {
            SectionTitle(text: "我们怎么相处")

            // TODO: 后端 —— 这些标签由气质预设 + 细调特征推出来，本版先用定值。
            WrappingChips(items: ["慢热", "话少", "记得住事", "不劝你"])

            Text("团子每天最多主动找你一到两次。你不回也没关系。")
                .font(Typo.sans(13))
                .lineHeight(1.8, size: 13)
                .foregroundStyle(Palette.ink3)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)
        }
    }

    // MARK: - 它记得的事

    private var whatItRemembers: some View {
        VStack(alignment: .leading, spacing: 11) {
            SectionTitle(text: "它记得的事")

            ListContainer {
                // TODO: 二级页 —— 记忆列表、在聊话题、不要再提列表，本版未做。
                memoryRow(icon: { Icons.document(color: Palette.ink3) },
                          title: "长期记忆", count: "\(store.memoryCount) 条")
                ListDivider(leading: 63)
                memoryRow(icon: { Icons.clock(color: Palette.ink3) },
                          title: "在聊的话题", count: "4 个")
                ListDivider(leading: 63)
                memoryRow(icon: { Icons.trash(color: Palette.ink3) },
                          title: "不要再提的", count: "\(store.boundaryCount) 条")
            }

            Text("每一条都能看到它是从哪次对话来的，可以改，也可以删。")
                .font(Typo.sans(13))
                .lineHeight(1.8, size: 13)
                .foregroundStyle(Palette.ink3)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)
        }
    }

    private func memoryRow<Icon: View>(
        @ViewBuilder icon: @escaping () -> Icon,
        title: String,
        count: String
    ) -> some View {
        HStack(spacing: 12) {
            // 层级靠容器，不靠把图标画大 —— 36 是列表行那一档。
            IconTile(size: Metrics.iconSlotMd, fill: Palette.bg, circular: true) { icon() }

            Text(title)
                .font(Typo.sans(14.5))
                .foregroundStyle(Palette.ink)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(count)
                .font(Typo.sans(13))
                .tabularNumbers()
                .foregroundStyle(Palette.ink4)

            Icons.chevronRight(color: Color(hex: 0xA7B2A0))
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 14)
        .frame(minHeight: Metrics.minTap)
    }

    // MARK: - 设置

    private var settings: some View {
        VStack(alignment: .leading, spacing: 11) {
            SectionTitle(text: "设置")

            ListContainer {
                HStack(spacing: 12) {
                    Text("新记录默认给团子看")
                        .font(Typo.sans(14.5))
                        .foregroundStyle(Palette.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    ShareToggle(isOn: store.shareByDefault)
                }
                .padding(.horizontal, 15)
                .padding(.vertical, 14)
                .frame(minHeight: Metrics.minTap)
                .contentShape(Rectangle())
                .onTapGesture {
                    withAnimation(.easeOut(duration: 0.2)) { store.shareByDefault.toggle() }
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isButton)

                ListDivider()
                // TODO: 二级页 —— 通知与声音，本版未做。
                settingRow("通知与声音")

                ListDivider()
                // TODO: 二级页 —— 显示与无障碍，本版未做。
                settingRow("显示与无障碍")

                ListDivider()
                HStack(spacing: 12) {
                    Text("帮助与关于")
                        .font(Typo.sans(14.5))
                        .foregroundStyle(Palette.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Text("0.1 · 长按看创建流程")
                        .font(Typo.sans(12))
                        .foregroundStyle(Palette.ink4)
                }
                .padding(.horizontal, 15)
                .padding(.vertical, 14)
                .frame(minHeight: Metrics.minTap)
                .contentShape(Rectangle())
                .onLongPressGesture { store.startOnboarding() }
            }
        }
    }

    private func settingRow(_ title: String) -> some View {
        HStack(spacing: 12) {
            Text(title)
                .font(Typo.sans(14.5))
                .foregroundStyle(Palette.ink)
                .frame(maxWidth: .infinity, alignment: .leading)

            Icons.chevronRight(color: Color(hex: 0xA7B2A0))
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 14)
        .frame(minHeight: Metrics.minTap)
    }
}

/// 44 × 26 轨道，20pt 旋钮。
struct ShareToggle: View {
    let isOn: Bool

    var body: some View {
        Capsule()
            .fill(isOn ? Palette.switchOn : Palette.rule)
            .frame(width: 44, height: 26)
            .overlay(alignment: isOn ? .trailing : .leading) {
                Circle()
                    .fill(Palette.card)
                    .frame(width: 20, height: 20)
                    .padding(.horizontal, 3)
            }
    }
}

/// 会换行的标签行。
struct WrappingChips: View {
    let items: [String]
    var spacing: CGFloat = 8
    var chipSize: CGFloat = 13
    var chipColor: Color = Palette.ink2
    var verticalPadding: CGFloat = 7
    var horizontalPadding: CGFloat = 13

    var body: some View {
        FlowLayout(spacing: spacing) {
            ForEach(items, id: \.self) { item in
                Chip(
                    text: item,
                    size: chipSize,
                    color: chipColor,
                    verticalPadding: verticalPadding,
                    horizontalPadding: horizontalPadding
                )
            }
        }
    }
}

/// 简单的流式布局：一行放不下就换行。
/// 量尺寸和摆位置走同一个分行函数，而且量出来的宽度就是给到的宽度 ——
/// 两边算出不同的行数时，第二行会压在下面的段落上。
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    private struct Row {
        var items: [(index: Int, size: CGSize)] = []
        var height: CGFloat = 0
    }

    private func rows(for width: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = [Row()]
        var x: CGFloat = 0
        for (index, subview) in subviews.enumerated() {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0 && x + spacing + size.width > width {
                rows.append(Row())
                x = 0
            }
            rows[rows.count - 1].items.append((index, size))
            rows[rows.count - 1].height = max(rows[rows.count - 1].height, size.height)
            x += (x > 0 ? spacing : 0) + size.width
        }
        return rows
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        let rows = rows(for: width, subviews: subviews)
        let height = rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(0, rows.count - 1))
        if width.isFinite { return CGSize(width: width, height: height) }
        let rowWidth = rows[0].items.reduce(0) { $0 + $1.size.width } + spacing * CGFloat(max(0, rows[0].items.count - 1))
        return CGSize(width: rowWidth, height: height)
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        var y = bounds.minY
        for row in rows(for: bounds.width, subviews: subviews) {
            var x = bounds.minX
            for item in row.items {
                subviews[item.index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(item.size))
                x += item.size.width + spacing
            }
            y += row.height + spacing
        }
    }
}
