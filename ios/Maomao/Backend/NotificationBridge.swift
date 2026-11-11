import UIKit
import UserNotifications

/// 系统回调仅携带ID；内容和跳转目标仍从已鉴权接口读取。
@MainActor final class NotificationBridge: NSObject, UIApplicationDelegate, @preconcurrency UNUserNotificationCenterDelegate {
    static weak var store: AppStore?
    static var token: String?
    static var pending: NotificationIntent? {
        get { UserDefaults.standard.data(forKey: "notification.pending.v1").flatMap { try? JSONDecoder().decode(NotificationIntent.self, from: $0) } }
        set { UserDefaults.standard.set(newValue.flatMap { try? JSONEncoder().encode($0) }, forKey: "notification.pending.v1") }
    }
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Self.token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Self.store?.registerNotificationDevice()
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        if let intent = NotificationIntent.parse(response.notification.request.content.userInfo) {
            Self.pending = intent
            Self.store?.resolveNotificationIntent()
        }
        completionHandler()
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        Self.store?.refreshInbox()
        completionHandler([])
    }
}
