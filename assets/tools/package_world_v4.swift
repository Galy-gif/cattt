import Foundation
import AppKit
import ImageIO
import UniformTypeIdentifiers

// Deterministic atlas import. Head width (not bounding-box height) controls every pose's scale.
let root=URL(fileURLWithPath:FileManager.default.currentDirectoryPath)
let source=root.appendingPathComponent("assets/tuanzi/world-v4")
let xc=root.appendingPathComponent("ios/Maomao/Assets.xcassets/world-v4")
let info:[String:Any] = ["version":1,"author":"xcode"]
func json(_ value:Any,_ url:URL) throws {
    try FileManager.default.createDirectory(at:url.deletingLastPathComponent(),withIntermediateDirectories:true)
    try JSONSerialization.data(withJSONObject:value,options:[.prettyPrinted,.sortedKeys]).write(to:url)
}
func load(_ name:String)->CGImage {
    let s=CGImageSourceCreateWithURL(source.appendingPathComponent(name+".png") as CFURL,nil)!
    return CGImageSourceCreateImageAtIndex(s,0,nil)!
}
func save(_ image:CGImage,_ url:URL) throws {
    try FileManager.default.createDirectory(at:url.deletingLastPathComponent(),withIntermediateDirectories:true)
    let d=CGImageDestinationCreateWithURL(url as CFURL,UTType.png.identifier as CFString,1,nil)!
    CGImageDestinationAddImage(d,image,nil);precondition(CGImageDestinationFinalize(d))
}
struct Cell {let image:CGImage;let crop:CGRect;let cellSize:CGSize}
func extract(_ im:CGImage,_ index:Int,columns:Int=4,rows:Int=4,protectHighlights:Bool=false)->Cell {
    let x0=im.width*(index%columns)/columns,x1=im.width*(index%columns+1)/columns
    let y0=im.height*(index/columns)/rows,y1=im.height*(index/columns+1)/rows
    let input=im.cropping(to:CGRect(x:x0,y:y0,width:x1-x0,height:y1-y0))!
    let w=input.width,h=input.height
    let ctx=CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.draw(input,in:CGRect(x:0,y:0,width:w,height:h))
    let p=ctx.data!.assumingMemoryBound(to:UInt8.self)
    let nativeAlpha=[CGImageAlphaInfo.premultipliedLast,.premultipliedFirst,.last,.first].contains(input.alphaInfo)
    var background = Set<Int>()
    if protectHighlights && !nativeAlpha {
        // Generated RGB sprites can contain a neutral preview backdrop. Remove only
        // large connected neutral regions, retaining cream rope highlights inside.
        var seen = Set<Int>()
        for start in 0..<w*h where !seen.contains(start) {
            let i=start*4
            guard Int(max(p[i],p[i+1],p[i+2]))-Int(min(p[i],p[i+1],p[i+2])) < 18 else {continue}
            var part=[start],cursor=0
            seen.insert(start)
            while cursor<part.count {
                let n=part[cursor];cursor += 1
                for next in [n-1,n+1,n-w,n+w] where next>=0 && next<w*h && abs(next%w-n%w)<=1 && !seen.contains(next) {
                    let j=next*4
                    if Int(max(p[j],p[j+1],p[j+2]))-Int(min(p[j],p[j+1],p[j+2])) < 18 {
                        seen.insert(next);part.append(next)
                    }
                }
            }
            if part.count > 500 {background.formUnion(part)}
        }
    }
    for n in 0..<w*h {
        if nativeAlpha {continue}
        if protectHighlights {
            if background.contains(n) {for c in 0..<4 {p[n*4+c]=0}}
            continue
        }
        let i=n*4,r=Double(p[i]),g=Double(p[i+1]),b=Double(p[i+2])
        let a=min(1,max(0,(max(r,g,b)-min(r,g,b)-12)/22))
        for c in 0..<4 {p[i+c]=UInt8(Double(p[i+c])*a)}
    }
    var visited=Set<Int>(),largest=[Int]()
    for start in 0..<w*h where p[start*4+3]>35 && !visited.contains(start) {
        var part=[start],cursor=0;visited.insert(start)
        while cursor<part.count {
            let n=part[cursor];cursor += 1
            for next in [n-1,n+1,n-w,n+w] where next>=0 && next<w*h && abs(next%w-n%w)<=1 {
                if p[next*4+3]>35 && visited.insert(next).inserted {part.append(next)}
            }
        }
        if part.count>largest.count {largest=part}
    }
    let keep=Set(largest)
    var minX=w,minY=h,maxX=0,maxY=0
    for n in 0..<w*h {
        if !keep.contains(n) {for c in 0..<4 {p[n*4+c]=0}}
        else {minX=min(minX,n%w);maxX=max(maxX,n%w);minY=min(minY,n/w);maxY=max(maxY,n/w)}
    }
    let bounds=CGRect(x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1)
    return Cell(image:ctx.makeImage()!.cropping(to:bounds)!,crop:bounds,cellSize:CGSize(width:w,height:h))
}
// Reimport the nest without rebuilding unrelated cat animation atlases.
if CommandLine.arguments.contains("--nest-only") {
    let input = extract(load("nest-source"), 0, columns: 1, rows: 1, protectHighlights: true).image
    try save(input, root.appendingPathComponent("ios/Maomao/Resources/WorldTextures/world-v4-nest.png"))
    print("Imported nest", input.width, input.height)
    exit(0)
}
struct Pose {let sheet:String;let cell:Int;let anchor:CGPoint;let head:Double}
func pose(_ sheet:String,_ i:Int,_ x:Double=0.58,_ y:Double=0.90,_ head:Double=0.36)->Pose {Pose(sheet:sheet,cell:i,anchor:CGPoint(x:x,y:y),head:head)}
// Anchors are measured in the source grid: a planted paw/ledge contact, never the changing outer silhouette.
let n=(0..<16).map {pose("nest-atlas",$0)}
let r=(0..<16).map {pose("rail-atlas",$0,0.57,0.94,0.40)}
let w=(0..<16).map {pose("water-atlas",$0,0.40,$0<12 ? 0.89:0.79,0.37)}
struct Group {let name:String;let poses:[Pose];let seconds:Double;var loop:String="once";var durations:[Double]?=nil}
var groups:[Group]=[
    Group(name:"jumpPrepare",poses:Array(n[0...2]),seconds:0.36),
    Group(name:"jumpUp",poses:[pose("nest-atlas",3,0.58,0.90),pose("nest-atlas",4,0.68,0.84),pose("nest-atlas",5,0.76,0.72),pose("nest-atlas",6,0.84,0.64),pose("nest-atlas",7,0.88,0.45)],seconds:0.60),
    Group(name:"climbIn",poses:[pose("nest-atlas",8,0.86,0.68),pose("nest-atlas",9,0.86,0.68),pose("nest-atlas",10,0.86,0.68),pose("nest-atlas",11,0.84,0.79),pose("nest-atlas",12,0.85,0.72),pose("nest-atlas",13,0.86,0.73)],seconds:0.84),
    Group(name:"nestLook",poses:[pose("nest-atlas",14,0.86,0.74),pose("sleep-atlas",14,0.86,0.74),pose("nest-atlas",14,0.86,0.74)],seconds:2.6,loop:"loop",durations:[1.5,0.12,0.98]),
    Group(name:"nestSleep",poses:[pose("sleep-atlas",15,0.86,0.74)],seconds:1,loop:"loop"),
    Group(name:"railReach",poses:Array(r[0...3]),seconds:0.48),
    Group(name:"railClimb",poses:[pose("rail-atlas",4,0.57,0.94,0.40),pose("rail-atlas",5,0.66,0.80,0.40),pose("rail-atlas",6,0.76,0.64,0.40),pose("rail-atlas",7,0.84,0.52,0.40),pose("rail-atlas",8,0.86,0.54,0.40)],seconds:0.88),
    Group(name:"railSettle",poses:[pose("rail-atlas",9,0.86,0.61,0.40),pose("rail-atlas",10,0.80,0.66,0.40),pose("rail-atlas",11,0.73,0.84,0.40),pose("rail-atlas",12,0.64,0.73,0.40),pose("rail-atlas",13,0.58,0.67,0.40)],seconds:0.72),
    Group(name:"perchLook",poses:[pose("rail-atlas",14,0.58,0.62,0.40)],seconds:1,loop:"loop"),
    Group(name:"perchSleep",poses:[pose("rail-atlas",15,0.58,0.63,0.40)],seconds:1,loop:"loop"),
    Group(name:"waterLook",poses:Array(w[0...1]),seconds:0.7),
    Group(name:"waterReach",poses:Array(w[2...4]),seconds:0.8),
    Group(name:"waterTap",poses:[w[7],w[4],w[5],w[7],w[8],w[9],w[10]],seconds:1.6,durations:[0.28,0.18,0.24,0.28,0.18,0.24,0.20]),
    Group(name:"waterWatch",poses:[w[10],w[11]],seconds:0.8),
    Group(name:"waterShake",poses:[w[12],w[13],w[14],w[13],w[14]],seconds:0.9),
    Group(name:"waterRest",poses:[w[15]],seconds:1,loop:"loop"),
    Group(name:"waterRecover",poses:[w[15],w[11],w[10],w[0]],seconds:0.5)
]
if FileManager.default.fileExists(atPath:source.appendingPathComponent("exit-atlas.png").path) {
    let e=(0..<16).map {pose("exit-atlas",$0, $0<9 ? 0.80:0.58, $0<4 ? 0.81:0.93,0.37)}
    groups += [Group(name:"climbOut",poses:Array(e[0...3]),seconds:0.65),Group(name:"jumpDown",poses:Array(e[4...8]),seconds:0.6),Group(name:"land",poses:Array(e[9...15]),seconds:0.32)]
}
var sheets=[String:[Cell]]()
for group in groups {for p in group.poses where sheets[p.sheet]==nil {let im=load(p.sheet);sheets[p.sheet]=(0..<16).map {extract(im,$0)}}}
var catalog=try JSONSerialization.jsonObject(with:Data(contentsOf:root.appendingPathComponent("outputs/world-v4/baseline/ios/Maomao/Assets.xcassets/cat-actions-v2.dataset/data.json"))) as! [String:Any]
var specs=catalog["actions"] as! [[String:Any]]
for group in groups {
    // Crop only transparent padding. Keep horizontal support at canvas center and adjust footY by the same crop.
    let bounds=group.poses.map { p -> CGRect in
        let c=sheets[p.sheet]![p.cell],scale=40/(Double(c.cellSize.width)*p.head)
        let px=(p.anchor.x*c.cellSize.width-c.crop.minX)*scale
        let py=(p.anchor.y*c.cellSize.height-c.crop.minY)*scale
        return CGRect(x:90-px,y:125-py,width:Double(c.image.width)*scale,height:Double(c.image.height)*scale)
    }
    let half=ceil(bounds.map {max(90-$0.minX,$0.maxX-90)}.max()!+4)
    let top=floor(min(121,bounds.map(\.minY).min()!-4))
    let bottom=ceil(max(129,bounds.map(\.maxY).max()!+4))
    let cw=half*2,ch=bottom-top,ax=half,ay=125-top
    for (i,p) in group.poses.enumerated() {
        let cell=sheets[p.sheet]![p.cell]
        let scale=40/(Double(cell.cellSize.width)*p.head)
        let w=Int(cw*3),h=Int(ch*3)
        let ctx=CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
        let px=(p.anchor.x*cell.cellSize.width-cell.crop.minX)*scale
        let py=(p.anchor.y*cell.cellSize.height-cell.crop.minY)*scale
        let iw=Double(cell.image.width)*scale,ih=Double(cell.image.height)*scale
        ctx.interpolationQuality = .high
        ctx.draw(cell.image,in:CGRect(x:(ax-px)*3,y:(ch-ay+py-ih)*3,width:iw*3,height:ih*3))
        let name=String(format:"cat-v4-%@-%02d",group.name,i+1),dir=xc.appendingPathComponent(String(format:"cat-v4-%@-%02d.imageset",group.name,i+1))
        try save(ctx.makeImage()!,dir.appendingPathComponent("image.png"))
        try json(["images":[["idiom":"universal","filename":"image.png"]],"info":info],dir.appendingPathComponent("Contents.json"))
        print(name,"scale",scale)
    }
    specs.removeAll{($0["id"] as? String)==group.name}
    specs.append(["id":group.name,"name":group.name,"frameCount":group.poses.count,"fps":12,"loop":group.loop,"size":[cw,ch],"footY":ay,"bodyLength":100.9,"hitInset":5,"imagePrefix":"cat-v4","frameDurations":group.durations ?? Array(repeating:group.seconds/Double(group.poses.count),count:group.poses.count)])
}
// Turn art contains the reversal already. Do not mirror its final frame a second time at the phase boundary.
if let i=specs.firstIndex(where: {($0["id"] as? String)=="turn"}) {specs[i]["frameCount"]=4;specs[i]["frameDurations"]=[0.08,0.10,0.12,0.10]}
catalog["actions"]=specs
try json(catalog,root.appendingPathComponent("ios/Maomao/Assets.xcassets/cat-actions-v2.dataset/data.json"))
try json(["info":info],xc.appendingPathComponent("Contents.json"))
for (sourceName,outputName) in [("nest-source","world-v4-nest")] {
    let input=extract(load(sourceName),0,columns:1,rows:1,protectHighlights:true).image
    try save(input,root.appendingPathComponent("ios/Maomao/Resources/WorldTextures/"+outputName+".png"))
}
