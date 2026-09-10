import SwiftUI

/// 主按钮：accent 底 + 软投影。原来是 2px 硬投影，那是印刷品的语言，参考图整套只有软投影。
struct PrimaryButton<Label: View>: View {
    var height: CGFloat = Metrics.primaryButton
    var horizontalPadding: CGFloat? = nil   // nil = 撑满宽度
    var enabled: Bool = true
    /// nil = 设计系统默认的 4pt 直角感；给具体值可以做成胶囊（传 height / 2）。
    var cornerRadius: CGFloat? = nil
    /// 软投影。浮在场景图上的按钮关掉 —— 场景本身已经有明暗，再叠一层会脏。
    var shadow: Bool = true
    /// 画在胶囊外面的可点余量。按钮想做矮又不想让热区掉到 44pt 以下时给它。
    var tapSlop: CGFloat = 0
    /// 浮在场景上的主按钮走珊瑚色玻璃（iOS 26），页面里的仍是实色。
    var glass: Bool = false
    let action: () -> Void
    @ViewBuilder let label: () -> Label

    var body: some View {
        Button(action: action) {
            label()
                .foregroundStyle(enabled ? Palette.accentInk : Palette.ink4)
                .frame(maxWidth: horizontalPadding == nil ? .infinity : nil)
                .padding(.horizontal, horizontalPadding ?? 0)
                .frame(height: height)
                .modifier(PrimaryFill(enabled: enabled, glass: glass, shape: RoundedRectangle(cornerRadius: cornerRadius ?? Metrics.radiusControl)))
                .modifier(ConditionalHardShadow(enabled: enabled && shadow && !glass))
                .padding(.vertical, tapSlop)
                .contentShape(Rectangle())
        }
        .buttonStyle(PressScaleStyle())
    }
}

private struct PrimaryFill: ViewModifier {
    let enabled: Bool
    let glass: Bool
    let shape: RoundedRectangle

    @ViewBuilder
    func body(content: Content) -> some View {
        if glass && enabled {
            content.liquidGlass(in: shape, tint: Palette.accent, interactive: true, fallback: Palette.accent)
        } else {
            content.background(enabled ? Palette.accent : Palette.pendingSwatch, in: shape)
        }
    }
}

private struct ConditionalHardShadow: ViewModifier {
    let enabled: Bool

    @ViewBuilder
    func body(content: Content) -> some View {
        if enabled {
            content.softShadow()
        } else {
            content
        }
    }
}

/// 文字链：底部一道 1px 下划线，宽度跟着文字走。
struct TextLink: View {
    let text: String
    var size: CGFloat = 13
    var color: Color = Palette.accent
    /// 下划线颜色，默认同文字色。
    var ruleColor: Color? = nil
    /// 文字底边到下划线的距离（设计稿的 `padding-bottom`）。
    var underlineGap: CGFloat = 2
    let action: () -> Void

    var body: some View {
        Text(text)
            .font(Typo.sans(size))
            .foregroundStyle(color)
            .padding(.bottom, underlineGap)
            // 下划线走 overlay 而不是 VStack —— Rectangle 没有固有宽度，
            // 放进 VStack 再 fixedSize 会缩成默认的 10pt。
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(ruleColor ?? color)
                    .frame(height: 1)
            }
            .contentShape(Rectangle())
            .onTapGesture(perform: action)
            .accessibilityAddTraits(.isButton)
    }
}

/// 分区小标题：17px 衬线 700。和页首大标题同一副字，只差一档。
struct SectionTitle: View {
    let text: String

    var body: some View {
        Text(text)
            .font(Typo.serif(17, bold: true))
            .tracking(track(0.04, 17))
            .foregroundStyle(Palette.ink)
    }
}

/// 列表容器：白底 + 软投影，不描边，内部用 divider 分隔。
struct ListContainer<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            content()
        }
        .background(Palette.card)
        .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
        .softShadow()
    }
}

/// 列表内分隔线，左侧按内容缩进。
struct ListDivider: View {
    var leading: CGFloat = 15

    var body: some View {
        Rectangle()
            .fill(Palette.divider)
            .frame(height: 1)
            .padding(.leading, leading)
    }
}

/// 标签胶囊。
struct Chip: View {
    let text: String
    var size: CGFloat = 13
    var color: Color = Palette.ink2
    var verticalPadding: CGFloat = 7
    var horizontalPadding: CGFloat = 13

    var body: some View {
        Text(text)
            .font(Typo.sans(size))
            .foregroundStyle(color)
            .padding(.horizontal, horizontalPadding)
            .padding(.vertical, verticalPadding)
            .background(Palette.chip, in: Capsule(style: .continuous))
    }
}

/// 团子读过一条碎片、但没话说时留下的三枚脚印。
/// 尺寸递减 13 / 11 / 9，轻微旋转 −14° / 9° / −6°，整体 opacity .5。
struct PawPrints: View {
    private let prints: [(size: CGFloat, angle: Double)] = [
        (13, -14), (11, 9), (9, -6),
    ]

    var body: some View {
        HStack(spacing: 7) {
            ForEach(prints.indices, id: \.self) { index in
                Icons.paw(size: prints[index].size, color: Palette.pawPrint)
                    .rotationEffect(.degrees(prints[index].angle))
            }
        }
        .opacity(0.5)
        .padding(.top, 2)
        .accessibilityLabel("团子来看过这条，没有留言")
    }
}

