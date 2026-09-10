import SwiftUI

/// 全部界面状态与状态转换。
///
/// 本版所有数据都是本地 mock —— 真实实现要接的四个口子（世界状态、聊天流式、
/// 日记碎片与访问状态、记忆条目 CRUD）都标了 `TODO: 后端`，逻辑形状按真接口的
/// 时序写好了（发送落地 / 等待 / 流式 / 可停止 / 可重试），换成网络层不用动界面。
@MainActor
final class AppStore: ObservableObject {

    // MARK: - 路由

    enum Screen { case home, chat, diary, me }

    enum OnboardingStep: Int, CaseIterable {
        case welcome, pickCat, temperament, naming, firstMeeting

        /// 欢迎屏不计步，其余是 1/4–4/4。
        var stepNumber: Int { rawValue }
    }

    @Published var screen: Screen = .home
    /// nil = 已经有猫了，走正常四屏。
    @Published var onboarding: OnboardingStep?

    // MARK: - 世界

    @Published var viewedIndex = 0    // 地点轨高亮的地点
    @Published var catIndex = 0       // 猫所在（或正前往）的地点
    @Published private(set) var statusIndex = 0
    /// 点猫后的反应句，2s 后自动清空。
    @Published private(set) var reaction: String?

    /// 相机中心 x（归一化）。跟随猫时视图用猫的实时 x，这个值只在自由镜头时生效。
    @Published var cameraX: CGFloat = Location.all[0].cameraX { didSet { refreshLost() } }
    /// 镜头跟着猫走。拖拽或点地点轨会断开；「找团子」接回。
    @Published var cameraFollowsCat = true { didSet { refreshLost() } }
    /// 猫的落脚点（不在行程中时有效）。
    @Published private(set) var catSpot: CGPoint = Location.all[0].spot
    @Published private(set) var catFacing: Facing = Location.all[0].facing
    @Published private(set) var catAction: CatAction = Location.all[0].idle
    @Published private(set) var catActionStart = Date()
    /// 正在进行的行程；视图每帧按时间采样位置。
    @Published private(set) var catMotion: CatMotion?
    /// 视图量出来的屏幕几何，判断猫在不在视野里要用。
    @Published var worldGeometry = WorldGeometry.placeholder { didSet { refreshLost() } }
    /// 猫不在视野里 —— 显示「找团子」。行程中每 100ms 刷新一次。
    @Published private(set) var isLost = false

    var viewedLocation: Location { Location.all[viewedIndex] }
    var catLocation: Location { Location.all[catIndex] }

    /// 猫此刻的位置和朝向（行程中按时间采样）。
    func catPose(at date: Date = Date()) -> (point: CGPoint, facing: Facing) {
        if let motion = catMotion {
            let s = motion.sample(at: date, fallbackFacing: catFacing)
            return (s.point, s.facing)
        }
        return (catSpot, catFacing)
    }

    /// 此刻视图该用的相机 x。
    func effectiveCameraX(at date: Date = Date()) -> CGFloat {
        cameraFollowsCat ? worldGeometry.clampCamera(catPose(at: date).point.x) : cameraX
    }

    private func refreshLost() {
        let lost = !worldGeometry.isVisible(catPose().point.x, cameraX: effectiveCameraX())
        if lost != isLost { isLost = lost }
    }

