import Foundation
import AppKit
import ImageIO
import UniformTypeIdentifiers

// Deterministic sprite-atlas import: chroma extraction, cells, common scale and contact anchors.
let root=URL(fileURLWithPath:FileManager.default.currentDirectoryPath)
let source=root.appendingPathComponent("assets/tuanzi/world-v3")
let xc=root.appendingPathComponent("ios/Maomao/Assets.xcassets/world-v3")
let info:[String:Any] = ["version":1,"author":"xcode"]
func json(_ object:Any,_ url:URL) throws {
    try FileManager.default.createDirectory(at:url.deletingLastPathComponent(),withIntermediateDirectories:true)
    try JSONSerialization.data(withJSONObject:object,options:[.prettyPrinted,.sortedKeys]).write(to:url)
}
func load(_ name:String)->CGImage {
    let s=CGImageSourceCreateWithURL(source.appendingPathComponent(name).appendingPathExtension("png") as CFURL,nil)!
    return CGImageSourceCreateImageAtIndex(s,0,nil)!
}
func cell(_ im:CGImage,_ index:Int, gray:Bool, columns:Int=4, rows:Int=3)->CGImage {
    let w=im.width/columns;let y0=Int((Double(index/columns)*Double(im.height)/Double(rows)).rounded())
    let y1=Int((Double(index/columns+1)*Double(im.height)/Double(rows)).rounded())
    let crop=im.cropping(to:CGRect(x:(index%columns)*w,y:y0,width:w,height:y1-y0))!
    let h=crop.height
    let ctx=CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.draw(crop,in:CGRect(x:0,y:0,width:w,height:h))
    let p=ctx.data!.assumingMemoryBound(to:UInt8.self)
    var minX=w,minY=h,maxX=0,maxY=0
    for y in 0..<h {for x in 0..<w {
        let i=(y*w+x)*4;let r=Double(p[i]),g=Double(p[i+1]),b=Double(p[i+2])
        let alpha:Double
        if gray {alpha=min(1,max(0,(max(r,g,b)-min(r,g,b)-12)/22))}
        else {alpha=1-min(1,max(0,(min(r,b)-g-25)/90))}
        if alpha<0.06 {for c in 0..<4 {p[i+c]=0}} else {
            p[i]=UInt8(min(255,r)*alpha);p[i+1]=UInt8(g*alpha);p[i+2]=UInt8(min(b,g+25)*alpha);p[i+3]=UInt8(255*alpha)
            minX=min(minX,x);maxX=max(maxX,x);minY=min(minY,y);maxY=max(maxY,y)
        }
    }}
    // Keep the single cat component: generated grids occasionally spill a neighbour's paw into a cell.
    var visited=[Bool](repeating:false,count:w*h),largest=[Int]()
    for start in 0..<w*h where !visited[start] && p[start*4+3]>30 {
        var component=[start],cursor=0;visited[start]=true
        while cursor<component.count {
            let n=component[cursor];cursor += 1
            for next in [n-1,n+1,n-w,n+w] where next>=0 && next<w*h && abs(next%w-n%w)<=1 {
                if !visited[next] && p[next*4+3]>30 {visited[next]=true;component.append(next)}
            }
        }
        if component.count>largest.count {largest=component}
    }
    let keep=Set(largest);minX=w;minY=h;maxX=0;maxY=0
    for n in 0..<w*h {
        if !keep.contains(n) {for c in 0..<4 {p[n*4+c]=0}} else {
            minX=min(minX,n%w);maxX=max(maxX,n%w);minY=min(minY,n/w);maxY=max(maxY,n/w)
            if !gray && Int(p[n*4+2])>Int(p[n*4+1])+8 {
                p[n*4]=UInt8(min(Double(p[n*4]),Double(p[n*4+1])*1.6+30))
                p[n*4+2]=UInt8(Double(p[n*4+1])*0.7)
            }
        }
    }
    precondition(maxX>minX && maxY>minY)
    return ctx.makeImage()!.cropping(to:CGRect(x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1))!
}
func save(_ image:CGImage,_ url:URL) throws {
    try FileManager.default.createDirectory(at:url.deletingLastPathComponent(),withIntermediateDirectories:true)
    let dest=CGImageDestinationCreateWithURL(url as CFURL,UTType.png.identifier as CFString,1,nil)!
    CGImageDestinationAddImage(dest,image,nil);precondition(CGImageDestinationFinalize(dest))
}
let flower=cell(load("flower-source"),0,gray:false,columns:1,rows:1)
let fh=384,fw=Int(Double(flower.width)*384/Double(flower.height))
let flowerContext=CGContext(data:nil,width:fw,height:fh,bitsPerComponent:8,bytesPerRow:fw*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
flowerContext.interpolationQuality = .high
flowerContext.draw(flower,in:CGRect(x:0,y:0,width:fw,height:fh))
try save(flowerContext.makeImage()!,root.appendingPathComponent("ios/Maomao/Resources/WorldTextures/world-v3-flower.png"))
if CommandLine.arguments.contains("--flower-only") {exit(0)}
let jump=load("jump-atlas"),interaction=load("interaction-atlas")
let j=(0..<12).map {cell(jump,$0,gray:true)}
let a=(0..<12).map {cell(interaction,$0,gray:false)}
// atlas 8's scratch was generated facing right; export that cell without the default mirror.
struct Group {let name:String;let frames:[CGImage];let height:Double;let durations:[Double];var mirror:Bool=true;var loop:String="once";var support:Double=1}
let groups:[Group] = [
    Group(name:"jumpPrepare",frames:[j[0]],height:76,durations:[0.28]),
    Group(name:"jumpUp",frames:[j[1],j[2],j[3]],height:107,durations:[0.20,0.24,0.24]),
    Group(name:"climbIn",frames:[j[4],j[5]],height:80,durations:[0.36,0.34]),
    Group(name:"climbOut",frames:[j[6]],height:80,durations:[0.35]),
    Group(name:"jumpDown",frames:[j[7]],height:76,durations:[0.60]),
    Group(name:"land",frames:[j[8]],height:73,durations:[0.28]),
    Group(name:"perchLook",frames:[j[10],j[11],j[10]],height:70,durations:[1.5,0.14,1.0],loop:"loop",support:0.62),
    Group(name:"perchSleep",frames:[j[11]],height:70,durations:[1],loop:"loop",support:0.62),
    Group(name:"flowerPlay",frames:Array(a[8...11]),height:76,durations:[0.5,0.25,0.20,0.65],loop:"loop"),
    Group(name:"turn",frames:Array(a[0...3])+[a[0]],height:76,durations:[0.06,0.09,0.10,0.09,0.06]),
    Group(name:"scratchEnter",frames:[a[4],a[5]],height:110,durations:[0.25,0.25]),
    Group(name:"scratchExit",frames:[a[5],a[4]],height:110,durations:[0.25,0.25]),
    Group(name:"treeScratch",frames:[a[5],a[6],a[5],a[6]],height:110,durations:[0.22,0.22,0.22,0.22],loop:"loop")
]
let catalogURL=source.appendingPathComponent("base-actions.json")
var catalog=try JSONSerialization.jsonObject(with:Data(contentsOf:catalogURL)) as! [String:Any]
var specs=catalog["actions"] as! [[String:Any]]
for group in groups {
    let heights=group.frames.map{Double($0.height)}.sorted()
    let scale=group.height/heights[heights.count/2]
    let cw=ceil(Double(group.frames.map(\.width).max()!)*scale+12),ch=ceil(Double(group.frames.map(\.height).max()!)*scale+10)
    for (i,im) in group.frames.enumerated() {
        let w=Int(ceil(cw*3)),h=Int(ceil(ch*3))
        let ctx=CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
        var mirror=group.mirror
        if group.name=="turn" && i==4 {mirror=false}
        if mirror {ctx.translateBy(x:Double(w),y:0);ctx.scaleBy(x:-1,y:1)}
        let iw=Double(im.width)*scale*3,ih=Double(im.height)*scale*3
        ctx.interpolationQuality = .high
        ctx.draw(im,in:CGRect(x:(Double(w)-iw)/2,y:15,width:iw,height:ih))
        let name=String(format:"cat-v3-%@-%02d",group.name,i+1)
        let dir=xc.appendingPathComponent(name+".imageset")
        try save(ctx.makeImage()!,dir.appendingPathComponent("image.png"))
        try json(["images":[["idiom":"universal","filename":"image.png"]],"info":info],dir.appendingPathComponent("Contents.json"))
    }
    let spec:[String:Any] = ["id":group.name,"name":group.name,"frameCount":group.frames.count,"fps":8,"loop":group.loop,"size":[cw,ch],"footY":(ch-5)*group.support,"bodyLength":100.9,"hitInset":5,"imagePrefix":"cat-v3","frameDurations":group.durations]
    specs.removeAll{($0["id"] as? String)==group.name};specs.append(spec)
    print(group.name,Int(cw),Int(ch),"support",(ch-5)*group.support)
}
catalog["actions"]=specs
try json(catalog,root.appendingPathComponent("ios/Maomao/Assets.xcassets/cat-actions-v2.dataset/data.json"))
try json(["info":info],xc.appendingPathComponent("Contents.json"))
