import SwiftUI

/// 全部界面状态与状态转换。
///
/// 本版所有数据都是本地 mock —— 真实实现要接的四个口子（世界状态、聊天流式、
/// 日记碎片与访问状态、记忆条目 CRUD）都标了 `TODO: 后端`，逻辑形状按真接口的
/// 时序写好了（发送落地 / 等待 / 流式 / 可停止 / 可重试），换成网络层不用动界面。
@MainActor
final class AppStore: ObservableObject {

    // MARK: - 路由

    /// 日记进了院子里的信箱、「我的」上了右上角，整屏只剩院子和聊天。
    enum Screen { case home, chat }

    enum OnboardingStep: Int, CaseIterable {
        case welcome, pickCat, temperament, naming, firstMeeting

        /// 欢迎屏不计步，其余是 1/4–4/4。
        var stepNumber: Int { rawValue }
    }

    @Published var screen: Screen = .home
    /// nil = 已经有猫了，走正常四屏。
    @Published var onboarding: OnboardingStep?

    // MARK: - 世界

    /// Debug comparison only; not persisted as a new product setting.
    @Published var worldDepthEnabled = true
    let world = WorldEngine()
    var worldBridge: WorldBridge?
    @Published var viewedIndex = 0
    @Published private(set) var reaction: String?
    @Published private(set) var camera = WorldCamera()
    let worldTextures: WorldTextureCache
    var cameraX: CGFloat { camera.x }
    var cameraFollowsCat: Bool { camera.followsCat }
    @Published var worldGeometry = WorldGeometry.placeholder
    var catIndex: Int { world.simulation.target }
    var viewedLocation: Location { Location.all[viewedIndex] }
    var catLocation: Location { Location.all[world.simulation.current] }
    var isLost: Bool { !worldGeometry.isVisible(CGFloat(world.simulation.renderPoint.x), cameraX: effectiveCameraX()) }
    var catAction: CatAction { CatAction(rawValue:world.simulation.action) ?? .blinkLook }
    func catPose(at date: Date = Date()) -> (point: CGPoint, facing: Facing) {
        (world.simulation.point.cgPoint,world.simulation.facingRight ? .right:.left)
    }
    func effectiveCameraX(at date: Date = Date()) -> CGFloat {
        cameraX
    }
    var statusText: String {
        if let reaction {return reaction}
        if let sequence=world.simulation.interaction {
            switch sequence.stage {
            case .pondLook,.pondWatch,.pondRest:return "团子在池边看水纹"
            case .pondReach,.pondTap:return "团子伸爪轻轻拍了拍水"
            case .pondShake,.pondRecover:return "团子甩了甩爪上的水珠"
            case .nestSleep:return "团子在树上的小窝里睡着了"
            case .nestLook:return "团子从窝口望着你"
            case .flower,.flowerWatch:return "团子在轻轻拨弄花朵"
            case .railLook,.railBalance:return "团子趴在栅栏上看风景"
            case .railSleep:return "团子趴在栅栏上睡着了"
            default:return sequence.isTree ? "团子在树上的小窝边活动":"团子在栅栏边活动"
            }
        }
        if world.simulation.isMoving {return "团子正往" + world.scene.destinations[world.simulation.target].name + "走"}
        if isLost {return viewedLocation.name + "这边没有猫"}
        switch world.simulation.action {
        case "scratchEnter", "treeScratch": return "团子在树上磨爪子"
        case "tailChase": return "团子在追自己的尾巴"
        default:
            if world.simulation.hiddenInGrass {return "团子藏在草丛里，轻点草丛叫叫它"}
            if world.simulation.current == 1 {return "团子在树荫下歇着"}
            return catLocation.lines[0]
        }
    }

    // MARK: - 聊天

    /// 来源卡：从日记留言或话题卡跳进来时出现。
    struct ChatSource: Equatable {
        let kicker: String
        let text: String
    }

    /// 长按气泡弹出的底部菜单。
    struct MessagePanel: Equatable {
        let id: String
        let isCat: Bool
    }

