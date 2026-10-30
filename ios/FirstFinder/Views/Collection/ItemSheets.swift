import PhotosUI
import SwiftUI

// PhotoViewerModal: every photo of an item (or just its receipts), large.
// The web also repairs photo records it finds in storage but not on the row,
// which writes; the prototype only shows what the row lists.
struct PhotoViewerModal: View {
    let request: PhotoViewerRequest
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

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
                    ForEach(photos, id: \.0.path) { photo, label in
                        VStack(alignment: .leading, spacing: 0) {
                            ZStack {
                                Theme.adaptive(0xf3ece0, dark: 0x0f332d)
                                SignedPhoto(path: photo.path, contentMode: .fit, accessibilityLabel: photo.name, missingLabel: "Photo didn't load")
                            }
                            .frame(height: 288)
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
                            app.markSold(entry.id, soldPrice: soldPrice, soldDate: DateField.iso(soldDate), condition: condition)
                            dismiss()
                        }
                        .buttonStyle(.ffPrimary)
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
        _purchaseDate = State(initialValue: DateField.parse(item.purchaseDate))
        _soldDate = State(initialValue: DateField.parse(item.soldDate))
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
                        Button("Cancel") { dismiss() }.buttonStyle(.ffSecondary)
                        Spacer()
                        Button("Save changes", action: save).buttonStyle(.ffPrimary)
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
        next.purchaseDate = purchaseDate.map(DateField.iso) ?? ""
        next.soldDate = sold ? (soldDate.map(DateField.iso) ?? "") : ""
        app.saveEdit(next, itemPhotos: itemPhotos, receiptPhotos: receiptPhotos, addedPhotoCount: added)
        dismiss()
    }
}

// EditPhotoSection: the photos already saved, ones added now (marked New),
// and a picker. Added photos live in the overlay's memory, nowhere else.
struct EditPhotoSection: View {
    let title: String
    let systemImage: String
    @Binding var photos: [Photo]
    @Binding var added: Int
    var original: [Photo] = []

    @Environment(AppModel.self) private var app
    @State private var picked: [PhotosPickerItem] = []

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label(title, systemImage: systemImage).font(.headline)
                Spacer()
                Text("\(photos.count)").font(.caption).padding(.horizontal, 10).padding(.vertical, 3)
                    .foregroundStyle(Theme.green).background(Theme.tint, in: Capsule())
            }
            PhotosPicker(selection: $picked, matching: .images) {
                Text("Add photos")
                    .font(.subheadline.weight(.medium))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .foregroundStyle(Theme.ink)
                    .background(Theme.adaptive(0xf7ecdc, dark: 0x0f332d), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.adaptive(0xcbb894, dark: 0x7d6c5a), style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
            }
            .onChange(of: picked) { _, items in
                Task { await load(items) }
            }
            if !photos.isEmpty {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                    ForEach(photos) { photo in
                        ZStack(alignment: .topTrailing) {
                            ZStack { Theme.pill; SignedPhoto(path: photo.path, missingLabel: "Photo") }
                                .frame(height: 80)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            Button {
                                photos.removeAll { $0.path == photo.path }
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
    }

    private func load(_ items: [PhotosPickerItem]) async {
        for item in items {
            guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
            photos.append(app.overlay.storePhoto(data, name: "photo-\(photos.count + 1).jpg"))
            added += 1
        }
        picked = []
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
                .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border))
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

    static func iso(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    static func parse(_ value: String) -> Date? {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: String(value.prefix(10)))
    }
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
