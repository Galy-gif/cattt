import SwiftUI

@main
struct MaomaoApp: App {
    @UIApplicationDelegateAdaptor(NotificationBridge.self) var notificationDelegate
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
