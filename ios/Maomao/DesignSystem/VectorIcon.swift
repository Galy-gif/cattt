import SwiftUI

/// 图标全部是设计稿里手写的 SVG 路径（非任何图标库），这里原样搬成 `Path`。
/// 坐标一律在 24 × 24 的设计空间里写，`VectorIcon` 负责缩放 —— 描边宽度跟着缩，
/// 所以 18px 的地点图标和 22px 的返回箭头看起来是同一套笔触。
struct VectorShape: Shape {
    // Shape 在 iOS 17 SDK 里要求 Sendable，所以画法闭包也标上 —— 图标全是无捕获字面量。
    let draw: @Sendable (inout Path) -> Void

    func path(in rect: CGRect) -> Path {
        var path = Path()
        draw(&path)
        let scale = min(rect.width, rect.height) / 24
        return path.applying(CGAffineTransform(scaleX: scale, y: scale))
    }
}

struct VectorIcon: View {
    enum Mode { case stroke, fill }

    var size: CGFloat
    var color: Color
    var lineWidth: CGFloat = 1.7
    var cap: CGLineCap = .round
    var join: CGLineJoin = .round
    var mode: Mode = .stroke
    var draw: @Sendable (inout Path) -> Void

    var body: some View {
        Group {
            switch mode {
            case .stroke:
                VectorShape(draw: draw).stroke(
                    color,
                    style: StrokeStyle(
                        lineWidth: lineWidth * size / 24,
                        lineCap: cap,
                        lineJoin: join
                    )
                )
            case .fill:
                VectorShape(draw: draw).fill(color)
            }
        }
        .frame(width: size, height: size)
    }
}

extension Path {
    /// 圆角四分之一弧，用标准三次贝塞尔逼近（kappa）。
    /// `corner` 是两条切线的交点 —— 也就是 SVG 里那个「本来的直角」。
    mutating func quarterArc(to end: CGPoint, corner: CGPoint) {
        let k: CGFloat = 0.5522847498
        let start = currentPoint ?? corner
        addCurve(
            to: end,
            control1: CGPoint(x: start.x + (corner.x - start.x) * k,
                              y: start.y + (corner.y - start.y) * k),
            control2: CGPoint(x: end.x + (corner.x - end.x) * k,
                              y: end.y + (corner.y - end.y) * k)
        )
    }

    /// 水平两点之间的半椭圆弧（SVG `a rx ry 0 0 s` 的半圈情形）。
    /// `rise` 是拱起的高度，负数向上、正数向下。
    mutating func halfArc(from a: CGPoint, to b: CGPoint, rise: CGFloat) {
        let k: CGFloat = 0.5522847498
        let rx = (b.x - a.x) / 2
        let apex = CGPoint(x: a.x + rx, y: a.y + rise)
        move(to: a)
        addCurve(
            to: apex,
            control1: CGPoint(x: a.x, y: a.y + rise * k),
            control2: CGPoint(x: apex.x - rx * k, y: apex.y)
        )
        addCurve(
            to: b,
            control1: CGPoint(x: apex.x + rx * k, y: apex.y),
            control2: CGPoint(x: b.x, y: b.y + rise * k)
        )
    }

    mutating func circle(_ cx: CGFloat, _ cy: CGFloat, _ r: CGFloat) {
        addEllipse(in: CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2))
    }

    mutating func ellipse(_ cx: CGFloat, _ cy: CGFloat, _ rx: CGFloat, _ ry: CGFloat) {
        addEllipse(in: CGRect(x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2))
    }

    mutating func line(_ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat) {
        move(to: CGPoint(x: x1, y: y1))
        addLine(to: CGPoint(x: x2, y: y2))
    }
}

func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x, y: y) }
