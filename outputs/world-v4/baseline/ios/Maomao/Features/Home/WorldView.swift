import SwiftUI

struct WorldView: View {
    @EnvironmentObject private var store: AppStore
    var body: some View { WorldCanvas(engine:store.world,textures:store.worldTextures) }
}

private struct WorldCanvas: View {
    @EnvironmentObject private var store: AppStore
    @ObservedObject var engine:WorldEngine
    @ObservedObject var textures:WorldTextureCache
    @ObservedObject private var frames=CatFrameCache.shared

    var body:some View {
        GeometryReader { proxy in
            let geo=WorldGeometry(screen:proxy.size)
            let camera=store.cameraX
            ZStack(alignment:.topLeading) {
                Color(red:0.42,green:0.68,blue:0.82).zIndex(-2)
                texture("world-v3-ground-preview",rect:WorldRect(x:0,y:0,width:1,height:1),geo:geo).zIndex(-1.5)
                ForEach(engine.scene.tiles.filter {visible($0.rect,camera:camera,geo:geo)}) { tile in
                    texture(tile.image,rect:tile.rect,geo:geo).zIndex(-1)
                }
                ForEach(engine.scene.objects) { object in
                    objectLayer(object,geo:geo).zIndex(object.depth)
                }
                shadow(geo:geo).zIndex(engine.simulation.point.y-0.001)
                cat(geo:geo).zIndex(engine.simulation.interaction?.isElevated == true ? 0.85:engine.simulation.point.y)
            }
            .frame(width:proxy.size.width,height:proxy.size.height).clipped()
            .transaction {$0.animation=nil;$0.disablesAnimations=true}
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance:8)
                .onChanged {store.dragCamera(translation:$0.translation.width)}
                .onEnded {store.endDrag(velocity:$0.velocity.width)})
            .simultaneousGesture(SpatialTapGesture().onEnded {tap($0.location,geo:geo)})
            .onAppear {store.worldGeometry=geo;frames.preheat();store.prepareWorldTextures()}
            .onChange(of:camera) {store.prepareWorldTextures()}
            .onChange(of:proxy.size) {store.worldGeometry=WorldGeometry(screen:proxy.size);store.prepareWorldTextures()}
        }
    }
    private func visible(_ r:WorldRect,camera:Double,geo:WorldGeometry)->Bool {
        r.x+r.width>=camera-geo.halfScreen-0.02 && r.x<=camera+geo.halfScreen+0.02
    }
    private func texture(_ name:String,rect:WorldRect,source:WorldRect? = nil,cutouts:[WorldRect] = [],outline:[WorldPoint]? = nil,cutoutPaths:[[WorldPoint]] = [],geo:WorldGeometry)->some View {
        let w=rect.width*geo.bgSize.width,h=rect.height*geo.bgSize.height
        let center=geo.screenPoint(rect.center.cgPoint,cameraX:store.cameraX)
        return Group {
            if let image=textures.images[name] {
                let source=source ?? WorldRect(x:0,y:0,width:1,height:1)
                Image(uiImage:image).resizable()
                    .frame(width:w/source.width,height:h/source.height)
                    .offset(x:-source.x*w/source.width,y:-source.y*h/source.height)
                    .frame(width:w,height:h,alignment:.topLeading).clipped()
            } else {Color.clear.frame(width:w,height:h)}
        }
        .modifier(SceneCutout(holes:cutouts,outline:outline,cutoutPaths:cutoutPaths))
        .position(center)
        .frame(width:geo.screen.width,height:geo.screen.height)
        .allowsHitTesting(false)
    }
    private func objectLayer(_ object:WorldScene.Object,geo:WorldGeometry)->some View {
        let rect=engine.scene.objectRect(object)
        let sequence=engine.simulation.interaction
        let angle=object.motion == "nest" ? sequence?.nestSwing ?? 0:object.motion == "flower" ? sequence?.flowerBend ?? 0:0
        let pivot=geo.screenPoint(CGPoint(x:rect.x+rect.width/2,y:rect.y+(object.motion == "flower" ? rect.height:0)),cameraX:store.cameraX)
        return texture(object.image,rect:rect,source:object.sourceRect,cutouts:object.cutouts ?? [],outline:object.outline,cutoutPaths:object.cutoutPaths ?? [],geo:geo)
            .rotationEffect(.degrees(angle),anchor:UnitPoint(x:pivot.x/geo.screen.width,y:pivot.y/geo.screen.height))
    }
    private func catScale(_ geo:WorldGeometry)->Double {
        let sequence=engine.simulation.interaction
        let factor:Double
        if sequence?.stage == .nestEnter {factor=1-0.25*(sequence?.progress ?? 0)}
        else if sequence?.stage == .nestOut {factor=0.75+0.25*(sequence?.progress ?? 0)}
        else if sequence?.inNest == true {factor=0.75}
        else {factor=1}
        return geo.catScale(at:engine.simulation.point.cgPoint)*factor
    }
    private func cat(geo:WorldGeometry)->some View {
        let sim=engine.simulation
        let action=CatAction(rawValue:sim.action) ?? .blinkLook
        let spec=action.spec,scale=catScale(geo)
        let foot=geo.screenPoint(sim.renderPoint.cgPoint,cameraX:store.cameraX)
        let clock=action.isGait && sim.isMoving ? sim.travelled/Double(spec.bodyLength*(spec.stride ?? 1))*spec.cycleDuration():sim.actionTime
        let breathing=action == .perchSleep ? 1+sin(sim.actionTime*1.6)*0.012:1
        let nestRect=engine.scene.objects.first(where:{$0.id == "nest-back"})?.rect
        let pivot=geo.screenPoint(CGPoint(x:(nestRect?.x ?? 0)+(nestRect?.width ?? 0)/2,y:nestRect?.y ?? 0),cameraX:store.cameraX)
        return frames.image(action.imageName(frame:spec.frame(at:clock)))
            .resizable().frame(width:spec.canvas.width*scale,height:spec.canvas.height*scale)
            .scaleEffect(x:sim.facingRight ? 1:-1,y:breathing,anchor:.center)
            .position(x:foot.x,y:foot.y+(spec.canvas.height/2-spec.footY)*scale)
            .frame(width:geo.screen.width,height:geo.screen.height)
            .modifier(CatNestMask(rect:nestRect,sequence:sim.interaction,geo:geo,camera:store.cameraX))
            .rotationEffect(.degrees(sim.interaction?.inNest == true ? sim.interaction?.nestSwing ?? 0:0),anchor:UnitPoint(x:pivot.x/geo.screen.width,y:pivot.y/geo.screen.height))
            .accessibilityLabel("团子，"+engine.scene.destinations[sim.current].name)
    }
    private func shadow(geo:WorldGeometry)->some View {
        let sim=engine.simulation
        let foot=geo.screenPoint(sim.point.cgPoint,cameraX:store.cameraX)
        let hidden=sim.interaction?.isElevated == true
        return Ellipse().fill(.black.opacity(hidden ? 0:0.12))
            .frame(width:48*geo.catScale(at:sim.point.cgPoint),height:7)
            .blur(radius:2).position(x:foot.x,y:foot.y+2)
    }
    private func tap(_ location:CGPoint,geo:WorldGeometry) {
        let sim=engine.simulation
        let p=WorldPoint(x:(location.x-geo.screen.width/2)/geo.bgSize.width+store.cameraX,y:location.y/geo.bgSize.height)
        let objects=engine.scene.objects.filter{($0.hitRect ?? engine.scene.objectRect($0)).contains(p)}.sorted{$0.depth>$1.depth}
        if let front=objects.first(where:{$0.occlusion != nil && $0.depth>sim.point.y}),let target=front.target {store.interact(with:target);return}
        let action=CatAction(rawValue:sim.action) ?? .blinkLook,spec=action.spec,scale=catScale(geo)
        let foot=geo.screenPoint(sim.renderPoint.cgPoint,cameraX:store.cameraX)
        let catRect=CGRect(x:foot.x-spec.canvas.width*scale/2,y:foot.y-spec.footY*scale,width:spec.canvas.width*scale,height:spec.canvas.height*scale)
        if catRect.contains(location) {store.poke();return}
        if let target=objects.first(where:{$0.target != nil})?.target {store.interact(with:target)}
        else if WorldRect(x:0.52,y:0.57,width:0.35,height:0.17).contains(p) {store.interact(with:4)}
    }
}

