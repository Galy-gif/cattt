import SwiftUI

extension AppStore {
    var diarySyncLabel: String {
        if !backend.isRemote { return "仅存本机" }
        if diarySyncFailed { return "同步未完成 · 重试" }
        if diarySyncTask != nil { return "正在同步" }
        if !diarySyncFinished || !diaryReadIndex.pendingUploads.isEmpty { return "等待同步" }
        return "已同步"
    }

    func syncDiary() {
        guard backend.isRemote, !backend.token.isEmpty, !diaryLoadFailed else { return }
        guard diarySyncTask == nil else { diarySyncAgain = true; return }
        let generation = diaryGeneration
        let client = api
        diarySyncFailed = false
        diarySyncTask = Task { @MainActor [weak self] in
            guard let self else { return }
            defer { if diaryGeneration == generation { diarySyncTask = nil } }
            do {
                repeat {
                    diarySyncAgain = false
                    try await performDiarySync(client: client, generation: generation)
                } while diarySyncAgain && !Task.isCancelled
                diarySyncFinished = true
                diarySyncFailed = false
            } catch {
                if diaryGeneration == generation && !Task.isCancelled { diarySyncFailed = true }
            }
        }
    }

    private func checkDiarySync(_ generation: UUID, _ client: APIClient) throws {
        try Task.checkCancellation()
        guard diaryGeneration == generation, backend == client.config else { throw CancellationError() }
    }

    private func performDiarySync(client: APIClient, generation: UUID) async throws {
        try checkDiarySync(generation, client)
        var prepared = diaryArchive
        let pending = diaryReadIndex.pendingUploads
        let missingKeys = pending.filter { prepared.entries[$0].pendingMutationID == nil }
        for i in missingKeys { prepared.entries[i].pendingMutationID = UUID().uuidString }
        if !missingKeys.isEmpty, !persistDiary(prepared) { throw APIError.badResponse }
        let pendingIDs = pending.map { prepared.entries[$0].id }
        for id in pendingIDs {
            for _ in 0..<3 {
                guard let sent = entries.first(where: { $0.id == id }), let mutation = sent.pendingMutationID else { break }
                let result = try await client.saveDiary(sent)
                try checkDiarySync(generation, client)
                var archive = diaryArchive
                switch result {
                case .saved(let value): archive.merge(try value.local(), sentMutation: mutation)
                case .conflict(let value):
                    var remote = try value.local()
                    // 撤回优先重试；过期的分享不能自动重新授权。
                    if let local = entries.first(where: { $0.id == id }), local.isPrivate, value.catAllowed, local.kind == .text {
                        remote.isPrivate = true
                        remote.pendingMutationID = UUID().uuidString
                    } else { flash("记录已在其他设备更新，已刷新") }
                    if let i = archive.entries.firstIndex(where: { $0.id == id }) { archive.entries[i] = remote }
                }
                guard persistDiary(archive) else { throw APIError.badResponse }
            }
        }
        do {
            repeat {
                let page = try await client.diaryChanges(after: diaryChangeCursor ?? 0)
                try checkDiarySync(generation, client)
                if page.entries.isEmpty { return }
                try applyDiaryPage(page.entries, cursor: page.cursor)
                if !page.hasMore { return }
            } while !Task.isCancelled
        } catch APIError.http(status: 404, code: _) {
            // 服务端尚未升级时沿用创建序号分页；两种游标不能混用。
            var after = 0
            repeat {
                let page = try await client.diaryPage(after: after)
                try checkDiarySync(generation, client)
                try applyDiaryPage(page.entries, cursor: nil)
                guard let next = page.nextSeq else { return }
                guard next > after else { throw APIError.badResponse }
                after = next
            } while !Task.isCancelled
        }
    }

    private func applyDiaryPage(_ rows: [APIDiaryEntry], cursor: Int?) throws {
        var archive = diaryArchive
        archive.changeCursor = cursor
        var mail = false
        for row in rows {
            let remote = try row.local()
            let old = entries.first(where: { $0.id == remote.id })
            if remote.visit > (old?.visit ?? .unread), !remote.isPrivate { mail = true }
            if remote.hasUnreadCatDiary && old == nil { mail = true }
            if archive.merge(remote) { flash("记录已在其他设备更新，请重新选择权限") }
        }
        // 磁盘成功后才推进游标，失败或进程中断后可安全重读同一页。
        if archive != diaryArchive, !persistDiary(archive) { throw APIError.badResponse }
        if mailboxOpen { markCatDiariesRead(on: diaryDay) }
        if (mail && !mailboxOpen) || entries.contains(where: \.hasUnreadCatDiary) { hasMail = true }
    }

    func setDiaryVisibility(_ entry: DiaryEntry, forCat: Bool) {
        guard backend.isRemote, let i = entries.firstIndex(where: { $0.id == entry.id }), entry.kind == .text else { return }
        var archive = diaryArchive
        archive.entries[i].isPrivate = !forCat
        archive.entries[i].pendingMutationID = UUID().uuidString
        if persistDiary(archive) {
            if !forCat {
                chatSource = nil
                if isStreaming || isWaiting { stopStreaming() }
            }
            syncDiary()
        }
    }
}