    @Published var messages = SeedData.messages
    @Published var draft = ""
    @Published var isWaiting = false
    @Published var isStreaming = false
    @Published var chatSource: ChatSource?
    @Published var messagePanel: MessagePanel?

    // MARK: - 日记

    @Published var entries = SeedData.entries
    @Published var isCapturing = false
    @Published var captureText = ""
    @Published var diaryFilter: DiaryFilter = .all
    var shownEntries: [DiaryEntry] { entries.filter(diaryFilter.matches) }
    /// 信箱里有新东西（团子来看过 / 留了一句）：旗子立起来。打开信箱就放下。
    @Published var hasMail = false
    /// 日记纸是否从信箱里抽出来了。
    @Published var mailboxOpen = false
    /// 抽纸的起点：信箱投信口的屏幕坐标，点信箱时由 `WorldView` 量好带进来。
    @Published var mailboxAnchor = CGPoint(x: 60, y: 520)
    /// 旗子当前角度：0 立起，-90 平放在箱顶。逐帧朝目标插值，画布不走隐式动画。
    @Published private(set) var flagAngle: Double = -90

    // MARK: - 我的

    /// 右上角头像钮打开的系统 sheet。
    @Published var showsMe = false
    @Published var shareByDefault = true
    @Published var memoryCount = 37
    @Published var boundaryCount = 2

    // MARK: - 后端

    /// 聊天走本地模拟还是本机后端。切换走 `setBackendMode(_:)`。
    @Published var backend = BackendConfig.load() {
        didSet { backend.save() }
    }
    /// 调试面板上显示的连接状态。
    @Published var backendStatus: String?
    /// 当前这一轮回复在服务端的 id，停止时要用。
    var remoteTurnID: String?
    /// 用户按了停止：之后到的字不再显示。
    var remoteStopped = false
    /// 收到 accepted 后 20 秒没有第一个字就判超时。
    var watchdogTask: Task<Void, Never>?

    // MARK: - 创建流程

    @Published var pickedAppearance = "orange"
    @Published var temperament: Temperament = .slow
    @Published var traitsOpen = false
    @Published var traitLevels: [Trait: Int] = [
        .energy: 1, .initiative: 1, .directness: 1, .closeness: 1,
    ]
    @Published var nameDraft = ""
    @Published var nameError: String?
    @Published private(set) var namePoolIndex = 0

    struct MeetLine: Identifiable, Equatable {
        let id = UUID()
        let text: String
        let isCat: Bool
    }

    /// false = 还在问名字（输入框 + 「先不说」），true = 可以进院子了。
    @Published private(set) var meetDone = false
    @Published var meetDraft = ""
    @Published private(set) var meetLines: [MeetLine] = []

    var catName: String { nameDraft.trimmed.isEmpty ? SeedData.defaultCatName : nameDraft.trimmed }
    var isNameValid: Bool { (1...8).contains(nameDraft.trimmed.count) }
    var nameSuggestions: [String] { SeedData.namePool[namePoolIndex % SeedData.namePool.count] }

    // MARK: - 全局

    @Published private(set) var toast: String?

    // MARK: - 调试开关（仅 DEBUG 构建可见）

    @Published var forceFail = false
    @Published var forceTimeout = false
    @Published var showTopicCard = false

    // MARK: - 任务管理

    /// 一次只有一条消息在途，所以聊天用单个句柄 —— 「停止」直接取消它。
    var chatTask: Task<Void, Never>?
    private var onboardingTask: Task<Void, Never>?
    private var toastTask: Task<Void, Never>?
    private var reactionTask: Task<Void, Never>?

    init() {
        worldTextures=WorldTextureCache(scene:world.scene)
        world.stateChanged = { [weak self] in self?.objectWillChange.send() }
        world.frameChanged = { [weak self] dt in self?.advanceCamera(dt) }
        connectBackend()
    }

    private func run(_ body: @escaping () async throws -> Void) -> Task<Void, Never> {
        Task { @MainActor in
            do { try await body() } catch { /* 取消即结束 */ }
        }
    }

