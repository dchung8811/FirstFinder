import SwiftUI

// The identification being reviewed: the editable item, the photos it was
// read from, and everything the research came back with.
struct IdentifyDraft: Equatable {
    var form: ItemDraft
    var photos: [Photo]
    var result: PhotoAI.IdentifyResult

    var valueRange: (low: Double, high: Double)? { ItemsLogic.valueRange(low: result.estimatedValueLow, high: result.estimatedValueHigh) }
    var firstEditionRange: (low: Double, high: Double)? { ItemsLogic.valueRange(low: result.firstEditionLow, high: result.firstEditionHigh) }

    init(result: PhotoAI.IdentifyResult, photos: [Photo]) {
        self.result = result
        self.photos = photos
        form = ItemDraft()
        apply(result)
        // AI results never prefill purchase price, and neither range fills the
        // estimate: only the collector knows what they paid.
        form.paidText = ""
        form.valueText = ""
        form.purchaseDate = Date()
    }

    // identifiedFields: the fields the research replaces on a re-check. What
    // the collector typed -- paid, date, source, notes -- is left alone.
    mutating func apply(_ result: PhotoAI.IdentifyResult) {
        self.result = result
        let category = result.category.isEmpty ? "Book" : result.category
        let authored = ItemsLogic.usesAuthorField(category)
        form.item.name = result.title
        form.item.author = authored ? result.author : ""
        form.item.maker = authored ? "" : result.author
        form.item.category = category
        form.item.bookGenre = result.genre
        form.item.bookEdition = result.edition
        form.item.bookPrinting = result.printing
        form.item.condition = result.condition
    }

    static func == (lhs: IdentifyDraft, rhs: IdentifyDraft) -> Bool {
        lhs.form == rhs.form && lhs.photos == rhs.photos && lhs.result == rhs.result
    }
}

// IdentifyReviewPage: "Is this right?" Everything read from the photo, every
// field editable, the value ranges and comparables beside it, nothing saved
// until submit.
struct IdentifyReviewPage: View {
    @Binding var draft: IdentifyDraft
    let onSaved: (ItemDraft, @escaping () -> Void) -> Void
    let onDiscard: () -> Void

