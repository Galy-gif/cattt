import SwiftUI

struct WorldView: View {
    @EnvironmentObject private var store: AppStore
    var body: some View { WorldCanvas(engine: store.world) }
}

private struct WorldCanvas: View {
    @EnvironmentObject private var store: AppStore
    @ObservedObject var engine: WorldEngine
    @ObservedObject private var frames = CatFrameCache.shared
    @StateObject private var textures = WorldTextureCache()
    var body: some View {
        GeometryReader { proxy in
            let geo=WorldGeometry(screen:proxy.size)
            let sim=engine.simulation
            let camera=store.cameraFollowsCat ? geo.clampCamera(sim.point.x) : store.cameraX
            let action=CatAction(rawValue:sim.action) ?? .blinkLook
            let spec=action.spec
            let scale=geo.catScale(at:sim.point.cgPoint)
            let foot=geo.screenPoint(sim.point.cgPoint,cameraX:camera)
            let clock=action.isGait && sim.isMoving ? sim.travelled / Double(spec.bodyLength * (spec.stride ?? 1)) * spec.cycleDuration() : sim.actionTime
            ZStack(alignment:.topLeading) {
                Color(red:0.42,green:0.68,blue:0.82).zIndex(-2)
                ForEach(engine.scene.tiles.filter { visible($0.rect,camera:camera,geo:geo,margin:0.2) }) { tile in
                    texture(tile.image,rect:tile.rect,camera:camera,geo:geo).zIndex(-1)
                }
                ForEach(engine.scene.objects.filter { visible(engine.scene.objectRect($0),camera:camera,geo:geo,margin:0.1) }) { object in
                    let rect=engine.scene.objectRect(object)
                    texture(object.image,rect:rect,camera:camera,geo:geo)
                        .zIndex(object.depth)
                }
                Ellipse().fill(.black.opacity(0.12)).frame(width:spec.canvas.width*scale*0.48,height:8*scale)
                    .blur(radius:2).position(x:foot.x,y:foot.y+2).zIndex(sim.point.y-0.001)
                frames.image(action.imageName(frame:spec.frame(at:clock)))
                    .resizable().frame(width:spec.canvas.width*scale,height:spec.canvas.height*scale)
                    .scaleEffect(x:sim.facingRight ? 1:-1,y:1)
                    .position(x:foot.x,y:foot.y+(spec.canvas.height/2-spec.footY)*scale)
                    .zIndex(sim.point.y)
                    .accessibilityLabel("团子，"+engine.scene.destinations[sim.current].name)
            }
            .frame(width:proxy.size.width,height:proxy.size.height).clipped()
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance:8)
                .onChanged { store.dragCamera(translation:$0.translation.width) }
                .onEnded { store.endDrag(velocity:$0.velocity.width) })
            .simultaneousGesture(SpatialTapGesture().onEnded { event in
                let p=WorldPoint(x:(event.location.x-proxy.size.width/2)/geo.bgSize.width+camera,y:event.location.y/geo.bgSize.height)
                let front=engine.scene.objects.filter{$0.occlusion != nil && $0.depth > sim.point.y && engine.scene.objectRect($0).contains(p)}
                if let target=front.last?.target {store.interact(with:target);return}
                let catRect=CGRect(x:foot.x-spec.canvas.width*scale/2,y:foot.y-spec.footY*scale,width:spec.canvas.width*scale,height:spec.canvas.height*scale)
                if catRect.contains(event.location) {store.poke();return}
                let objects=engine.scene.objects.filter{($0.hitRect ?? engine.scene.objectRect($0)).contains(p)}.sorted{$0.depth>$1.depth}
                if let target=objects.first(where:{$0.target != nil})?.target {store.interact(with:target)}
                else if WorldRect(x:0.52,y:0.57,width:0.35,height:0.17).contains(p) {store.interact(with:4)}
            })
            .onAppear {store.worldGeometry=geo;frames.preheat();loadTextures(camera:camera,geo:geo)}
            .onChange(of:camera) {loadTextures(camera:camera,geo:geo)}
            .onChange(of:proxy.size) {store.worldGeometry=WorldGeometry(screen:proxy.size)}
        }
    }
    private func loadTextures(camera:Double,geo:WorldGeometry) {
        let tiles=engine.scene.tiles.filter{visible($0.rect,camera:camera,geo:geo,margin:0.2)}.map(\.image)
        let objects=engine.scene.objects.filter{visible(engine.scene.objectRect($0),camera:camera,geo:geo,margin:0.1)}.map(\.image)
        textures.update(Set(tiles+objects))
    }
    private func visible(_ r:WorldRect,camera:Double,geo:WorldGeometry,margin:Double)->Bool {
        r.x+r.width>=camera-geo.halfScreen-margin && r.x<=camera+geo.halfScreen+margin
    }
    private func texture(_ name:String,rect:WorldRect,camera:Double,geo:WorldGeometry)->some View {
        let center=geo.screenPoint(rect.center.cgPoint,cameraX:camera)
        return Group {if let image=textures.images[name] {Image(uiImage:image).resizable()} else {Color.clear}}.frame(width:rect.width*geo.bgSize.width,height:rect.height*geo.bgSize.height)
            .position(center).allowsHitTesting(false)
    }
}