    /// 顶部状态条。点猫的反应句优先。
    var statusText: String {
        if let reaction { return reaction }
        if catMotion != nil { return "团子正往" + catLocation.name + "走" }
        guard !isLost else { return viewedLocation.name + "这边没有猫" }
        let lines = catLocation.lines
        return lines[statusIndex % lines.count]
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
    @Published private(set) var isWaiting = false
    @Published private(set) var isStreaming = false
    @Published var chatSource: ChatSource?
    @Published var messagePanel: MessagePanel?

    // MARK: - 日记

    @Published var entries = SeedData.entries
    @Published var isCapturing = false
    @Published var captureText = ""
    /// Tab 栏「日记」上的未读红点。
    @Published var diaryDot = false

    // MARK: - 我的

    @Published var shareByDefault = true
    @Published private(set) var memoryCount = 37
    @Published private(set) var boundaryCount = 2

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

    /// 显示 Tab 栏：创建流程和专注聊天都不显示。
    var showsTabBar: Bool { onboarding == nil && screen != .chat }

    // MARK: - 调试开关（仅 DEBUG 构建可见）

    @Published var forceFail = false
    @Published var forceTimeout = false
    @Published var showTopicCard = false

    // MARK: - 任务管理

    /// 一次只有一条消息在途，所以聊天用单个句柄 —— 「停止」直接取消它。
    private var chatTask: Task<Void, Never>?
    private var onboardingTask: Task<Void, Never>?
    private var toastTask: Task<Void, Never>?
    private var reactionTask: Task<Void, Never>?
    private var motionTask: Task<Void, Never>?
    private var onceTask: Task<Void, Never>?
    private var fidgetTask: Task<Void, Never>?

    init() {
        scheduleFidget()
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
        cancelCatTasks()
    }

    private static func sleep(_ milliseconds: Int) async throws {
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

    /// 猫换地点：走过去（远了就跑）。镜头在跟随时一路跟着并提示；用户在别处闲逛就只更新红点，不打扰。
    func moveCat(to index: Int) {
        guard index != catIndex || catMotion != nil else { return }
        let target = Location.all[index]
        let from = catPose().point
        cancelCatTasks()
        let points = CatMotion.route(from: from, to: target.spot)
        let length = zip(points, points.dropFirst()).reduce(CGFloat(0)) { $0 + World.distance($1.0, $1.1) }
        let gait: CatAction = length > 2 * Metrics.referenceWidth ? .run : .walk
        let speed = gait.spec.bodyLength * (gait == .run ? 2.2 : 1.0)
        let motion = CatMotion(points: points, start: Date(), gait: gait, speed: speed)
        catIndex = index
        statusIndex = Int.random(in: 0..<target.lines.count)
        reaction = nil
        catAction = gait
        catActionStart = motion.start
        catMotion = motion
        if cameraFollowsCat {
            viewedIndex = index
            flash("团子去" + target.name + "了")
        }
        motionTask = Task { @MainActor in
            while Date() < motion.end {
                try? await Self.sleep(100)
                guard !Task.isCancelled else { return }
                refreshLost()
            }
            guard !Task.isCancelled else { return }
            arrive(at: target)
        }
    }

    private func arrive(at location: Location) {
        catSpot = location.spot
        catFacing = location.facing
        catMotion = nil
        setAction(location.idle)
        refreshLost()
        scheduleFidget()
    }

    private func setAction(_ action: CatAction) {
        catAction = action
        catActionStart = Date()
    }

    /// 插播一个单次动作（眨眼 / 伸懒腰），播完回到地点的待机动作。行程中不插。
    func playOnce(_ action: CatAction) {
        guard catMotion == nil else { return }
        onceTask?.cancel()
        setAction(action)
        let duration = action.spec.cycleDuration()
        onceTask = Task { @MainActor in
            try? await Self.sleep(Int(duration * 1000))
            guard !Task.isCancelled else { return }
            setAction(catLocation.idle)
        }
    }

    /// 待机小动作：到位 4–10s 后随机眨眼或伸懒腰。睡着的时候不动。
    private func scheduleFidget() {
        fidgetTask?.cancel()
        fidgetTask = Task { @MainActor in
            while !Task.isCancelled {
                try? await Self.sleep(Int.random(in: 4000...10000))
                guard !Task.isCancelled else { return }
                let idle = catLocation.idle
                guard catMotion == nil, catAction == idle, idle != .sleepBreathe, idle != .sleepyNod else { continue }
                playOnce(Bool.random() ? .blinkLook : .stretch)
            }
        }
    }

    private func cancelCatTasks() {
        motionTask?.cancel()
        onceTask?.cancel()
        fidgetTask?.cancel()
    }

    /// 地点轨：自由镜头滑到那个地点。
    func look(at index: Int) {
        reaction = nil
        viewedIndex = index
        cameraFollowsCat = false
        withAnimation(.easeInOut(duration: 0.6)) {
            cameraX = worldGeometry.clampCamera(Location.all[index].cameraX)
        }
    }

    /// 「找团子」：镜头滑回猫身边，然后重新跟随。
    func findCat() {
        reaction = nil
        let target = worldGeometry.clampCamera(catPose().point.x)
        withAnimation(.easeInOut(duration: 0.6)) { cameraX = target }
        Task { @MainActor in
            try? await Self.sleep(600)
            cameraFollowsCat = true
            viewedIndex = catIndex
        }
    }

    // 拖拽平移：起手断开跟随；越界带 0.35 的橡皮筋；松手按速度惯性滑到夹紧后的位置。
    private var dragOrigin: CGFloat?

    func dragCamera(translation: CGFloat) {
        if dragOrigin == nil {
            dragOrigin = effectiveCameraX()
            cameraFollowsCat = false
        }
        let raw = (dragOrigin ?? cameraX) - translation / worldGeometry.bgSize.width
        let clamped = worldGeometry.clampCamera(raw)
        cameraX = clamped + (raw - clamped) * 0.35
    }

    func endDrag(velocity: CGFloat) {
        dragOrigin = nil
        let projected = cameraX - velocity * 0.12 / worldGeometry.bgSize.width
        let target = worldGeometry.clampCamera(projected)
        withAnimation(.easeOut(duration: 0.4)) { cameraX = target }
        viewedIndex = Location.nearest(toCamera: target)
    }

    /// 点猫。只有猫在视野里且没在走路时可点。播一个小动作，反应文案停留 2s。
    func poke() {
        guard !isLost, catMotion == nil else { return }
        reactionTask?.cancel()
        playOnce(Bool.random() ? .stretch : .blinkLook)
        withAnimation(.easeOut(duration: Metrics.pokeDuration)) {
            reaction = catLocation.reactions.randomElement()
        }
        reactionTask = Task { @MainActor in
            try? await Self.sleep(2000)
            guard !Task.isCancelled else { return }
            withAnimation(.easeOut(duration: Metrics.pokeDuration)) { reaction = nil }
        }
    }

    func openTopicCard() {
        chatSource = ChatSource(kicker: "接着昨天的", text: SeedData.topicText)
        showTopicCard = false
        screen = .chat
    }

    // MARK: - 聊天

    /// 发送：520ms 落地 → 等待 900ms → 流式每字 58ms。
    /// TODO: 后端 —— 换成真的流式接口，落地态对应请求已受理，streaming 对应 SSE/WebSocket 分片。
    func send() {
        let text = draft.trimmed
        guard !text.isEmpty, !isStreaming else { return }

        let id = "u" + UUID().uuidString
        let willFail = forceFail
        messages.append(ChatMessage(id: id, role: .user, text: text, state: .sending))
        draft = ""
        forceFail = false

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
    /// TODO: 后端 —— 写进边界列表，之后模型不再提这条。
    func markBoundary() {
        guard let panel = messagePanel else { return }
        if let index = messages.firstIndex(where: { $0.id == panel.id }) {
            messages[index].boundary = true
        }
        boundaryCount += 1
        messagePanel = nil
    }

    private func setState(_ state: ChatMessage.State, for id: String) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        messages[index].state = state
    }

    private func updateText(_ text: String, for id: String) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        messages[index].text = text
    }

    // MARK: - 日记

    /// 留言纸上的「聊聊」：跳聊天并带来源卡。
    func openChat(from entry: DiaryEntry) {
        chatSource = ChatSource(kicker: "从今天的这条继续", text: entry.text)
        diaryDot = false
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
        diaryDot = true
        flash(target == .commented ? "团子留了一句" : "团子来看过了")
    }

    // MARK: - 创建流程

    func startOnboarding() {
        cancelEverything()
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
    }

    // MARK: - 重置

    /// 调试：回到种子数据。
    func reseed() {
        cancelEverything()
        onboarding = nil
        screen = .home
        viewedIndex = 0
        catIndex = 0
        statusIndex = 0
        reaction = nil
        catMotion = nil
        catSpot = Location.all[0].spot
        catFacing = Location.all[0].facing
        setAction(Location.all[0].idle)
        cameraFollowsCat = true
        cameraX = Location.all[0].cameraX
        dragOrigin = nil
        scheduleFidget()
        messages = SeedData.messages
        entries = SeedData.entries
        chatSource = nil
        messagePanel = nil
        isStreaming = false
        isWaiting = false
        draft = ""
        showTopicCard = false
        diaryDot = false
        memoryCount = 37
        boundaryCount = 2
        toast = nil
        forceFail = false
        forceTimeout = false
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
