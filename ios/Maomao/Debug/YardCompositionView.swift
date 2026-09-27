#if DEBUG
import Combine
import SwiftUI

/// 第 1 轮独立构图预览：真实 WKWebView + 原生控件；不改变 AppStore 的猫、首页或聊天。
struct YardCompositionView: View {
    @StateObject private var preview = YardCompositionPreview()
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var controlFrames: [String: CGRect] = [:]

    var body: some View {
        GeometryReader { safe in
            GeometryReader { full in
                ZStack {
                    YardWebSurface(controller: preview.web)
                    overlay(size: full.size, safe: safe.safeAreaInsets)
                        .opacity(preview.showUI ? 1 : 0)
                        .allowsHitTesting(preview.showUI)
                    if let error = preview.error ?? preview.web.failure {
                        Text(error).font(Typo.sans(12)).padding(12)
                            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: Metrics.radiusCard))
                    }
                }
                .coordinateSpace(name: "composition")
                .onPreferenceChange(CompositionFrames.self) { frames in
                    controlFrames = frames; preview.updateControls(frames)
                }
                .onAppear { preview.start(safe: safe.safeAreaInsets) }
                .onChange(of: safe.safeAreaInsets) { preview.updateInsets(safe.safeAreaInsets) }
                .onChange(of: full.size) { preview.updateInsets(safe.safeAreaInsets) }
            }
            .ignoresSafeArea()
        }
        .preferredColorScheme(preview.night ? .dark : .light)
        .onChange(of: scenePhase) { preview.setActive(scenePhase == .active) }
        .onChange(of: reduceMotion) { preview.send(["type": "previewMotion", "on": reduceMotion]) }
        .onDisappear { preview.close() }
    }

    private func overlay(size: CGSize, safe: EdgeInsets) -> some View {
        let pillTop = max(58, safe.top + 5)
        let bottom = max(safe.bottom, 16) + 24
        return ZStack {
            VStack {
                Text("团子 · \(preview.catName) · \(preview.night ? "夜晚 · 雨" : "白天 · 晴")")
                    .font(Typo.sans(12.5)).tracking(track(0.06, 12.5))
                    .foregroundStyle(preview.night ? Color.white.opacity(0.92) : Palette.ink2).multilineTextAlignment(.center)
                    .padding(.horizontal, 14).padding(.vertical, 6)
                    .liquidGlass(in: Capsule()).compositionFrame("status")
                    .padding(.horizontal, 64).padding(.top, pillTop)
                Spacer()
            }
            VStack {
                HStack {
                    Spacer()
                    Menu {
                        Text("构图预览 · 参数待评审")
                        Button(preview.night ? "白天晴" : "夜晚雨") { preview.toggleWeather() }
                        Button("保存参数与量测") { preview.saveEvidence() }
                        Button("播放镜头演示") { preview.demo() }
                        Button("隐藏控件 5 秒") { preview.hideTemporarily() }
                        Button("在扩展后的院子里散步") { preview.send(["type": "stroll"]) }
                        Button("内容进程恢复测试") { preview.recoveryCheck() }
                        Button("关闭预览") { preview.close(); dismiss() }
                    } label: {
                        IconTile(size: Metrics.iconSlotLg, circular: true, glass: true) {
                            Image("tuanzi-canonical").resizable().scaledToFit().padding(5)
                        }
                    }
                    .accessibilityLabel("构图预览设置")
                    .compositionFrame("profile")
                    .padding(.trailing, 16).padding(.top, pillTop - 8)
                }
                Spacer()
            }
            HStack {
                VStack {
                    GlassGroup(spacing: 4) {
                        VStack(spacing: 4) {
                            ForEach(CompositionPlace.all) { item in
                                Button { preview.look(item.id) } label: {
                                    Icons.location(item.location, color: preview.selected == item.id ? Palette.accentInk : (preview.night ? Color.white.opacity(0.86) : Palette.railIcon))
                                        .frame(width: 34, height: 34)
                                        .liquidGlass(in: Circle(), tint: preview.selected == item.id ? Palette.accent : nil,
                                                     interactive: true, fallback: preview.selected == item.id ? Palette.onSceneRailOn : Palette.onSceneRailOn)
                                        .frame(width: 44, height: 44).contentShape(Rectangle())
                                }
                                .buttonStyle(PressScaleStyle()).accessibilityLabel(item.location.name)
                            }
                        }
                    }
                    .compositionFrame("rail").padding(.leading, 7).padding(.top, 191)
                    Spacer()
                }
                Spacer()
            }
            VStack {
                Spacer()
                HStack(spacing: 11) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("昨天没说完的").font(Typo.sans(10.5)).foregroundStyle(Palette.paperInk)
                        Text(SeedData.topicText).font(Typo.sans(13.5)).foregroundStyle(Palette.ink).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                    Text("接着聊").font(Typo.sans(12)).foregroundStyle(Palette.accent)
                    Icons.close(color: Palette.paperInk)
                }
                .padding(.horizontal, 13).padding(.vertical, 12)
                .background(Palette.onSceneTopic, in: RoundedRectangle(cornerRadius: Metrics.radiusCard))
                .overlay(RoundedRectangle(cornerRadius: Metrics.radiusCard).stroke(Palette.onSceneTopicRule, lineWidth: 1))
                .compositionFrame("topic").padding(.horizontal, 16)
                .padding(.bottom, bottom + Metrics.minTap + 16)
            }
            VStack {
                Spacer()
                HStack(spacing: 8) {
                    cameraButton("全景", symbol: "arrow.up.left.and.arrow.down.right") { preview.overview() }
                        .compositionFrame("overview")
                    if preview.mode != "following" {
                        cameraButton("找团子", symbol: "pawprint") { preview.findCat() }
                            .compositionFrame("findCat")
                    }
                    Spacer(minLength: 8)
                    PrimaryButton(height: Metrics.chatPill, horizontalPadding: 24, cornerRadius: Metrics.chatPill / 2,
                                  shadow: false, tapSlop: (Metrics.minTap - Metrics.chatPill) / 2, glass: true) {
                        preview.showNotice("这里仅预览构图；聊天仍在原首页")
                    } label: {
                        Text("聊会儿").font(Typo.sans(15)).tracking(track(0.08, 15))
                    }
                    .compositionFrame("chat")
                }
                .padding(.horizontal, 18).padding(.bottom, bottom)
            }
        }
    }

    private func cameraButton(_ label: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 17, weight: .medium)).foregroundStyle(preview.night ? Color.white.opacity(0.92) : Palette.accent)
                .frame(width: 42, height: 42)
                .liquidGlass(in: Circle(), interactive: true, fallback: Palette.onSceneRailOn)
                .frame(width: 46, height: 46).contentShape(Circle())
        }.buttonStyle(PressScaleStyle()).accessibilityLabel(label)
    }
}

