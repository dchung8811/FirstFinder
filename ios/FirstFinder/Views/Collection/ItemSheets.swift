import SwiftUI

// PhotoViewerModal: every photo of an item (or just its receipts), large.
// The web also repairs photo records it finds in storage but not on the row,
// which writes; the prototype only shows what the row lists. Tapping a photo
// opens it full screen to zoom in on a number line or a receipt total.
struct PhotoViewerModal: View {
    let request: PhotoViewerRequest
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var zoomStart: PhotoZoomViewer.Start?

    var body: some View {
        let entry = app.inventory.first { $0.id == request.itemId }
        let receiptsOnly = request.kind == .receipt
        let photos: [(Photo, String)] = entry.map { item in
            (receiptsOnly ? [] : item.itemPhotos.map { ($0, "Item photo") }) + item.receiptPhotos.map { ($0, "Receipt proof") }
        } ?? []

        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Eyebrow(receiptsOnly ? "Receipts" : "Photos")
                    Text(entry.map { $0.name.isEmpty ? "Untitled item" : $0.name } ?? "")
                        .font(.display(28, relativeTo: .title).weight(.semibold))
                    if photos.isEmpty {
                        Text(receiptsOnly ? "No receipt saved for this item yet." : "No saved photos for this item yet.")
                            .frame(maxWidth: .infinity)
                            .padding(24)
                            .foregroundStyle(Theme.brown)
                            .background(Theme.pill, in: RoundedRectangle(cornerRadius: 16))
                    }
                    ForEach(Array(photos.enumerated()), id: \.element.0.path) { index, entry in
                        let (photo, label) = entry
                        VStack(alignment: .leading, spacing: 0) {
                            Button { zoomStart = PhotoZoomViewer.Start(index: index) } label: {
                                ZStack(alignment: .bottomTrailing) {
                                    Theme.adaptive(0xf3ece0, dark: 0x0f332d)
                                    SignedPhoto(path: photo.path, contentMode: .fit, accessibilityLabel: photo.name, missingLabel: "Photo didn't load")
                                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(.white)
                                        .frame(width: 32, height: 32)
                                        .background(Color.black.opacity(0.55), in: Circle())
                                        .padding(10)
                                        .accessibilityHidden(true)
                                }
                                .frame(height: 288)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(label), \(photo.name)")
                            .accessibilityHint("Opens the photo full screen to zoom in.")
                            VStack(alignment: .leading, spacing: 2) {
                                Text(label).font(.headline)
                                Text(photo.name).font(.subheadline).foregroundStyle(Theme.brown).lineLimit(1)
                            }
                            .padding(16)
                        }
                        .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border))
                    }
                }
                .padding(16)
            }
            .background(Theme.page)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }.accessibilityLabel("Close photo viewer")
                }
            }
        }
        .fullScreenCover(item: $zoomStart) { start in
            PhotoZoomViewer(pages: photos.map { PhotoZoomViewer.Page(photo: $0.0, label: $0.1) }, start: start.index)
        }
    }
}

// MarkSoldDialog: what it actually sold for, so realized gain reflects
// reality. Prefilled with the estimate; blank is allowed.
struct MarkSoldDialog: View {
    let entry: Item
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var soldPrice = ""
    @State private var soldDate = Date()
    @State private var condition = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Eyebrow("Mark sold")
                    Text("\"\(entry.name.isEmpty ? "Untitled item" : entry.name)\" sold")
                        .font(.display(26, relativeTo: .title).weight(.semibold))
                    Text("Capture what it actually sold for so realized gain and the Sold tab totals reflect reality, not the estimate. Leave the price blank if you'd rather skip it for now.")
                        .foregroundStyle(Theme.brown)
                    Field(label: "Sold for", text: $soldPrice, kind: .decimal)
                    DateField(label: "Sold on", date: $soldDate)
                    SelectField(label: "Condition", selection: $condition, options: Vocab.conditionOptions, placeholder: "Not set")
                    HStack {
                        Button("Cancel") { dismiss() }.buttonStyle(.ffSecondary)
                        Spacer()
                        Button("Mark sold") {
                            Task {
                                if await app.markSold(entry.id, soldPrice: soldPrice, soldDate: Format.day(soldDate), condition: condition) { dismiss() }
                            }
                        }
                        .buttonStyle(.ffPrimary)
                        .disabled(app.isSaving)
                    }
                    .padding(.top, 8)
                }
                .padding(20)
            }
            .background(Theme.page)
        }
        .presentationDetents([.large])
        .onAppear {
            soldPrice = Format.amountText(entry.estimatedValue)
            condition = entry.condition
        }
    }
}

