import SwiftUI
import Combine

@MainActor
final class WorldEngine: ObservableObject {
    let scene: WorldScene
    @Published private(set) var simulation: WorldSimulation
    @Published private(set) var loadError: String?
    var stateChanged: (() -> Void)?
    var bridgeChanged: (() -> Void)?
    var agentActionChanged: ((WorldCommand, String, String?) -> Void)?
    private var activeAgentCommand: WorldCommand?
    private var agentFinishUptime: Double?
    private var lastBridgeSnapshot: WorldSnapshot?
    private var bridgeVersion = 0
    private var yard = WorldYardFacts()
    private var runtimeQuiet = false
    private var runtimeResting = false
    private var runtimeUnsocial = false
    var frameChanged: ((Double) -> Void)?
    private var displayLink: CADisplayLink?
    private var clockTarget: WorldClockTarget?
    private var lastTick = ProcessInfo.processInfo.systemUptime
    private var foreground = true
    private var onHome = true
    private var worldEnabled = true
    private var manuallyPaused = false
    private var accumulator = 0.0
    private var tickIntervals:[Double]=[]
    private(set) var maxTickMilliseconds = 0.0
    private(set) var tickCount = 0
    private(set) var totalTickMilliseconds = 0.0
    #if DEBUG
    /// 调试慢放：验收录 0.25 倍速用。只缩放世界时间，不影响镜头和界面动画。
    var debugTimeScale = 1.0
    #endif

