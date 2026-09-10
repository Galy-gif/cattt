import AppKit
let dir = URL(fileURLWithPath:CommandLine.arguments[1])
let space=CGColorSpace(name:CGColorSpace.sRGB)!
let ctx=CGContext(data:nil,width:348,height:472,bitsPerComponent:8,bytesPerRow:348*4,space:space,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
let bytes=ctx.data!.assumingMemoryBound(to:UInt8.self)
for i in stride(from:0,to:348*472*4,by:4) {bytes[i]=239;bytes[i+1]=230;bytes[i+2]=210;bytes[i+3]=255}
for (file,y) in [(dir.deletingLastPathComponent().appendingPathComponent("icon-24-48-180-true-size.png"),248),(dir.appendingPathComponent("icon-24-48-180-true-size.png"),0)] {
  let image=NSImage(contentsOf:file)!;var r=CGRect(origin:.zero,size:image.size)
  let cg=image.cgImage(forProposedRect:&r,context:nil,hints:nil)!
  ctx.draw(cg,in:CGRect(x:0,y:y,width:348,height:224))
}
try! NSBitmapImageRep(cgImage:ctx.makeImage()!).representation(using:.png,properties:[:])!.write(to:dir.appendingPathComponent("previous-vs-revision2-true-size.png"))
