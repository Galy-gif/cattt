import SwiftUI

/// 原生页面：米白毛毡与淡蓝光晕；珊瑚为强调，留言纸与木牌保留暖色。
/// 页面底使用 PageBackground；bg 只作为纯色面回退，不能拿渐变填图标或卡片。
enum Palette {
    static let pageGlow = Color(hex: 0xF4F7FC)
    static let inset = Color(hex: 0xECEFEE)

    // 底 / 面
    static let bg = Color(hex: 0xF5F5F3)          // 页面底色
    static let card = Color(hex: 0xFFFFFF)        // 卡片、气泡、输入框、列表容器。参考图是纯白，定纯白
    static let rule = Color(hex: 0xD4D7D8)        // 未选中态、需要描边的地方。卡片不再描边，靠投影浮起
    static let divider = Color(hex: 0xEBECEC)     // 列表内分隔线（画在卡片里）
    static let shadow = Color(hex: 0x29312F, alpha: 0.07)  // 卡片投影，软而散

    // 文字
    static let ink = Color(hex: 0x29312F)         // 主文字
    static let ink2 = Color(hex: 0x49514F)        // 次级文字、正文段落
    static let ink3 = Color(hex: 0x626B68)        // 三级文字、说明、时间戳
    static let ink4 = Color(hex: 0x68716E)        // 弱化文字、计数、占位

    // 珊瑚强调；略压明度配白字，保证原生按钮与小字对比度。
    static let accent = Color(hex: 0xB45138)      // 主按钮、选中态、链接、未读点
    static let accentDark = Color(hex: 0x9E4630)  // 主按钮 2px 硬投影
    static let accentInk = Color(hex: 0xFFFFFF)   // accent 底上的文字

    // 团子留言纸。全屏唯一的暖面，是重音不是底，随页面底漂色会失去意义。
    static let paper = Color(hex: 0xF6EEDC)
    static let paperRule = Color(hex: 0xE0D4B4)
    static let paperInk = Color(hex: 0xA8865A)

    // 杂项
    static let chip = Color(hex: 0xE8ECEB)        // 标签胶囊底
    static let switchOn = Color(hex: 0xB45138)    // 开关开启态轨道
    static let privateBg = Color(hex: 0xEDF0EF)   // 私密碎片卡底
    static let privateRule = Color(hex: 0xBBC5C1) // 私密碎片虚线描边
    static let overlay = Color(hex: 0x252D2B, alpha: 0.32)          // 抽屉/菜单遮罩

    // 场景层上的半透明面。采用中性白，避免把场景色染进控件。
    static let onSceneRail = Color(hex: 0xF5F5F3, alpha: 0.62)
    static let onSceneRailOn = Color(hex: 0xF5F5F3, alpha: 0.92)
    static let onSceneAxis = Color(hex: 0xF5F5F3, alpha: 0.72)       // 地点轨的竖线
    static let onSceneNode = Color(hex: 0xF5F5F3, alpha: 0.94)       // 轨上未选中的节点
    static let onSceneNodeRule = Color(hex: 0x29312F, alpha: 0.20)   // 节点描边
    static let onSceneStatus = Color(hex: 0xF5F5F3, alpha: 0.72)
    static let onSceneTopic = Color(hex: 0xF6EEDC, alpha: 0.95)      // 话题卡是留言纸，留暖
    static let onSceneTopicRule = Color(hex: 0xE0D4B4, alpha: 0.90)

    /// 场景上的玻璃层。状态条和 Tab 栏共用这一层，压在 70% 不透明度的 ultraThinMaterial 上。
    static let onSceneGlass = Color(hex: 0xF5F5F3, alpha: 0.22)
    static let onSceneGlassRule = Color(hex: 0x29312F, alpha: 0.10)

    // 聊天层。2026-09-16 起叠在虚化的院子底上（见 ChatBackground），不再是实色面。
    // 气泡不描边、不发光，只靠半透明白和院子分开；正文对比度按底图最饱和处（天蓝、草绿）实测。
    static let chatMist = Color(hex: 0xF7F5EE)                    // 上下雾层，暖白
    static let chatBubbleCat = Color(hex: 0xFFFFFF, alpha: 0.80)
    static let chatBubbleUser = Color(hex: 0xFBF4EC, alpha: 0.66) // 比猫透一档，略暖
    static let chatHint = Color(hex: 0x414B47)    // 气泡下方状态注，直接压在院子上，所以比 ink3 深
    static let chatField = Color(hex: 0xFFFFFF, alpha: 0.80)
    static let chatDot = Color(hex: 0x68716E)     // 等待回复三点
    static let chatSeparation = Color(hex: 0x29312F, alpha: 0.06) // 面和院子之间极轻的软投影
    // 入夜以后（见 ChatTone）：雾换深夜蓝，面换冷白薄玻璃，字换浅色。
    static let chatMistNight = Color(hex: 0x121A2C)
    static let chatBubbleCatNight = Color(hex: 0xE6ECF7, alpha: 0.17)
    static let chatBubbleUserNight = Color(hex: 0xF4E6DA, alpha: 0.13)
    static let chatFieldNight = Color(hex: 0xE6ECF7, alpha: 0.15)
    static let chatInkNight = Color(hex: 0xF1F3F8)
    static let chatInk2Night = Color(hex: 0xC5CDDC)
    static let chatPlaceholderNight = Color(hex: 0x9DA7BA)

    // 创建流程
    static let pendingCard = Color(hex: 0xECEEED)   // 待定稿外观卡底
    static let pendingSwatch = Color(hex: 0xDCDFDE) // 待定稿灰圆 / 置灰按钮底
    static let signFace = Color(hex: 0xD9C39C)      // 木牌牌面，留暖
    static let signEdge = Color(hex: 0x6B5B4A)      // 木牌描边
    static let signPost = Color(hex: 0xC7A882)      // 木牌牌柱
    static let signPlaceholder = Color(hex: 0x9C8E76)

    // 日记
    static let pawPrint = Color(hex: 0x8A7A5E)      // 只留脚印，留暖
    static let pawMark = Color(hex: 0xC9823F)       // 留言纸 / 来源卡上的爪印徽标
    static let photoStripeA = Color(hex: 0xC4D9CE)
    static let photoStripeB = Color(hex: 0xBAD0C4)

    // 我的
    static let meHeaderTop = Color(hex: 0xF4F7FC)
    static let meHeaderMid = Color(hex: 0xF5F6F7)

    // 轻提示
    static let toastFill = Color(hex: 0x29312F, alpha: 0.86)
    static let toastText = Color(hex: 0xF6F8F4)

    // 地点轨图标（未选中）。和场景插画的线色是同一支，留暖。
    static let railIcon = Color(hex: 0x6B5B4A)
}

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}
