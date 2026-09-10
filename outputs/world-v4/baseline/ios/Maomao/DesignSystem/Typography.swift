import SwiftUI
import UIKit

/// 字体栈。
///
/// 正文 / UI 走系统中文栈（iOS 上就是 PingFang SC）。
/// 标题 / 猫名 / 木牌走中文衬线。设计稿用的是 Noto Serif SC —— 那是 Google Web Font，
/// iOS 不自带。把 NotoSerifSC-Medium/Bold 加进 target 并在 Info.plist 的
/// `UIAppFonts` 里登记，`serif` 会自动改用它；没加时退到系统自带的宋体 Songti SC，
/// 骨架同源（都是思源宋体一路），字面稍宽一点。
enum Typo {
    private static let notoMedium = "NotoSerifSC-Medium"
    private static let notoBold = "NotoSerifSC-Bold"
    private static let songtiRegular = "STSongti-SC-Regular"
    private static let songtiBold = "STSongti-SC-Bold"

    private static func firstAvailable(_ names: String...) -> String? {
        names.first { UIFont(name: $0, size: 12) != nil }
    }

    private static let mediumFace = firstAvailable(notoMedium, songtiRegular)
    private static let boldFace = firstAvailable(notoBold, songtiBold)

    /// 中文衬线。`weight` 只认 500（小标题）与 700（大标题），设计稿里没有别的档。
    static func serif(_ size: CGFloat, bold: Bool = false) -> Font {
        if let name = bold ? boldFace : mediumFace {
            return .custom(name, fixedSize: size)
        }
        return .system(size: size, weight: bold ? .bold : .medium, design: .serif)
    }

    /// 正文 / UI 无衬线。用 fixedSize 而不是 relative —— 设计稿给的是最终像素值。
    static func sans(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }

    /// 调试面板的等宽眉标。
    static func mono(_ size: CGFloat) -> Font {
        .system(size: size, design: .monospaced)
    }
}

extension View {
    /// 数字一律 tabular-nums（计数、时间戳、日期）。
    func tabularNumbers() -> some View {
        monospacedDigit()
    }

    /// 行高。SwiftUI 的 lineSpacing 是「行间距」不是「行高」，这里按
    /// line-height × fontSize − fontSize 折算，和设计稿的 CSS line-height 对齐。
    func lineHeight(_ multiple: CGFloat, size: CGFloat) -> some View {
        lineSpacing(max(0, multiple * size - size))
    }
}