    @Environment(AppModel.self) private var app
    @State private var rechecking = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    Eyebrow("Review before saving")
                    Text("Is this right?").font(.display(38, relativeTo: .largeTitle).weight(.semibold))
                    Text("Everything below was read from your photo and can be changed. Nothing is saved until you submit.")
                        .foregroundStyle(Theme.brown)
                    if app.dataMode == .sample {
                        Text("Sample mode: this is a sample result, and the sources below are placeholders.")
                            .font(.caption).foregroundStyle(Theme.warningInk).padding(10)
                            .background(Theme.warningSurface, in: RoundedRectangle(cornerRadius: 12))
                    }
                }

                if let cover = draft.photos.first {
                    ZStack { Theme.pill; SignedPhoto(path: cover.path, contentMode: .fit) }
                        .frame(height: 300)
                        .clipShape(RoundedRectangle(cornerRadius: 28))
                        .accessibilityLabel("The item you photographed")
                }

                morePhotos
                whatThisIs
                comparables
                form
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 24)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.page)
        .navigationTitle(AppView.identify.title)
        .navigationBarTitleDisplayMode(.inline)
        .overlay {
            if rechecking { IdentifyLoadingOverlay(photos: draft.photos) }
        }
    }

    private var morePhotos: some View {
        let atLimit = draft.photos.count >= 4
        return VStack(alignment: .leading, spacing: 12) {
            Text("Add more photos for a better read").font(.headline)
            Text("A cover alone can't prove an edition. Add the copyright page, the number line, or the ISBN barcode and re-check — the edition, printing and value estimates get more reliable with each one.")
                .font(.subheadline).foregroundStyle(Theme.adaptive(0x365c53, dark: 0xd8e6e2))
            HStack(spacing: 12) {
                ForEach(Array(draft.photos.enumerated()), id: \.element.path) { index, photo in
                    ZStack(alignment: .topTrailing) {
                        ZStack { Theme.pill; SignedPhoto(path: photo.path) }
                            .frame(width: 72, height: 72)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(alignment: .topLeading) {
                                if index == 0 { Chip(text: "Cover", tone: .tint).scaleEffect(0.8).offset(x: -6, y: -8) }
                            }
                        if draft.photos.count > 1 {
                            Button {
                                draft.photos.removeAll { $0.path == photo.path }
                            } label: {
                                Image(systemName: "xmark").font(.caption2).padding(5).background(Theme.chip, in: Circle())
                            }
                            .offset(x: 6, y: -6)
                            .accessibilityLabel("Remove this photo")
                        }
                    }
                }
            }
            HStack(spacing: 10) {
                PhotoPickerButton(maxCount: max(1, 4 - draft.photos.count), onPicked: { added in
                    let room = 4 - draft.photos.count
                    draft.photos += added.prefix(room)
                    if added.count > room { app.toasts.push("Added \(room) photo\(room == 1 ? "" : "s") — the limit is 4.", tone: .warning) }
                }) {
                    Label(atLimit ? "4 photo limit reached" : "Add photos", systemImage: "camera")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.brown)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(Theme.adaptive(0xffffff, dark: 0x0f332d), in: Capsule())
                        .overlay(Capsule().strokeBorder(Theme.borderStrong))
                }
                .disabled(atLimit || rechecking)
                Button(rechecking ? "Re-checking..." : "Re-check with \(draft.photos.count) photo\(draft.photos.count == 1 ? "" : "s")", action: recheck)
                    .buttonStyle(FFButtonStyle(variant: .primary, fullWidth: true))
                    .disabled(rechecking)
            }
            Text("Re-checking replaces the identified fields above. Anything you typed yourself — what you paid, purchase date, source, notes — is kept.")
                .font(.caption).foregroundStyle(Theme.adaptive(0x5c7d74, dark: 0xd8e6e2))
        }
        .padding(18)
        .background(Theme.tint, in: RoundedRectangle(cornerRadius: 28))
        .overlay(RoundedRectangle(cornerRadius: 28).strokeBorder(Theme.green.opacity(0.25)))
    }

    private var whatThisIs: some View {
        Card(padding: 20) {
            VStack(alignment: .leading, spacing: 10) {
                Text("What this is").font(.headline)
                Text(draft.result.summary.isEmpty ? "No summary was returned for this photo." : draft.result.summary).foregroundStyle(Theme.brown)
                if !draft.result.editionRationale.isEmpty {
                    Text("Why this edition and printing").font(.headline).padding(.top, 6)
                    Text(draft.result.editionRationale).foregroundStyle(Theme.brown)
                }
                if !draft.result.conditionNotes.isEmpty {
                    Text("What condition does to the value").font(.headline).padding(.top, 6)
                    Text(draft.result.conditionNotes).foregroundStyle(Theme.brown)
                }
                Text("These figures come from live web research, not a formal appraisal. Review the comparables below before relying on them for insurance or a sale.")
                    .font(.subheadline).foregroundStyle(Theme.warningInk).padding(14)
                    .background(Theme.warningSurface, in: RoundedRectangle(cornerRadius: 16))
                    .padding(.top, 6)
                HStack {
                    Text("Confidence").font(.subheadline).foregroundStyle(Theme.brownSoft)
                    Chip(text: draft.result.confidence.capitalized, tone: draft.result.confidence == "high" ? .tint : .warning)
                }
            }
        }
    }

    private var comparables: some View {
        Card(padding: 20) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Comparable sales").font(.headline)
                if draft.result.comparables.isEmpty {
                    Text("No comparables were found for this specific edition and printing.").font(.subheadline).foregroundStyle(Theme.brownMuted)
                }
                ForEach(draft.result.comparables) { comp in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Link(comp.source.isEmpty ? "Source" : comp.source, destination: comp.url)
                                .font(.subheadline.weight(.medium)).underline().foregroundStyle(Theme.green)
                            Spacer()
                            let (label, tone) = saleType(comp.saleType)
                            Chip(text: label, tone: tone)
                        }
                        HStack(spacing: 6) {
                            Text(Format.currency(Decimal(comp.price))).font(.ledger(15, relativeTo: .subheadline).weight(.semibold)).foregroundStyle(Theme.ink)
                            if !comp.date.isEmpty { Text("· \(comp.date)").font(.subheadline).foregroundStyle(Theme.brown) }
                        }
                        if !comp.editionMatch.isEmpty { Text(comp.editionMatch).font(.caption).foregroundStyle(Theme.brownMuted) }
                    }
                    .padding(12)
                    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.borderSoft))
                    .accessibilityElement(children: .combine)
                }
                if !draft.result.citations.isEmpty {
                    Text("SOURCES CHECKED").font(.caption).tracking(1.4).foregroundStyle(Theme.brownSoft).padding(.top, 6)
                    ForEach(draft.result.citations) { citation in
                        Link(citation.title.isEmpty ? citation.url.absoluteString : citation.title, destination: citation.url)
                            .font(.subheadline).underline().foregroundStyle(Theme.green)
                    }
                }
            }
        }
    }

    private func saleType(_ type: String) -> (String, Chip.Tone) {
        switch type {
        case "sold": ("Sold", .tint)
        case "auction_result": ("Auction result", .tint)
        case "active_listing": ("Asking price", .neutral)
        default: ("Unclear", .neutral)
        }
    }

    private var form: some View {
        Card(padding: 20) {
            VStack(alignment: .leading, spacing: 14) {
                Field(label: "Item name", text: $draft.form.item.name)
                if ItemsLogic.usesAuthorField(draft.form.item.category) { Field(label: "Author", text: $draft.form.item.author) }
                Field(label: "Make / Publisher / Brand", text: $draft.form.item.maker)
                SelectField(label: "Category", selection: $draft.form.item.category, options: Vocab.quickCategories)
                SelectField(label: "Condition", selection: $draft.form.item.condition, options: Vocab.conditionOptions, placeholder: "Not set")
                if draft.form.item.category == "Book" {
                    Field(label: "Genre", text: $draft.form.item.bookGenre)
                    SelectField(label: "Edition", selection: $draft.form.item.bookEdition, options: Vocab.bookEditionOptions, placeholder: "Select edition")
                    SelectField(label: "Printing", selection: $draft.form.item.bookPrinting, options: Vocab.bookPrintingOptions, placeholder: "Select printing")
                }
                SelectField(label: "Status", selection: $draft.form.item.status, options: Vocab.statuses)
                OptionalDateField(label: "Purchase date", date: $draft.form.purchaseDate)
                Field(label: "Where purchased", text: $draft.form.item.source)
                Field(label: "What you paid", text: $draft.form.paidText, kind: .decimal)
                Field(label: "Estimated value", text: $draft.form.valueText, kind: .decimal)
                Field(label: "Notes", text: $draft.form.item.notes)

                ValueRangeBlock(label: "Estimated value, as pictured", range: draft.valueRange) { draft.form.valueText = Self.amount($0) }
                ValueRangeBlock(
                    label: "If it were a first edition, first printing", range: draft.firstEditionRange,
                    caveat: "Only apply this if you've confirmed the edition and printing yourself — a cover photo alone can't prove either."
                ) { draft.form.valueText = Self.amount($0) }
                Text("Neither figure fills in the Estimated value field automatically — pick a number from the range, or from the comparables below, and enter it yourself.")
                    .font(.caption).foregroundStyle(Theme.brownMuted)
                Text("We left \"what you paid\" blank on purpose — only you know that, and it's what turns an estimate into a real number.")
                    .font(.subheadline).foregroundStyle(Theme.green).padding(14)
                    .background(Theme.tint, in: RoundedRectangle(cornerRadius: 16))
                HStack {
                    Button("Discard", action: onDiscard).buttonStyle(.ffSecondary)
                    Spacer()
                    Button {
                        var form = draft.form
                        form.itemPhotos = draft.photos
                        onSaved(form) {}
                    } label: { Label("Add to my collection", systemImage: "square.and.arrow.down") }
                        .buttonStyle(.ffPrimary)
                }
            }
        }
    }

    private static func amount(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(value)
    }

    private func recheck() {
        rechecking = true
        Task {
            defer { rechecking = false }
            do {
                draft.apply(try await app.identifyPhotos(draft.photos))
            } catch let failure as PhotoAI.Failure {
                app.toasts.push(failure.message, tone: .error)
            } catch {}
        }
    }
}

