import Foundation
@main struct IdentityLogicTests {
 static func check(_ condition:Bool){precondition(condition)}
 static func main() throws {
  let a=AccountSession(accountID:"account-a",token:"first",appleUserID:"apple-a",expiresAt:Date().addingTimeInterval(1000))
  let refresh=AccountSession(accountID:"account-a",token:"next",appleUserID:"apple-a",expiresAt:Date().addingTimeInterval(1000))
  check(a.storageIdentity(origin:"https://test.invalid")==refresh.storageIdentity(origin:"https://test.invalid"))
  let b=AccountSession(accountID:"account-b",token:"second",appleUserID:"apple-b",expiresAt:Date().addingTimeInterval(1000))
  check(a.storageIdentity(origin:"https://test.invalid") != b.storageIdentity(origin:"https://test.invalid"))
  check(CredentialPersistencePolicy.maySaveDeveloperToken(mode:"local",accountID:nil))
  check(!CredentialPersistencePolicy.maySaveDeveloperToken(mode:"mock",accountID:"account-a"))
  check(!CredentialPersistencePolicy.maySaveDeveloperToken(mode:"local",accountID:"account-a"))
  check(!CredentialPersistencePolicy.maySaveDeveloperToken(mode:"service",accountID:"account-a"))
  let source=UUID().uuidString
  check(AgreementNotificationGate.accepted(sourceID:source,savedSources:[source]))
  check(!AgreementNotificationGate.accepted(sourceID:nil,savedSources:[source]))
  check(!AgreementNotificationGate.accepted(sourceID:UUID().uuidString,savedSources:[source]))
  let id=UUID().uuidString
  let notice=NotificationIntent(accountID:"account-a",notificationID:id)
  check(notice.canResolve(accountID:"account-a",connected:true));check(!notice.canResolve(accountID:"account-b",connected:true));check(!notice.canResolve(accountID:"account-a",connected:false))
  check(NotificationIntent.parse(["account_id":"account-a","notification_id":"fake"]) == nil)
  check(NotificationIntent.parse(["account_id":"account-a","notification_id":id]) == notice)
  let data=try JSONEncoder().encode(notice);check(try JSONDecoder().decode(NotificationIntent.self,from:data)==notice)
  print("正式身份逻辑：会话轮换稳定分区、账号隔离、通知等待登录与真实ID检查通过")
 }
}
