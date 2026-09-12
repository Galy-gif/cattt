import SwiftUI

/// Sprite actions use a shared metadata catalog and explicit ground/support anchors.
/// Versioned atlas import lives in assets/tools/package_world_v3.swift.
enum CatAction: String, Codable, CaseIterable {
    case walk, sleepyNod, blinkLook, stretch, treeScratch, tailChase, run, sleepBreathe, walkToward, walkAway, scratchEnter, scratchExit, jumpPrepare, jumpUp, climbIn, climbOut, jumpDown, land, perchLook, perchSleep, flowerPlay, turn, nestLook, nestSleep, railReach, railClimb, railSettle, waterLook, waterReach, waterTap, waterWatch, waterShake, waterRest, waterRecover
    // v5 树窝整段（逐帧 v5，见 docs/specs/逐帧v5-出图与播放规则-2026-09-11.md）
    case v5Prepare, v5Air, v5Grip, v5Enter, v5Look, v5Sleep, v5Out, v5Leap, v5Fall, v5Land
    // v6 门口待机、情绪、喝水（frames-v6，见 docs/specs/情绪-喝水-时段与雨天-方案-2026-09-12.md）
    case sitLook, headTilt, groom, moodHappy, moodSulk, moodSadIn, moodSad, moodSadOut, drinkDown, drinkLap, drinkUp, sitToStand, standToSit

    var spec: CatActionSpec { CatActionCatalog.shared.spec(for: self) }

    /// v5 帧缺失时退回的 v4 动作。
    var v4Fallback: CatAction? {
        switch self {
        case .v5Prepare: return .jumpPrepare
        case .v5Air: return .jumpUp
        case .v5Grip, .v5Enter: return .climbIn
        case .v5Look: return .nestLook
        case .v5Sleep: return .nestSleep
        case .v5Out, .v5Leap: return .climbOut
        case .v5Fall: return .jumpDown
        case .v5Land: return .land
        default: return nil
        }
    }

    /// 播放时实际用哪一套帧：v5 帧齐全用 v5，否则用 v4 回退。
    var resolved: CatAction {
        guard let fallback = v4Fallback, !CatActionCatalog.shared.hasV5 else { return self }
        return fallback
    }

    func imageName(frame: Int) -> String {
        String(format: "%@-%@-%02d", spec.imagePrefix ?? "cat", rawValue, frame + 1)
    }

    var isGait: Bool { [.walk, .run, .walkToward, .walkAway].contains(self) }
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
    let imagePrefix: String?
    let frameDurations: [Double]?
    /// 腾空帧：锚点是身体重心。弧线起点处重心相对起跳锚点的偏移、终点处相对落点锚点的偏移（pt，素材朝右，y 向下）。
    let airFrom: [CGFloat]?
    let airTo: [CGFloat]?
    /// 喝水帧：嘴相对锚点的位置（pt，x 向前、y 向上），场景配置用它算碗前落脚点。
    let mouth: [CGFloat]?

    var canvas: CGSize { CGSize(width: size[0], height: size[1]) }

    /// 一轮的帧数：往返是 2n-2。
    var cycleLength: Int { loop == .pingpong ? max(1, 2 * frameCount - 2) : frameCount }

    /// 播一遍要多久（once 用来决定什么时候切回待机）。
    func cycleDuration(fps override: Double? = nil) -> TimeInterval {
        frameDurations?.reduce(0,+) ?? (Double(cycleLength) / (override ?? fps))
    }

    /// 从动作开始经过 t 秒该显示第几帧。
    func frame(at t: TimeInterval, fps override: Double? = nil) -> Int {
        if let durations=frameDurations, override == nil, durations.count == frameCount {
            let total=durations.reduce(0,+)
            if loop == .once && t >= total { return frameCount-1 }
            var remaining=max(0,t).truncatingRemainder(dividingBy:total)
            for (i,d) in durations.enumerated() {if remaining < d {return i};remaining -= d}
            return frameCount-1
        }
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
        guard let data = NSDataAsset(name: "cat-actions-v2")?.data else {
            fatalError("Assets.xcassets/cat-actions.dataset 缺失 —— 跑 assets/tools/export_frames.py")
        }
        do {
            let catalog=try JSONDecoder().decode(CatActionCatalog.self, from: data)
            for action in CatAction.allCases {
                // v5 可以整组缺失（回退 v4）；只要出现就必须完整合法。
                if action.v4Fallback != nil && !catalog.actions.contains(where:{$0.id == action}) {continue}
                guard let spec=catalog.actions.first(where:{$0.id == action}), spec.frameCount>0, spec.fps>0,
                      spec.size.count==2, spec.size.allSatisfy({$0>0}),spec.footY>0,spec.footY<=spec.size[1] else {
                    throw CocoaError(.fileReadCorruptFile)
                }
                if let durations=spec.frameDurations, durations.count != spec.frameCount || durations.contains(where:{$0<=0}) {throw CocoaError(.fileReadCorruptFile)}
                // Frame existence is validated by the asset packaging check; avoid synchronous decoding here.
            }
            return catalog
        } catch {
            fatalError("cat-actions.json 解析失败：\(error)")
        }
    }()

    func has(_ action: CatAction) -> Bool { actions.contains { $0.id == action } }
    /// v5 树窝整段是否可用：十个动作都在才用，缺一个就整段回退 v4，不混用。
    var hasV5: Bool { CatAction.allCases.filter { $0.v4Fallback != nil }.allSatisfy(has) }

    func spec(for action: CatAction) -> CatActionSpec {
        if let fallback = action.v4Fallback, !hasV5 { return spec(for: fallback) }
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
        let catalog = CatActionCatalog.shared
        // 只有树窝独用的 v4 帧会被 v5 取代；climbOut / jumpDown / land 栅栏还在用。
        let superseded: Set<CatAction> = catalog.hasV5 ? [.jumpPrepare, .jumpUp, .climbIn, .nestLook, .nestSleep] : []
        let names = CatAction.allCases.filter { !superseded.contains($0) && (catalog.hasV5 || $0.v4Fallback == nil) }.flatMap { action in
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
