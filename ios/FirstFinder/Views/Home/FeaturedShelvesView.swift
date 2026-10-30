import SwiftUI

// FeaturedShelves from app/InventoryApp.jsx: books from a few real shelves on
// Explore, drifting past under the hero. The quickest proof of what the
// headline promises: other collectors' actual books.
struct FeaturedShelvesView: View {
    // nil while loading; [] when there is nothing to show, which hides the
    // whole section, as on the web.
    let shelves: [FeaturedShelf]?
    let onOpen: (WebRoute) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var covers: [ShelfStripCover] { ExploreLogic.interleave(shelves ?? []) }

    var body: some View {
        if shelves != nil, covers.isEmpty {
            EmptyView()
        } else {
            VStack(spacing: 24) {
                // Enforced, not aspirational: a shelf appears only once its
                // owner listed their page and switched on Explore.
                Text("From real shelves on Explore, shared by the collectors who own them.")
                    .font(.ledger(12, relativeTo: .caption))
                    .foregroundStyle(Theme.brownMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)

                if shelves == nil {
                    LoadingCovers()
                } else if covers.count >= ShelfDrift.minToMove, !reduceMotion {
                    ShelfMarquee(covers: covers) { onOpen(.sharedItem(slug: $0.shelfSlug, itemId: $0.cover.id)) }
                } else {
                    // Reduce Motion, or too few books to make a strip: an
                    // ordinary row the reader scrolls themselves.
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: ShelfMarquee.gap) {
                            ForEach(covers) { cover in
                                Button { onOpen(.sharedItem(slug: cover.shelfSlug, itemId: cover.cover.id)) } label: {
                                    ShelfCover(cover: cover)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 24)
                    }
                }

                if let shelves {
                    ShelfChips(shelves: shelves) { onOpen(.sharedCollection(slug: $0.slug)) }
                        .padding(.horizontal, 16)
                }
            }
        }
    }
}

// The strip itself. Driven frame by frame rather than by an animation because
// a reader can grab it: a drag moves it with the finger, a fling carries on
// under its own momentum, and either way it eases back into the drift. The
// physics is ShelfDrift, ported from src/utils/shelfDrift.js.
struct ShelfMarquee: View {
    let covers: [ShelfStripCover]
    let onOpen: (ShelfStripCover) -> Void

    static let coverWidth: CGFloat = 144
    static let gap: CGFloat = 16

    @State private var motion = MarqueeMotion()

    // Short strips repeat until one loop is wider than a screen.
    private var loop: [ShelfStripCover] {
        let repeats = Int((Double(ShelfDrift.minCovers) / Double(covers.count)).rounded(.up))
        return Array(repeating: covers, count: max(1, repeats)).flatMap { $0 }
    }

    // Each half is n covers, each followed by one gap, as the web's
    // "flex gap-4 pr-4" halves are.
    private var span: Double { Double(loop.count) * Double(Self.coverWidth + Self.gap) }

    private var cruise: Double {
        span > 0 ? -span / (Double(loop.count) * ShelfDrift.secondsPerCover) : 0
    }

    // The cover, the gap under it, two lines of text and room for the shadow.
    static let stripHeight: CGFloat = coverWidth * 4 / 3 + 72

    var body: some View {
        // The track is several screens wide. Drawn in an overlay on a
        // fixed-height slot, it can't widen the page around it -- the native
        // version of the web's overflow-hidden on the hero.
        Color.clear
            .frame(maxWidth: .infinity)
            .frame(height: Self.stripHeight)
            .overlay(alignment: .topLeading) { strip }
            .clipped()
            .mask {
                LinearGradient(
                    stops: [.init(color: .clear, location: 0), .init(color: .black, location: 0.05), .init(color: .black, location: 0.95), .init(color: .clear, location: 1)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            }
            .simultaneousGesture(
                DragGesture(minimumDistance: ShelfDrift.dragThreshold)
                    .onChanged { value in motion.drag(value, span: span) }
                    .onEnded { value in motion.release(value) }
            )
            // The moving strip is out of VoiceOver's way, as it is out of the
            // web's tab order: the shelf list below reaches every shelf once.
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Books from featured shelves, moving slowly")
            .accessibilityHint("Each shelf is listed below.")
    }

    private var strip: some View {
        TimelineView(.animation) { context in
            let offset = motion.advance(to: context.date, span: span, cruise: cruise)
            HStack(spacing: 0) {
                ForEach(0..<2, id: \.self) { half in
                    ForEach(Array(loop.enumerated()), id: \.offset) { _, cover in
                        ShelfCover(cover: cover)
                            .padding(.trailing, Self.gap)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                // A drag ends over whichever cover it started
                                // on; that is not a tap on it.
                                guard !motion.justDragged(at: Date()) else { return }
                                onOpen(cover)
                            }
                    }
                    .accessibilityHidden(half == 1)
                }
            }
            .fixedSize()
            .offset(x: offset)
            .padding(.top, 4)
        }
    }
}

// The strip's position, kept in a plain class rather than in state: sixty
// updates a second must not re-render anything but the TimelineView frame.
@MainActor
final class MarqueeMotion {
    private var state = ShelfDrift.State(offset: 0, velocity: .nan)
    private var lastFrame: Date?
    private var hold: Hold?
    private var releasedAt: Date?

