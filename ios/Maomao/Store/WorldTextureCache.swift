import SwiftUI
import ImageIO

/// Visible tiles survive until replacements are decoded. Objects remain resident.
@MainActor final class WorldTextureCache: ObservableObject {
    @Published private(set) var images: [String:UIImage] = [:]
    private var desired=Set<String>()
    private var pending=Set<String>()
    private var failed=Set<String>()
    private var decoding=false
    private var pixelLimits:[String:Int] = [:]
    init(scene:WorldScene) {
        for object in scene.objects {
            let rect=scene.objectRect(object),source=object.sourceRect ?? WorldRect(x:0,y:0,width:1,height:1)
            let needed=Int(ceil(max(rect.width/source.width*World.refSize.width,rect.height/source.height*World.refSize.height)*3.5))
            pixelLimits[object.image]=max(pixelLimits[object.image] ?? 0,needed)
        }
        pixelLimits["world-v3-ground-preview"]=1800
        for name in Set(scene.objects.map(\.image)).union(["world-v3-ground-preview"]) {
            if let image=Self.decode(name,limit:pixelLimits[name] ?? 1200) {images[name]=image}
        }
    }
    nonisolated private static func decode(_ name:String,limit:Int)->UIImage? {
        guard let url=Bundle.main.url(forResource:name,withExtension:"png"),
              let source=CGImageSourceCreateWithURL(url as CFURL,nil) else {return nil}
        let options:[CFString:Any]=[kCGImageSourceCreateThumbnailFromImageAlways:true,kCGImageSourceThumbnailMaxPixelSize:limit,kCGImageSourceCreateThumbnailWithTransform:true,kCGImageSourceShouldCacheImmediately:true]
        guard let image=CGImageSourceCreateThumbnailAtIndex(source,0,options as CFDictionary) else {return nil}
        return UIImage(cgImage:image)
    }
    func update(_ names:Set<String>, pinned:Set<String> = []) {
        desired=names.union(pinned)
        pending.formUnion(desired.subtracting(images.keys).subtracting(failed))
        decodeNext()
    }
    func ready(_ names:Set<String>) -> Bool {names.isSubset(of:Set(images.keys))}
    private func decodeNext() {
        guard !decoding else {return}
        pending.formIntersection(desired)
        pending.subtract(images.keys)
        guard !pending.isEmpty else {trim();return}
        decoding=true
        let names=Array(pending.sorted().prefix(3));pending.subtract(names)
        let limits=pixelLimits
        Task { [weak self] in
            let decoded=await Task.detached(priority:.userInitiated) {
                var result:[String:UIImage]=[:]
                for name in names {
                    autoreleasepool {
                        if let image=Self.decode(name,limit:limits[name] ?? 1200) {result[name]=image}
                    }
                }
                return result
            }.value
            guard let self else {return}
            var transaction=Transaction();transaction.disablesAnimations=true
            withTransaction(transaction) { self.images.merge(decoded) {_,new in new} }
            self.failed.formUnion(Set(names).subtracting(decoded.keys))
            self.decoding=false;self.trim();self.decodeNext()
        }
    }
    private func trim() {
        guard desired.isSubset(of:Set(images.keys).union(failed)),
              images.keys.contains(where:{!desired.contains($0)}) else {return}
        var transaction=Transaction();transaction.disablesAnimations=true
        withTransaction(transaction) {images=images.filter{desired.contains($0.key)}}
    }
}
