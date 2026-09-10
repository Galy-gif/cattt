import Foundation
@main struct WorldTests {
 static func main() throws {
  let path=CommandLine.arguments[1]
  let scene=try JSONDecoder().decode(WorldScene.self,from:Data(contentsOf:URL(fileURLWithPath:path)))
  let errors=scene.validationErrors();precondition(errors.isEmpty,errors.joined(separator:"\n"))
  var checks=0
  func drive(_ s:inout WorldSimulation,_ seconds:Double) {
   for _ in 0..<Int(seconds*30) {
    let previous=s.point;s.tick(1.0/30)
    precondition(scene.isWalkable(s.point),"Off road \(s.point)")
    precondition(previous.distance(to:s.point,aspect:scene.aspect)*844<9,"Position jumped: \(previous) → \(s.point), action=\(s.action), phase=\(s.phase), time=\(s.time), target=\(s.target), current=\(s.current)")
   }
  }
  for from in 0..<6 {for to in 0..<6 where from != to {
   var s=WorldSimulation(scene:scene);s.autonomous=false;s.request(from);drive(&s,40)
   precondition(s.current==from);s.request(to);drive(&s,40);precondition(s.current==to);checks += 1
  }}
  var s=WorldSimulation(scene:scene);s.autonomous=false;s.request(5);drive(&s,1)
  s.request(2);s.request(3);s.request(4);drive(&s,40);precondition(s.current==4)
  let p=s.point,t=s.time;s.setPaused(true);drive(&s,10);precondition(s.point==p && s.time==t)
  s.setPaused(false);s.request(1);drive(&s,30);precondition(s.current==1)
  s.request(3);drive(&s,30);precondition(s.hiddenInGrass);s.poke();drive(&s,2);precondition(s.hiddenInGrass)
  var retarget=WorldSimulation(scene:scene);retarget.autonomous=false
  retarget.request(5);drive(&retarget,0.8);retarget.request(2);retarget.request(5);drive(&retarget,40);precondition(retarget.current==5)
  var scratch=WorldSimulation(scene:scene);scratch.autonomous=false;scratch.request(1)
  for _ in 0..<900 {scratch.tick(1.0/30);if scratch.action=="treeScratch" {break}}
  precondition(scratch.action=="treeScratch");scratch.request(4);precondition(scratch.action=="scratchExit")
  drive(&scratch,30);precondition(scratch.current==4)
  var corrupt=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:path))) as! [String:Any]
  corrupt["edges"]=[]
  let disconnected=try JSONDecoder().decode(WorldScene.self,from:JSONSerialization.data(withJSONObject:corrupt))
  precondition(!disconnected.validationErrors().isEmpty)
  var a=WorldSimulation(scene:scene,seed:123),b=a
  drive(&a,600);drive(&b,600);precondition(a.point==b.point && a.action==b.action)
  print("PASS: \(checks) directed routes, obstacle checks, latest target, pause, grass, deterministic 600s")
 }
}
