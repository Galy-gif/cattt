import CoreLocation
import Foundation

/// 院子「跟着真实天气」的取数：系统大致位置 + Open-Meteo 当前天气。
/// 公共端点只适合本机非商业开发（和后端 `server/src/runtime/weather.ts` 同一条限制）；以后换 WeatherKit 只换这一个文件。
/// 取不到（拒绝定位、断网、超时）就留着上次的结果；从没取到过由 `WeatherMode.resolve` 当晴天。
@MainActor
final class RealWeather: NSObject, CLLocationManagerDelegate {
    private(set) var latest: Weather?
    /// 用户拒绝或系统限制了定位：设置里提示一行，不反复弹窗。
    private(set) var locationDenied = false

    private let manager = CLLocationManager()
    private var fetchedAt: Date?
    private var inFlight = false
    private static let interval: TimeInterval = 30 * 60
    private enum Keys { static let weather = "maomao.realWeather", time = "maomao.realWeatherAt" }

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyReduced
        let ud = UserDefaults.standard
        latest = ud.string(forKey: Keys.weather).flatMap(Weather.init(rawValue:))
        fetchedAt = ud.object(forKey: Keys.time) as? Date
        updateDenied(manager.authorizationStatus)
    }

    /// 每秒会被调到；真正取数最多三十分钟一次，只在前台。
    func refreshIfNeeded(now: Date = Date()) {
        guard !inFlight, !locationDenied else { return }
        if let fetchedAt, now.timeIntervalSince(fetchedAt) < Self.interval { return }
        switch manager.authorizationStatus {
        case .notDetermined:
            inFlight = true
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            inFlight = true
            manager.requestLocation()
        default:
            updateDenied(manager.authorizationStatus)
        }
    }

    private func updateDenied(_ status: CLAuthorizationStatus) {
        locationDenied = status == .denied || status == .restricted
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            self.updateDenied(status)
            switch status {
            case .authorizedWhenInUse, .authorizedAlways: self.manager.requestLocation()
            case .notDetermined: break
            default: self.inFlight = false
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let c = locations.last?.coordinate else { return }
        Task { @MainActor in await self.fetch(latitude: c.latitude, longitude: c.longitude) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            self.inFlight = false
            // 失败也记一次时间，避免每秒重试；五分钟后再试。
            self.fetchedAt = Date().addingTimeInterval(-Self.interval + 5 * 60)
        }
    }

    private func fetch(latitude: Double, longitude: Double) async {
        defer { inFlight = false }
        var parts = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        parts.queryItems = [
            URLQueryItem(name: "latitude", value: String(format: "%.2f", latitude)),
            URLQueryItem(name: "longitude", value: String(format: "%.2f", longitude)),
            URLQueryItem(name: "current", value: "weather_code,precipitation"),
        ]
        var request = URLRequest(url: parts.url!)
        request.timeoutInterval = 5
        struct Response: Decodable {
            struct Current: Decodable { let weather_code: Int; let precipitation: Double? }
            let current: Current
        }
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            let current = try JSONDecoder().decode(Response.self, from: data).current
            let w: Weather = (current.precipitation ?? 0) > 0 ? .rain : .fromWMO(current.weather_code)
            let now = Date()
            latest = w; fetchedAt = now
            UserDefaults.standard.set(w.rawValue, forKey: Keys.weather)
            UserDefaults.standard.set(now, forKey: Keys.time)
        } catch {
            fetchedAt = Date().addingTimeInterval(-Self.interval + 5 * 60)
        }
    }
}