// ValueRangeBlock: a low–high range with a button for each end. Picking one
// is the only way a figure reaches the estimate.
struct ValueRangeBlock: View {
    let label: String
    let range: (low: Double, high: Double)?
    var caveat: String?
    let onUse: (Double) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased()).font(.caption).tracking(1.4).foregroundStyle(Theme.brownSoft)
            if let range {
                Text(range.low == range.high ? Format.currency(Decimal(range.low)) : "\(Format.currency(Decimal(range.low)))–\(Format.currency(Decimal(range.high)))")
                    .font(.ledger(24, relativeTo: .title2).weight(.semibold))
                    .foregroundStyle(Theme.green)
                HStack(spacing: 16) {
                    Button("Use \(Format.currency(Decimal(range.low)))") { onUse(range.low) }
                    if range.high != range.low {
                        Button("Use \(Format.currency(Decimal(range.high)))") { onUse(range.high) }
                    }
                }
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.green)
                .underline()
                if let caveat { Text(caveat).font(.subheadline).foregroundStyle(Theme.brown) }
            } else {
                Text("No supported estimate — search didn't turn up usable comparables.").font(.subheadline).foregroundStyle(Theme.brownMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Theme.pill, in: RoundedRectangle(cornerRadius: 16))
        .accessibilityElement(children: .contain)
    }
}
