import AppKit
import CoreGraphics

let dir = URL(fileURLWithPath: CommandLine.arguments[1])
let source = NSImage(contentsOf: dir.appendingPathComponent("icon-master-generated-v2.png"))!
var proposed = CGRect(origin: .zero, size: source.size)
let cg = source.cgImage(forProposedRect: &proposed, context: nil, hints: nil)!
let w = cg.width, h = cg.height
var bytes = [UInt8](repeating: 0, count: w*h*4)
let space = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: &bytes, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w*4, space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
var minX=w, minY=h, maxX=0, maxY=0
for y in 0..<h { for x in 0..<w {
  let i=(y*w+x)*4
  let inside = Int(bytes[i])-Int(bytes[i+2]) > 65
  bytes[i]=227; bytes[i+1]=160; bytes[i+2]=92; bytes[i+3]=inside ? 255 : 0
  if !inside {bytes[i]=0;bytes[i+1]=0;bytes[i+2]=0}
  if inside {minX=min(minX,x);minY=min(minY,y);maxX=max(maxX,x);maxY=max(maxY,y)}
}}
let provider = CGDataProvider(data: Data(bytes) as CFData)!
let mask = CGImage(width:w,height:h,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:w*4,space:space,bitmapInfo:CGBitmapInfo(rawValue:CGImageAlphaInfo.premultipliedLast.rawValue),provider:provider,decode:nil,shouldInterpolate:true,intent:.defaultIntent)!
let cropped = mask.cropping(to:CGRect(x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1))!
func context(_ width:Int,_ height:Int)->CGContext {
  let c=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:space,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
  let p=c.data!.assumingMemoryBound(to:UInt8.self)
  for i in stride(from:0,to:width*height*4,by:4) {p[i]=239;p[i+1]=230;p[i+2]=210;p[i+3]=255}
  return c
}
func save(_ image:CGImage,_ name:String) {let rep=NSBitmapImageRep(cgImage:image);try! rep.representation(using:.png,properties:[:])!.write(to:dir.appendingPathComponent(name))}
var images:[CGImage]=[]
for size in [24,48,180] {
  let c=context(size,size)
  let ratio=min(Double(size-4)/Double(cropped.width),Double(size-4)/Double(cropped.height))
  let iw=Double(cropped.width)*ratio, ih=Double(cropped.height)*ratio
  c.interpolationQuality = .high
  c.draw(cropped,in:CGRect(x:(Double(size)-iw)/2,y:(Double(size)-ih)/2,width:iw,height:ih))
  let output=c.makeImage()!;images.append(output);save(output,"icon-\(size)px.png")
}
let sheet=context(348,224)
for (image,x) in zip(images,[16,64,136]) {sheet.draw(image,in:CGRect(x:x,y:24,width:image.width,height:image.height))}
save(sheet.makeImage()!,"icon-24-48-180-true-size.png")
print("Exported actual 24x24, 48x48, 180x180. Comparison 348x224; 1:1 placement. Colour flattened to #E3A05C, cream #EFE6D2; antialiasing only at edges.")