/// 遮罩 + 底部抽屉。用于长按菜单和「记一下」。
struct BottomSheetScrim<Content: View>: View {
    let onDismiss: () -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        ZStack(alignment: .bottom) {
            Palette.overlay
                .ignoresSafeArea(.container)
                .contentShape(Rectangle())
                .onTapGesture(perform: onDismiss)

            content()
                .background(Palette.card)
                .clipShape(
                    UnevenRoundedRectangle(
                        topLeadingRadius: Metrics.radiusControl,
                        topTrailingRadius: Metrics.radiusControl
                    )
                )
        }
        // 只忽略容器安全区 —— 抽屉里有输入框时键盘照常把它顶上去。
        .ignoresSafeArea(.container)
        .transition(.opacity)
    }
}

/// 原生玻璃（2026-09-09 用户定）：iOS 26 走系统 Liquid Glass，17–25 回退到下面的 `SceneGlass` 或给定的实色。
///
/// 只给「浮在内容上面的控件层」用：Tab 栏、状态条、地点轨、场景上的按钮、输入栏、页首的小按钮。
/// 内容卡片（日记条目、列表容器、气泡）不上玻璃，那是 Apple 的分层规矩，也避免整页都在折射。
struct LiquidGlass<S: Shape>: ViewModifier {
    let shape: S
    var tint: Color? = nil
    var interactive = false
    /// 回退用的实色；nil 走 `SceneGlass`（场景上的透明玻璃）。
    var fallback: Color? = nil

    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            var glass = Glass.regular
            if let tint { glass = glass.tint(tint) }
            if interactive { glass = glass.interactive() }
            return AnyView(content.glassEffect(glass, in: shape))
        } else if let fallback {
            return AnyView(content.background(fallback, in: shape).softShadow())
        } else {
            return AnyView(content.sceneGlass(in: shape))
        }
    }
}

extension View {
    func liquidGlass<S: Shape>(in shape: S, tint: Color? = nil, interactive: Bool = false, fallback: Color? = nil) -> some View {
        modifier(LiquidGlass(shape: shape, tint: tint, interactive: interactive, fallback: fallback))
    }
}

/// 几个玻璃元素挨在一起时放进容器，系统会把它们当一组折射、挨近时融合。低版本原样返回。
struct GlassGroup<Content: View>: View {
    var spacing: CGFloat = 0
    @ViewBuilder let content: () -> Content

    var body: some View {
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: spacing) { content() }
        } else {
            content()
        }
    }
}

enum GlassAware {
    /// 输入栏这类通宽条的底：玻璃元素浮在上面时底要透，让列表从底下穿过；低版本仍用实色托住。
    static var barFill: Color {
        if #available(iOS 26.0, *) { return .clear }
        return Palette.chatBar
    }
}

/// 按下去缩到 0.96 —— 每个可按的东西都要在按下时有反应，悬停不算（触屏没有悬停）。
struct PressScaleStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.easeOut(duration: Metrics.press), value: configuration.isPressed)
    }
}

/// 场景上的玻璃底：毛玻璃 + 一层很薄的页面底色。
/// 状态条和 Tab 栏共用，两处的透明度和色相保持一致，场景从底下整幅透上来。
struct SceneGlass<S: Shape>: View {
    var shape: S

    var body: some View {
        ZStack {
            // ultraThinMaterial 是系统最薄的一档，单用还是把场景糊得太实，
            // 再掐掉 3 成不透明度，草地的纹理能穿上来。
            Rectangle().fill(.ultraThinMaterial).opacity(0.7)
            Palette.onSceneGlass
        }
        .clipShape(shape)
    }
}

extension View {
    func sceneGlass<S: Shape>(in shape: S) -> some View {
        background(SceneGlass(shape: shape))
    }
}

/// 图标底座。层级靠容器尺寸走（Metrics.iconSlotSm / Md / Lg），图标玻璃本身只有 IconSize 两档。
/// 参考 travel app：顶栏主操作 44、信息片和列表行 36、卡片角上的小操作 28。
struct IconTile<Icon: View>: View {
    var size: CGFloat = Metrics.iconSlotMd
    var fill: Color = Palette.card
    /// 正圆还是圆角方块。参考图两种都用，圆角方块给方形语义（返回、菜单），正圆给信息片。
    var circular: Bool = false
    /// 页首浮着的操作钮走玻璃；行内的小底座仍是实色。
    var glass: Bool = false
    @ViewBuilder let icon: () -> Icon

    var body: some View {
        let framed = icon().frame(width: size, height: size)
        if glass {
            if circular {
                framed.liquidGlass(in: Circle(), interactive: true, fallback: fill)
            } else {
                framed.liquidGlass(in: RoundedRectangle(cornerRadius: Metrics.radiusSm, style: .continuous), interactive: true, fallback: fill)
            }
        } else {
            framed.background {
                if circular {
                    Circle().fill(fill)
                } else {
                    RoundedRectangle(cornerRadius: Metrics.radiusSm, style: .continuous).fill(fill)
                }
            }
        }
    }
}

/// 日记左栏的时间片。参考图二下半部分那种：白底小方块，两行，上大下小。
struct TimeChip: View {
    let time: String

    var body: some View {
        Text(time)
            .font(Typo.sans(11))
            .tracking(track(0.04, 11))
            .tabularNumbers()
            .foregroundStyle(Palette.ink2)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 7)
            .background(
                Palette.card,
                in: RoundedRectangle(cornerRadius: Metrics.radiusSm, style: .continuous)
            )
            .softShadow()
    }
}