// EditItemModal: every field of the record, both photo sets, and the
// per-item "Hide from my public page".
struct EditItemModal: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    @State private var draft: Item
    @State private var purchasePrice: String
    @State private var valueText: String
    @State private var purchaseDate: Date?
    @State private var soldDate: Date?
    @State private var itemPhotos: [Photo]
    @State private var receiptPhotos: [Photo]
    @State private var added = 0
    private let original: Item

    init(item: Item) {
        original = item
        _draft = State(initialValue: item)
        _purchasePrice = State(initialValue: Format.amountText(item.purchasePrice))
        _valueText = State(initialValue: Format.amountText(item.status == "Sold" ? item.soldPrice : item.estimatedValue))
        _purchaseDate = State(initialValue: Format.parseDay(item.purchaseDate))
        _soldDate = State(initialValue: Format.parseDay(item.soldDate))
        _itemPhotos = State(initialValue: item.itemPhotos)
        _receiptPhotos = State(initialValue: item.receiptPhotos)
    }

    private var sold: Bool { draft.status == "Sold" }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Eyebrow("Edit record")
                    Text(original.name.isEmpty ? "Untitled item" : original.name)
                        .font(.display(28, relativeTo: .title).weight(.semibold))
                        .padding(.bottom, 6)

                    Field(label: "Item name", text: $draft.name)
                    SelectField(label: "Category", selection: $draft.category, options: Vocab.quickCategories)
                    if ItemsLogic.usesAuthorField(draft.category) {
                        Field(label: "Author", text: $draft.author)
                    }
                    Field(label: "Make / Publisher / Brand", text: $draft.maker)
                    if draft.category == "Book" {
                        Field(label: "Genre", text: $draft.bookGenre)
                        SelectField(label: "Edition", selection: $draft.bookEdition, options: Vocab.bookEditionOptions, placeholder: "Select edition")
                        SelectField(label: "Printing", selection: $draft.bookPrinting, options: Vocab.bookPrintingOptions, placeholder: "Select printing")
                    } else {
                        Field(label: "Edition / Variant / Details", text: $draft.edition)
                    }
                    SelectField(label: "Status", selection: Binding(get: { draft.status }, set: { value in statusChanged(value) }), options: Vocab.statuses)
                    SelectField(label: "Condition", selection: $draft.condition, options: Vocab.conditionOptions, placeholder: "Not set")
                    OptionalDateField(label: "Purchase date", date: $purchaseDate)
                    Field(label: "Where purchased", text: $draft.source)
                    Field(label: "What you paid", text: $purchasePrice, kind: .decimal)
                    Field(label: sold ? "Sold for" : "Estimated value", text: $valueText, kind: .decimal)
                    if sold {
                        OptionalDateField(label: "Sold on", date: $soldDate)
                    }
                    Field(label: "Notes", text: $draft.notes)

                    EditPhotoSection(title: "Item photos", systemImage: "camera", photos: $itemPhotos, added: $added, original: original.itemPhotos)
                    EditPhotoSection(title: "Receipt proof", systemImage: "receipt", photos: $receiptPhotos, added: $added, original: original.receiptPhotos)

                    Toggle(isOn: $draft.hiddenFromShare) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Hide from my public page").font(.subheadline.weight(.medium))
                            Text("Keeps this item off your shared collection page, whatever that page is set to show.")
                                .font(.caption).foregroundStyle(Theme.brownSoft)
                        }
                    }
                    .toggleStyle(CheckboxToggleStyle())
                    .padding(16)
                    .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.borderSoft))

                    HStack {
                        Button("Cancel") { discardAdded(); dismiss() }.buttonStyle(.ffSecondary).disabled(app.isSaving)
                        Spacer()
                        Button(app.isSaving ? "Saving…" : "Save changes", action: save).buttonStyle(.ffPrimary).disabled(app.isSaving)
                    }
                    .padding(.top, 8)
                }
                .padding(20)
            }
            .background(Theme.page)
            .scrollDismissesKeyboard(.interactively)
        }
    }

    // Picking Sold dates the sale today unless a date is already there.
    private func statusChanged(_ value: String) {
        draft.status = value
        if value == "Sold", soldDate == nil { soldDate = Date() }
        valueText = Format.amountText(value == "Sold" ? draft.soldPrice : draft.estimatedValue)
    }

    private func save() {
        var next = draft
        next.purchasePrice = Format.optionalAmount(purchasePrice)
        if sold {
            next.soldPrice = Format.optionalAmount(valueText)
        } else {
            next.estimatedValue = Format.optionalAmount(valueText)
        }
        next.purchaseDate = purchaseDate.map(Format.day) ?? ""
        next.soldDate = sold ? (soldDate.map(Format.day) ?? "") : ""
        Task { if await app.saveEdit(next, itemPhotos: itemPhotos, receiptPhotos: receiptPhotos) { dismiss() } }
    }

    // Photos picked and then cancelled are forgotten, not left in memory.
    private func discardAdded() {
        app.pendingPhotos.forget((itemPhotos + receiptPhotos).filter(PendingPhotos.isPending).map(\.path))
    }
}

