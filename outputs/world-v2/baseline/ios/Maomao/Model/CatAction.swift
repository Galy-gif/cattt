import SwiftUI

/// 世界层的八个动作。帧图在 `Assets.xcassets/cat/`（`cat-<id>-01…06`，一律朝右，向左在代码里镜像），
/// 尺寸元数据在 `cat-actions.dataset`，由 `assets/tools/export_frames.py` 生成，不要手改。
enum CatAction: String, Codable, CaseIterable {
    case walk, sleepyNod, blinkLook, stretch, treeScratch, tailChase, run, sleepBreathe

    var spec: CatActionSpec { CatActionCatalog.shared.spec(for: self) }

    func imageName(frame: Int) -> String {
        String(format: "cat-%@-%02d", rawValue, frame + 1)
    }

    var isGait: Bool { self == .walk || self == .run }
}

enum CatLoop: String, Codable {
    case loop       // 1 2 3 4 5 6 1 2 …
    case pingpong   // 1 2 3 4 5 6 5 4 3 2 1 2 …
    case once       // 播一遍停在末帧
}

struct CatActionSpec: Codable, Equatable {
    let id: CatAction
    let name: String
    let frameCount: Int
    let fps: Double
    let loop: CatLoop
    /// 画布 pt（参考屏 390 × 844）。同一动作六帧同画布。
    let size: [CGFloat]
    /// 脚底行（pt，从画布顶量）。锚点。
    let footY: CGFloat
    /// 身长 pt。走路速度的单位。
    let bodyLength: CGFloat
    /// 一个循环前进几个身长（只有 walk / run 有）。
    let stride: CGFloat?
    let hitInset: CGFloat

    var canvas: CGSize { CGSize(width: size[0], height: size[1]) }

    /// 一轮的帧数：往返是 2n-2。
    var cycleLength: Int { loop == .pingpong ? max(1, 2 * frameCount - 2) : frameCount }

    /// 播一遍要多久（once 用来决定什么时候切回待机）。
    func cycleDuration(fps override: Double? = nil) -> TimeInterval {
        Double(cycleLength) / (override ?? fps)
    }

    /// 从动作开始经过 t 秒该显示第几帧。
    func frame(at t: TimeInterval, fps override: Double? = nil) -> Int {
        let step = max(0, Int(t * (override ?? fps)))
        switch loop {
        case .once: return min(step, frameCount - 1)
        case .loop: return step % frameCount
        case .pingpong:
            let i = step % cycleLength
            return i < frameCount ? i : cycleLength - i
        }
    }
}

struct CatActionCatalog: Decodable {
    let catPt: CGFloat
    let actions: [CatActionSpec]

    static let shared: CatActionCatalog = {
        guard let data = NSDataAsset(name: "cat-actions")?.data else {
            fatalError("Assets.xcassets/cat-actions.dataset 缺失 —— 跑 assets/tools/export_frames.py")
        }
        do {
            return try JSONDecoder().decode(CatActionCatalog.self, from: data)
        } catch {
            fatalError("cat-actions.json 解析失败：\(error)")
        }
    }()

    func spec(for action: CatAction) -> CatActionSpec {
        guard let spec = actions.first(where: { $0.id == action }) else {
            fatalError("cat-actions.json 里没有 \(action.rawValue)")
        }
        return spec
    }
}

/// 预解码的帧缓存。48 帧 @3x 约 25MB，换来切帧不卡。
@MainActor
final class CatFrameCache: ObservableObject {
    static let shared = CatFrameCache()
    @Published private(set) var images: [String: UIImage] = [:]
    private var loading = false

    func preheat() {
        guard !loading, images.isEmpty else { return }
        loading = true
        let names = CatAction.allCases.flatMap { action in
            (0..<action.spec.frameCount).map { action.imageName(frame: $0) }
        }
        Task.detached(priority: .userInitiated) {
            var decoded: [String: UIImage] = [:]
            for name in names {
                if let image = UIImage(named: name)?.preparingForDisplay() {
                    decoded[name] = image
                }
            }
            let result = decoded
            await MainActor.run { CatFrameCache.shared.images = result }
        }
    }

    func image(_ name: String) -> Image {
        if let cached = images[name] { return Image(uiImage: cached) }
        return Image(name)
    }
}