private struct RegionMask:Shape {
    let holes:[WorldRect]
    let outline:[WorldPoint]?
    let cutoutPaths:[[WorldPoint]]
    func path(in rect:CGRect)->Path {
        func polygon(_ points:[WorldPoint])->Path {
            var p=Path()
            for (i,point) in points.enumerated() {
                let v=CGPoint(x:point.x*rect.width,y:point.y*rect.height)
                if i==0 {p.move(to:v)} else {p.addLine(to:v)}
            }
            p.closeSubpath();return p
        }
        var path=outline.map(polygon) ?? Path(rect)
        for points in cutoutPaths {path.addPath(polygon(points))}
        for h in holes {path.addRect(CGRect(x:h.x*rect.width,y:h.y*rect.height,width:h.width*rect.width,height:h.height*rect.height))}
        return path
    }
}
private struct NestOpening:Shape {
    let rect:WorldRect
    let sequence:WorldInteraction
    let geo:WorldGeometry
    let camera:Double
    func path(in bounds:CGRect)->Path {
        let p=geo.screenPoint(CGPoint(x:rect.x+rect.width*0.17,y:rect.y+rect.height*0.51),cameraX:camera)
        let opening=CGRect(x:p.x,y:p.y,width:rect.width*0.65*geo.bgSize.width,height:rect.height*0.33*geo.bgSize.height)
        var path=Path(ellipseIn:opening)
        // Rear body is outside the rim while climbing; the opening takes over progressively.
        let outside=sequence.stage == .nestEnter ? 1-sequence.progress:sequence.stage == .nestOut ? sequence.progress:0
        if outside>0 {
            path.addRect(CGRect(x:opening.midX-80*outside,y:opening.maxY-8,width:160*outside,height:140*outside))
        }
        return path
    }
}