    func cancelEverything() {
        chatTask?.cancel()
        onboardingTask?.cancel()
        toastTask?.cancel()
        reactionTask?.cancel()
    }

    static func sleep(_ milliseconds: Int) async throws {
        try await Task.sleep(nanoseconds: UInt64(milliseconds) * 1_000_000)
    }

    // MARK: - 轻提示

    /// 同一时刻最多一条轻提示 —— 这是硬规则，新的顶掉旧的。
    func flash(_ text: String) {
        toastTask?.cancel()
        withAnimation(.easeOut(duration: Metrics.fadeFast)) { toast = text }
        toastTask = Task { @MainActor in
            try? await Self.sleep(1400)
            guard !Task.isCancelled else { return }
            withAnimation(.easeOut(duration: Metrics.fadeFast)) { toast = nil }
        }
    }

    // MARK: - 世界

    func moveCat(to index: Int) { world.request(index) }
    func interact(with index: Int) {
        world.request(index)
        if let failure=world.simulation.failure {flash(failure)}
    }
    func look(at index: Int) {
        guard world.scene.destinations.indices.contains(index) else {return}
        reaction=nil;viewedIndex=index
        camera.look(at:world.scene.destinations[index].cameraX,half:worldGeometry.halfScreen)
        prepareWorldTextures()
    }
    func findCat() { reaction=nil;camera.find();prepareWorldTextures() }
    func dragCamera(translation: CGFloat) {
        camera.drag(translation,width:worldGeometry.bgSize.width,half:worldGeometry.halfScreen)
        prepareWorldTextures()
    }
    func endDrag(velocity: CGFloat) {
        camera.endDrag(velocity:velocity,width:worldGeometry.bgSize.width,half:worldGeometry.halfScreen)
        viewedIndex=world.scene.destinations.indices.min(by:{abs(world.scene.destinations[$0].cameraX-camera.target) < abs(world.scene.destinations[$1].cameraX-camera.target)}) ?? 0
    }
    private func tileNames(at x:Double, margin:Double = 0) -> Set<String> {
        Set(world.scene.tiles.filter {
            $0.rect.x+$0.rect.width >= x-worldGeometry.halfScreen-margin && $0.rect.x <= x+worldGeometry.halfScreen+margin
        }.map(\.image))
    }
    func prepareWorldTextures() {
        let lookAhead=camera.x+camera.velocity*0.24
        let tiles=tileNames(at:camera.x,margin:0.14).union(tileNames(at:lookAhead,margin:0.08))
        let pinned=Set(world.scene.objects.map(\.image)).union(["world-v3-ground-preview"])
        worldTextures.update(tiles,pinned:pinned)
    }
    #if DEBUG
    private var cameraFrames=0
    private var maxCameraStep=0.0
    private var maxTextureBytes=0
    private var cameraMissingHDFrames=0
    private var lastCameraForMetrics:Double?
    func writeCameraSnapshot(label:String) {
        let object:[String:Any] = ["frames":cameraFrames,"cameraX":camera.x,"cameraMode":String(describing:camera.mode),"maxStepNormalized":maxCameraStep,"maxTextureBytes":maxTextureBytes,"missingHDFrames":cameraMissingHDFrames,"textureCount":worldTextures.images.count]
        if let data=try? JSONSerialization.data(withJSONObject:object,options:.prettyPrinted),let dir=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first {
            let safe=label.filter{$0.isLetter || $0.isNumber || $0 == "-"}
            try? data.write(to:dir.appendingPathComponent("camera-"+safe+".json"),options:.atomic)
        }
    }
    #endif
    private func advanceCamera(_ dt:Double) {
        advanceFlag(dt)
        #if DEBUG
        cameraFrames += 1
        if let previous=lastCameraForMetrics {maxCameraStep=max(maxCameraStep,abs(camera.x-previous))}
        lastCameraForMetrics=camera.x
        if !worldTextures.ready(tileNames(at:camera.x)) {cameraMissingHDFrames += 1}
        maxTextureBytes=max(maxTextureBytes,worldTextures.images.values.reduce(0){$0+($1.cgImage.map{$0.bytesPerRow*$0.height} ?? 0)})
        #endif
        var next=camera
        let sim=world.simulation
        let focus=sim.interaction.map { $0.isTree ? ($0.launch.x+$0.nest.x)/2:($0.ground.x+$0.rail.x)/2 } ?? sim.renderPoint.x
        next.tick(dt,cat:(sim.interaction?.isTree == true || sim.interaction?.isElevated == true) ? focus:sim.renderPoint.x,half:worldGeometry.halfScreen,reduceMotion:UIAccessibility.isReduceMotionEnabled)
        let needed=tileNames(at:next.x)
        prepareWorldTextures()
        if worldTextures.ready(needed) {
            camera=next
            if camera.mode == .following {viewedIndex=world.simulation.current}
        } else {
            let pinned=Set(world.scene.objects.map(\.image)).union(["world-v3-ground-preview"])
            worldTextures.update(tileNames(at:camera.x,margin:0.14).union(needed),pinned:pinned)
        }
    }
    func poke() {
        guard !isLost,!world.simulation.isMoving else {return}
        world.poke()
        announce(world.simulation.hiddenInGrass ? "草叶动了动，团子看着你":catLocation.reactions[0])
    }

