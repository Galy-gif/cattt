import SwiftUI

/// 小院是一张横向长图。所有位置都用**归一化坐标**（x、y 各 0–1，相对整张背景图），
/// 换高清背景时坐标不用改。几何计算在「参考屏 pt 空间」里做：高 844，宽 = 844 × 长宽比。
enum World {
    static let imageName = "courtyard-felt"

    /// 背景宽 / 高。从图上读，换图自动跟着变。
    static let aspect: CGFloat = 1.5

    /// 参考屏下整张背景的 pt 尺寸（≈ 1779 × 844）。
    static var refSize: CGSize { CGSize(width: Metrics.referenceHeight * aspect, height: Metrics.referenceHeight) }

    /// 猫能落脚的最远一行（最上）和前景行走带。纵深缩放在这两行之间插值。
    static let farY: CGFloat = 0.60
    static let nearY: CGFloat = 0.82   // 再往下就进底部 Tab 栏了

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