    private struct Hold {
        var startOffset: Double
        var horizontal: Bool
        var samples: [ShelfDrift.Sample]
    }

    func advance(to now: Date, span: Double, cruise: Double) -> Double {
        let dt = lastFrame.map { min(now.timeIntervalSince($0), ShelfDrift.maxFrameSeconds) } ?? 0
        lastFrame = now
        if state.velocity.isNaN { state.velocity = cruise }
        // Held, the strip stays where the finger has it.
        if hold == nil {
            state = ShelfDrift.step(state, cruise: cruise, dt: dt, span: span)
        }
        return state.offset
    }

    func drag(_ value: DragGesture.Value, span: Double) {
        if hold == nil {
            // A mostly vertical swipe is the page scrolling, not the strip.
            let horizontal = abs(value.translation.width) >= abs(value.translation.height)
            hold = Hold(startOffset: state.offset, horizontal: horizontal, samples: [])
        }
        guard var current = hold, current.horizontal else { return }
        state.offset = ShelfDrift.wrap(current.startOffset + value.translation.width, span: span)
        current.samples.append(.init(t: value.time.timeIntervalSince1970 * 1000, x: value.location.x))
        if current.samples.count > 32 { current.samples.removeFirst() }
        hold = current
    }

    func release(_ value: DragGesture.Value) {
        guard let current = hold else { return }
        if current.horizontal {
            state.velocity = ShelfDrift.releaseVelocity(current.samples, releasedAt: value.time.timeIntervalSince1970 * 1000)
            releasedAt = Date()
        }
        hold = nil
    }

    func justDragged(at now: Date) -> Bool {
        hold?.horizontal == true || (releasedAt.map { now.timeIntervalSince($0) < 0.35 } ?? false)
    }
}

// ShelfCover: a 3:4 cover with its title and the shelf it's from.
struct ShelfCover: View {
    let cover: ShelfStripCover

    var body: some View {
        let label = (cover.cover.name ?? "").isEmpty ? "Untitled item" : cover.cover.name!
        VStack(alignment: .leading, spacing: 2) {
            CoverImage(cover: cover.cover, label: label)
                .frame(width: ShelfMarquee.coverWidth, height: ShelfMarquee.coverWidth * 4 / 3)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.adaptive(0xd3c1a4, dark: 0x665746)))
                .shadow(color: Color(red: 48 / 255, green: 36 / 255, blue: 20 / 255).opacity(0.35), radius: 12, y: 10)
                .padding(.bottom, 6)
            Text(label)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
            Text("from \(cover.shelfTitle)")
                .font(.caption)
                .foregroundStyle(Theme.brownMuted)
                .lineLimit(1)
        }
        .frame(width: ShelfMarquee.coverWidth, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }
}

// The photo if there is one; otherwise the same cloth jacket /explore draws
// for an unphotographed book. A photo that fails to load falls back to the
// jacket too, rather than a broken image.
struct CoverImage: View {
    let cover: FeaturedShelf.Cover
    let label: String

    @State private var image: UIImage?
    @State private var failed = false