// EditPhotoSection: the photos already saved, ones added now (marked New),
// and a picker. Added photos wait in memory until Save uploads them.
struct EditPhotoSection: View {
    let title: String
    let systemImage: String
    @Binding var photos: [Photo]
    @Binding var added: Int
    var original: [Photo] = []

    @Environment(AppModel.self) private var app
    @State private var zoomStart: PhotoZoomViewer.Start?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label(title, systemImage: systemImage).font(.headline)
                Spacer()
                Text("\(photos.count)").font(.caption).padding(.horizontal, 10).padding(.vertical, 3)
                    .foregroundStyle(Theme.green).background(Theme.tint, in: Capsule())
            }
            // The same "Take photo / Choose from library" choice as adding an
            // item: a collector editing a record is usually holding the thing.
            PhotoPickerButton(onPicked: { new in
                photos.append(contentsOf: new)
                added += new.count
            }) {
                Text("Take or add photos")
                    .font(.subheadline.weight(.medium))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .foregroundStyle(Theme.ink)
                    .background(Theme.adaptive(0xf7ecdc, dark: 0x0f332d), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.adaptive(0xcbb894, dark: 0x7d6c5a), style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
            }
            .buttonStyle(.plain)
            if !photos.isEmpty {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                    ForEach(Array(photos.enumerated()), id: \.element.id) { index, photo in
                        ZStack(alignment: .topTrailing) {
                            // Tap to check a photo full screen -- a blurry
                            // number line is better caught before saving.
                            Button { zoomStart = PhotoZoomViewer.Start(index: index) } label: {
                                ZStack { Theme.pill; SignedPhoto(path: photo.path, missingLabel: "Photo") }
                                    .frame(height: 80)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("View \(photo.name) full screen")
                            Button {
                                photos.removeAll { $0.path == photo.path }
                                // A photo picked and removed before saving
                                // shouldn't sit in memory until the sheet closes.
                                if PendingPhotos.isPending(photo) { app.pendingPhotos.forget([photo.path]) }
                            } label: {
                                Image(systemName: "xmark").font(.caption2.weight(.bold)).foregroundStyle(.white)
                                    .frame(width: 26, height: 26).background(Color.black.opacity(0.7), in: Circle())
                            }
                            .padding(5)
                            .accessibilityLabel("Remove \(photo.name)")
                        }
                        .overlay(alignment: .topLeading) {
                            if !original.contains(where: { $0.path == photo.path }) {
                                Text("New").font(.system(size: 10, weight: .medium)).padding(.horizontal, 6).padding(.vertical, 2)
                                    .foregroundStyle(Theme.onAction).background(Theme.action, in: Capsule()).padding(5)
                            }
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.border))
        .fullScreenCover(item: $zoomStart) { start in
            PhotoZoomViewer(pages: photos.map { PhotoZoomViewer.Page(photo: $0, label: title) }, start: start.index)
        }
    }
}

// SelectField from the web: a labelled dropdown with an optional
// placeholder meaning "not set".
struct SelectField: View {
    let label: String
    @Binding var selection: String
    let options: [String]
    var placeholder: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).font(.subheadline.weight(.medium)).foregroundStyle(Theme.brown)
            Menu {
                Picker(label, selection: $selection) {
                    if let placeholder { Text(placeholder).tag("") }
                    ForEach(options, id: \.self) { Text($0).tag($0) }
                }
            } label: {
                HStack {
                    Text(selection.isEmpty ? (placeholder ?? "") : selection)
                        .foregroundStyle(selection.isEmpty ? Theme.brownMuted : Theme.ink)
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down").font(.caption).foregroundStyle(Theme.brown)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .fieldInks()
                .background(Theme.field, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.fieldBorder))
            }
            .accessibilityLabel("\(label): \(selection.isEmpty ? (placeholder ?? "none") : selection)")
        }
    }
}

// A date, stored as YYYY-MM-DD like the date columns.
struct DateField: View {
    let label: String
    @Binding var date: Date

    var body: some View {
        HStack {
            Text(label).font(.subheadline.weight(.medium)).foregroundStyle(Theme.brown)
            Spacer()
            DatePicker(label, selection: $date, displayedComponents: .date).labelsHidden()
        }
    }

    static func iso(_ date: Date) -> String { Format.day(date) }
    static func parse(_ value: String) -> Date? { Format.parseDay(value) }
}

// A date that may be left blank, as purchase dates often are.
struct OptionalDateField: View {
    let label: String
    @Binding var date: Date?

    var body: some View {
        HStack {
            Text(label).font(.subheadline.weight(.medium)).foregroundStyle(Theme.brown)
            Spacer()
            if let current = date {
                DatePicker(label, selection: Binding(get: { current }, set: { date = $0 }), displayedComponents: .date).labelsHidden()
                Button { date = nil } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.brownMuted) }
                    .accessibilityLabel("Clear \(label)")
            } else {
                Button("Add date") { date = Date() }.font(.subheadline).foregroundStyle(Theme.green)
            }
        }
    }
}
