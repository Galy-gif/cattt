import SwiftUI

/// 小院是一张横向长图。所有位置都用**归一化坐标**（x、y 各 0–1，相对整张背景图），
/// 换高清背景时坐标不用改。几何计算在「参考屏 pt 空间」里做：高 844，宽 = 844 × 长宽比。
enum World {
    static let imageName = "courtyard-felt"

    /// 背景宽 / 高。从图上读，换图自动跟着变。
    static let aspect: CGFloat = {
        let size = UIImage(named: imageName)?.size ?? CGSize(width: 1821, height: 864)
        return size.width / size.height
    }()

    /// 参考屏下整张背景的 pt 尺寸（≈ 1779 × 844）。
    static var refSize: CGSize { CGSize(width: Metrics.referenceHeight * aspect, height: Metrics.referenceHeight) }

    /// 猫能落脚的最远一行（最上）和前景行走带。纵深缩放在这两行之间插值。
    static let farY: CGFloat = 0.60
    static let nearY: CGFloat = 0.885   // 再往下就进底部 Tab 栏了

    /// 归一化位移 → 参考屏 pt 距离。
    static func distance(_ a: CGPoint, _ b: CGPoint) -> CGFloat {
        let dx = (b.x - a.x) * refSize.width
        let dy = (b.y - a.y) * refSize.height
        return (dx * dx + dy * dy).squareRoot()
    }
}

enum Facing: Equatable {
    case left, right
}

/// 当前屏幕上的世界几何：背景按屏高铺满，横向比屏宽长；相机 x（归一化）决定看哪一段。
struct WorldGeometry: Equatable {
    let screen: CGSize

    static let placeholder = WorldGeometry(screen: CGSize(width: Metrics.referenceWidth, height: Metrics.referenceHeight))

    var bgSize: CGSize { CGSize(width: screen.height * World.aspect, height: screen.height) }

    /// 半个屏幕对应的归一化宽度 —— 相机 x 的可取范围是 [half, 1 - half]。
    var halfScreen: CGFloat { screen.width / 2 / bgSize.width }

    func clampCamera(_ x: CGFloat) -> CGFloat {
        min(max(x, halfScreen), 1 - halfScreen)
    }

    /// 相机在 x 时，归一化点落在屏幕哪里。
    func screenPoint(_ p: CGPoint, cameraX: CGFloat) -> CGPoint {
        CGPoint(x: (p.x - cameraX) * bgSize.width + screen.width / 2, y: p.y * bgSize.height)
    }

    /// 背景图左上角相对屏幕的 x 偏移。
    func backgroundOffsetX(cameraX: CGFloat) -> CGFloat {
        screen.width / 2 - cameraX * bgSize.width
    }

    /// 猫的整体缩放：参考屏 844 高为 1，再叠一点纵深 —— 越靠前（下）越大。
    func catScale(at p: CGPoint) -> CGFloat {
        let base = screen.height / Metrics.referenceHeight
        let t = min(max((p.y - World.farY) / (World.nearY - World.farY), 0), 1)
        return base * (0.85 + 0.15 * t)
    }

    func isVisible(_ x: CGFloat, cameraX: CGFloat, margin: CGFloat = 0.02) -> Bool {
        abs(x - cameraX) < halfScreen + margin
    }
}

/// 一段行程：折线路径 + 出发时刻 + 速度。视图每帧按时间采样，不经过 @Published。
struct CatMotion: Equatable {
    let points: [CGPoint]
    let start: Date
    let gait: CatAction
    /// 参考屏 pt / s
    let speed: CGFloat
    /// 每段的累计结束时刻（秒）
    let segmentEnds: [TimeInterval]

    init(points: [CGPoint], start: Date, gait: CatAction, speed: CGFloat) {
        self.points = points
        self.start = start
        self.gait = gait
        self.speed = speed
        var ends: [TimeInterval] = []
        var acc: TimeInterval = 0
        for i in 1..<max(points.count, 2) {
            let a = points[i - 1], b = points[min(i, points.count - 1)]
            acc += TimeInterval(World.distance(a, b) / speed)
            ends.append(acc)
        }
        self.segmentEnds = ends
    }

    var duration: TimeInterval { segmentEnds.last ?? 0 }
    var end: Date { start.addingTimeInterval(duration) }
    var destination: CGPoint { points.last ?? .zero }

    /// 走路帧率锁到速度：一个循环前进 stride 个身长。
    var fps: Double {
        let spec = gait.spec
        let strideLength = (spec.stride ?? 1) * spec.bodyLength
        return Double(spec.frameCount) * Double(speed / strideLength)
    }

    /// 某时刻猫在哪、朝哪。
    func sample(at date: Date, fallbackFacing: Facing) -> (point: CGPoint, facing: Facing, done: Bool) {
        let t = date.timeIntervalSince(start)
        guard points.count >= 2, t >= 0 else { return (points.first ?? .zero, fallbackFacing, points.count < 2) }
        if t >= duration {
            let a = points[points.count - 2], b = points[points.count - 1]
            return (b, facing(from: a, to: b, fallback: fallbackFacing), true)
        }
        var segStart: TimeInterval = 0
        for (i, segEnd) in segmentEnds.enumerated() {
            if t <= segEnd {
                let a = points[i], b = points[i + 1]
                let u = segEnd > segStart ? CGFloat((t - segStart) / (segEnd - segStart)) : 1
                let p = CGPoint(x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u)
                return (p, facing(from: a, to: b, fallback: fallbackFacing), false)
            }
            segStart = segEnd
        }
        return (destination, fallbackFacing, true)
    }

    private func facing(from a: CGPoint, to b: CGPoint, fallback: Facing) -> Facing {
        if abs(b.x - a.x) < 0.002 { return fallback }
        return b.x > a.x ? .right : .left
    }

    /// 两点之间怎么走：远的先斜着下到前景行走带、沿带走、再斜着上去；近的直线。
    /// 斜段横向走 |dy| 的 1.6 倍，避免侧视帧「原地下沉」。两头斜段要交叉就退回直线。
    static func route(from a: CGPoint, to b: CGPoint) -> [CGPoint] {
        let w = World.refSize.width, h = World.refSize.height
        let dxPt = abs(b.x - a.x) * w
        guard dxPt >= 220 else { return [a, b] }
        let dir: CGFloat = b.x > a.x ? 1 : -1
        var descend: CGPoint?
        var ascend: CGPoint?
        if a.y < World.nearY - 0.03 {
            let run = (World.nearY - a.y) * h * 1.6 / w
            descend = CGPoint(x: a.x + dir * run, y: World.nearY)
        }
        if b.y < World.nearY - 0.03 {
            let run = (World.nearY - b.y) * h * 1.6 / w
            ascend = CGPoint(x: b.x - dir * run, y: World.nearY)
        }
        let first = descend?.x ?? a.x
        let last = ascend?.x ?? b.x
        // 斜段互相越过了：路太短，直线过去
        if dir * (last - first) < 0 { return [a, b] }
        var pts = [a]
        if let descend { pts.append(descend) }
        if let ascend { pts.append(ascend) }
        pts.append(b)
        return pts
    }
}