    private var url: URL? { cover.photoUrl.flatMap(URL.init(string:)) }

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
            } else if let url, url.scheme == SampleStore.photoScheme {
                SamplePlaceholderCover(seed: cover.id)
            } else if url != nil, !failed {
                Theme.adaptive(0xefe4d2, dark: 0x3f352a)
            } else {
                jacket
            }
        }
        .task(id: cover.photoUrl) {
            guard let url, url.scheme != SampleStore.photoScheme else { return }
            if let loaded = await ImageLoader.shared.image(for: url, cacheKey: url.absoluteString) {
                image = loaded
            } else {
                failed = true
            }
        }
    }

    private var jacket: some View {
        let tone = ExploreLogic.jacketTones[ExploreLogic.jacketToneIndex(cover.id)]
        let credit = ExploreLogic.credit(category: cover.category, author: cover.author, maker: cover.maker)
        return VStack(alignment: .leading) {
            Text(label)
                .font(.display(14, relativeTo: .footnote).weight(.semibold))
                .lineLimit(5)
            Spacer(minLength: 4)
            if !credit.isEmpty {
                Text(credit.uppercased())
                    .font(.system(size: 10))
                    .tracking(1.4)
                    .lineLimit(2)
                    .opacity(0.75)
            }
        }
        .foregroundStyle(Theme.adaptive(0xfff7ea, dark: 0xfff7ea))
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(UIColor(hex: tone)))
    }
}

private struct LoadingCovers: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dim = false

    var body: some View {
        Color.clear
            .frame(maxWidth: .infinity)
            .frame(height: ShelfMarquee.stripHeight)
            .overlay(alignment: .top) {
                HStack(spacing: ShelfMarquee.gap) {
                    ForEach(0..<10, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(Theme.adaptive(0xefe4d2, dark: 0x3f352a))
                            .frame(width: ShelfMarquee.coverWidth, height: ShelfMarquee.coverWidth * 4 / 3)
                    }
                }
                .fixedSize()
                .padding(.top, 4)
            }
            .clipped()
        .opacity(dim ? 0.55 : 1)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: true)) { dim = true }
        }
        .accessibilityLabel("Loading featured shelves")
    }
}

// The shelves the strip came from, each a link to its page.
private struct ShelfChips: View {
    let shelves: [FeaturedShelf]
    let onOpen: (FeaturedShelf) -> Void

    var body: some View {
        FlowLayout(spacing: 12) {
            ForEach(shelves) { shelf in
                Button { onOpen(shelf) } label: {
                    HStack(spacing: 10) {
                        Text(ExploreLogic.monogram(shelf.title))
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.adaptive(0xfff7ea, dark: 0xfff7ea))
                            .frame(width: 28, height: 28)
                            .background(Theme.adaptive(0x123f38, dark: 0x123f38), in: Circle())
                            .accessibilityHidden(true)
                        Text(shelf.title).font(.subheadline.weight(.medium)).foregroundStyle(Theme.ink)
                        Text("\(shelf.itemCount) \(shelf.itemCount == 1 ? "item" : "items")")
                            .font(.subheadline)
                            .foregroundStyle(Theme.brownMuted)
                    }
                    .padding(.leading, 4)
                    .padding(.trailing, 14)
                    .padding(.vertical, 4)
                    .background(Theme.surfaceRaised, in: Capsule())
                    .overlay(Capsule().strokeBorder(Theme.adaptive(0xd3c1a4, dark: 0x665746)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(shelf.title), \(shelf.itemCount) \(shelf.itemCount == 1 ? "item" : "items")")
            }
        }
    }
}

// Wraps its children onto centred rows, like the web's flex-wrap.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(subviews, width: proposal.width ?? .infinity)
        let height = rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(0, rows.count - 1))
        let width = rows.map(\.width).max() ?? 0
        return CGSize(width: proposal.width ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(subviews, width: bounds.width) {
            var x = bounds.minX + (bounds.width - row.width) / 2
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y + (row.height - size.height) / 2), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(_ subviews: Subviews, width: CGFloat) -> [Row] {
        var rows: [Row] = []
        var current = Row()
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let needed = current.indices.isEmpty ? size.width : current.width + spacing + size.width
            if needed > width, !current.indices.isEmpty {
                rows.append(current)
                current = Row()
            }
            current.width = current.indices.isEmpty ? size.width : current.width + spacing + size.width
            current.height = max(current.height, size.height)
            current.indices.append(index)
        }
        if !current.indices.isEmpty { rows.append(current) }
        return rows
    }
}
