import SwiftUI
import Combine

@MainActor
final class WorldEngine: ObservableObject {
    let scene: WorldScene
    @Published private(set) var simulation: WorldSimulation
    @Published private(set) var loadError: String?
    var stateChanged: (() -> Void)?
    var frameChanged: ((Double) -> Void)?
    private var displayLink: CADisplayLink?
    private var clockTarget: WorldClockTarget?
    private var lastTick = ProcessInfo.processInfo.systemUptime
    private var foreground = true
    private var onHome = true
    private var manuallyPaused = false
    private var accumulator = 0.0
    private var tickIntervals:[Double]=[]
    private(set) var maxTickMilliseconds = 0.0
    private(set) var tickCount = 0
    private(set) var totalTickMilliseconds = 0.0

    init() {
        let loaded = Self.load()
        scene=loaded.0;loadError=loaded.1
        simulation=WorldSimulation(scene:loaded.0)
        let target=WorldClockTarget { [weak self] in self?.advance() }
        clockTarget=target
        let link=CADisplayLink(target:target,selector:#selector(WorldClockTarget.fire))
        link.preferredFrameRateRange=CAFrameRateRange(minimum:30,maximum:60,preferred:60)
        link.add(to:.main,forMode:.common);displayLink=link
    }
    deinit {displayLink?.invalidate()}
    private static func load() -> (WorldScene,String?) {
        var errorMessage: String?
        for asset in ["world-scene-v4","world-scene-v3","world-scene-v2","world-scene-fallback"] {
            do {
                guard let data=NSDataAsset(name:asset)?.data else {throw CocoaError(.fileNoSuchFile)}
                let scene=try JSONDecoder().decode(WorldScene.self,from:data)
                let problems=scene.validationErrors()
                guard problems.isEmpty else {throw NSError(domain:"WorldScene",code:1,userInfo:[NSLocalizedDescriptionKey:problems.joined(separator:"; ")])}
                let missing=(scene.tiles.map(\.image)+scene.objects.map(\.image)).filter{Bundle.main.url(forResource:$0,withExtension:"png")==nil}
                guard missing.isEmpty else {throw NSError(domain:"WorldScene",code:2,userInfo:[NSLocalizedDescriptionKey:"Missing images: \(missing)"])}
                return (scene,errorMessage)
            } catch {errorMessage="小院资源校验失败，已恢复备用场景：\(error.localizedDescription)"}
        }
        // Both bundled configurations must pass the build-time validator.
        preconditionFailure(errorMessage ?? "No world scene")
    }
    private func advance() {
        let now=ProcessInfo.processInfo.systemUptime
        let dt=now-lastTick;lastTick=now
        guard foreground,onHome,dt<0.5 else {return}
        frameChanged?(dt)
        guard !manuallyPaused else {return}
        let start=ProcessInfo.processInfo.systemUptime
        let oldRevision=simulation.revision
        let oldPhase=simulation.phase
        let oldTarget=simulation.target
        let oldCurrent=simulation.current
        simulation.tick(dt)
        tickIntervals.append(dt)
        if tickIntervals.count>9000 {tickIntervals.removeFirst()}
        accumulator += dt
        if oldRevision != simulation.revision || oldPhase != simulation.phase || oldTarget != simulation.target || oldCurrent != simulation.current || accumulator>0.1 {
            accumulator=0;stateChanged?()
        }
        let elapsed=(ProcessInfo.processInfo.systemUptime-start)*1000
        tickCount += 1;totalTickMilliseconds += elapsed;maxTickMilliseconds=max(maxTickMilliseconds,elapsed)
        #if DEBUG
        if tickCount % 300 == 0 {writeSnapshot()}
        #endif
    }
    #if DEBUG
    func placeForReview(_ index:Int) {simulation.placeForReview(index);stateChanged?()}
    func writeSnapshot(label:String="world-metrics") {
        let intervals=tickIntervals.sorted()
        let p95=intervals.isEmpty ? 0:intervals[min(intervals.count-1,Int(Double(intervals.count)*0.95))]*1000
        let data:[String:Any]=["ticks":tickCount,"worldSeconds":simulation.time,"meanSimulationMilliseconds":totalTickMilliseconds/Double(max(1,tickCount)),"maxSimulationMilliseconds":maxTickMilliseconds,"p95TimerIntervalMilliseconds":p95,"action":simulation.action,"phase":simulation.phase.rawValue,"x":simulation.point.x,"y":simulation.point.y,"target":simulation.target,"current":simulation.current,"paused":simulation.paused,"onHome":onHome,"foreground":foreground,"textureValidationError":loadError ?? ""]
        if let json=try? JSONSerialization.data(withJSONObject:data,options:.prettyPrinted),let dir=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first {
            let safe=label.filter{$0.isLetter || $0.isNumber || $0 == "-"}
            try? json.write(to:dir.appendingPathComponent((safe.isEmpty ? "world-metrics":safe)+".json"),options:.atomic)
        }
    }
    #endif
    func setVisibility(home:Bool,foreground:Bool) {
        onHome=home;self.foreground=foreground
        displayLink?.isPaused = !home || !foreground
        simulation.setPaused(!home || !foreground || manuallyPaused)
        lastTick=ProcessInfo.processInfo.systemUptime
    }
    func request(_ index:Int) { simulation.request(index);stateChanged?() }
    func poke() {simulation.poke();stateChanged?()}
    func togglePause() {
        manuallyPaused.toggle();simulation.setPaused(manuallyPaused || !foreground || !onHome)
        lastTick=ProcessInfo.processInfo.systemUptime;stateChanged?()
    }
    func setSeed(_ value:UInt64) {simulation.seed(value)}
    func stepFrame() {
        guard let action=CatAction(rawValue:simulation.action) else {return}
        let spec=action.spec,index=spec.frame(at:simulation.actionTime)
        let duration=spec.frameDurations?[index] ?? (1/spec.fps)
        simulation.stepFrame(duration+0.00001);stateChanged?()
    }
    func preview(_ name:String) {manuallyPaused=true;simulation.preview(name);stateChanged?()}
    func reset() {
        simulation=WorldSimulation(scene:scene);manuallyPaused=false
        simulation.setPaused(!foreground || !onHome)
        stateChanged?()
    }
}


@MainActor private final class WorldClockTarget: NSObject {
    let callback: () -> Void
    init(_ callback:@escaping () -> Void) { self.callback=callback }
    @objc func fire() { callback() }
}
