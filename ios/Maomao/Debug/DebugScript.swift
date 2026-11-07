import SwiftUI
import Combine

#if DEBUG
/// 启动参数脚本：没有模拟器面板时也能驱动世界层做验收截图。
///
/// ```
/// xcrun simctl launch booted com.maomao.app -script "500:moveCat:4;9000:poke;12000:look:0;14000:findCat"
/// ```
/// 每条 `延迟ms:命令[:参数]`，延迟从启动起算。命令：moveCat:i、look:i、findCat、poke、drag:dx（pt）、screen:home|chat|mailbox|me、mail、reseed，
/// speed:倍数（世界时间慢放，0.25 = 四分之一速），
/// 时段与情绪：time:小时（如 19.6，auto 恢复）、weather:rain|clear|auto、mood:calm|happy|sulk|sad|auto、bowl:fill|empty、drink（去喝水）、diary（现在写团子的日记）；
/// 性格：temperament:slow|close|quiet|curious、trait:energy|initiative|directness|closeness=0|1|2、days:N（假装领养了 N 天）、greet（当成刚打开 App）；
/// 实测回归：yardProbe:open|close（配合 -yardProbeAutoStart YES）；
/// performance:标签（采集五秒 Store 通知数，写入 Documents/performance-标签.json）；
/// factsCheck:标签（水碗/邮件即时同步与跨日刷新检查，结束后恢复原内存状态）；
/// avatarSnapshot:标签（头像实际播放状态和同步准备耗时）；
/// datePerformance:标签（原生日期函数批量基准，写入 Documents/date-performance-标签.json）；
/// diaryReadPerformance:标签（日记只读路径基准及失效检查；样本不落盘）；
/// 以及聊天：backend:mock|local、send:文本（文本里不能有冒号和分号）、stop、boundary（把最后一条猫消息标成不要再提）。
enum DebugScript {
    static func run(on store: AppStore) {
        guard let raw = UserDefaults.standard.string(forKey: "script"), !raw.isEmpty else { return }
        for item in raw.split(separator: ";") {
            let parts = item.split(separator: ":").map(String.init)
            guard parts.count >= 2, let delay = Int(parts[0]) else { continue }
            let command = parts[1]
            let arg = parts.count > 2 ? parts[2] : ""
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: UInt64(delay) * 1_000_000)
                switch command {
                case "avatarSnapshot": PortraitPerformance.write(label: arg)
                case "factsCheck":
                    guard let runtime = store.world.yard3D else { return }
                    let bowl = store.bowlFilledAt, mail = store.hasMail
                    defer { store.bowlFilledAt = bowl; store.hasMail = mail; store.conditionsClock = 1 }
                    @MainActor func configured(full: Bool, mail: Bool) -> Bool {
                        let facts = runtime.web.homeConfiguration["facts"]
                        return facts?["full"] as? Bool == full && facts?["mail"] as? Bool == mail
                    }
                    store.bowlFilledAt = nil; store.hasMail = false
                    store.bowlFilledAt = store.currentDate()
                    let filled = configured(full: true, mail: false)
                    store.bowlFilledAt = nil
                    let emptied = configured(full: false, mail: false)
                    store.hasMail = true
                    let raised = configured(full: false, mail: true)
                    store.hasMail = false
                    let lowered = configured(full: false, mail: false)
                    // 模拟已过归档日却仍留着满碗的网页事实；每秒刷新必须纠正。
                    store.bowlFilledAt = store.currentDate().addingTimeInterval(-86400)
                    runtime.facts(full: true, mail: false)
                    store.conditionsClock = 1; store.advanceConditions(0)
                    let values = ["filledImmediately": filled, "emptiedImmediately": emptied,
                                  "mailRaisedImmediately": raised, "mailLoweredImmediately": lowered,
                                  "expiredWaterRefreshed": configured(full: false, mail: false)]
                    let label = arg.filter { $0.isLetter || $0.isNumber || $0 == "-" }
                    if let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
                       let data = try? JSONSerialization.data(withJSONObject: values, options: .prettyPrinted) {
                        try? data.write(to: dir.appendingPathComponent("facts-check-" + label + ".json"), options: .atomic)
                    }
                case "diaryReadPerformance":
                    // 合成 1,000 条 / 100 天；计量 Store 读取，包含写入派生数据的成本。
                    let original = store.entries, selected = store.selectedDiaryDay, filter = store.diaryFilter
                    defer { store.entries = original; store.selectedDiaryDay = selected; store.diaryFilter = filter }
                    let zone = TimeZone(identifier: "Asia/Shanghai")!
                    let samples: [DiaryEntry] = (0..<1000).map { i in
                        let seconds = 1_792_320_000.0 - Double(i % 100) * 86400 - Double(i / 100) * 60
                        return DiaryEntry(id: "read-benchmark-\(i)", time: "12:00", kind: .text, visit: .unread,
                                   text: "样本\(i)", isPrivate: i % 2 == 0,
                                   createdAt: Date(timeIntervalSince1970: seconds), timeZone: zone)
                    }
                    store.selectedDiaryDay = samples[0].dayKey; store.diaryFilter = .all
                    var readTimes: [Double] = [], updateTimes: [Double] = []
                    var checksum = 0
                    for _ in 0..<3 {
                        var started = ProcessInfo.processInfo.systemUptime
                        store.entries = samples
                        updateTimes.append((ProcessInfo.processInfo.systemUptime - started) * 1000)
                        started = ProcessInfo.processInfo.systemUptime
                        for _ in 0..<20 {
                            checksum += store.shownEntries.count
                            for day in store.diaryEarlierDays {
                                let records = store.diaryEntries(on: day)
                                checksum += records.count + (records.first?.text.utf8.count ?? 0)
                            }
                        }
                        readTimes.append((ProcessInfo.processInfo.systemUptime - started) * 1000)
                    }
                    store.entries = []
                    let cleared = store.shownEntries.isEmpty && store.diaryEarlierDays.isEmpty
                    store.entries = [samples[0]]
                    store.entries[0].text = "更新"; store.entries[0].isPrivate = false
                    store.diaryFilter = .privateOnly
                    let updated = store.diaryEntries(on: samples[0].dayKey) == store.entries && store.shownEntries.isEmpty
                    let values: [String: Any] = ["entries": samples.count, "days": 100, "readsPerRound": 20,
                                               "readMilliseconds": readTimes, "updateMilliseconds": updateTimes,
                                               "checksum": checksum, "cleared": cleared, "updated": updated]
                    let label = arg.filter { $0.isLetter || $0.isNumber || $0 == "-" }
                    if let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
                       let data = try? JSONSerialization.data(withJSONObject: values, options: .prettyPrinted) {
                        try? data.write(to: dir.appendingPathComponent("diary-read-performance-" + label + ".json"), options: .atomic)
                    }
                case "datePerformance":
                    // 合成批量基准，仅用于比较日期处理本身，不作为界面帧率。
                    let dates = (0..<1000).map { Date(timeIntervalSince1970: 1_792_320_000 + Double($0) * 3600) }
                    let keys = (0..<1000).map { String(format: "2026-11-%02d", $0 % 28 + 1) }
                    let zone = TimeZone(identifier: "Asia/Shanghai")!
                    var keyTimes: [Double] = [], labelTimes: [Double] = []
                    var checksum = 0
                    for _ in 0..<3 {
                        var started = ProcessInfo.processInfo.systemUptime
                        for date in dates { checksum += DiaryDay.key(for: date, timeZone: zone).utf8.count }
                        keyTimes.append((ProcessInfo.processInfo.systemUptime - started) * 1000)
                        started = ProcessInfo.processInfo.systemUptime
                        for key in keys { checksum += DiaryDay.label(key).utf8.count }
                        labelTimes.append((ProcessInfo.processInfo.systemUptime - started) * 1000)
                    }
                    let values: [String: Any] = ["iterations": dates.count, "keyMilliseconds": keyTimes,
                                               "labelMilliseconds": labelTimes, "checksum": checksum]
                    let label = arg.filter { $0.isLetter || $0.isNumber || $0 == "-" }
                    if let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
                       let data = try? JSONSerialization.data(withJSONObject: values, options: .prettyPrinted) {
                        try? data.write(to: dir.appendingPathComponent("date-performance-" + label + ".json"), options: .atomic)
                    }
                case "performance":
                    // 五秒实测真实 Store 通知；不把通知数冒充 SwiftUI 重绘次数。
                    var updates = 0
                    let observation = store.objectWillChange.sink { updates += 1 }
                    let factsBefore = store.world.yard3D?.factsChecks ?? 0
                    let started = ProcessInfo.processInfo.systemUptime
                    try? await Task.sleep(for: .seconds(5))
                    observation.cancel()
                    guard !Task.isCancelled else { return }
                    let seconds = ProcessInfo.processInfo.systemUptime - started
                    let values: [String: Any] = [
                        "seconds": seconds, "storeNotifications": updates,
                        "notificationsPerSecond": Double(updates) / seconds,
                        "factsChecks": (store.world.yard3D?.factsChecks ?? 0) - factsBefore,
                        "uses3D": store.world.uses3D,
                        "surfaceReady": store.world.yard3D?.web.surfaceReady == true,
                        "screen": store.screen == .home ? "home" : "chat",
                        "cameraMode": store.world.intent3D.cameraMode,
                    ]
                    let label = arg.filter { $0.isLetter || $0.isNumber || $0 == "-" }
                    if let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
                       let data = try? JSONSerialization.data(withJSONObject: values, options: .prettyPrinted) {
                        try? data.write(to: dir.appendingPathComponent("performance-" + label + ".json"), options: .atomic)
                    }
                case "creationStart": store.startOnboarding()
                case "creationNext": store.onboardingNext()
                case "creationBack": store.onboardingBack()
                case "creationName": store.nameDraft = arg
                case "creationInput": store.meetDraft = arg
                case "creationSend": store.sendMeetReply()
                case "creationEnter": store.enterYard()
                case "creationRetry": store.retryCreationSave()
                case "creationReload": store.loadCreation()
                case "creationSnapshot":
                    let data: [String: Any] = [
                        "step": store.onboarding.map { String(describing: $0) } ?? "home",
                        "name": store.catName, "nameDraft": store.nameDraft,
                        "temperament": store.temperament.rawValue,
                        "traits": Dictionary(uniqueKeysWithValues: store.traitLevels.map { ($0.key.rawValue, $0.value) }),
                        "input": store.meetDraft, "firstReply": store.firstMeetingReply ?? "",
                        "lines": store.meetLines.map(\.text), "lineIDs": store.meetLines.map { $0.id.uuidString },
                        "done": store.meetDone, "pending": store.meetReplyPending,
                        "loadFailed": store.creationLoadFailed, "saveFailed": store.creationSaveFailed,
                        "profileID": store.creationArchive.profile?.id.uuidString ?? "",
                        "createdAt": store.creationArchive.profile?.createdAt.timeIntervalSince1970 ?? 0,
                    ]
                    if let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
                       let encoded = try? JSONSerialization.data(withJSONObject: data) {
                        try? encoded.write(to: dir.appendingPathComponent("creation-" + arg + ".json"), options: .atomic)
                    }
                case "reviewPage":
                    // 只切内存中的页面用于视觉验收，不重置领养资料或提交创建流程。
                    if let raw = Int(arg), let step = AppStore.OnboardingStep(rawValue: raw) {
                        store.showsMe = false; store.onboarding = step
                    }
                case "recoveryReply": store.remoteReply(to: arg)
                case "historyReconnect": store.connectBackend()
                case "historyEarlier": await store.loadEarlierMessages()
                case "historySnapshot":
                    let data: [String: Any] = [
                        "texts": store.messages.map(\.text),
                        "states": store.messages.map { String(describing: $0.state) },
                        "waiting": store.isWaiting, "streaming": store.isStreaming,
                        "ids": store.messages.map { $0.serverID ?? $0.id },
                        "sequences": store.messages.compactMap(\.serverSequence),
                        "hasEarlier": store.hasEarlierMessages,
                        "loading": store.isLoadingEarlierMessages,
                        "failed": store.historyLoadError != nil,
                    ]
                    if let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
                       let encoded = try? JSONSerialization.data(withJSONObject: data) {
                        try? encoded.write(to: dir.appendingPathComponent("history-" + arg + ".json"), options: .atomic)
                    }
                case "reviewDraft": store.draft = arg
                case "diaryCapture": store.captureText = arg; store.saveCapture()
                case "diaryCaptureShared": store.captureForCat = true; store.captureText = arg; store.saveCapture(); store.captureForCat = false
                case "diarySync": store.syncDiary()
                case "diaryShare":
                    if let entry = store.entries.last(where: { $0.kind == .text }) { store.setDiaryVisibility(entry, forCat: arg == "yes") }
                case "diaryChat":
                    if let entry = store.entries.last(where: { $0.kind == .text && !$0.isPrivate }) { store.openChat(from: entry) }
                case "diaryDay": store.selectDiaryDay(arg == "today" ? nil : arg)
                case "diaryEditor": store.isCapturing = true
                case "diaryReload": store.loadDiary()
                case "diarySnapshot":
                    let data: [String: Any] = [
                        "texts": store.entries.map(\.text), "ids": store.entries.map(\.id),
                        "days": store.entries.map(\.dayKey), "private": store.entries.map(\.isPrivate),
                        "shown": store.shownEntries.map(\.text), "selectedDay": store.diaryDay,
                        "failed": store.diaryLoadFailed, "draft": store.captureText,
                        "capturing": store.isCapturing, "saveFailed": store.captureSaveFailed,
                        "cloudIDs": store.entries.map { $0.cloudID ?? "" }, "revisions": store.entries.map { $0.cloudRevision ?? 0 },
                        "pending": store.entries.map { $0.pendingMutationID != nil }, "visits": store.entries.map { $0.visit.rawValue },
                        "notes": store.entries.map(\.note), "sync": store.diarySyncLabel,
                        "needsSync": store.entries.map(\.needsSync),
                    ]
                    if let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
                       let encoded = try? JSONSerialization.data(withJSONObject: data) {
                        try? encoded.write(to: dir.appendingPathComponent("diary-" + arg + ".json"), options: .atomic)
                    }
                case "reviewMessage":
                    store.messages.append(ChatMessage(id: "ui-review-long", role: .cat, text: arg, state: .done))
                case "yardHit":
                    if let runtime = store.world.yard3D {
                        do {
                            let text = try await runtime.web.send(["type": "reviewTargets"])
                            let object = try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any]
                            let targets = object?["targets"] as? [[String: Any]] ?? []
                            if let target = targets.first(where: { $0["name"] as? String == arg }), target["hit"] as? String == arg,
                               let x = target["x"] as? Double, let y = target["y"] as? Double {
                                runtime.send(["type": "reviewTap", "x": x, "y": y])
                            }
                            if let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
                                try Data(text.utf8).write(to: dir.appendingPathComponent("yard-hit-" + arg + ".json"), options: .atomic)
                            }
                        } catch { print("3D 点选验收失败：\(error)") }
                    }
                case "yardTap":
                    let point = arg.split(separator: ",").compactMap { Double($0) }
                    if point.count == 2 { store.world.yard3D?.send(["type": "reviewTap", "x": point[0], "y": point[1]]) }
                case "yardCover": store.world.yard3D?.web.captureCover(exportName: arg)
                case "yardReload": store.world.yard3D?.web.simulateContentProcessTermination()
                case "yardActivity": store.world.reviewActivity(arg)
                case "yardCommand":
                    let parts = arg.split(separator: "=").map(String.init)
                    if let type = parts.first {
                        var value: [String: Any] = ["type": type]
                        if parts.count > 1 { value["slot"] = parts[1]; value["weather"] = parts.count > 2 ? parts[2] : "clear"; value["instant"] = true }
                        store.world.yard3D?.send(value)
                    }
                case "yardProbe": store.yardProbeVisible = arg == "open"
                case "depth": store.worldDepthEnabled = arg != "off"
                case "moveCat": if let i = Int(arg) { store.moveCat(to: i) }
                case "look": if let i = Int(arg) { store.look(at: i) }
                case "findCat": store.findCat()
                case "poke": store.poke()
                case "drag":
                    if let dx = Double(arg) {
                        store.dragCamera(translation: CGFloat(dx))
                        store.endDrag(velocity: 0)
                    }
                case "snapshot": store.world.writeSnapshot(label:arg);store.writeCameraSnapshot(label:arg);store.writeYardBusinessSnapshot(label:arg)
                case "place": if let i=Int(arg) {store.world.placeForReview(i)}
                case "screen":
                    switch arg {
                    case "home":store.screen = .home;store.closeMailbox();store.showsMe = false
                    case "chat":store.screen = .chat
                    // 日记和我的不再是整屏：信箱抽纸 / 右上角 sheet。锚点给个信箱大概的位置。
                    case "mailbox":store.openMailbox(anchor:CGPoint(x:44,y:490))
                    case "me":store.showsMe = true
                    default:break
                    }
                case "memory": store.memoryShowsBoundaries = arg == "boundaries"; store.showsMemoryControls = true
                case "mail": store.hasMail = true
                case "pause": store.world.togglePause()
                case "speed": if let v=Double(arg) {store.world.debugTimeScale=v}
                case "frame": store.world.stepFrame()
                case "seed": if let seed=UInt64(arg) {store.world.setSeed(seed)}
                case "action": if CatAction(rawValue:arg) != nil {store.world.preview(arg)}
                case "reseed": store.reseed()
                case "time": store.debugHour = arg == "auto" ? nil : Double(arg); store.conditionsClock = 1
                case "weather": store.debugWeather = arg == "auto" ? nil : Weather(rawValue: arg); store.rainAmount = arg == "rain" ? 1 : 0; store.conditionsClock = 1
                case "mood": store.debugMood = arg == "auto" ? nil : Mood(rawValue: arg); store.conditionsClock = 1
                case "bowl": if arg == "fill" { store.fillBowl() } else { store.emptyBowl() }
                case "drink": store.world.requestDrink()
                case "diary": store.writeCatDiary(now: store.currentDate())
                case "temperament":
                    if let t = Temperament(rawValue: arg) { store.temperament = t }
                    store.conditionsClock = 1
                case "trait":
                    let pair = arg.split(separator: "=")
                    if pair.count == 2, let trait = Trait(rawValue: String(pair[0])), let level = Int(pair[1]) {
                        store.traitLevels[trait] = min(2, max(0, level))
                    }
                    store.conditionsClock = 1
                case "days":
                    if let n = Int(arg) {
                        store.createdAt = Calendar.current.date(byAdding: .day, value: -n, to: store.currentDate()) ?? store.createdAt
                        store.compileBehavior()
                    }
                    store.conditionsClock = 1
                case "greet":
                    store.greetedThisSession = false
                    store.greetOnOpen()
                case "backend": if let mode = BackendConfig.Mode(rawValue: arg) { store.setBackendMode(mode) }
                case "send":
                    store.draft = arg
                    store.send()
                case "stop": store.stopStreaming()
                case "boundary":
                    if let last = store.messages.last(where: { $0.isCat }) {
                        store.messagePanel = AppStore.MessagePanel(id: last.id, isCat: true)
                        store.markBoundary()
                    }
                default: print("DebugScript: 未知命令 \(command)")
                }
            }
        }
    }
}
#endif
