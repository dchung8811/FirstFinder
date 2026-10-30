import SwiftUI
import UIKit

// Every color the prototype draws, taken from the Tailwind arbitrary values in
// app/InventoryApp.jsx. Nothing here is new: the web has no dark mode, so the
// dark column re-uses the same palette with the roles swapped (deep green
// becomes the surface, cream becomes the ink) rather than inventing tones.
enum Theme {
    // Surfaces
    static let page = adaptive(0xf6efe3, dark: 0x0f332d)
    static let surface = adaptive(0xfff9f0, dark: 0x123f38)
    static let surfaceRaised = adaptive(0xfffdf8, dark: 0x123f38)
    static let surfaceWarm = adaptive(0xfff8ee, dark: 0x0f332d)
    static let cream = adaptive(0xfff7ea, dark: 0x0f332d)
    static let chip = adaptive(0xf0e2cf, dark: 0x0f332d)
    static let pill = adaptive(0xf7efe3, dark: 0x0f332d)
    static let tint = adaptive(0xedf4f2, dark: 0x0f332d)

    // Ink
    static let ink = adaptive(0x201a14, dark: 0xfff7ea)
    static let brown = adaptive(0x665746, dark: 0xd8c7ad)
    static let brownSoft = adaptive(0x7d6c5a, dark: 0xcdbb9d)
    static let brownMuted = adaptive(0x8a7a64, dark: 0xcdbb9d)
    static let green = adaptive(0x123f38, dark: 0xedf4f2)

    // Borders
    static let border = adaptive(0xd8c7ad, dark: 0x665746)
    static let borderStrong = adaptive(0xcdbb9d, dark: 0x7d6c5a)
    static let borderSoft = adaptive(0xe0d2bc, dark: 0x665746)

    // Actions. The primary button is deep green on cream in light mode and
    // flips to cream on deep green in dark, so it stays the highest-contrast
    // thing on the screen either way.
    static let action = adaptive(0x123f38, dark: 0xfff7ea)
    static let actionPressed = adaptive(0x0f332d, dark: 0xedf4f2)
    static let onAction = adaptive(0xfff7ea, dark: 0x123f38)

    // States, from the web's toast and warning styles.
    static let warningSurface = adaptive(0xfff3d8, dark: 0x3f352a)
    static let warningInk = adaptive(0x6d5526, dark: 0xfff3d8)
    static let errorSurface = adaptive(0xfbf1ec, dark: 0x3f352a)
    static let errorInk = adaptive(0x8a3b22, dark: 0xe2b6a1)
    static let errorBorder = adaptive(0xe2b6a1, dark: 0x8a3b22)

    static func adaptive(_ light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xff) / 255,
            green: CGFloat((hex >> 8) & 0xff) / 255,
            blue: CGFloat(hex & 0xff) / 255,
            alpha: 1
        )
    }
}

// The web's two font classes: .font-display (Fraunces) for headings and
// .font-ledger (IBM Plex Mono, tabular) for figures and reference numbers.
// Body text stays in the system sans, as Tailwind's default does on the web.
// Both scale with Dynamic Type through relativeTo.
extension Font {
    static func display(_ size: CGFloat, relativeTo style: Font.TextStyle = .title) -> Font {
        .custom("Fraunces", size: size, relativeTo: style)
    }

    static func ledger(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom("IBM Plex Mono", size: size, relativeTo: style).monospacedDigit()
    }
}

// The small uppercase, letter-spaced label the web puts above most headings
// ("uppercase tracking-[0.18em] text-[#7d6c5a]").
struct Eyebrow: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text.uppercased())
            .font(.caption.weight(.medium))
            .tracking(1.6)
            .foregroundStyle(Theme.brownSoft)
    }
}

// Card / CardContent: "rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm".
struct Card<Content: View>: View {
    var padding: CGFloat = 20
    var background: Color = Theme.surface
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(background, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).strokeBorder(Theme.border))
            .shadow(color: .black.opacity(0.04), radius: 2, y: 1)
    }
}

// Button variants, matching the web's Button component: primary is the
// filled deep-green pill, secondary the outlined cream one.
struct FFButtonStyle: ButtonStyle {
    enum Variant { case primary, secondary, quiet, danger }

    var variant: Variant = .primary
    var fullWidth = false

    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: 44)
            .foregroundStyle(foreground)
            .background(background(pressed: configuration.isPressed), in: Capsule())
            .overlay(Capsule().strokeBorder(border))
            .opacity(isEnabled ? 1 : 0.5)
            .contentShape(Capsule())
    }

    private var foreground: Color {
        switch variant {
        case .primary: Theme.onAction
        case .secondary, .quiet: Theme.green
        case .danger: Theme.cream
        }
    }

    private func background(pressed: Bool) -> Color {
        switch variant {
        case .primary: pressed ? Theme.actionPressed : Theme.action
        case .secondary: pressed ? Theme.chip : Theme.surfaceRaised
        case .quiet: pressed ? Theme.chip : .clear
        case .danger: Theme.errorInk
        }
    }

    private var border: Color {
        switch variant {
        case .secondary: Theme.borderStrong
        default: .clear
        }
    }
}

extension ButtonStyle where Self == FFButtonStyle {
    static var ffPrimary: FFButtonStyle { FFButtonStyle(variant: .primary) }
    static var ffSecondary: FFButtonStyle { FFButtonStyle(variant: .secondary) }
    static var ffQuiet: FFButtonStyle { FFButtonStyle(variant: .quiet) }
    static var ffDanger: FFButtonStyle { FFButtonStyle(variant: .danger) }
}

// The rounded pill chips used for counts, statuses and criteria.
struct Chip: View {
    enum Tone { case neutral, tint, warning, error }

    let text: String
    var tone: Tone = .neutral
    var systemImage: String?

    var body: some View {
        HStack(spacing: 4) {
            if let systemImage {
                Image(systemName: systemImage).imageScale(.small)
            }
            Text(text)
        }
        .font(.caption.weight(.medium))
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .foregroundStyle(foreground)
        .background(background, in: Capsule())
        .accessibilityElement(children: .combine)
    }

    private var foreground: Color {
        switch tone {
        case .neutral: Theme.brown
        case .tint: Theme.green
        case .warning: Theme.warningInk
        case .error: Theme.errorInk
        }
    }

    private var background: Color {
        switch tone {
        case .neutral: Theme.chip
        case .tint: Theme.tint
        case .warning: Theme.warningSurface
        case .error: Theme.errorSurface
        }
    }
}

// The "local" chip on anything the in-memory overlay has changed, so a
// reviewer can always tell a live row from one that exists only on this phone.
struct LocalChip: View {
    var body: some View {
        Chip(text: "local", tone: .warning, systemImage: "iphone")
            .accessibilityLabel("Changed on this phone only")
    }
}