private struct CompositionFrames: PreferenceKey {
    static var defaultValue: [String: CGRect] = [:]
    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) { value.merge(nextValue(), uniquingKeysWith: { _, new in new }) }
}
private extension View {
    func compositionFrame(_ name: String) -> some View {
        background(GeometryReader { proxy in Color.clear.preference(key: CompositionFrames.self, value: [name: proxy.frame(in: .named("composition"))]) })
    }
}

struct CompositionPlace: Identifiable {
    let id: String
    let location: Location
    static let all: [CompositionPlace] = [
        ("house", Location.ID.mushroomHouse), ("bed", .catBed), ("tree", .treeHouse),
        ("grass", .grass), ("pond", .pond), ("fence", .fence)
    ].map { CompositionPlace(id: $0.0, location: Location.all[Location.index(of: $0.1)]) }
}

@MainActor final class YardCompositionPreview: ObservableObject {
    let web = YardWebController()
    @Published var showUI = true
    @Published var night = false
    @Published var selected: String? = "house"
    @Published var mode = "browsing"
    @Published var catName = "蘑菇屋"
    @Published var error: String?
    var controlFrames: [String: CGRect] = [:]
    private var subscription: AnyCancellable?
    private var tasks: [Task<Void, Never>] = []
    private var loaded = false
    private var ready = false
    private var initialView = "house"
    private var insets: [String: Double] = [:]
    private var began = Date()
    private var savedAutomatic = false
    private var previousIdle: Bool?
    private var deadline: Task<Void, Never>?
    private var latestReport: [String: Any] = [:]
    private var events: [[String: Any]] = []
    private var recovery: [String: Any] = [:]