    /// 状态条上说一句，2s 后回到常态句。同一时刻只有一句。
    func announce(_ text: String) {
        reactionTask?.cancel()
        reaction=text
        reactionTask=Task { @MainActor in
            try? await Self.sleep(2000)
            guard !Task.isCancelled else {return}
            reaction=nil
        }
    }

    // MARK: - 信箱

    /// 旗子 0.3s 转到位：立起 0°，放下 -90°（平放在箱顶）。
    private func advanceFlag(_ dt: Double) {
        let target: Double = hasMail ? 0 : -90
        guard flagAngle != target else {return}
        let step=90/0.3*dt
        flagAngle = abs(target-flagAngle) <= step ? target : flagAngle+(target>flagAngle ? step:-step)
    }

    /// 点信箱：纸从投信口抽出来。旗子放下。
    func openMailbox(anchor: CGPoint) {
        guard !mailboxOpen else {return}
        mailboxAnchor=anchor
        hasMail=false
        mailboxOpen=true
    }

    func closeMailbox() { mailboxOpen=false }

    func openTopicCard() {
        chatSource = ChatSource(kicker: "接着昨天的", text: SeedData.topicText)
        showTopicCard = false
        screen = .chat
    }

    // MARK: - 聊天

    /// 发送：520ms 落地 → 等待 900ms → 流式每字 58ms。
    /// 接了后端时走 `remoteSend`，状态对应见 AppStore+Remote.swift。
    func send() {
        let text = draft.trimmed
        guard !text.isEmpty, !isStreaming else { return }

        let id = "u" + UUID().uuidString
        let willFail = forceFail
        messages.append(ChatMessage(id: id, role: .user, text: text, state: .sending))
        draft = ""
        forceFail = false

        if backend.isRemote {
            remoteSend(localID: id, text: text)
            return
        }

        chatTask?.cancel()
        chatTask = run { [weak self] in
            try await Self.sleep(520)
            guard let self else { return }
            if willFail {
                self.setState(.failed, for: id)
                return
            }
            self.setState(.sent, for: id)
            self.isWaiting = true
            try await self.catReply(to: text)
        }
    }

    /// 发送失败后点注文重试。
    func retry(messageID: String) {
        guard let text = messages.first(where: { $0.id == messageID })?.text else { return }
        setState(.sending, for: messageID)
        if backend.isRemote {
            remoteSend(localID: messageID, text: text)
            return
        }
        chatTask?.cancel()
        chatTask = run { [weak self] in
            try await Self.sleep(600)
            guard let self else { return }
            self.setState(.sent, for: messageID)
            self.isWaiting = true
            try await self.catReply(to: text)
        }
    }

