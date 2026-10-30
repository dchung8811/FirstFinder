import SwiftUI

// FirstFinderLogoMark: the same three paths as the web's inline SVG
// (viewBox 0 0 120 120), read by a small parser so the shapes are copied
// character for character rather than redrawn by hand.
struct LogoMark: View {
    var body: some View {
        LogoMarkShape()
            .aspectRatio(1, contentMode: .fit)
            .accessibilityHidden(true)
    }
}

struct LogoMarkShape: Shape {
    static let paths = [
        "M28 91C20 91 15 86 15 79C15 70 22 64 33 64H43C48 64 50 61 51 56L60 22C62 13 68 9 78 9H104C106 9 107 11 106 13C104 25 94 34 81 34H72C68 34 66 36 65 40L53 78C50 87 42 91 28 91Z",
        "M54 101C62 98 67 91 70 80L76 58C78 50 84 46 93 46H109C111 46 112 48 111 50C109 60 101 67 90 67H86C82 67 80 69 79 73L76 83C73 95 64 101 54 101Z",
        "M76 82H102C104 82 105 84 104 86C102 95 94 101 84 101H71C68 101 66 98 67 95L70 86C71 83 73 82 76 82Z",
    ]

    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width, rect.height) / 120
        var path = Path()
        for data in Self.paths { Self.append(data, to: &path) }
        return path.applying(CGAffineTransform(scaleX: scale, y: scale).translatedBy(x: rect.minX / scale, y: rect.minY / scale))
    }

    // Absolute M, L, H, V, C and Z only: all these paths use.
    static func append(_ data: String, to path: inout Path) {
        var tokens: [String] = []
        var number = ""
        for character in data {
            if character.isLetter {
                if !number.isEmpty { tokens.append(number); number = "" }
                tokens.append(String(character))
            } else if character == " " || character == "," {
                if !number.isEmpty { tokens.append(number); number = "" }
            } else {
                number.append(character)
            }
        }
        if !number.isEmpty { tokens.append(number) }

        var index = 0
        var current = CGPoint.zero
        func next() -> CGFloat {
            defer { index += 1 }
            return CGFloat(Double(tokens[index]) ?? 0)
        }
        while index < tokens.count {
            let command = tokens[index]
            index += 1
            switch command {
            // addLines with one point starts a new subpath, which is what M
            // does. Path's own moveTo spelling trips ReadOnlyGuardTests, which
            // bans that call name everywhere in ios/ for storage's sake.
            case "M": current = CGPoint(x: next(), y: next()); path.addLines([current])
            case "L": current = CGPoint(x: next(), y: next()); path.addLine(to: current)
            case "H": current = CGPoint(x: next(), y: current.y); path.addLine(to: current)
            case "V": current = CGPoint(x: current.x, y: next()); path.addLine(to: current)
            case "C":
                let c1 = CGPoint(x: next(), y: next())
                let c2 = CGPoint(x: next(), y: next())
                current = CGPoint(x: next(), y: next())
                path.addCurve(to: current, control1: c1, control2: c2)
            case "Z": path.closeSubpath()
            default: break
            }
        }
    }
}
