import SwiftUI

/// 所有“已保存”都等服务端确认；失败留在当前页，可重试，不用演示数据冒充记忆。
struct MemoryCenterView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let startWithBoundaries: Bool
    @State private var memories: [APIMemory] = []
    @State private var boundaries: [APIBoundary] = []
    @State private var settings: APIMemorySettings?
    @State private var error: String?
    @State private var busy = false
    @State private var loaded = false
    private enum Page: Hashable { case settings, boundaries }
    @State private var path: [Page] = []
    @State private var navigationInitialized = false
    @State private var revoking: APIBoundary?

    var body: some View {
        NavigationStack(path: $path) {
            page {
                if !store.backend.isRemote {
                    Text("演示模式下暂无长期记忆。连接后可查看已保存的内容。")
                } else {
                    loadingState
                    if loaded && memories.isEmpty {
                        empty("暂无长期记忆", settings?.learn == false
                              ? "新记忆保存已关闭，可在设置中开启。"
                              : "聊天中保存的记忆会显示在这里。")
                    }
                    ForEach(memories) { memory in
                        NavigationLink {
                            MemoryDetailView(memory: memory, changed: { await reload() })
                        } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Text(memory.predicate).font(Typo.sans(12)).foregroundStyle(Palette.ink3)
                                    Spacer()
                                    if memory.status == "conflicted" { Text("待确认").font(Typo.sans(12)).foregroundStyle(Palette.ink2) }
                                    Image(systemName: "chevron.right").font(.caption)
                                }
                                Text(memory.value).foregroundStyle(Palette.ink).multilineTextAlignment(.leading)
                                Text("更新于 \(memory.lastConfirmedAt.prefix(10))").font(Typo.sans(12)).foregroundStyle(Palette.ink3)
                            }.memoryCard()
                        }.buttonStyle(.plain)
                    }
                }
            }
            .navigationTitle("长期记忆")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if store.backend.isRemote {
                        NavigationLink(value: Page.settings) {
                            Image(systemName: "gearshape")
                        }.accessibilityLabel("记忆设置")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) { Button("完成") { dismiss() } }
            }
            .navigationDestination(for: Page.self) { destination in
                switch destination {
                case .settings: settingsPage
                case .boundaries: boundariesPage
                }
            }
            .task {
                if !navigationInitialized {
                    navigationInitialized = true
                    if startWithBoundaries { path = [.settings, .boundaries] }
                }
                await reload()
            }
        }.tint(Palette.ink).preferredColorScheme(.light)
    }

    private func page<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22, content: content)
                .frame(maxWidth: .infinity, alignment: .leading).padding(24)
        }
        .background { PageBackground().ignoresSafeArea() }
        .font(Typo.sans(15)).foregroundStyle(Palette.ink)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await reload() }
    }

    @ViewBuilder private var loadingState: some View {
        if let error { errorBox(error) }
        if !loaded && error == nil { ProgressView("正在读取…") }
    }

    private var settingsPage: some View {
        page {
            loadingState
            if let settings { controls(settings) }
            if loaded {
                ListContainer {
                    NavigationLink(value: Page.boundaries) {
                        HStack {
                            Text("回避话题")
                            Spacer()
                            Text("\(boundaries.count) 项").foregroundStyle(Palette.ink3)
                            Icons.chevronRight(color: Palette.ink3)
                        }.padding(16).frame(minHeight: Metrics.minTap)
                    }.buttonStyle(.plain)
                }
            }
        }.navigationTitle("记忆设置")
    }

    private func controls(_ value: APIMemorySettings) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 8) {
                Toggle("保存新记忆", isOn: Binding(get: { value.learn }, set: { next in Task { await setSettings(learn: next) } }))
                Text("关闭后，聊天内容不再保存为长期记忆，已有记忆保留。")
                    .font(Typo.sans(13)).foregroundStyle(Palette.ink3)
            }.memoryCard()
            VStack(alignment: .leading, spacing: 8) {
                Toggle("使用已有记忆", isOn: Binding(get: { value.use }, set: { next in Task { await setSettings(use: next) } }))
                Text("关闭后，回复不再参考长期记忆，仍可接续最近的聊天。")
                    .font(Typo.sans(13)).foregroundStyle(Palette.ink3)
            }.memoryCard()
            DisclosureGroup("了解记忆设置") {
                Text("关闭期间，即使要求“记住”也不会保存；重新开启后也不补存。已有记忆仍可修改。\n\n这些开关不会删除聊天记录。要停用某条消息，可在记忆详情中选择“停用原消息”。")
                    .font(Typo.sans(13)).foregroundStyle(Palette.ink3).padding(.top, 8)
            }.font(Typo.sans(13)).foregroundStyle(Palette.ink3)
        }.tint(Palette.switchOn).disabled(busy)
    }

    private var boundariesPage: some View {
        page {
            loadingState
            Text("团子不会主动提及这些话题；你主动问起时，仍可回答。")
                .font(Typo.sans(13)).foregroundStyle(Palette.ink3)
            if loaded && boundaries.isEmpty {
                empty("暂无回避话题", "长按团子的回复，选择“回避此话题”即可添加。")
            }
            ForEach(boundaries) { boundary in
                VStack(alignment: .leading, spacing: 12) {
                    Text(boundary.description ?? "话题整理中").font(Typo.sans(16, weight: .medium))
                    Text(boundary.sourceText).font(Typo.sans(14)).foregroundStyle(Palette.ink3)
                    Button("取消回避") { revoking = boundary }.frame(minHeight: Metrics.minTap).disabled(busy)
                }.memoryCard()
            }
        }
        .navigationTitle("回避话题")
        .alert("取消回避此话题？", isPresented: Binding(get: { revoking != nil }, set: { if !$0 { revoking = nil } })) {
            Button("保留", role: .cancel) { revoking = nil }
            Button("取消回避") {
                guard let item = revoking else { return }
                Task { await revoke(item) }
            }
        } message: { Text("团子可以主动提及此话题。已删除的记忆和已停用的消息不会恢复。") }
    }
    private func empty(_ title: String, _ detail: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(Typo.sans(17, weight: .medium))
            Text(detail).font(Typo.sans(13)).foregroundStyle(Palette.ink3)
        }.padding(.vertical, 28)
    }
    private func errorBox(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) { Text(text); Button("重新读取") { Task { await reload() } } }
            .font(Typo.sans(13)).memoryCard()
    }
    private func reload() async {
        guard store.backend.isRemote else { return }
        let client = store.api
        do {
            async let m = client.memoryList()
            async let b = client.boundaryList()
            async let s = client.memorySettings()
            let result = try await (m, b, s)
            guard store.backend == client.config else { return }
            memories = result.0; boundaries = result.1; settings = result.2
            loaded = true; error = nil
            store.memoryCount = memories.count; store.boundaryCount = boundaries.count
            for i in store.messages.indices {
                store.messages[i].boundary = boundaries.contains { $0.sourceMessageId == store.messages[i].serverID }
            }
        } catch { self.error = "读取失败。\(memoryError(error))" }
    }
    private func setSettings(learn: Bool? = nil, use: Bool? = nil) async {
        guard let current = settings, !busy else { return }
        busy = true; defer { busy = false }
        do { settings = try await store.api.changeMemorySettings(learn: learn, use: use, revision: current.revision); error = nil }
        catch { self.error = "设置未保存。\(memoryError(error))" }
    }
    private func revoke(_ item: APIBoundary) async {
        busy = true; defer { busy = false; revoking = nil }
        do { try await store.api.revokeBoundary(item.id); await reload() }
        catch { self.error = "取消回避失败。\(memoryError(error))" }
    }
}

