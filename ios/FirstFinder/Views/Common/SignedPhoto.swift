import SwiftUI

// SignedPhoto from app/InventoryApp.jsx: an image from a private storage path.
// Its one hard rule is that it never shows a broken image. A path that won't
// sign, or bytes that won't load, hide the image -- the caller decides what
// stands in its place (usually nothing, or the card's plain header).
struct SignedPhoto: View {
    let path: String
    var contentMode: ContentMode = .fill
    var accessibilityLabel: String = ""
    // Said in the frame when the photo can't be shown. Without one, nothing
    // is drawn. Either way, never a broken image.
    var missingLabel: String?
    // Told the pixel size once the image is in, for a caller that lays out
    // around the photo itself rather than its frame (the zoom viewer).
    var onImageSize: ((CGSize) -> Void)?

    @Environment(AppModel.self) private var app
    @State private var image: UIImage?
    @State private var loadFailed = false

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
                    .accessibilityLabel(accessibilityLabel)
            } else if path.hasPrefix(PendingPhotos.prefix) {
                Color.clear
            } else if case .signed(let url) = app.photos.state(for: path), url.scheme == SampleStore.photoScheme {
                SamplePlaceholderCover(seed: path)
                    .accessibilityLabel(accessibilityLabel)
            } else if !loadFailed, app.photos.state(for: path) != .failed {
                // Waiting to be signed, or signed and still downloading.
                Rectangle().fill(Theme.chip).overlay(ProgressView().tint(Theme.brownSoft))
                    .accessibilityLabel("Loading photo")
            } else if let missingLabel {
                MissingPhotoLabel(text: missingLabel)
            } else {
                // Failed to sign or to load: nothing to see. Color.clear, not
                // EmptyView: a Group holding only EmptyView isn't on screen,
                // so SwiftUI cancels the task below and never starts the next
                // one. That left every collection tile blank once its photo
                // was signed, before the download had even begun.
                Color.clear
            }
        }
        .task(id: taskKey) { await load() }
        .onChange(of: image?.size) { _, size in
            if let size { onImageSize?(size) }
        }
    }

    private var taskKey: String {
        switch app.photos.state(for: path) {
        case .signed(let url): url.absoluteString
        case .pending: "pending:" + path
        case .failed: "failed:" + path
        }
    }

    private func load() async {
        if path.hasPrefix(PendingPhotos.prefix) {
            image = app.pendingPhotos.bytes[path].flatMap(UIImage.init(data:))
            return
        }
        switch app.photos.state(for: path) {
        case .pending:
            app.photos.request([path])
        case .signed(let url):
            guard url.scheme != SampleStore.photoScheme else { return }
            if let loaded = await ImageLoader.shared.image(for: url, cacheKey: path) {
                image = loaded
            } else if !Task.isCancelled {
                // A cancelled download isn't a failed one: the view went away
                // or its URL changed, and whoever replaces it loads again.
                loadFailed = true
            }
        case .failed:
            break
        }
    }
}

// The sample covers: a cloth-bound spine in palette colors, picked from the
// path so each sample item keeps the same cover between launches.
struct SamplePlaceholderCover: View {
    let seed: String
    @Environment(AppModel.self) private var app

    private var palette: (Color, Color) {
        let options: [(Color, Color)] = [
            (Theme.adaptive(0x123f38, dark: 0x123f38), Theme.adaptive(0xfff7ea, dark: 0xfff7ea)),
            (Theme.adaptive(0x665746, dark: 0x665746), Theme.adaptive(0xf0e2cf, dark: 0xf0e2cf)),
            (Theme.adaptive(0x0f332d, dark: 0x0f332d), Theme.adaptive(0xd8c7ad, dark: 0xd8c7ad)),
            (Theme.adaptive(0x8a7a64, dark: 0x8a7a64), Theme.adaptive(0xfff9f0, dark: 0xfff9f0)),
            (Theme.adaptive(0x7d6c5a, dark: 0x7d6c5a), Theme.adaptive(0xedf4f2, dark: 0xedf4f2)),
        ]
        let index = seed.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) & 0x7fffffff } % options.count
        return options[index]
    }

    var body: some View {
        let (cloth, ink) = palette
        ZStack {
            cloth
            VStack(spacing: 6) {
                Rectangle().fill(ink.opacity(0.7)).frame(height: 2)
                Image(systemName: seed.contains("receipt") ? "receipt" : "book.closed")
                    .font(.system(size: 22, weight: .light))
                    .foregroundStyle(ink)
                // Labelled so a demo can't pass for a real shelf -- except in
                // App Store screenshots, where the label would be noise.
                if !app.screenshotMode {
                    Text("SAMPLE")
                        .font(.ledger(9, relativeTo: .caption2))
                        .tracking(2)
                        .foregroundStyle(ink.opacity(0.8))
                }
                Rectangle().fill(ink.opacity(0.7)).frame(height: 2)
            }
            .padding(.horizontal, 18)
        }
    }
}
