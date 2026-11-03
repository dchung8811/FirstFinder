import SwiftUI

// CollectionCard from app/InventoryApp.jsx. The photo leads and the photo is
// the control; the ledger rows collapse to nothing on an item with no numbers
// yet; Delete sits with the other actions, never floating over the photo.
struct CollectionCard: View {
    struct Actions {
        var viewPhotos: (Item, PhotoViewerRequest.Kind) -> Void
        var edit: (Item) -> Void
        var markSold: (Item) -> Void
        var restore: (Item) -> Void
        var askToDelete: (Item) -> Void
    }

    let entry: Item
    var highlighted = false
    let actions: Actions

    @Environment(AppModel.self) private var app

    private var title: String { entry.name.isEmpty ? "Untitled item" : entry.name }
    private var totalPhotos: Int { entry.itemPhotoCount + entry.receiptPhotoCount }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            cover
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline) {
                    Text(title)
                        .font(.display(24, relativeTo: .title2).weight(.semibold))
                        .foregroundStyle(Theme.ink)
                    Spacer(minLength: 8)
                    if let reference = entry.referenceNumber {
                        Text(Format.reference(reference))
                            .font(.ledger(12, relativeTo: .caption))
                            .foregroundStyle(Theme.brownMuted)
                            .accessibilityLabel("Reference \(Format.reference(reference))")
                    }
                }
                let credit = ItemsLogic.credit(entry)
                Text(credit.isEmpty ? "Unknown maker" : credit).foregroundStyle(Theme.brown).padding(.top, 2)

                chips.padding(.top, 12)
                ledger.padding(.top, 18)
                similarCopies
                buttons.padding(.top, 18)
            }
            .padding(22)
        }
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .strokeBorder(highlighted ? Theme.green : Theme.border, lineWidth: highlighted ? 2 : 1)
        )
    }

    @ViewBuilder private var cover: some View {
        if let photo = entry.itemPhotos.first {
            Button { actions.viewPhotos(entry, .all) } label: {
                ZStack {
                    Theme.chip
                    SignedPhoto(path: photo.path, accessibilityLabel: title)
                }
                .frame(height: 224)
                .frame(maxWidth: .infinity)
                .clipped()
                // clipped() trims only what's drawn. Without this, a tall
                // photo's overflow stayed tappable and swallowed taps on the
                // card above -- "Mark sold" there opened this item's photos.
                .contentShape(Rectangle())
                .overlay(alignment: .topTrailing) {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                        .font(.footnote)
                        .foregroundStyle(Theme.ink)
                        .frame(width: 36, height: 36)
                        .background(Theme.surface.opacity(0.9), in: Circle())
                        .padding(12)
                }
                .overlay(alignment: .bottomTrailing) {
                    if totalPhotos > 1 {
                        HStack(spacing: 5) {
                            Image(systemName: "photo.on.rectangle")
                            Text("View \(totalPhotos) photos ›")
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.green)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Theme.surface.opacity(0.95), in: Capsule())
                        .padding(12)
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("View photos of \(title)")
        } else {
            // Not a button: nothing to open, and a control that does nothing
            // is worse than an honest blank.
            Text("No photo yet")
                .font(.subheadline)
                .foregroundStyle(Theme.brownMuted)
                .frame(maxWidth: .infinity)
                .frame(height: 224)
                .background(Theme.chip)
        }
    }

    private var chips: some View {
        let edition = PublicCollection.editionLine(category: entry.category, edition: entry.edition, bookEdition: entry.bookEdition, bookPrinting: entry.bookPrinting)
        return FlowLayout(spacing: 8) {
            if !edition.isEmpty { Chip(text: edition, tone: .tint) }
            if !entry.condition.isEmpty { Chip(text: entry.condition) }
            if !entry.bookGenre.isEmpty { Chip(text: entry.bookGenre) }
            // Only when it isn't the ordinary case.
            if entry.status != "Owned" { Chip(text: entry.status, tone: .warning) }
            if entry.bookGenre.isEmpty, !entry.category.isEmpty, entry.category != "Book" { Chip(text: entry.category) }
            if entry.receiptPhotoCount > 0 {
                Button { actions.viewPhotos(entry, .receipt) } label: {
                    Chip(text: entry.receiptPhotoCount == 1 ? "Receipt on file" : "\(entry.receiptPhotoCount) receipts on file", tone: .tint, systemImage: "receipt")
                        .underline()
                }
                .buttonStyle(.plain)
                .accessibilityLabel("View the receipt for \(title)")
            }
            if entry.hiddenFromShare { Chip(text: "Hidden from your page", systemImage: "eye.slash") }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var ledger: some View {
        VStack(alignment: .leading, spacing: 8) {
            if ItemsLogic.hasEstimate(entry) { DetailRow(label: "Est. value", value: ItemsLogic.formatEstimatedValue(entry)) }
            if Format.hasValue(entry.purchasePrice) { DetailRow(label: "Paid", value: Format.currency(entry.purchasePrice)) }
            if let gain = ItemsLogic.gain(entry) { DetailRow(label: "Change", value: ItemsLogic.formatGain(gain)) }
            if entry.status == "Sold", let sold = entry.soldPrice {
                DetailRow(label: "Sold for", value: Format.currency(sold) + (entry.soldDate.isEmpty ? "" : " · \(entry.soldDate)"))
            }
            if !entry.purchaseDate.isEmpty { DetailRow(label: "Acquired", value: entry.purchaseDate) }
            if !entry.source.isEmpty { DetailRow(label: "Source", value: entry.source) }
            if !entry.notes.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Divider().overlay(Theme.adaptive(0xeadfcd, dark: 0x665746))
                    Text("NOTES").font(.caption).tracking(1.5).foregroundStyle(Theme.brownMuted)
                    Text(entry.notes).font(.subheadline).foregroundStyle(Theme.adaptive(0x3f352a, dark: 0xfff7ea))
                }
            }
        }
    }

    @ViewBuilder private var similarCopies: some View {
        if let links = ItemsLogic.similarCopyLinks(entry) {
            VStack(alignment: .leading, spacing: 0) {
                Divider().overlay(Theme.adaptive(0xeadfcd, dark: 0x665746)).padding(.top, 14)
                HStack(spacing: 10) {
                    Text("Find similar copies:").foregroundStyle(Theme.brownSoft)
                    Link("AbeBooks", destination: links.abebooks).fontWeight(.medium).underline()
                    Link("eBay", destination: links.ebay).fontWeight(.medium).underline()
                }
                .font(.caption)
                .foregroundStyle(Theme.green)
                .padding(.top, 10)
            }
        }
    }

    private var buttons: some View {
        HStack(spacing: 8) {
            Button("Edit") { actions.edit(entry) }.buttonStyle(.ffSecondary)
            if entry.status == "Sold" {
                Button("Restore") { actions.restore(entry) }.buttonStyle(.ffSecondary)
            } else {
                Button("Mark sold") { actions.markSold(entry) }.buttonStyle(.ffSecondary)
            }
            Spacer()
            Button { actions.askToDelete(entry) } label: {
                Image(systemName: "trash")
                    .foregroundStyle(Theme.brown)
                    .frame(width: 44, height: 44)
                    .background(Theme.chip, in: Circle())
            }
            .accessibilityLabel("Delete \(title)")
        }
    }
}

// The shared card's ledger row: label left, figure right, hairline above.
struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 6) {
            Divider().overlay(Theme.adaptive(0xeadfcd, dark: 0x665746))
            HStack(alignment: .firstTextBaseline) {
                Text(label.uppercased()).font(.caption).tracking(1.4).foregroundStyle(Theme.brownMuted)
                Spacer()
                Text(value)
                    .font(.ledger(14, relativeTo: .subheadline).weight(.medium))
                    .foregroundStyle(Theme.adaptive(0x3f352a, dark: 0xfff7ea))
                    .multilineTextAlignment(.trailing)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

// A tile: the cover and nothing else, Explore's search grid brought home.
// An unphotographed item gets the jacket /explore draws.
struct CollectionTile: View {
    let entry: Item
    var highlighted = false
    @Environment(AppModel.self) private var app

    var body: some View {
        let label = entry.name.isEmpty ? "Untitled item" : entry.name
        let credit = ItemsLogic.credit(entry)
        VStack(alignment: .leading, spacing: 2) {
            // The 3:4 frame comes from an empty shape and the photo is laid
            // over it. Inside a ZStack, a filling landscape photo set the
            // stack's own width and spilled out across the next column.
            Color.clear
                .aspectRatio(3 / 4, contentMode: .fit)
                .frame(maxWidth: .infinity)
                .overlay {
                    if let photo = entry.itemPhotos.first {
                        ZStack {
                            Theme.pill
                            SignedPhoto(path: photo.path)
                        }
                    } else {
                        jacket(label: label, credit: credit)
                    }
                }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(highlighted ? Theme.green : Theme.border, lineWidth: highlighted ? 2 : 1)
            )
            .padding(.bottom, 6)
            Text(label).font(.subheadline.weight(.medium)).foregroundStyle(Theme.ink).lineLimit(1)
            Text(credit.isEmpty ? "Unknown maker" : credit).font(.caption).foregroundStyle(Theme.brownSoft).lineLimit(1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }

    private func jacket(label: String, credit: String) -> some View {
        let tone = ExploreLogic.jacketTones[ExploreLogic.jacketToneIndex(entry.id)]
        return VStack(alignment: .leading) {
            Text(label).font(.display(13, relativeTo: .footnote).weight(.semibold)).lineLimit(5)
            Spacer(minLength: 2)
            if !credit.isEmpty {
                Text(credit.uppercased()).font(.system(size: 9)).tracking(1.2).lineLimit(2).opacity(0.75)
            }
        }
        .foregroundStyle(Theme.adaptive(0xfff7ea, dark: 0xfff7ea))
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(UIColor(hex: tone)))
    }
}