    func start(safe: EdgeInsets) {
        guard !loaded else { return }
        loaded = true; began = Date()
        let ud = UserDefaults.standard
        initialView = ud.string(forKey: "yardCompositionView") ?? "house"
        if !CompositionPlace.all.contains(where: { $0.id == initialView }) && initialView != "overview" && initialView != "comparison" { initialView = "house" }
        selected = initialView == "overview" ? nil : initialView
        night = ud.string(forKey: "yardCompositionTime") == "night"
        showUI = ud.object(forKey: "yardCompositionUI") == nil || ud.bool(forKey: "yardCompositionUI")
        updateInsets(safe)
        previousIdle = UIApplication.shared.isIdleTimerDisabled
        UIApplication.shared.isIdleTimerDisabled = true
        subscription = web.messages.sink { [weak self] message in self?.receive(message) }
        var query = ["composition": "1", "view": initialView, "time": night ? "night" : "day", "weather": night ? "rain" : "clear",
                     "dpr": "1.5", "msaa": "0", "fps": "60", "post": "1", "shadow": "2048", "grass": "1", "shells": "4", "walk": "0"]
        for (key, value) in insets { query[key] = String(value) }
        web.load(runID: UUID().uuidString, query: query, active: true)
        armDeadline()
    }
    func updateControls(_ frames: [String: CGRect]) {
        controlFrames = frames
        sendControls()
    }
    private func sendControls() {
        send(["type": "controls", "rects": controlFrames.values.map { ["x": $0.minX, "y": $0.minY, "width": $0.width, "height": $0.height] }])
    }
    func updateInsets(_ safe: EdgeInsets) {
        insets = ["top": Double(max(58, safe.top + 5) + 44), "bottom": Double(max(safe.bottom, 16) + 24 + 46 + 16 + 62), "left": 62, "right": 16]
        if ready { send(["type": "viewport", "insets": insets]) }
    }
    func send(_ command: [String: Any]) {
        guard loaded, ready else { return }
        tasks.append(Task { [weak self] in
            guard let self else { return }
            do { _ = try await web.send(command) } catch { self.error = "预览操作失败：\(error.localizedDescription)" }
        })
    }
    func look(_ id: String) { selected = id; mode = "browsing"; send(["type": "look", "place": id]) }
    func overview() { selected = nil; mode = "overview"; send(["type": "overview"]) }
    func findCat() { selected = nil; mode = "following"; send(["type": "findCat"]) }
    func toggleWeather() {
        night.toggle()
        send(["type": "atmosphere", "slot": night ? "night" : "day", "weather": night ? "rain" : "clear"])
    }
    func setActive(_ active: Bool) {
        tasks.append(Task { [weak self] in await self?.web.setActive(active) })
    }
    func hideTemporarily() {
        showUI = false
        tasks.append(Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 5_000_000_000) } catch { return }
            self?.showUI = true
        })
    }
    func showNotice(_ text: String) {
        error = text
        tasks.append(Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 2_000_000_000) } catch { return }
            self?.error = nil
        })
    }
    func demo() {
        tasks.append(Task { [weak self] in
            guard let self else { return }
            let commands: [[String: Any]] = [["type": "overview"], ["type": "previewZoom", "ratio": 1.7],
                ["type": "previewZoom", "ratio": 1.7], ["type": "findCat"], ["type": "look", "place": "pond"], ["type": "overview"]]
            for command in commands {
                do {
                    try await Task.sleep(nanoseconds: 2_000_000_000)
                    if command["type"] as? String == "previewZoom", let ratio = command["ratio"] as? Double {
                        for _ in 0..<30 {
                            try await Task.sleep(nanoseconds: 33_000_000)
                            _ = try await web.send(["type": "previewZoom", "ratio": pow(ratio, 1.0 / 30.0)])
                        }
                    } else { _ = try await web.send(command) }
                } catch { if !Task.isCancelled { self.error = "镜头演示失败：\(error)" }; return }
            }
            saveEvidence()
        })
    }
    func saveEvidence() {
        guard ready else { return }
        tasks.append(Task { [weak self] in
            guard let self else { return }
            do {
                let raw = try await web.send(["type": "compositionMetrics"])
                var record = try JSONSerialization.jsonObject(with: Data(raw.utf8)) as! [String: Any]
                record["controls"] = controlFrames.mapValues { ["x": $0.minX, "y": $0.minY, "width": $0.width, "height": $0.height] }
                record["startedAt"] = ISO8601DateFormatter().string(from: began)
                record["runId"] = web.identity.runID
                let buildURL = Bundle.main.url(forResource: "YardWeb", withExtension: nil)?.appendingPathComponent("probe-build.json")
                record["build"] = buildURL.flatMap { try? Data(contentsOf: $0) }.flatMap { try? JSONSerialization.jsonObject(with: $0) } ?? NSNull()
                record["view"] = initialView; record["time"] = night ? "night" : "day"; record["overlay"] = showUI
                record["device"] = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] ?? UIDevice.current.model
                record["system"] = UIDevice.current.systemVersion
                record["isSimulator"] = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] != nil
                record["recovery"] = recovery
                record["report"] = latestReport; record["events"] = events
                record["thermal"] = ProcessInfo.processInfo.thermalState.rawValue
                record["elapsed"] = Date().timeIntervalSince(began)
                let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("yard-composition")
                _ = try YardProbeArchive.save(record, directory: url, name: "\(initialView)-\(night ? "night" : "day")-\(showUI ? "ui" : "clean")")
            } catch { self.error = "预览证据保存失败：\(error.localizedDescription)" }
        })
    }
    private func receive(_ message: [String: Any]) {
        guard web.identity.accepts(message) else { return }
        let type = message["type"] as? String ?? ""
        if type == "visualReady" {
            ready = true; deadline?.cancel(); sendControls()
            if recovery["before"] != nil, recovery["after"] == nil {
                tasks.append(Task { [weak self] in
                    guard let self else { return }
                    do {
                        try await Task.sleep(nanoseconds: 2_000_000_000)
                        let raw = try await web.send(["type": "snapshot"])
                        recovery["after"] = try JSONSerialization.jsonObject(with: Data(raw.utf8))
                        saveEvidence()
                    } catch { self.error = "恢复复核失败：\(error)" }
                })
            }
            send(["type": "previewMotion", "on": UIAccessibility.isReduceMotionEnabled])
            if !savedAutomatic {
                savedAutomatic = true
                tasks.append(Task { [weak self] in
                    do { try await Task.sleep(nanoseconds: 3_000_000_000) } catch { return }
                    self?.saveEvidence()
                    if UserDefaults.standard.bool(forKey: "yardCompositionStroll") { self?.send(["type": "stroll"]) }
                    if UserDefaults.standard.bool(forKey: "yardCompositionDemo") { self?.demo() }
                    if UserDefaults.standard.bool(forKey: "yardCompositionRecovery") { self?.recoveryCheck() }
                })
            }
        }
        if type == "perf" {
            latestReport = message["report"] as? [String: Any] ?? [:]
            if let snapshot = message["snapshot"] as? [String: Any] {
                if let camera = snapshot["camera"] as? [String: Any] { mode = camera["mode"] as? String ?? mode; selected = camera["place"] as? String }
                if let goal = message["nearest"] as? String ?? snapshot["goal"] as? String { catName = CompositionPlace.all.first(where: { $0.id == goal })?.location.name ?? catName }
            }
            let duration = UserDefaults.standard.double(forKey: "yardCompositionDuration")
            if duration > 0, (latestReport["seconds"] as? Double ?? 0) >= duration {
                saveEvidence(); send(["type": "active", "on": false])
            }
        } else {
            events.append(["type": type, "at": Date().timeIntervalSince(began)])
            if type == "error" { error = message["message"] as? String }
            if type == "processTerminated" || type == "contextLost" { ready = false; armDeadline() }
        }
    }
    func recoveryCheck() {
        guard ready else { return }
        recovery = [:]
        tasks.append(Task { [weak self] in
            guard let self else { return }
            do {
                _ = try await web.send(["type": "overview"])
                try await Task.sleep(nanoseconds: 2_000_000_000)
                _ = try await web.send(["type": "previewZoom", "ratio": 1.6])
                try await Task.sleep(nanoseconds: 1_000_000_000)
                let raw = try await web.send(["type": "snapshot"])
                recovery["before"] = try JSONSerialization.jsonObject(with: Data(raw.utf8))
                recovery["kind"] = "原生内容进程终止回调注入；非系统真实杀进程"
                web.simulateContentProcessTermination()
            } catch { self.error = "恢复测试未完成：\(error)" }
        })
    }
    private func armDeadline() {
        deadline?.cancel()
        deadline = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 10_000_000_000) } catch { return }
            guard let self, loaded, !ready else { return }
            error = "10 秒内未收到可见画面；请关闭预览后重试"
        }
    }
    func close() {
        deadline?.cancel(); deadline = nil
        tasks.forEach { $0.cancel() }; tasks.removeAll(); subscription?.cancel(); subscription = nil
        web.stop(); loaded = false; ready = false
        if let previousIdle { UIApplication.shared.isIdleTimerDisabled = previousIdle }
        previousIdle = nil
    }
}
#endif
