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
    // 沿用高清前毛毡小院的柔和色感；底板、高清地块与前景统一处理，猫保持原色。
    private let scenerySaturation = 0.70

    var body:some View {
        GeometryReader { proxy in
            let geo=WorldGeometry(screen:proxy.size)
            let camera=store.cameraX
            ZStack(alignment:.topLeading) {
                Color(red:0.42,green:0.68,blue:0.82).saturation(scenerySaturation).zIndex(-2)
                texture("world-v3-ground-preview",rect:WorldRect(x:0,y:0,width:1,height:1),geo:geo).zIndex(-1.5)
                ForEach(engine.scene.tiles.filter {visible($0.rect,camera:camera,geo:geo)}) { tile in
                    texture(tile.image,rect:tile.rect,geo:geo).zIndex(-1)
                }
                ForEach(engine.scene.objects) { object in
                    objectLayer(object,geo:geo).zIndex(object.depth)
                }
                water(geo:geo).saturation(scenerySaturation).zIndex(0.53)
                shadow(geo:geo).zIndex(engine.simulation.point.y-0.001)
                cat(geo:geo).zIndex(engine.simulation.interaction?.inNest == true ? 0.70:engine.simulation.interaction?.isElevated == true ? 0.80:engine.simulation.point.y)
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
                    .saturation(scenerySaturation)
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
        // 信箱旗子绕杆底转，和花茎一样轴在底边中点；角度由 AppStore 逐帧插值（画布关了隐式动画）。
        let angle=object.motion == "nest" ? sequence?.nestSwing ?? 0:object.motion == "flower" ? sequence?.flowerBend ?? 0:object.motion == "flag" ? store.flagAngle:0
        let pivot=geo.screenPoint(CGPoint(x:rect.x+rect.width/2,y:rect.y+(object.motion == "flower" || object.motion == "flag" ? rect.height:0)),cameraX:store.cameraX)
        return texture(object.image,rect:rect,source:object.sourceRect,cutouts:object.cutouts ?? [],outline:object.outline,cutoutPaths:object.cutoutPaths ?? [],geo:geo)
            .rotationEffect(.degrees(angle),anchor:UnitPoint(x:pivot.x/geo.screen.width,y:pivot.y/geo.screen.height))
    }
    private func catScale(_ geo:WorldGeometry)->Double {
        geo.catScale(at:engine.simulation.point.cgPoint)
    }
    private func cat(geo:WorldGeometry)->some View {
        let sim=engine.simulation
        let action=CatAction(rawValue:sim.action) ?? .blinkLook
        let spec=action.spec,scale=catScale(geo)
        let foot=geo.screenPoint(sim.renderPoint.cgPoint,cameraX:store.cameraX)
        let clock=action.isGait && sim.isMoving ? sim.travelled/Double(spec.bodyLength*(spec.stride ?? 1))*spec.cycleDuration():sim.actionTime
        let breathing=(action == .perchSleep || action == .nestSleep) ? 1+sin(sim.actionTime*1.6)*0.012:1
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
        let height=abs(sim.renderPoint.y-sim.point.y)
        let opacity=sim.interaction?.inNest == true || sim.interaction?.onRail == true ? 0:max(0.015,0.12-height*0.7)
        return Ellipse().fill(.black.opacity(opacity))
            .frame(width:48*geo.catScale(at:sim.point.cgPoint),height:7)
            .blur(radius:2).position(x:geo.screenPoint(CGPoint(x:sim.renderPoint.x,y:sim.point.y),cameraX:store.cameraX).x,y:foot.y+2)
    }
    private func water(geo:WorldGeometry)->some View {
        Canvas { context,size in
            guard let sequence=engine.simulation.interaction, sequence.isPond,
                  let contact=engine.scene.waterContact,let outline=engine.scene.waterOutline else {return}
            var mask=Path()
            for (i,p) in outline.enumerated() {
                let point=geo.screenPoint(p.cgPoint,cameraX:store.cameraX)
                if i==0 {mask.move(to:point)} else {mask.addLine(to:point)}
            }
            mask.closeSubpath();context.clip(to:mask)
            let center=geo.screenPoint(contact.cgPoint,cameraX:store.cameraX)
            let scale=geo.screen.height/844
            for age in sequence.rippleAges {
                let radius=(5+age*28)*scale
                let rect=CGRect(x:center.x-radius,y:center.y-radius*0.28,width:radius*2,height:radius*0.56)
                context.stroke(Path(ellipseIn:rect),with:.color(.white.opacity(max(0,0.7-age*0.44))),lineWidth:1.2*scale)
                if age<0.42 {
                    for i in 0..<4 {
                        let side=Double(i)-1.5
                        let x=center.x+side*age*30*scale
                        let y=center.y-(sin(age/0.42 * .pi)*12+Double(i%2)*3)*scale
                        context.fill(Path(ellipseIn:CGRect(x:x,y:y,width:2.2*scale,height:3.5*scale)),with:.color(Color(red:0.75,green:0.94,blue:1).opacity(1-age/0.42)))
                    }
                }
            }
            if sequence.stage == .pondShake {
                let t=sequence.progress
                for i in 0..<3 {
                    let x=center.x+Double(i+1)*5*scale
                    let y=center.y-15*scale+30*t*scale
                    context.fill(Path(ellipseIn:CGRect(x:x,y:y,width:2*scale,height:3*scale)),with:.color(.white.opacity(0.6*(1-t))))
                }
            }
        }.allowsHitTesting(false)
    }
    private func tap(_ location:CGPoint,geo:WorldGeometry) {
        let sim=engine.simulation
        let p=WorldPoint(x:(location.x-geo.screen.width/2)/geo.bgSize.width+store.cameraX,y:location.y/geo.bgSize.height)
        let objects=engine.scene.objects.filter{($0.hitRect ?? engine.scene.objectRect($0)).contains(p)}.sorted{$0.depth>$1.depth}
        // 信箱先于一切：点它打开日记，纸从投信口抽出来，所以把投信口的屏幕坐标带出去。
        if let mail=objects.first(where:{$0.action == "mail"}) {
            let rect=engine.scene.objectRect(mail)
            let mouth=geo.screenPoint(CGPoint(x:rect.x+rect.width/2,y:rect.y+rect.height*0.36),cameraX:store.cameraX)
            store.openMailbox(anchor:mouth);return
        }
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
        let p=geo.screenPoint(CGPoint(x:rect.x+rect.width*0.13,y:rect.y+rect.height*0.42),cameraX:camera)
        let opening=CGRect(x:p.x,y:p.y,width:rect.width*0.74*geo.bgSize.width,height:rect.height*0.47*geo.bgSize.height)
        return Path(ellipseIn:opening)
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
        if let sequence,[WorldInteraction.Stage.nestLook,.nestSleep].contains(sequence.stage),let rect {content.mask(NestOpening(rect:rect,sequence:sequence,geo:geo,camera:camera).fill())}
        else {content}
    }
}