struct MemoryDetailView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let memory: APIMemory
    let changed: () async -> Void
    @FocusState private var editing: Bool
    @State private var value = ""
    @State private var busy = false
    @State private var error: String?
    @State private var action: MemoryImpactAction?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                if memory.status == "conflicted" {
                    Text("记忆存在冲突，暂不使用。请修改后保存。")
                        .font(Typo.sans(13)).foregroundStyle(Palette.ink3)
                }
                VStack(alignment: .leading, spacing: 12) {
                    Text("\(memory.subject) · \(memory.predicate)").font(Typo.sans(13)).foregroundStyle(Palette.ink3)
                    TextEditor(text: $value).focused($editing).frame(minHeight: 120, maxHeight: 200)
                        .scrollContentBackground(.hidden).accessibilityLabel("记忆内容")
                    Text("\(value.count) / 2000 字").font(Typo.sans(12)).foregroundStyle(Palette.ink3)
                    if let error { Text(error).font(Typo.sans(13)).foregroundStyle(Palette.ink2) }
                    Button("保存修改") { Task { await save() } }
                        .disabled(busy || value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || value.count > 2000 || memory.sourceText == nil || !memory.sourceAllowed)
                }.memoryCard()
                VStack(alignment: .leading, spacing: 12) {
                    Text(memory.edited ? "原消息 · 记忆已修改" : "原消息").font(Typo.sans(13)).foregroundStyle(Palette.ink3)
                    Text(memory.sourceText ?? "原消息缺失，无法修改。可删除后在聊天中重新保存。")
                    if memory.sourceAllowed && memory.sourceText != nil {
                        Button("停用原消息") { action = .source(memory.sourceMessageId) }
                    } else { Text(memory.sourceText == nil ? "无法核对原消息" : "原消息已停用").font(Typo.sans(12)).foregroundStyle(Palette.ink3) }
                }.memoryCard()
                Button("删除记忆", role: .destructive) { action = .memory(memory.id) }
                    .frame(minHeight: Metrics.minTap).disabled(busy)
                Text("删除记忆不会删除聊天记录。")
                    .font(Typo.sans(13)).foregroundStyle(Palette.ink3)
            }.padding(24)
        }.font(Typo.sans(15)).foregroundStyle(Palette.ink)
            .background { PageBackground().ignoresSafeArea() }
            .navigationTitle("记忆详情").navigationBarTitleDisplayMode(.inline)
            .task { value = memory.value }
            .sheet(item: $action) { item in
                MemoryImpactView(action: item) { await changed(); dismiss() }
            }
    }
    private func save() async {
        editing = false
        busy = true; defer { busy = false }
        do { try await store.api.editMemory(memory, value: value.trimmingCharacters(in: .whitespacesAndNewlines)); await changed(); dismiss() }
        catch { self.error = "修改未保存。\(memoryError(error))" }
    }
}

