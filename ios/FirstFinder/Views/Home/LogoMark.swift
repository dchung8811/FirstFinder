import SwiftUI

// The FirstFinder mark: public/firstfinder-mark-exact.png, the same image the
// web's header, footer and share cards use, bundled as an asset. The web
// draws it in a rounded square (rounded-xl at 40pt); so does this.
struct LogoMark: View {
    var size: CGFloat = 32

    var body: some View {
        Image("LogoMark")
            .resizable()
            .interpolation(.high)
            .aspectRatio(contentMode: .fill)
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.3, style: .continuous))
            .accessibilityHidden(true)
    }
}
