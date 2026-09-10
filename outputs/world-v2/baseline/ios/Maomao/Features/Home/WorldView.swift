import SwiftUI

/// 陪伴主页的底层：一张横向长图 + 独立的猫层。
///
/// 相机 x 由 `AppStore` 决定：跟随猫（猫的实时 x）、自由镜头（地点轨 / 「找团子」动画到位）、
/// 拖拽（带橡皮筋）。猫的位置在行程中按时间采样，不经过 @Published，所以 30fps 重绘只在这一层。
struct WorldView: View {
    @EnvironmentObject private var store: AppStore
    @ObservedObject private var frames = CatFrameCache.shared

    var body: some View {
        GeometryReader { proxy in
            let geo = WorldGeometry(screen: proxy.size)
            TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
                let now = context.date
                let pose = store.catPose(at: now)
                let cameraX = store.cameraFollowsCat ? geo.clampCamera(pose.point.x) : store.cameraX
                Color.clear
                    .overlay(alignment: .topLeading) {
                        Image(World.imageName)
                            .resizable()
                            .frame(width: geo.bgSize.width, height: geo.bgSize.height)
                            .offset(x: geo.backgroundOffsetX(cameraX: cameraX))
                    }
                    .overlay {
                        CatSprite(
                            action: store.catAction,
                            start: store.catActionStart,
                            fps: store.catMotion?.fps,
                            foot: geo.screenPoint(pose.point, cameraX: cameraX),
                            facing: pose.facing,
                            scale: geo.catScale(at: pose.point),
                            now: now,
                            frames: frames
                        )
                        .onTapGesture { store.poke() }
                        .accessibilityElement()
                        .accessibilityLabel(store.catLocation.name + "的团子")
                        .accessibilityAddTraits(.isButton)
                    }
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .clipped()
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 8)
                    .onChanged { store.dragCamera(translation: $0.translation.width) }
                    .onEnded { store.endDrag(velocity: $0.velocity.width) }
            )
            // 点猫：场景轻推一下，0.35s 回落。
            .scaleEffect(store.reaction == nil ? 1 : Metrics.pokeScale)
            .onAppear {
                store.worldGeometry = geo
                frames.preheat()
            }
            .onChange(of: proxy.size) { store.worldGeometry = WorldGeometry(screen: proxy.size) }
        }
    }
}

/// 一只猫：按 (脚底屏幕点, 朝向, 动作, 帧) 画。锚点在脚底；向左用 x 镜像；脚下一枚椭圆软影。
struct CatSprite: View {
    let action: CatAction
    let start: Date
    /// 行程中帧率锁到速度；nil 用动作自己的 fps。
    let fps: Double?
    let foot: CGPoint
    let facing: Facing
    let scale: CGFloat
    let now: Date
    let frames: CatFrameCache

    var body: some View {
        let spec = action.spec
        let frame = spec.frame(at: now.timeIntervalSince(start), fps: fps)
        let canvas = spec.canvas
        let anchor = UnitPoint(x: 0.5, y: spec.footY / canvas.height)

        ZStack {
            Ellipse()
                .fill(Palette.ink.opacity(0.16))
                .frame(width: canvas.width * 0.5 * scale, height: 10 * scale)
                .blur(radius: 1.5)
                .position(x: foot.x, y: foot.y + 3 * scale)
                .allowsHitTesting(false)

            frames.image(action.imageName(frame: frame))
                .resizable()
                .frame(width: canvas.width, height: canvas.height)
                .contentShape(Rectangle().inset(by: spec.hitInset))
                .scaleEffect(x: facing == .left ? -scale : scale, y: scale, anchor: anchor)
                .position(x: foot.x, y: foot.y + canvas.height / 2 - spec.footY)
        }
    }
}
