import Foundation

/// 时段与雨天的分级参数：天空、地面、物件、猫各乘一个颜色，天空另加一层暖光。
/// 数值从 outputs/atmosphere-v1-delivery 的四张方向图上量出来（天空区、地平线区、草地区、墙面区相对白天首页截图的中位数比值），
/// 见 outputs/atmosphere-v1-review/验收报告.md 与 assets/scenes/atmosphere-v1/README.md。地面和物件比实测略提亮，免得夜里看不清。
struct Tint: Equatable {
    var r: Double, g: Double, b: Double
    static let none = Tint(r: 1, g: 1, b: 1)
    static let black = Tint(r: 0, g: 0, b: 0)
    static func mix(_ a: Tint, _ b: Tint, _ t: Double) -> Tint {
        Tint(r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t)
    }
}

struct AtmosphereParams: Equatable {
    /// 天空顶部、地平线处的乘色；再加一层"发光"（加色），黄昏的粉和傍晚地平线的一线桃色靠它。
    var skyTop = Tint.none, skyTopAdd = Tint.black
    var skyHorizon = Tint.none, skyHorizonAdd = Tint.black
    /// 地面拼贴（地平线以下）、独立物件（房子、树、栅栏…）、猫。
    var ground = Tint.none, object = Tint.none, cat = Tint.none
    /// 正常混合盖在天空上的一层"雾"：颜色与顶部、地平线处的不透明度。雨天用它把蓝天和奶白的云一起压灰。
    var cover = Tint(r: 0.5, g: 0.54, b: 0.6), coverTop = 0.0, coverHorizon = 0.0
    /// 天上的东西的可见度 0–1。
    var sun = 0.0, moon = 0.0, stars = 0.0, windowLit = 0.0
    /// 雨的强度 0–1（雨丝密度与雨云不透明度）。
    var rain = 0.0

    static func mix(_ a: AtmosphereParams, _ b: AtmosphereParams, _ t: Double) -> AtmosphereParams {
        var p = AtmosphereParams()
        p.skyTop = .mix(a.skyTop, b.skyTop, t); p.skyTopAdd = .mix(a.skyTopAdd, b.skyTopAdd, t)
        p.skyHorizon = .mix(a.skyHorizon, b.skyHorizon, t); p.skyHorizonAdd = .mix(a.skyHorizonAdd, b.skyHorizonAdd, t)
        p.ground = .mix(a.ground, b.ground, t); p.object = .mix(a.object, b.object, t); p.cat = .mix(a.cat, b.cat, t)
        p.cover = .mix(a.cover, b.cover, t); p.coverTop = a.coverTop + (b.coverTop - a.coverTop) * t; p.coverHorizon = a.coverHorizon + (b.coverHorizon - a.coverHorizon) * t
        p.sun = a.sun + (b.sun - a.sun) * t; p.moon = a.moon + (b.moon - a.moon) * t
        p.stars = a.stars + (b.stars - a.stars) * t; p.windowLit = a.windowLit + (b.windowLit - a.windowLit) * t
        p.rain = a.rain + (b.rain - a.rain) * t
        return p
    }