    /// 回复超时后点「再试一次」：撤掉那条「……」，重发它前面那句。
    ///
    /// 原型把超时气泡留在原地又追加一条新回复，看起来像猫说了两次。这里改成先撤再重试。
    func retryAfterTimeout(messageID: String) {
        guard let index = messages.firstIndex(where: { $0.id == messageID }) else { return }
        let previousUserMessage = messages[..<index].last { $0.role == .user }
        withAnimation(.easeOut(duration: Metrics.fadeFast)) {
            messages.remove(at: index)
        }
        guard let previousUserMessage else { return }
        if backend.isRemote, let serverID = previousUserMessage.serverID {
            // 用户那句服务端已经收了，只让猫重新回，不再发一遍
            remoteReply(to: serverID)
            return
        }
        retry(messageID: previousUserMessage.id)
    }

    private func catReply(to userText: String) async throws {
        let willTimeout = forceTimeout
        try await Self.sleep(900)

        if willTimeout {
            forceTimeout = false
            isWaiting = false
            messages.append(ChatMessage(
                id: "c" + UUID().uuidString, role: .cat, text: "", state: .timeout
            ))
            return
        }

        // 用户消息里出现「记住」「别忘」时计入长期记忆。
        // TODO: 后端 —— 记忆抽取在服务端做，前端只消费「这条被记住了」的结果。
        let remembered = userText.contains("记住") || userText.contains("别忘")
        let full = remembered
            ? "好，我记下了。"
            : (temperament.replies.randomElement() ?? "嗯。")

        let id = "c" + UUID().uuidString
        isWaiting = false
        isStreaming = true
        messages.append(ChatMessage(
            id: id, role: .cat, text: "", state: .streaming, remembered: remembered
        ))

        let characters = Array(full)
        for index in characters.indices {
            try await Self.sleep(58)
            guard !Task.isCancelled else { return }
            updateText(String(characters[0...index]), for: id)
        }

        isStreaming = false
        setState(.done, for: id)
        if remembered {
            memoryCount += 1
            flash("记下了")
        }
    }

    /// 流式中按停止：保留已生成文字。
    func stopStreaming() {
        if backend.isRemote {
            remoteStop()
            return
        }
        chatTask?.cancel()
        isStreaming = false
        isWaiting = false
        if let index = messages.firstIndex(where: { $0.state == .streaming }) {
            messages[index].state = .stopped
        }
    }

    func sendOrStop() {
        if isStreaming { stopStreaming() } else { send() }
    }

    /// 长按菜单里的「不要再提」：该气泡标记边界，「我的」页边界计数 +1。
    /// 接了后端时写进服务端的边界列表，之后模型不再主动提。
    func markBoundary() {
        guard let panel = messagePanel else { return }
        if let index = messages.firstIndex(where: { $0.id == panel.id }) {
            messages[index].boundary = true
            if backend.isRemote, let serverID = messages[index].serverID {
                remoteMarkBoundary(messageID: serverID)
            } else {
                boundaryCount += 1
            }
        }
        messagePanel = nil
    }

