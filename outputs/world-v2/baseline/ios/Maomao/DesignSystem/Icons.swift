import SwiftUI

/// 图标玻璃只有两档。层级靠 `Metrics.iconSlotSm/Md/Lg` 的容器变，不靠把图标画大 ——
/// 改版前这里有 12/15/16/17/18/19/21/22/24 九档，基本是连续的，
/// 12 和 15、18 和 19 肉眼分不出层级，只会读成「大小不齐」。
enum IconSize {
    /// 行内、辅助、chevron、装饰性标记
    static let sm: CGFloat = 16
    /// 导航、主操作、Tab
    static let md: CGFloat = 20
}

/// 全套图标，路径逐条对照设计稿的内联 SVG 搬过来。
/// 描边宽度 1.7–1.9，手绘感；不要换成 SF Symbols —— 那会把这套院子的笔触冲掉。
enum Icons {

    // MARK: - 地点轨（六个场景，IconSize.md，stroke-width 1.7）

    /// 蘑菇屋：圆顶小屋
    static func mushroomHouse(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color, join: .round) { p in
            p.move(to: pt(3.4, 11.2))
            p.addQuadCurve(to: pt(20.6, 11.2), control: pt(12, 2.4))
            p.closeSubpath()

            p.move(to: pt(8.4, 11.2))
            p.addLine(to: pt(8.4, 19.6))
            p.addLine(to: pt(15.6, 19.6))
            p.addLine(to: pt(15.6, 11.2))

            p.move(to: pt(10.4, 19.6))
            p.addLine(to: pt(10.4, 15.4))
            p.halfArc(from: pt(10.4, 15.4), to: pt(13.6, 15.4), rise: -1.6)
            p.addLine(to: pt(13.6, 19.6))
        }
    }

    /// 树屋：树冠加枝
    static func treeHouse(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color) { p in
            p.line(12, 20.4, 12, 13.8)

            p.move(to: pt(12, 13.8))
            p.addCurve(to: pt(7.2, 8.4), control1: pt(7.6, 13.8), control2: pt(5.6, 10.8))
            p.addCurve(to: pt(12, 8), control1: pt(8.4, 6.6), control2: pt(10, 8))
            p.addCurve(to: pt(16.8, 8.4), control1: pt(14, 8), control2: pt(15.6, 6.6))
            p.addCurve(to: pt(12, 13.8), control1: pt(18.4, 10.8), control2: pt(16.4, 13.8))
            p.closeSubpath()

            p.move(to: pt(12, 8))
            p.addCurve(to: pt(15.4, 4.4), control1: pt(12, 5.4), control2: pt(13.6, 3.6))
        }
    }

    /// 猫窝：半椭圆垫子
    static func catBed(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color, cap: .butt, join: .round) { p in
            p.move(to: pt(3.4, 13.4))
            p.addCurve(to: pt(20.6, 13.4), control1: pt(3.4, 19.8), control2: pt(20.6, 19.8))
            p.closeSubpath()

            p.halfArc(from: pt(3.4, 13.4), to: pt(20.6, 13.4), rise: -3.2)
        }
    }

    /// 草丛：三根草叶
    static func grass(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color, join: .miter) { p in
            p.line(12, 20.4, 12, 9.2)

            p.move(to: pt(7.2, 20.4))
            p.addCurve(to: pt(6.4, 11.2), control1: pt(6, 16.4), control2: pt(5.6, 13.6))

            p.move(to: pt(16.8, 20.4))
            p.addCurve(to: pt(17.6, 11.6), control1: pt(18, 16.4), control2: pt(18.4, 13.8))
        }
    }

    /// 池塘：椭圆加波纹
    static func pond(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color, join: .miter) { p in
            p.ellipse(12, 13.4, 8.6, 5.6)

            p.move(to: pt(8, 12.2))
            p.addQuadCurve(to: pt(12.8, 12.2), control: pt(10.4, 10.4))

            p.move(to: pt(11.6, 15.8))
            p.addQuadCurve(to: pt(16.4, 15.8), control: pt(14, 14))
        }
    }

    /// 栅栏上：两根竖桩加两道横杠
    static func fence(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color) { p in
            p.move(to: pt(6, 20))
            p.addLine(to: pt(6, 8.4))
            p.addLine(to: pt(7.6, 6.6))
            p.addLine(to: pt(9.2, 8.4))
            p.addLine(to: pt(9.2, 20))

            p.move(to: pt(14.8, 20))
            p.addLine(to: pt(14.8, 8.4))
            p.addLine(to: pt(16.4, 6.6))
            p.addLine(to: pt(18, 8.4))
            p.addLine(to: pt(18, 20))

            p.line(3.6, 11.4, 20.4, 11.4)
            p.line(3.6, 15.6, 20.4, 15.6)
        }
    }

    static func location(_ location: Location, size: CGFloat = IconSize.md, color: Color) -> some View {
        Group {
            switch location.id {
            case .mushroomHouse: mushroomHouse(size: size, color: color)
            case .treeHouse: treeHouse(size: size, color: color)
            case .catBed: catBed(size: size, color: color)
            case .grass: grass(size: size, color: color)
            case .pond: pond(size: size, color: color)
            case .fence: fence(size: size, color: color)
            }
        }
    }

    // MARK: - 通用

    /// 聊会儿：带尾巴的对话框
    static func chatBubble(size: CGFloat = IconSize.sm, color: Color) -> some View {
        VectorIcon(size: size, color: color, join: .round) { p in
            p.move(to: pt(3.8, 6.6))
            p.quarterArc(to: pt(6.4, 4), corner: pt(3.8, 4))
            p.addLine(to: pt(17.6, 4))
            p.quarterArc(to: pt(20.2, 6.6), corner: pt(20.2, 4))
            p.addLine(to: pt(20.2, 13.8))
            p.quarterArc(to: pt(17.6, 16.4), corner: pt(20.2, 16.4))
            p.addLine(to: pt(9.8, 16.4))
            p.addLine(to: pt(4.8, 20.4))
            p.addLine(to: pt(4.8, 16.4))
            p.quarterArc(to: pt(3.8, 13.8), corner: pt(3.8, 16.4))
            p.closeSubpath()
        }
    }

    static func close(size: CGFloat = IconSize.sm, color: Color) -> some View {
        VectorIcon(size: size, color: color, lineWidth: 1.9, cap: .round) { p in
            p.line(6.6, 6.6, 17.4, 17.4)
            p.line(17.4, 6.6, 6.6, 17.4)
        }
    }

    static func chevronLeft(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color, lineWidth: 1.9) { p in
            p.move(to: pt(15.2, 4.6))
            p.addLine(to: pt(7.8, 12))
            p.addLine(to: pt(15.2, 19.4))
        }
    }

    static func chevronRight(size: CGFloat = IconSize.sm, color: Color) -> some View {
        VectorIcon(size: size, color: color, lineWidth: 1.9, cap: .butt, join: .miter) { p in
            p.move(to: pt(9, 5))
            p.addLine(to: pt(16, 12))
            p.addLine(to: pt(9, 19))
        }
    }

    static func chevronUp(size: CGFloat = IconSize.sm, color: Color) -> some View {
        VectorIcon(size: size, color: color, lineWidth: 1.8, cap: .butt, join: .miter) { p in
            p.move(to: pt(6, 15))
            p.addLine(to: pt(12, 9))
            p.addLine(to: pt(18, 15))
        }
    }

    static func chevronDown(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color, cap: .butt, join: .miter) { p in
            p.move(to: pt(5, 8))
            p.addLine(to: pt(12, 15))
            p.addLine(to: pt(19, 8))
        }
    }

    static func check(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color, lineWidth: 2.1) { p in
            p.move(to: pt(5, 12.5))
            p.addLine(to: pt(10, 17.5))
            p.addLine(to: pt(19, 7))
        }
    }

    static func plus(size: CGFloat = IconSize.sm, color: Color) -> some View {
        VectorIcon(size: size, color: color, lineWidth: 1.9) { p in
            p.line(12, 5.2, 12, 18.8)
            p.line(5.2, 12, 18.8, 12)
        }
    }

    static func search(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color) { p in
            p.circle(10.6, 10.6, 6.4)
            p.line(15.3, 15.3, 20, 20)
        }
    }

    /// 找团子：放大镜，镜片里是一枚爪印。院子里只有这一处用它。
    static func findCat(size: CGFloat = IconSize.md, color: Color) -> some View {
        ZStack {
            VectorIcon(size: size, color: color) { p in
                p.circle(10.4, 10.4, 7.2)
                p.line(15.7, 15.7, 20.4, 20.4)
            }
            VectorIcon(size: size, color: color, mode: .fill) { p in
                p.ellipse(10.4, 12.3, 2.3, 1.8)
                p.ellipse(7.2, 9.5, 0.9, 1.05)
                p.ellipse(9.6, 8.0, 0.9, 1.05)
                p.ellipse(11.9, 8.2, 0.9, 1.05)
                p.ellipse(13.9, 9.9, 0.85, 1.0)
            }
        }
        .frame(width: size, height: size)
    }

    /// 团子的爪印。留言纸徽标、日记脚印、来源卡都用它。
    static func paw(size: CGFloat = IconSize.sm, color: Color) -> some View {
        VectorIcon(size: size, color: color, mode: .fill) { p in
            p.ellipse(12, 16, 5.4, 4.2)
            p.ellipse(6.4, 10.2, 2.1, 2.4)
            p.ellipse(10.4, 7.6, 2.1, 2.5)
            p.ellipse(14.6, 8, 2.1, 2.5)
            p.ellipse(18, 11.4, 2, 2.3)
        }
    }

    // MARK: - 聊天 / 记录

    /// 照片：圆角框 + 左上一点太阳 + 右下一道山。
    static func photo(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color) { p in
            p.addRoundedRect(
                in: CGRect(x: 3.2, y: 5, width: 17.6, height: 14),
                cornerSize: CGSize(width: 2.6, height: 2.6)
            )
            p.circle(8.6, 9.6, 1.6)
            p.move(to: pt(5.2, 17))
            p.addLine(to: pt(10.2, 12.2))
            p.addLine(to: pt(13.4, 15.2))
            p.addLine(to: pt(15.8, 13))
            p.addLine(to: pt(19.2, 16.4))
        }
    }

    static func mic(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color) { p in
            p.addRoundedRect(
                in: CGRect(x: 9, y: 2.8, width: 6, height: 11.2),
                cornerSize: CGSize(width: 3, height: 3)
            )
            p.halfArc(from: pt(5.4, 11.6), to: pt(18.6, 11.6), rise: 6.6)
            p.line(12, 18.2, 12, 21.2)
        }
    }

    static func sendArrow(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color, lineWidth: 1.8) { p in
            p.line(12, 19.4, 12, 5)
            p.move(to: pt(6.2, 10.8))
            p.addLine(to: pt(12, 5))
            p.addLine(to: pt(17.8, 10.8))
        }
    }

    static func stopSquare(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color, mode: .fill) { p in
            p.addRoundedRect(
                in: CGRect(x: 7, y: 7, width: 10, height: 10),
                cornerSize: CGSize(width: 2.2, height: 2.2)
            )
        }
    }

    /// 语音碎片的波形
    static func waveform(size: CGFloat = IconSize.sm, color: Color) -> some View {
        VectorIcon(size: size, color: color, lineWidth: 1.8) { p in
            p.line(4, 10, 4, 14)
            p.line(8.5, 6, 8.5, 18)
            p.line(13, 9, 13, 15)
            p.line(17.5, 4, 17.5, 20)
            p.line(22, 11, 22, 13)
        }
    }

    /// 私密碎片的锁
    static func lock(size: CGFloat = IconSize.sm, color: Color) -> some View {
        VectorIcon(size: size, color: color, lineWidth: 1.9, cap: .butt, join: .round) { p in
            p.addRoundedRect(
                in: CGRect(x: 4.8, y: 10.4, width: 14.4, height: 9.4),
                cornerSize: CGSize(width: 2.2, height: 2.2)
            )
            p.move(to: pt(8.4, 10.4))
            p.addLine(to: pt(8.4, 7.4))
            p.halfArc(from: pt(8.4, 7.4), to: pt(15.6, 7.4), rise: -3.6)
            p.addLine(to: pt(15.6, 10.4))
        }
    }

    // MARK: - 我的

    /// 长期记忆：折角文档
    static func document(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color, cap: .butt, join: .round) { p in
            p.move(to: pt(5, 4.4))
            p.addLine(to: pt(14.6, 4.4))
            p.addLine(to: pt(19, 8.8))
            p.addLine(to: pt(19, 19.6))
            p.addLine(to: pt(5, 19.6))
            p.closeSubpath()

            p.move(to: pt(14.6, 4.4))
            p.addLine(to: pt(14.6, 8.8))
            p.addLine(to: pt(19, 8.8))

            p.line(8, 13, 15, 13)
            p.line(8, 16.2, 12.4, 16.2)
        }
    }

    /// 在聊的话题：钟
    static func clock(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color) { p in
            p.circle(12, 12, 8.2)
            p.move(to: pt(12, 7))
            p.addLine(to: pt(12, 12.4))
            p.addLine(to: pt(15.6, 14.6))
        }
    }

    /// 不要再提的：废纸篓
    static func trash(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color) { p in
            p.line(4.6, 6.6, 19.4, 6.6)

            p.move(to: pt(9.6, 6.6))
            p.addLine(to: pt(9.6, 4.4))
            p.addLine(to: pt(14.4, 4.4))
            p.addLine(to: pt(14.4, 6.6))

            p.move(to: pt(6.6, 6.6))
            p.addLine(to: pt(7.6, 19.6))
            p.addLine(to: pt(16.4, 19.6))
            p.addLine(to: pt(17.4, 6.6))
        }
    }

    // MARK: - Tab 栏

    /// 陪伴：团子标记（实心猫 + 一道尾巴），和 `tuanzi-mark.svg` 同一份路径
    static func tabCompanion(size: CGFloat = IconSize.md, color: Color) -> some View {
        ZStack {
            VectorIcon(size: size, color: color, mode: .fill) { p in
                p.move(to: pt(9.6, 21.6))
                p.addCurve(to: pt(7.9, 19.9), control1: pt(8.4, 21.6), control2: pt(7.9, 20.9))
                p.addLine(to: pt(7.9, 15.6))
                p.addCurve(to: pt(8.8, 12), control1: pt(7.9, 14.1), control2: pt(8.2, 13))
                p.addCurve(to: pt(8.7, 6.6), control1: pt(8.4, 10.4), control2: pt(8.4, 8.4))
                p.addLine(to: pt(8.2, 2.2))
                p.addCurve(to: pt(9.2, 1.6), control1: pt(8.1, 1.5), control2: pt(8.6, 1.2))
                p.addLine(to: pt(13.1, 4))
                p.addCurve(to: pt(16.9, 4), control1: pt(14.4, 3.7), control2: pt(15.6, 3.7))
                p.addLine(to: pt(20.8, 1.6))
                p.addCurve(to: pt(21.8, 2.2), control1: pt(21.4, 1.2), control2: pt(21.9, 1.5))
                p.addLine(to: pt(21.3, 6.6))
                p.addCurve(to: pt(21.2, 12), control1: pt(21.6, 8.4), control2: pt(21.6, 10.4))
                p.addCurve(to: pt(22.1, 15.6), control1: pt(21.8, 13), control2: pt(22.1, 14.1))
                p.addLine(to: pt(22.1, 19.9))
                p.addCurve(to: pt(20.4, 21.6), control1: pt(22.1, 20.9), control2: pt(21.6, 21.6))
                p.closeSubpath()
            }
            VectorIcon(size: size, color: color, lineWidth: 3.1, cap: .round) { p in
                p.move(to: pt(9, 20.4))
                p.addCurve(to: pt(2.7, 16.8), control1: pt(6.2, 21.2), control2: pt(3.4, 19.6))
                p.addCurve(to: pt(5.1, 11.6), control1: pt(2.1, 14.4), control2: pt(3.2, 12.2))
            }
        }
        .frame(width: size, height: size)
    }

    /// 日记：本子
    static func tabDiary(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color) { p in
            p.move(to: pt(5.6, 3.6))
            p.addLine(to: pt(18.4, 3.6))
            p.addLine(to: pt(18.4, 20.4))
            p.addLine(to: pt(5.6, 20.4))
            p.closeSubpath()

            p.line(8.6, 8, 15.4, 8)
            p.line(8.6, 11.7, 15.4, 11.7)
            p.line(8.6, 15.4, 13, 15.4)
        }
    }

    /// 我的：人像
    static func tabMe(size: CGFloat = IconSize.md, color: Color) -> some View {
        VectorIcon(size: size, color: color, join: .miter) { p in
            p.circle(12, 8.4, 3.9)
            p.move(to: pt(5, 20.6))
            p.addCurve(to: pt(12, 14), control1: pt(5, 16.6), control2: pt(8.1, 14))
            p.addCurve(to: pt(19, 20.6), control1: pt(15.9, 14), control2: pt(19, 16.6))
        }
    }
}
