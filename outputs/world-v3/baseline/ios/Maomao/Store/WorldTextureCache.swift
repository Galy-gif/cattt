import SwiftUI

/// File-backed images avoid UIImage(named:) retaining the entire HD panorama.
@MainActor final class WorldTextureCache: ObservableObject {
    @Published private(set) var images: [String:UIImage] = [:]
    private var desired=Set<String>()
    private var generation=0
    func update(_ names:Set<String>) {
        guard names != desired else {return}
        desired=names;generation += 1
        let token=generation
        images=images.filter{names.contains($0.key)}
        let missing=names.subtracting(images.keys)
        Task { [weak self] in
            let decoded=await Task.detached(priority:.userInitiated) {
                var result:[String:UIImage]=[:]
                for name in missing {
                    if let path=Bundle.main.path(forResource:name,ofType:"png"),let image=UIImage(contentsOfFile:path)?.preparingForDisplay() {result[name]=image}
                }
                return result
            }.value
            guard let self,self.generation==token else {return}
            self.images.merge(decoded){_,new in new}
        }
    }
}
