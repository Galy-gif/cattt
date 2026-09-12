import SwiftUI

struct WorldView: View {
    @EnvironmentObject private var store: AppStore
    var body: some View { WorldCanvas(engine:store.world,textures:store.worldTextures) }
}

private struct WorldCanvas: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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
                background(geo:geo, camera:camera).zIndex(-1)
                ForEach(engine.scene.objects) { object in
                    objectLayer(object,geo:geo).zIndex(object.depth)
                }
                water(geo:geo).saturation(scenerySaturation).zIndex(0.53)
                shadow(geo:geo).zIndex(engine.simulation.point.y-0.001)
                cat(geo:geo).zIndex(catDepth)
                if store.worldDepthEnabled { foreground(geo:geo).zIndex(2) }
                feltGrain(geo:geo).zIndex(5)
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
    private var hasDepth:Bool {store.worldDepthEnabled && !textures.skyline.isEmpty}
    private var parallaxEnabled: Bool {hasDepth && !reduceMotion}

    /// Three rigid planes share one camera. The near plane is the unmodified original
    /// geometry; only decorative sky/ridge pixels move at a different speed.
    private func background(geo:WorldGeometry, camera:Double)->some View {
        let size=geo.bgSize
        return ZStack(alignment:.topLeading) {
            if hasDepth, let preview=textures.images["world-v3-ground-preview"] {
                farPlate(preview,size:size)
                    .layerEffect(ShaderLibrary.courtyardSky(.float2(size),.floatArray(textures.skyline),.float(Double(textures.skyline.count))),
                                 maxSampleOffset:CGSize(width:0,height:size.height*0.58))
                    .saturation(scenerySaturation)
                    .offset(x:geo.backgroundOffsetX(cameraX:WorldDepth.camera(camera,rate:WorldDepth.skyRate,enabled:parallaxEnabled)))
                farPlate(preview,size:size)
                    .colorEffect(ShaderLibrary.courtyardRidge(.float2(size),.floatArray(textures.skyline),.float(Double(textures.skyline.count))))
                    .saturation(scenerySaturation*0.92)
                    .offset(x:geo.backgroundOffsetX(cameraX:WorldDepth.camera(camera,rate:WorldDepth.ridgeRate,enabled:parallaxEnabled)))
            }
            groundPlate(geo:geo,camera:camera)
                .mask {
                    if hasDepth {
                        LinearGradient(stops:[
                            .init(color:.clear,location:0),
                            .init(color:.clear,location:0.535),
                            .init(color:.white,location:WorldDepth.groundStart),
                            .init(color:.white,location:1)
                        ],startPoint:.top,endPoint:.bottom)
                    } else {Color.white}
                }
                .offset(x:geo.backgroundOffsetX(cameraX:camera))
        }
        .frame(width:geo.screen.width,height:geo.screen.height,alignment:.topLeading)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func farPlate(_ image:UIImage,size:CGSize)->some View {
        Image(uiImage:image).resizable()
            .frame(width:size.width,height:size.height)
            .frame(width:size.width,height:size.height*0.58,alignment:.top)
            .clipped()
            .drawingGroup(opaque:true)
    }

    private func groundPlate(geo:WorldGeometry,camera:Double)->some View {
        let size=geo.bgSize
        return ZStack(alignment:.topLeading) {
            if let preview=textures.images["world-v3-ground-preview"] {
                Image(uiImage:preview).resizable().frame(width:size.width,height:size.height)
            }
            ForEach(engine.scene.tiles.filter {visible($0.rect,camera:camera,geo:geo)}) { tile in
                if let image=textures.images[tile.image] {
                    Image(uiImage:image).resizable()
                        .frame(width:tile.rect.width*size.width,height:tile.rect.height*size.height)
                        .position(x:tile.rect.center.x*size.width,y:tile.rect.center.y*size.height)
                }
            }
        }
        .frame(width:size.width,height:size.height)
        .saturation(scenerySaturation)
    }

    /// Reuse the existing felt leaves at the lens edge. These are decorations only;
    /// interactive grass and its occlusion/hit regions remain attached to the ground.
    private func foreground(geo:WorldGeometry)->some View {
        let clumps:[(x:Double,y:Double,w:Double,h:Double,mirror:Bool)] = [
            (0.035,1.045,0.17,0.19,false),
            (0.335,1.06,0.15,0.17,true),
            (0.655,1.04,0.16,0.18,false),
            (0.955,1.06,0.19,0.21,true)
        ]
        return ZStack(alignment:.topLeading) {
            if let grass=textures.images["world-v2-grass"] {
                ForEach(clumps.indices,id:\.self) { i in
                    let clump=clumps[i]
                    let x=WorldDepth.foregroundX(clump.x,camera:store.cameraX,enabled:parallaxEnabled)*geo.bgSize.width+geo.screen.width/2
                    Image(uiImage:grass).resizable()
                        .frame(width:clump.w*geo.bgSize.width,height:clump.h*geo.bgSize.height)
                        .scaleEffect(x:clump.mirror ? -1:1,y:1)
                        .saturation(0.66).brightness(-0.04)
                        .blur(radius:0.7)
                        .position(x:x,y:(clump.y-clump.h/2)*geo.bgSize.height)
                }
            }
        }
        .frame(width:geo.screen.width,height:geo.screen.height)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func visible(_ r:WorldRect,camera:Double,geo:WorldGeometry,margin:Double = 0.02)->Bool {
        r.x+r.width>=camera-geo.halfScreen-margin && r.x<=camera+geo.halfScreen+margin
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
        let pivot=object.motion == "nest" ? nestPivot(geo):geo.screenPoint(CGPoint(x:rect.x+rect.width/2,y:rect.y+(object.motion == "flower" || object.motion == "flag" ? rect.height:0)),cameraX:store.cameraX)
        return texture(object.image,rect:rect,source:object.sourceRect,cutouts:object.cutouts ?? [],outline:object.outline,cutoutPaths:object.cutoutPaths ?? [],geo:geo)
            .rotationEffect(.degrees(angle),anchor:UnitPoint(x:pivot.x/geo.screen.width,y:pivot.y/geo.screen.height))
    }
    /// 树窝整段锁定起跳点处的透视缩放：猫不因"升高"而变小，只有沿地面走远才变。
    private func catScale(_ geo:WorldGeometry)->Double {
        if let s=engine.simulation.interaction, s.isTree {return geo.catScale(at:s.launch.cgPoint)}
        return geo.catScale(at:engine.simulation.point.cgPoint)
    }
    /// 吊窝摆动支点（树枝绳结）的屏幕坐标；窝、吊绳、窝上的猫都绕它转。
    private func nestPivot(_ geo:WorldGeometry)->CGPoint {
        if let p=engine.scene.nestPivot {return geo.screenPoint(p.cgPoint,cameraX:store.cameraX)}
        let r=engine.scene.objects.first(where:{$0.id == "nest-back"})?.rect ?? WorldRect(x:0,y:0,width:0,height:0)
        return geo.screenPoint(CGPoint(x:r.x+r.width/2,y:r.y),cameraX:store.cameraX)
    }
    private func nestRectOnScreen(_ geo:WorldGeometry)->CGRect {
        let r=engine.scene.objects.first(where:{$0.id == "nest-back"})?.rect ?? WorldRect(x:0,y:0,width:0,height:0)
        let o=geo.screenPoint(CGPoint(x:r.x,y:r.y),cameraX:store.cameraX)
        return CGRect(x:o.x,y:o.y,width:r.width*geo.bgSize.width,height:r.height*geo.bgSize.height)
    }
    /// 层级：窝前片 0.92、窝后壁 0.615。猫在窝里时夹在两者之间，只从窝口露出来；
    /// 起跳、抓沿、蹬出、落地时在整个窝前面。换层时刻（翻上窝沿、蹬出窝沿）猫和窝前片不重叠，所以看不出跳变。
    private var catDepth:Double {
        let sim=engine.simulation
        if let s=sim.interaction, s.isTree {
            if s.behindNestWall {return 0.70}
            if s.isElevated {return 0.95}
            return sim.renderPoint.y
        }
        if sim.interaction?.isElevated == true {return 0.80}
        return sim.point.y
    }
    private func cat(geo:WorldGeometry)->some View {
        let sim=engine.simulation
        let action=(CatAction(rawValue:sim.action) ?? .blinkLook).resolved
        let spec=action.spec,scale=catScale(geo)
        var foot=geo.screenPoint(sim.renderPoint.cgPoint,cameraX:store.cameraX)
        // 腾空帧的锚点是身体重心：沿弧线从"起跳锚点 + 起跳时重心偏移"过渡到"落点锚点 + 落点重心偏移"。
        if let a=spec.airFrom,let b=spec.airTo,let s=sim.interaction,s.airborne {
            let u=CGFloat(s.airFraction),dir:CGFloat=sim.facingRight ? 1:-1
            foot.x += (a[0]+(b[0]-a[0])*u)*dir*scale
            foot.y += (a[1]+(b[1]-a[1])*u)*scale
        }
        let clock=action.isGait && sim.isMoving ? sim.travelled/Double(spec.bodyLength*(spec.stride ?? 1))*spec.cycleDuration():sim.actionTime
        let breathing=(action == .perchSleep || action == .nestSleep) ? 1+sin(sim.actionTime*1.6)*0.012:1
        let pivot=nestPivot(geo)
        return frames.image(action.imageName(frame:spec.frame(at:clock)))
            .resizable().frame(width:spec.canvas.width*scale,height:spec.canvas.height*scale)
            .scaleEffect(x:sim.facingRight ? 1:-1,y:breathing,anchor:.center)
            .position(x:foot.x,y:foot.y+(spec.canvas.height/2-spec.footY)*scale)
            .frame(width:geo.screen.width,height:geo.screen.height)
            // 猫在窝里时整个被窝的外轮廓裁住：尾巴、耳朵不会穿出窝壁（窝前片只挡住窝口以外的部分）。
            .mask(NestSilhouette(active:sim.interaction?.behindNestWall == true,image:textures.images["world-v4-nest"],rect:nestRectOnScreen(geo),screen:geo.screen))
            .rotationEffect(.degrees(sim.interaction?.onNest == true ? sim.interaction?.nestSwing ?? 0:0),anchor:UnitPoint(x:pivot.x/geo.screen.width,y:pivot.y/geo.screen.height))
            .accessibilityLabel("团子，"+engine.scene.destinations[sim.current].name)
    }
    /// 毛毡收尾层：一张中灰毛毡纤维，按世界坐标平铺（跟着镜头走），柔光叠在世界最上面，把猫和场景罩进同一种材质里。
    @ViewBuilder private func feltGrain(geo:WorldGeometry)->some View {
        if let grain=textures.images["world-v5-felt-grain"] {
            let tile=geo.bgSize.height*0.30
            let shift=(store.cameraX*geo.bgSize.width).truncatingRemainder(dividingBy:tile)
            Rectangle().fill(ImagePaint(image:Image(uiImage:grain),scale:tile/grain.size.width))
                .frame(width:geo.screen.width+tile,height:geo.screen.height)
                .offset(x:-shift)
                .frame(width:geo.screen.width,height:geo.screen.height,alignment:.leading).clipped()
                .blendMode(.softLight).opacity(0.18)
                .allowsHitTesting(false)
        }
    }
    /// 两层：贴着脚掌的接触影（窄、实），和身子底下的环境影（宽、淡）。离地越高接触影越快消失、环境影越小越淡。
    private func shadow(geo:WorldGeometry)->some View {
        let sim=engine.simulation
        let ground=sim.interaction?.isTree == true ? WorldPoint(x:sim.renderPoint.x,y:sim.interaction!.launch.y):WorldPoint(x:sim.renderPoint.x,y:sim.point.y)
        let foot=geo.screenPoint(ground.cgPoint,cameraX:store.cameraX)
        let height=max(0,ground.y-sim.renderPoint.y)
        let hidden=sim.interaction?.onNest == true || sim.interaction?.onRail == true
        let ambient=hidden ? 0:max(0.02,0.13-height*0.9)
        let contact=hidden ? 0:max(0,0.30*(1-height/0.02))
        let s=catScale(geo),shrink=max(0.55,1-height*4)
        return ZStack {
            Ellipse().fill(.black.opacity(ambient)).frame(width:52*s*shrink,height:8*shrink).blur(radius:2.5)
            Ellipse().fill(Color(red:0.24,green:0.17,blue:0.10).opacity(contact)).frame(width:30*s,height:3.5).blur(radius:1)
        }
        .position(x:foot.x,y:foot.y+1.5)
        .allowsHitTesting(false)
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
        let action=(CatAction(rawValue:sim.action) ?? .blinkLook).resolved,spec=action.spec,scale=catScale(geo)
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
/// 猫在窝里时的遮罩：窝贴图的 alpha。不在窝里时不裁。
private struct NestSilhouette:View {
    let active:Bool
    let image:UIImage?
    let rect:CGRect
    let screen:CGSize
    var body:some View {
        if active,let image {
            Image(uiImage:image).resizable().frame(width:rect.width,height:rect.height)
                .position(x:rect.midX,y:rect.midY)
                .frame(width:screen.width,height:screen.height)
        } else {
            Rectangle().frame(width:screen.width,height:screen.height)
        }
    }
}