    func setState(_ state: ChatMessage.State, for id: String) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        messages[index].state = state
    }

    func updateText(_ text: String, for id: String) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        messages[index].text = text
    }

    // MARK: - 日记

    /// 留言纸上的「聊聊」：跳聊天并带来源卡。
    func openChat(from entry: DiaryEntry) {
        chatSource = ChatSource(kicker: "从今天的这条继续", text: entry.text)
        hasMail = false
        mailboxOpen = false
        screen = .chat
    }

    /// 「记一下」抽屉保存：按当前时间插入新碎片。
    func saveCapture() {
        let text = captureText.trimmed
        guard !text.isEmpty else {
            isCapturing = false
            return
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        withAnimation(.easeOut(duration: Metrics.fade)) {
            entries.append(DiaryEntry(
                id: "n" + UUID().uuidString,
                time: formatter.string(from: Date()),
                kind: .text,
                visit: .unread,
                text: text
            ))
        }
        isCapturing = false
        captureText = ""
        flash("记下了")
    }

    /// 调试：把第一条够不上目标状态的非私密碎片推到该状态。
    func advanceVisit(to target: DiaryEntry.Visit) {
        guard let index = entries.firstIndex(where: { $0.visit < target && !$0.isPrivate }) else {
            flash("没有可以推进的碎片了")
            return
        }
        withAnimation(.easeOut(duration: Metrics.fadeSlow)) {
            entries[index].visit = target
        }
        hasMail = true
        announce(target == .commented ? "团子在你的日记上留了一句" : "团子去信箱看过你的日记了")
    }

    // MARK: - 创建流程

    func startOnboarding() {
        cancelEverything()
        showsMe = false
        mailboxOpen = false
        nameDraft = ""
        nameError = nil
        meetDone = false
        meetLines = []
        meetDraft = ""
        toast = nil
        onboarding = .welcome
    }

    func onboardingBack() {
        guard let step = onboarding else { return }
        onboarding = OnboardingStep(rawValue: max(0, step.rawValue - 1))
    }

    func onboardingNext() {
        guard let step = onboarding else { return }

        if step == .naming {
            guard isNameValid else {
                nameError = "名字要 1 到 8 个字"
                return
            }
            nameError = nil
            startFirstMeeting()
            return
        }

        withAnimation(.easeOut(duration: Metrics.progressBar)) {
            onboarding = OnboardingStep(rawValue: min(OnboardingStep.allCases.count - 1, step.rawValue + 1))
        }
    }

    func rerollNames() { namePoolIndex += 1 }

    /// 初次见面：第一句话由猫先说 —— 用户是被认领的一方，不是操作者。
    private func startFirstMeeting() {
        meetDone = false
        meetDraft = ""
        meetLines = [MeetLine(text: "你来了。", isCat: true)]
        onboarding = .firstMeeting

        onboardingTask?.cancel()
        onboardingTask = run { [weak self] in
            try await Self.sleep(1400)
            guard let self else { return }
            withAnimation(.easeOut(duration: Metrics.fade)) {
                self.meetLines.append(MeetLine(text: "我要怎么叫你？", isCat: true))
            }
        }
    }

    func sendMeetReply() {
        let text = meetDraft.trimmed
        guard !text.isEmpty else { return }
        let name = catName
        withAnimation(.easeOut(duration: Metrics.fade)) {
            meetLines.append(MeetLine(text: text, isCat: false))
        }
        meetDraft = ""

        onboardingTask?.cancel()
        onboardingTask = run { [weak self] in
            try await Self.sleep(900)
            guard let self else { return }
            withAnimation(.easeOut(duration: Metrics.fade)) {
                self.meetLines.append(MeetLine(text: "\(text)。\n那我是\(name)。记住了。", isCat: true))
                self.meetDone = true
            }
        }
    }

    /// 「先不说」跳过。
    func skipMeet() {
        withAnimation(.easeOut(duration: Metrics.fade)) {
            meetLines.append(MeetLine(text: "那我先不问了。你在就行。", isCat: true))
            meetDone = true
        }
    }

    func enterYard() {
        onboarding = nil
        screen = .home
        if backend.isRemote { remoteUpdateCat() }
    }

    // MARK: - 重置

    /// 调试：回到种子数据。
    func reseed() {
        cancelEverything()
        onboarding = nil
        screen = .home
        viewedIndex = 0
        reaction = nil
        world.reset()
        camera = WorldCamera()
        messages = SeedData.messages
        entries = SeedData.entries
        chatSource = nil
        messagePanel = nil
        isStreaming = false
        isWaiting = false
        draft = ""
        showTopicCard = false
        hasMail = false
        mailboxOpen = false
        showsMe = false
        memoryCount = 37
        boundaryCount = 2
        toast = nil
        forceFail = false
        forceTimeout = false
        connectBackend()
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
