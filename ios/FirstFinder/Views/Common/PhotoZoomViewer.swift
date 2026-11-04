import SwiftUI

// A photo full screen, for reading a number line or checking a receipt:
// pinch or double-tap to zoom, drag to look around, swipe between photos.
// Swiping is off while zoomed in, so a drag across a zoomed copyright page
// moves the page instead of jumping to the next photo. The images come from
// SignedPhoto, so opening this fetches and keeps nothing new.
struct PhotoZoomViewer: View {
    struct Page: Identifiable {
        let photo: Photo
        let label: String
        var id: String { photo.path }
    }

    // Which photo to open on, for `.fullScreenCover(item:)`.
    struct Start: Identifiable {
        let index: Int
        var id: Int { index }
    }

    let pages: [Page]
    @State private var selection: Int
    @State private var zoomed = false
    @Environment(\.dismiss) private var dismiss

    init(pages: [Page], start: Int) {
        self.pages = pages
        _selection = State(initialValue: min(max(start, 0), max(pages.count - 1, 0)))
    }

    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()
            TabView(selection: $selection) {
                ForEach(Array(pages.enumerated()), id: \.element.id) { index, page in
                    ZoomablePhoto(photo: page.photo, isCurrent: index == selection) { isZoomed in
                        if index == selection { zoomed = isZoomed }
                    }
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: pages.count > 1 && !zoomed ? .always : .never))
            .scrollDisabled(zoomed)
            .ignoresSafeArea()
            .onChange(of: selection) { zoomed = false }

            header
        }
    }

    private var header: some View {
        HStack(alignment: .center) {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(Color.black.opacity(0.55), in: Circle())
            }
            .accessibilityLabel("Close full-screen photo")
            Spacer()
            if let page = pages[safe: selection] {
                VStack(spacing: 2) {
                    Text(page.label).font(.subheadline.weight(.semibold))
                    if pages.count > 1 {
                        Text("\(selection + 1) of \(pages.count)").font(.caption).monospacedDigit()
                    }
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(Color.black.opacity(0.55), in: Capsule())
                .accessibilityElement(children: .combine)
            }
            Spacer()
            // Balances the close button so the label sits centered.
            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}

// One page of the viewer. Zoom is a scale and an offset on the fitted photo;
// the photo's own size (not its frame) bounds the offset, so a wide photo on
// a tall screen can't be dragged off into the letterbox.
private struct ZoomablePhoto: View {
    let photo: Photo
    let isCurrent: Bool
    let onZoomChange: (Bool) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var imageSize: CGSize?
    @State private var scale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var pinchStart: (scale: CGFloat, offset: CGSize)?
    @State private var lastDrag: CGSize?

    private static let maxScale: CGFloat = 5
    private static let doubleTapScale: CGFloat = 2.5

    var body: some View {
        GeometryReader { geo in
            let size = geo.size
            SignedPhoto(path: photo.path, contentMode: .fit, accessibilityLabel: photo.name, missingLabel: "Photo didn't load", onImageSize: { imageSize = $0 })
                .frame(width: size.width, height: size.height)
                .scaleEffect(scale)
                .offset(offset)
                .frame(width: size.width, height: size.height)
                .contentShape(Rectangle())
                .clipped()
                .gesture(pinch(in: size))
                // Off until zoomed in, so a one-finger swipe still reaches the
                // pager. `.subviews` keeps the pinch above working.
                .simultaneousGesture(pan(in: size), including: scale > 1 ? .all : .subviews)
                .onTapGesture(count: 2) { location in
                    if scale > 1 {
                        settle(to: 1, offset: .zero)
                    } else {
                        zoom(to: Self.doubleTapScale, at: location, in: size)
                    }
                }
                .accessibilityZoomAction { action in
                    let center = CGPoint(x: size.width / 2, y: size.height / 2)
                    switch action.direction {
                    case .zoomIn: zoom(to: min(scale * 2, Self.maxScale), at: center, in: size)
                    case .zoomOut: scale / 2 <= 1 ? settle(to: 1, offset: .zero) : zoom(to: scale / 2, at: center, in: size)
                    @unknown default: break
                    }
                }
        }
        .onChange(of: scale > 1) { _, isZoomed in onZoomChange(isZoomed) }
        .onChange(of: isCurrent) { _, current in
            if !current {
                scale = 1
                offset = .zero
            }
        }
    }

    private func pinch(in size: CGSize) -> some Gesture {
        MagnifyGesture()
            .onChanged { value in
                let start = pinchStart ?? (scale, offset)
                if pinchStart == nil { pinchStart = start }
                // A little past either limit while pinching, then it settles
                // back -- the stretch says "that's as far as it goes".
                let next = min(max(start.scale * value.magnification, 0.8), Self.maxScale * 1.15)
                offset = Self.anchored(point(value.startLocation, in: size), from: start.offset, ratio: next / start.scale)
                scale = next
            }
            .onEnded { _ in
                pinchStart = nil
                let target = min(max(scale, 1), Self.maxScale)
                settle(to: target, offset: target <= 1 ? .zero : clamp(offset, scale: target, in: size))
            }
    }

    // Moves by the change since the last event rather than the total since
    // the drag began, so lifting one finger out of a pinch doesn't jump.
    private func pan(in size: CGSize) -> some Gesture {
        DragGesture()
            .onChanged { value in
                defer { lastDrag = value.translation }
                guard pinchStart == nil, let last = lastDrag else { return }
                let moved = CGSize(width: offset.width + value.translation.width - last.width,
                                   height: offset.height + value.translation.height - last.height)
                offset = clamp(moved, scale: scale, in: size)
            }
            .onEnded { _ in lastDrag = nil }
    }

    // Zooms so the point under the finger stays under the finger.
    private func zoom(to target: CGFloat, at location: CGPoint, in size: CGSize) {
        let next = Self.anchored(point(location, in: size), from: offset, ratio: target / scale)
        settle(to: target, offset: clamp(next, scale: target, in: size))
    }

    private func settle(to target: CGFloat, offset next: CGSize) {
        withAnimation(reduceMotion ? nil : .spring(duration: 0.3)) {
            scale = target
            offset = next
        }
    }

    // A location in the frame, measured from its center -- where scaleEffect
    // scales from.
    private func point(_ location: CGPoint, in size: CGSize) -> CGPoint {
        CGPoint(x: location.x - size.width / 2, y: location.y - size.height / 2)
    }

    // A photo point shown at p = c * s + o stays at p when s changes by
    // `ratio` if the offset becomes p - (p - o) * ratio.
    private static func anchored(_ p: CGPoint, from o: CGSize, ratio: CGFloat) -> CGSize {
        CGSize(width: p.x - (p.x - o.width) * ratio, height: p.y - (p.y - o.height) * ratio)
    }

    private func clamp(_ proposed: CGSize, scale: CGFloat, in size: CGSize) -> CGSize {
        let fitted = fittedSize(in: size)
        let maxX = max(0, (fitted.width * scale - size.width) / 2)
        let maxY = max(0, (fitted.height * scale - size.height) / 2)
        return CGSize(width: min(max(proposed.width, -maxX), maxX), height: min(max(proposed.height, -maxY), maxY))
    }

    // The photo's on-screen size at scale 1. Until the image is in (or for
    // a sample cover, which has none), the frame stands in.
    private func fittedSize(in size: CGSize) -> CGSize {
        guard let image = imageSize, image.width > 0, image.height > 0 else { return size }
        let ratio = min(size.width / image.width, size.height / image.height)
        return CGSize(width: image.width * ratio, height: image.height * ratio)
    }
}
