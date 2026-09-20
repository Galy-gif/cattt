import Foundation

@main
struct YardProbeSupportTests {
    @MainActor static func main() async throws {
        var late: ((Result<String, Error>) -> Void)?
        let began = ProcessInfo.processInfo.systemUptime
        do {
            let _: String = try await YardDeadline.perform(seconds: 0.03) { complete in late = complete }
            fatalError("悬住的回调应该超时")
        } catch YardProbeError.timeout {}
        assert(ProcessInfo.processInfo.systemUptime - began < 1)
        late?(.success("迟到")); late?(.failure(YardProbeError.invalidResponse))
        let value: String = try await YardDeadline.perform(seconds: 0.1) { complete in
            complete(.success("ok")); complete(.success("重复"))
        }
        assert(value == "ok")
        let identity = YardProbeIdentity(runID: "new", pageID: "page2")
        assert(!identity.accepts(["runId": "old", "pageId": "page2"]))
        assert(!identity.accepts(["runId": "new", "pageId": "page1"]))
        assert(identity.accepts(["runId": "new", "pageId": "page2"]))
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        enum DiskFailure: Error { case full }
        do {
            _ = try YardProbeArchive.save(["status":"未通过"], directory: directory, name: "failure", writer: { _, _ in throw DiskFailure.full })
            fatalError("写盘失败不可返回已保存 URL")
        } catch DiskFailure.full {}
        assert(!FileManager.default.fileExists(atPath: directory.appendingPathComponent("failure.json").path))
        let file = try YardProbeArchive.save(["status":"缺测", "missing": ["webContentMemory"]], directory: directory, name: "success")
        let saved = try JSONSerialization.jsonObject(with: Data(contentsOf: file)) as! [String: Any]
        assert(saved["status"] as? String == "缺测")
        print("PASS: timeout, late/duplicate callbacks, run/page isolation, save failure, atomic save (6 scenarios)")
    }
}