    static let day = AtmosphereParams()
    static let dawn: AtmosphereParams = {
        var p = AtmosphereParams()
        p.skyTop = Tint(r: 0.88, g: 0.94, b: 0.96); p.skyTopAdd = Tint(r: 0.06, g: 0.04, b: 0.02)
        p.skyHorizon = Tint(r: 0.95, g: 0.93, b: 0.90); p.skyHorizonAdd = Tint(r: 0.08, g: 0.05, b: 0.02)
        p.ground = Tint(r: 0.86, g: 0.90, b: 0.92); p.object = Tint(r: 0.92, g: 0.93, b: 0.96); p.cat = Tint(r: 0.97, g: 0.97, b: 1)
        return p
    }()
    /// A1：天空 (172,97,141) / 白天 (112,190,228)；草地 (64,74,38) / (145,152,70)；墙 (234,114,42) / (246,158,66)。
    static let dusk: AtmosphereParams = {
        var p = AtmosphereParams()
        p.skyTop = Tint(r: 1.0, g: 0.51, b: 0.62); p.skyTopAdd = Tint(r: 0.24, g: 0.0, b: 0.02)
        p.skyHorizon = Tint(r: 1.0, g: 0.62, b: 0.42); p.skyHorizonAdd = Tint(r: 0.30, g: 0.12, b: 0.0)
        p.ground = Tint(r: 0.66, g: 0.62, b: 0.50); p.object = Tint(r: 0.96, g: 0.76, b: 0.64); p.cat = Tint(r: 1.0, g: 0.90, b: 0.84)
        p.sun = 1
        return p
    }()
    /// A2：天空 (27,64,131)；草地 (40,53,42)；窗户亮。
    static let evening: AtmosphereParams = {
        var p = AtmosphereParams()
        p.skyTop = Tint(r: 0.24, g: 0.34, b: 0.57); p.skyHorizon = Tint(r: 0.42, g: 0.40, b: 0.55); p.skyHorizonAdd = Tint(r: 0.10, g: 0.05, b: 0.0)
        p.ground = Tint(r: 0.40, g: 0.46, b: 0.62); p.object = Tint(r: 0.58, g: 0.60, b: 0.72); p.cat = Tint(r: 0.78, g: 0.78, b: 0.84)
        p.windowLit = 1; p.stars = 0.3
        return p
    }()
    /// A3：天空 (8,33,78)；草地 (31,45,43)；团子比地面亮 15.8 L*。
    static let night: AtmosphereParams = {
        var p = AtmosphereParams()
        p.skyTop = Tint(r: 0.08, g: 0.18, b: 0.36); p.skyHorizon = Tint(r: 0.27, g: 0.32, b: 0.51)
        p.ground = Tint(r: 0.30, g: 0.36, b: 0.56); p.object = Tint(r: 0.44, g: 0.48, b: 0.64); p.cat = Tint(r: 0.66, g: 0.66, b: 0.74)
        p.windowLit = 1; p.moon = 1; p.stars = 1
        return p
    }()
    /// A4：天空 (115,129,144)；草地 (81,90,53)；整图饱和度中位数 0.34（白天 0.51）。
    static let rain: AtmosphereParams = {
        var p = AtmosphereParams()
        p.skyTop = Tint(r: 0.92, g: 0.90, b: 0.90); p.skyHorizon = Tint(r: 0.88, g: 0.86, b: 0.88)
        p.cover = Tint(r: 0.47, g: 0.52, b: 0.58); p.coverTop = 0.62; p.coverHorizon = 0.34
        p.ground = Tint(r: 0.62, g: 0.64, b: 0.72); p.object = Tint(r: 0.84, g: 0.85, b: 0.90); p.cat = Tint(r: 0.90, g: 0.90, b: 0.93)
        p.rain = 1
        return p
    }()

    /// 一天的关键帧（小时）。相邻两帧之间线性过渡，跨午夜环绕。
    static let keyframes: [(hour: Double, params: AtmosphereParams)] = [
        (5.5, night), (6.5, dawn), (8.0, day), (17.0, day), (17.8, dusk), (18.7, evening), (19.8, night),
    ]

    static func at(hour: Double, weather: Weather, rainAmount: Double = 1) -> AtmosphereParams {
        var h = hour.truncatingRemainder(dividingBy: 24); if h < 0 { h += 24 }
        let frames = keyframes
        var base = frames.last!.params
        for i in frames.indices {
            let a = frames[i], b = frames[(i + 1) % frames.count]
            let bHour = b.hour + (b.hour < a.hour ? 24 : 0)
            var hh = h; if hh < a.hour { hh += 24 }
            if hh >= a.hour && hh <= bHour {
                base = mix(a.params, b.params, bHour > a.hour ? (hh - a.hour) / (bHour - a.hour) : 0); break
            }
        }
        guard weather == .rain, rainAmount > 0 else { return base }
        // 雨天：白天按雨的参数；夜里和傍晚把雨的灰压在原来的暗色上。
        var wet = rain
        wet.skyTop = Tint(r: base.skyTop.r * wet.skyTop.r, g: base.skyTop.g * wet.skyTop.g, b: base.skyTop.b * wet.skyTop.b)
        wet.skyHorizon = Tint(r: base.skyHorizon.r * wet.skyHorizon.r, g: base.skyHorizon.g * wet.skyHorizon.g, b: base.skyHorizon.b * wet.skyHorizon.b)
        wet.ground = Tint(r: base.ground.r * wet.ground.r, g: base.ground.g * wet.ground.g, b: base.ground.b * wet.ground.b)
        wet.object = Tint(r: base.object.r * wet.object.r, g: base.object.g * wet.object.g, b: base.object.b * wet.object.b)
        wet.cat = Tint(r: base.cat.r * wet.cat.r, g: base.cat.g * wet.cat.g, b: base.cat.b * wet.cat.b)
        wet.skyTopAdd = Tint(r: base.skyTopAdd.r * 0.3, g: base.skyTopAdd.g * 0.3, b: base.skyTopAdd.b * 0.3)
        wet.skyHorizonAdd = Tint(r: base.skyHorizonAdd.r * 0.3, g: base.skyHorizonAdd.g * 0.3, b: base.skyHorizonAdd.b * 0.3)
        wet.windowLit = base.windowLit; wet.moon = base.moon * 0.3; wet.stars = 0; wet.sun = 0
        // 夜里的雨：雾也跟着暗
        wet.cover = Tint(r: wet.cover.r * (0.4 + 0.6 * base.skyTop.r), g: wet.cover.g * (0.4 + 0.6 * base.skyTop.g), b: wet.cover.b * (0.4 + 0.6 * base.skyTop.b))
        return mix(base, wet, rainAmount)
    }
}