enum MemoryImpactAction: Identifiable {
    case memory(String), source(String)
    var id: String { switch self { case .memory(let id), .source(let id): return id } }
    var deletingMemory: Bool { if case .memory = self { return true }; return false }
}
struct MemoryImpactView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let action: MemoryImpactAction
    let completed: () async -> Void
    @State private var impact: APIMemoryImpact?
    @State private var withdraw = false
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text(action.deletingMemory ? "删除后，不会再从旧聊天中恢复此记忆。" : "停用后，整条消息不再用于回复或保存记忆，聊天记录保留。")
                    if action.deletingMemory { Toggle("同时停用原消息", isOn: $withdraw).tint(Palette.switchOn) }
                    if let impact {
                        if withdraw || !action.deletingMemory {
                            Text("将停用 \(impact.messages.filter(\.allowed).count) 条消息，并删除 \(impact.memories.count) 条相关记忆。相关的表达习惯与临时状态也将停用。")
                                .font(Typo.sans(13)).foregroundStyle(Palette.ink3)
                            ForEach(impact.messages) { source in
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(source.legacy == true ? "旧回复（来源无法核对，一并停用）" : source.role == "user" ? "原消息" : "相关回复").font(Typo.sans(12)).foregroundStyle(Palette.ink3)
                                    Text(source.text)
                                }.memoryCard()
                            }
                            ForEach(impact.memories) { memory in Text("相关记忆：\(memory.value)").font(Typo.sans(13)) }
                            Text("消息中的所有内容都会停用。正在生成的回复会停止，已发出的内容保留。")
                                .font(Typo.sans(13)).foregroundStyle(Palette.ink3)
                        }
                        Button(action.deletingMemory ? "确认删除" : "确认停用", role: .destructive) { Task { await apply(impact) } }
                            .frame(minHeight: Metrics.minTap).disabled(busy)
                    } else if error == nil { ProgressView("正在核对影响范围…") }
                    if let error { Text(error); Button("重新核对") { Task { await load() } } }
                }.padding(24)
            }.background { PageBackground().ignoresSafeArea() }
                .font(Typo.sans(15)).foregroundStyle(Palette.ink)
                .navigationTitle("影响范围").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .topBarLeading) { Button("取消") { dismiss() }.disabled(busy) } }
                .task { await load() }
        }.tint(Palette.ink).interactiveDismissDisabled(busy)
    }
    private func load() async {
        do {
            impact = try await (action.deletingMemory ? store.api.memoryImpact(action.id) : store.api.sourceImpact(action.id))
            error = nil
        } catch { self.error = "读取影响范围失败。\(memoryError(error))" }
    }
    private func apply(_ preview: APIMemoryImpact) async {
        busy = true; defer { busy = false }
        do {
            if action.deletingMemory { try await store.api.deleteMemory(action.id, withdrawSources: withdraw, revision: preview.revision, watermark: preview.watermark) }
            else { try await store.api.withdrawSource(action.id, revision: preview.revision, watermark: preview.watermark) }
            if withdraw || !action.deletingMemory {
                let ids = Set(preview.messages.map(\.id))
                for i in store.messages.indices where store.messages[i].serverID.map(ids.contains) == true {
                    store.messages[i].sourceWithdrawn = true
                    store.messages[i].remembered = false
                }
            }
            await completed(); dismiss()
        } catch { self.error = "操作未完成。\(memoryError(error))" }
    }
}
private func memoryError(_ error: Error) -> String {
    if case APIError.http(409, _) = error { return "内容刚有变化，请重新读取后操作。" }
    if case APIError.http(404, _) = error { return "这条内容已不存在，请返回刷新。" }
    return "请检查连接后重试。"
}
private extension View {
    func memoryCard() -> some View {
        self.frame(maxWidth: .infinity, alignment: .leading).padding(16)
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Metrics.radiusCard))
    }
}