    init() {
        // v5 树窝帧不齐就整段退回 v4，时长和动作名一起换，不混用。
        WorldInteraction.useV5 = CatActionCatalog.shared.hasV5
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
        guard foreground,worldEnabled,dt<0.5 else {return}
        if onHome { frameChanged?(dt) }
        guard !manuallyPaused else {return}
        let start=ProcessInfo.processInfo.systemUptime
        let oldRevision=simulation.revision
        let oldPhase=simulation.phase
        let oldTarget=simulation.target
        let oldCurrent=simulation.current
        #if DEBUG
        simulation.tick(dt*debugTimeScale)
        #else
        simulation.tick(dt)
        #endif
        tickIntervals.append(dt)
        if tickIntervals.count>9000 {tickIntervals.removeFirst()}
        accumulator += dt
        if oldRevision != simulation.revision || oldPhase != simulation.phase || oldTarget != simulation.target || oldCurrent != simulation.current || accumulator>0.1 {
            accumulator=0;notifyState()
        }
        let elapsed=(ProcessInfo.processInfo.systemUptime-start)*1000
        tickCount += 1;totalTickMilliseconds += elapsed;maxTickMilliseconds=max(maxTickMilliseconds,elapsed)
        #if DEBUG
        if tickCount % 300 == 0 {writeSnapshot()}
        #endif
    }
    #if DEBUG
    func placeForReview(_ index:Int) {interruptAgentMove(reason: "user_preempted");simulation.placeForReview(index);notifyState()}
    func writeSnapshot(label:String="world-metrics") {
        let intervals=tickIntervals.sorted()
        let p95=intervals.isEmpty ? 0:intervals[min(intervals.count-1,Int(Double(intervals.count)*0.95))]*1000
        let data:[String:Any]=["worldEnabled":worldEnabled,"displayLinkPaused":displayLink?.isPaused ?? true,"manuallyPaused":manuallyPaused,"ticks":tickCount,"worldSeconds":simulation.time,"meanSimulationMilliseconds":totalTickMilliseconds/Double(max(1,tickCount)),"maxSimulationMilliseconds":maxTickMilliseconds,"p95TimerIntervalMilliseconds":p95,"action":simulation.action,"phase":simulation.phase.rawValue,"x":simulation.point.x,"y":simulation.point.y,"target":simulation.target,"current":simulation.current,"paused":simulation.paused,"onHome":onHome,"foreground":foreground,"textureValidationError":loadError ?? ""]
        if let json=try? JSONSerialization.data(withJSONObject:data,options:.prettyPrinted),let dir=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first {
            let safe=label.filter{$0.isLetter || $0.isNumber || $0 == "-"}
            try? json.write(to:dir.appendingPathComponent((safe.isEmpty ? "world-metrics":safe)+".json"),options:.atomic)
        }
    }
    #endif
    private func notifyState() {
        inspectAgentAction()
        stateChanged?()
        bridgeChanged?()
    }
    /// 同一份后端临时状态控制自发活动；不把想安静冒充已经睡着。
    func applyRuntimeState(energy: String, willingness: String) {
        runtimeResting = energy == "resting"
        runtimeUnsocial = willingness == "quiet"
        runtimeQuiet = runtimeResting || runtimeUnsocial
        simulation.autonomous = activeAgentCommand == nil && !runtimeQuiet
    }
    /// 后端临时状态压在性格上（性格系统优化方案第 2.2 节）：
    /// 想休息 → 家与窝只打盹；想安静 → 不看你、也不来门口。
    func adjusted(_ behavior: BehaviorParams) -> BehaviorParams {
        var b = behavior
        if runtimeResting { b.sleepWeight = 1; b.lookWeight = 0; b.groomWeight = 0 }
        if runtimeUnsocial { b.lookWeight = 0; b.comesToDoor = false }
        return b
    }
    var canRunWorld: Bool { foreground && worldEnabled && !manuallyPaused }
    func worldSnapshot() -> WorldSnapshot {
        let destinations = scene.destinations
        var snapshot = WorldSnapshot(stateVersion: bridgeVersion, sceneVersion: scene.version,
            destinationIds: destinations.map(\.id), currentDestinationId: destinations[simulation.current].id,
            targetDestinationId: destinations[simulation.pendingTarget ?? simulation.target].id,
            phase: simulation.phase.rawValue, action: simulation.action,
            paused: simulation.paused, runnable: canRunWorld,
            mood: yard.mood, moodReason: yard.moodReason, dayPhase: yard.dayPhase, weather: yard.weather,
            bowlFilledToday: yard.bowlFilledToday, lastDrinkAt: yard.lastDrinkAt, placesToday: yard.placesToday)
        if var previous = lastBridgeSnapshot {
            previous.stateVersion = snapshot.stateVersion
            if previous != snapshot { bridgeVersion += 1; snapshot.stateVersion = bridgeVersion }
        }
        lastBridgeSnapshot = snapshot
        return snapshot
    }
    /// accepted 已经持久化后才执行；等待网络期间任何世界变化都会使命令失效。
    func beginAgentMove(_ command: WorldCommand, finishAfter: Double) -> Bool {
        let snapshot = worldSnapshot()
        guard canRunWorld, snapshot.stateVersion == command.stateVersion,
              let index = scene.destinations.firstIndex(where: { $0.id == command.destinationId }),
              activeAgentCommand == nil else { return false }
        activeAgentCommand = command
        agentFinishUptime = ProcessInfo.processInfo.systemUptime + max(0, finishAfter)
        simulation.autonomous = false
        simulation.request(index)
        agentActionChanged?(command, "running", nil)
        notifyState()
        return true
    }
    func interruptAgentMove(reason: String) {
        guard let command = activeAgentCommand else { return }
        activeAgentCommand = nil; agentFinishUptime = nil
        simulation.autonomous = !runtimeQuiet
        // 不强切出窝/下栏动画。用户请求走正常重定向；暂停保留安全过渡，回前台不重发命令。
        agentActionChanged?(command, "interrupted", reason)
    }
    private func inspectAgentAction() {
        guard let command = activeAgentCommand else { return }
        if !canRunWorld { interruptAgentMove(reason: "world_paused"); return }
        if let deadline = agentFinishUptime, ProcessInfo.processInfo.systemUptime >= deadline {
            interruptAgentMove(reason: "execution_timeout"); return
        }
        guard let index = scene.destinations.firstIndex(where: { $0.id == command.destinationId }),
              simulation.current == index, simulation.target == index,
              simulation.pendingTarget == nil, !simulation.isMoving, !simulation.isTurning,
              simulation.phase != .exiting else { return }
        // treeScratch 在进窝之前，railUp 在上栏途中；这些都不能算进场完成。
        let settled: Bool
        if let interaction = simulation.interaction {
            settled = [.nestLook, .nestSleep, .railLook, .railSleep, .pondLook, .pondReach,
                       .pondTap, .pondWatch, .pondRest, .flower, .flowerWatch].contains(interaction.stage)
        } else {
            settled = simulation.phase == .idle || (simulation.phase == .interacting && index != 1 && index != 5)
        }
        if settled {
            activeAgentCommand = nil; agentFinishUptime = nil; simulation.autonomous = !runtimeQuiet
            agentActionChanged?(command, "arrived", nil)
        }
    }
    func setVisibility(home:Bool,foreground:Bool,enabled:Bool = true) {
        onHome=home;self.foreground=foreground;worldEnabled=enabled
        displayLink?.isPaused = !enabled || !foreground
        simulation.setPaused(!enabled || !foreground || manuallyPaused)
        lastTick=ProcessInfo.processInfo.systemUptime
        notifyState()
    }
    func request(_ index:Int) { interruptAgentMove(reason: "user_preempted"); simulation.request(index);notifyState() }
    func poke() {interruptAgentMove(reason: "user_preempted");simulation.poke();notifyState()}
    /// 情绪、时段、天气、水碗：每秒由 AppStore 喂一次。
    func setConditions(mood:Mood,night:Bool,allowed:Set<Int>,bowlFull:Bool,behavior:BehaviorParams) {
        simulation.setConditions(mood:mood,night:night,allowed:allowed,bowlFull:bowlFull,behavior:adjusted(behavior))
    }
    /// 打开 App：按性格决定来不来门口。
    func greet() { simulation.greet();notifyState() }
    /// 院子里的事实（情绪、时段、天气、水、今天去过哪）：每秒由 AppStore 喂一次，只为送进聊天。
    func setYardFacts(_ facts: WorldYardFacts) {
        guard facts != yard else { return }
        yard = facts
        bridgeChanged?()
    }
    func requestDrink() { if simulation.requestDrink() {notifyState()} }
    func togglePause() {
        interruptAgentMove(reason: "world_paused")
        manuallyPaused.toggle();simulation.setPaused(manuallyPaused || !foreground || !worldEnabled)
        lastTick=ProcessInfo.processInfo.systemUptime;notifyState()
    }
    func setSeed(_ value:UInt64) {simulation.seed(value)}
    func stepFrame() {
        guard let action=CatAction(rawValue:simulation.action) else {return}
        let spec=action.spec,index=spec.frame(at:simulation.actionTime)
        let duration=spec.frameDurations?[index] ?? (1/spec.fps)
        simulation.stepFrame(duration+0.00001);notifyState()
    }
    func preview(_ name:String) {interruptAgentMove(reason: "world_paused");manuallyPaused=true;simulation.preview(name);notifyState()}
    func reset() {
        interruptAgentMove(reason: "world_reset")
        simulation=WorldSimulation(scene:scene);manuallyPaused=false
        simulation.autonomous = !runtimeQuiet
        simulation.setPaused(!foreground || !worldEnabled)
        notifyState()
    }
}


@MainActor private final class WorldClockTarget: NSObject {
    let callback: () -> Void
    init(_ callback:@escaping () -> Void) { self.callback=callback }
    @objc func fire() { callback() }
}