private struct SceneCutout:ViewModifier {
    let holes:[WorldRect]
    let outline:[WorldPoint]?
    let cutoutPaths:[[WorldPoint]]
    @ViewBuilder func body(content:Content)->some View {
        if let outline {
            if holes.isEmpty && cutoutPaths.isEmpty {
                content.mask(RegionMask(holes:[],outline:outline,cutoutPaths:[]).fill())
            } else {
                content.mask(RegionMask(holes:holes,outline:nil,cutoutPaths:cutoutPaths).fill(style:FillStyle(eoFill:true)))
                    .mask(RegionMask(holes:[],outline:outline,cutoutPaths:[]).fill())
            }
        } else if !holes.isEmpty || !cutoutPaths.isEmpty {
            content.mask(RegionMask(holes:holes,outline:nil,cutoutPaths:cutoutPaths).fill(style:FillStyle(eoFill:true)))
        } else {content}
    }
}
private struct CatNestMask:ViewModifier {
    let rect:WorldRect?
    let sequence:WorldInteraction?
    let geo:WorldGeometry
    let camera:Double
    @ViewBuilder func body(content:Content)->some View {
        if let sequence,sequence.inNest,let rect {content.mask(NestOpening(rect:rect,sequence:sequence,geo:geo,camera:camera).fill())}
        else {content}
    }
}
