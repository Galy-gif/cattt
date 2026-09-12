import AVFoundation

/// 雨声：一段可无缝循环的合成雨声（assets/tools/make_rain_sound.py），跟随系统静音开关，和别的音频混着放。
@MainActor final class RainSound {
    private var player: AVAudioPlayer?
    private(set) var playing = false
    private var fadeTask: Task<Void, Never>?

    func set(on: Bool, volume: Float = 0.35) {
        if on {
            guard !playing else { player?.setVolume(volume, fadeDuration: 1.0); return }
            guard let url = Bundle.main.url(forResource: "rain-loop", withExtension: "m4a") else { return }
            do {
                try AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
                try AVAudioSession.sharedInstance().setActive(true)
                let p = try AVAudioPlayer(contentsOf: url)
                p.numberOfLoops = -1; p.volume = 0; p.prepareToPlay(); p.play()
                p.setVolume(volume, fadeDuration: 2.0)
                player = p; playing = true
            } catch { player = nil; playing = false }
        } else {
            guard playing, let p = player else { return }
            playing = false
            p.setVolume(0, fadeDuration: 1.2)
            fadeTask?.cancel()
            fadeTask = Task { @MainActor [weak self] in
                try? await Task.sleep(nanoseconds: 1_300_000_000)
                guard let self, !self.playing else { return }
                self.player?.stop(); self.player = nil
            }
        }
    }
}
