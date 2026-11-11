import Foundation

extension AppStore {
    func refreshProactivePermission() async {
        let client = api
        guard backend.isRemote, !backend.token.isEmpty else { allowProactive = false; return }
        do {
            let permission = try await client.proactivePermission()
            guard backend == client.config, !proactiveBusy else { return }
            allowProactive = permission.allowProactive
            proactiveError = nil
        } catch {
            guard backend == client.config else { return }
            proactiveError = "还没读到这个设置，稍后再试"
        }
    }

    func changeProactivePermission() {
        guard backend.isRemote, !backend.token.isEmpty, !proactiveBusy else { return }
        let client = api
        let wanted = !allowProactive
        proactiveBusy = true
        proactiveError = nil
        Task { @MainActor in
            defer { if backend == client.config { proactiveBusy = false } }
            do {
                let permission = try await client.setProactivePermission(wanted)
                guard backend == client.config else { return }
                allowProactive = permission.allowProactive
            } catch {
                guard backend == client.config else { return }
                proactiveError = "还没保存好，稍后再试"
            }
        }
    }
}
