import SwiftUI

// AddItemsPage from app/InventoryApp.jsx: one place to add an item, where a
// photo is the quick way to fill it and typing is the fallback. Below it,
// the optional AI research. The web's CSV import is left out on purpose:
// bulk editing through a spreadsheet belongs at a desk.
struct AddItemsPage: View {
    enum Route: Hashable { case tutorial, identify }

    struct ScanNotes: Equatable {
        var reasons: [String]
        var numberLine: String
        var editionStatement: String
        var publicationYear: String
        var isbn: String
        var sawCopyrightPage: Bool
        var filledCount: Int
    }

    @Environment(AppModel.self) private var app
    @State private var path = NavigationPath()
    @State private var quick = ItemDraft()
    @State private var scanNotes: ScanNotes?
    @State private var busyPhotos: [Photo] = []
    @State private var scanning = false
    @State private var identifying = false
    @State private var identifyDraft: IdentifyDraft?
    @State private var duplicates: [ItemsLogic.DuplicateMatch]?
    @State private var pendingSave: (() -> Void)?

    var body: some View {
        NavigationStack(path: $path) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        header(proxy)
                        summaryCards
                        quickAdd.id("quick-add")
                        identifyCard
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 24)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .background(Theme.page)
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .tutorial: FullAddPage(onSaved: finishSave).solidNavigationBar()
                case .identify:
                    if let binding = Binding($identifyDraft) {
                        IdentifyReviewPage(draft: binding, onSaved: finishSave, onDiscard: discardIdentify).solidNavigationBar()
                    }
                }
            }
        }
        .overlay {
            if scanning || identifying {
                IdentifyLoadingOverlay(
                    photos: busyPhotos,
                    steps: scanning ? IdentifyLoadingOverlay.scanningSteps : IdentifyLoadingOverlay.identifyingSteps,
                    note: scanning ? "Reading the printed text off your photos. Nothing is saved until you submit." : "This usually takes a few seconds. You'll get to review and edit everything before anything is saved."
                )
            }
        }
        .sheet(isPresented: Binding(get: { duplicates != nil }, set: { if !$0 { duplicates = nil } })) {
            if let duplicates {
                DuplicateWarningDialog(matches: duplicates) { pendingSave?() }
            }
        }
    }

    // MARK: Header

    private func header(_ proxy: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Add something quickly.")
                .font(.display(38, relativeTo: .largeTitle).weight(.semibold))
                .foregroundStyle(Theme.ink)
                .accessibilityAddTraits(.isHeader)
            Text("Snap a picture to fill in quick add, or type it in. Open the tutorial for the guided flow.")
                .foregroundStyle(Theme.brown)
            FlowLayout(spacing: 10) {
                Button("Quick Add") { withAnimation { proxy.scrollTo("quick-add", anchor: .top) } }.buttonStyle(.ffPrimary)
                Button("My Collection") { app.selectedTab = .collection }.buttonStyle(.ffPrimary)
                Button("Tutorial") { path.append(Route.tutorial) }.buttonStyle(.ffSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // DashboardCard ×3: what's held, what was paid, the change in value.
    private var summaryCards: some View {
        let active = app.activeInventory
        let paid = active.reduce(Decimal(0)) { $0 + Format.toNumber($1.purchasePrice) }
        let gain = active.reduce(Decimal(0)) { $0 + (ItemsLogic.gain($1) ?? 0) }
        return VStack(spacing: 12) {
            DashboardCard(systemImage: "shippingbox", label: "In your collection", value: "\(active.count)")
            DashboardCard(systemImage: "receipt", label: "What you paid", value: Format.currency(paid))
            DashboardCard(systemImage: "dollarsign", label: "Change in value", value: Format.currency(gain))
        }
    }

    // MARK: Quick add

    private var quickAdd: some View {
        Card(padding: 22) {
            VStack(alignment: .leading, spacing: 14) {
                Eyebrow("Quick add")
                Text("New collectible").font(.display(28, relativeTo: .title).weight(.semibold))
                Text("Snap the cover and copyright page and we'll fill in the fields below, edition and printing included, or type them in yourself. Nothing is saved until you submit.")
                    .foregroundStyle(Theme.brown)

                VStack(spacing: 6) {
                    PhotoPickerButton(maxCount: 3, onPicked: scan) {
                        Label(scanning ? "Reading..." : scanNotes != nil ? "Snap another page" : "Snap a picture", systemImage: "camera")
                            .font(.body.weight(.medium))
                            .foregroundStyle(Theme.onAction)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .background(Theme.action, in: Capsule())
                    }
                    .disabled(scanning)
                    Text("Up to 3 photos at a time").font(.caption).foregroundStyle(Theme.brownMuted)
                }

                if let scanNotes {
                    ScanNotesPanel(notes: scanNotes) { self.scanNotes = nil }
                }

                QuickAddFields(draft: $quick)

                PhotoUploader(title: "Item photo", systemImage: "camera", photos: $quick.itemPhotos)
                PhotoUploader(title: "Receipt proof", systemImage: "receipt", photos: $quick.receiptPhotos)

                Button(app.isSaving ? "Saving…" : "Submit") { save(quick, onDone: resetQuick) }
                    .buttonStyle(FFButtonStyle(variant: .primary, fullWidth: true))
                    .disabled(app.isSaving)
            }
        }
    }

    // MARK: AI research

    private var identifyCard: some View {
        Card(padding: 22) {
            VStack(alignment: .leading, spacing: 12) {
                Eyebrow("Optional · AI research")
                Text("Research what it's worth.").font(.display(24, relativeTo: .title2).weight(.semibold))
                Text("Photograph the cover and an AI model searches the web for comparable sales, then suggests the edition and a value range with its sources. It's a starting point, not an appraisal, and you review everything before it's saved.")
                    .foregroundStyle(Theme.brown)
                Text("Limited to a few a day per account, and it can pause if the budget runs out — each one is a live, search-grounded API call, and this is a self-funded app.")
                    .font(.subheadline).foregroundStyle(Theme.brownMuted)
                // The allowance before the camera, not after a refusal.
                if let left = app.identifyAllowance?.remaining, let limit = app.identifyAllowance?.dailyLimit {
                    Chip(text: left > 0 ? "\(left) of \(limit) left today" : "None left today · resets at midnight UTC",
                         tone: left > 0 ? .tint : .warning, systemImage: "sparkle.magnifyingglass")
                }
                PhotoPickerButton(maxCount: 1, onPicked: identify) {
                    Label(identifying ? "Researching..." : "Research a photo", systemImage: "magnifyingglass")
                        .font(.body.weight(.medium))
                        .foregroundStyle(Theme.brown)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(Theme.adaptive(0xffffff, dark: 0x0f332d), in: Capsule())
                        .overlay(Capsule().strokeBorder(Theme.borderStrong))
                }
                .disabled(identifying || !app.isOnline || app.identifyAllowance?.remaining == 0)
            }
        }
        .task { await app.refreshAllowance() }
    }

    // MARK: Actions

    private func scan(_ photos: [Photo]) {
        guard !photos.isEmpty else { return }
        guard app.isOnline else {
            app.toasts.push("You're offline. Scanning needs a connection.", tone: .warning)
            return
        }
        busyPhotos = photos
        scanning = true
        Task {
            defer { scanning = false; busyPhotos = [] }
            do {
                let result = try await app.scanPhotos(photos)
                let (fields, reasons) = ScanFill.fields(from: result)
                let (merged, filled) = ScanFill.merge(quick.item, fields: fields)
                quick.item = merged
                quick.itemPhotos += photos
                scanNotes = ScanNotes(
                    reasons: reasons, numberLine: result.numberLine, editionStatement: result.editionStatement,
                    publicationYear: result.publicationYear, isbn: result.isbn,
                    sawCopyrightPage: !(result.numberLine + result.editionStatement + result.printingStatement + result.publisher).isEmpty,
                    filledCount: filled.count
                )
                if filled.isEmpty { app.toasts.push("Read your photos, but every field it found already had something in it.", tone: .warning) }
            } catch let failure as PhotoAI.Failure {
                app.toasts.push(failure.message, tone: .error)
                app.pendingPhotos.forget(photos.map(\.path))
            } catch {}
        }
    }

    private func identify(_ photos: [Photo]) {
        guard let photo = photos.first else { return }
        busyPhotos = [photo]
        identifying = true
        Task {
            defer { identifying = false; busyPhotos = [] }
            do {
                let result = try await app.identifyPhotos([photo])
                identifyDraft = IdentifyDraft(result: result, photos: [photo])
                path.append(Route.identify)
            } catch let failure as PhotoAI.Failure {
                app.toasts.push(failure.message, tone: .error)
                app.pendingPhotos.forget([photo.path])
            } catch {}
        }
    }

    // saveQuickItem: duplicates are flagged first, never blocking.
    private func save(_ draft: ItemDraft, onDone: @escaping () -> Void) {
        let item = draft.built()
        // addItem says "Saved to your collection." itself, or what went wrong.
        let commit: () -> Void = {
            Task {
                guard await app.addItem(item, itemPhotos: draft.itemPhotos, receiptPhotos: draft.receiptPhotos) != nil else { return }
                onDone()
                app.selectedTab = .collection
            }
        }
        let matches = ItemsLogic.findPossibleDuplicates(item, in: app.inventory)
        if matches.isEmpty {
            commit()
        } else {
            pendingSave = commit
            duplicates = matches
        }
    }

    private func finishSave(_ draft: ItemDraft, reset: @escaping () -> Void) {
        save(draft) {
            reset()
            path = NavigationPath()
        }
    }

    private func resetQuick() {
        quick = ItemDraft()
        scanNotes = nil
    }

    private func discardIdentify() {
        if let identifyDraft { app.pendingPhotos.forget(identifyDraft.photos.map(\.path)) }
        identifyDraft = nil
        path = NavigationPath()
    }
}

// The quick-add fields, in the web's order.
struct QuickAddFields: View {
    @Binding var draft: ItemDraft

    var body: some View {
        VStack(spacing: 14) {
            BookNameField(label: "Item name", draft: $draft, enabled: draft.item.category == "Book")
            SelectField(label: "Category", selection: $draft.item.category, options: Vocab.quickCategories)
            Field(label: "What you paid", text: $draft.paidText, kind: .decimal)
            Field(label: draft.isSold ? "Sold for" : "Estimated value", text: $draft.valueText, kind: .decimal)
            if ItemsLogic.usesAuthorField(draft.item.category) {
                Field(label: "Author", text: $draft.item.author)
            }
            Field(label: "Make / Publisher / Brand", text: $draft.item.maker)
            Field(label: "Where purchased", text: $draft.item.source)
            OptionalDateField(label: "Purchase date", date: $draft.purchaseDate)
            SelectField(label: "Status", selection: Binding(get: { draft.item.status }, set: { value in draft.setStatus(value) }), options: Vocab.statuses)
            if draft.isSold {
                OptionalDateField(label: "Sold on", date: $draft.soldDate)
            }
            SelectField(label: "Condition", selection: $draft.item.condition, options: Vocab.conditionOptions, placeholder: "Not set")
            if draft.item.category == "Book" {
                Field(label: "Genre", text: $draft.item.bookGenre)
                SelectField(label: "Edition", selection: $draft.item.bookEdition, options: Vocab.bookEditionOptions, placeholder: "Select edition")
                SelectField(label: "Printing", selection: $draft.item.bookPrinting, options: Vocab.bookPrintingOptions, placeholder: "Select printing")
            }
            Field(label: "Notes", text: $draft.item.notes)
        }
    }
}

// ScanNotesPanel: what the scan read, why it chose the printing it did, and
// a nudge to snap the copyright page if it wasn't in the scan.
struct ScanNotesPanel: View {
    let notes: AddItemsPage.ScanNotes
    let onDismiss: () -> Void

    var body: some View {
        let read = [("Edition statement", notes.editionStatement), ("Number line", notes.numberLine), ("Year", notes.publicationYear), ("ISBN", notes.isbn)]
            .filter { !$0.1.isEmpty }
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                Text(notes.filledCount > 0 ? "Filled \(notes.filledCount) field\(notes.filledCount == 1 ? "" : "s") from your photos" : "What the scan read")
                    .font(.headline).foregroundStyle(Theme.green)
                Spacer()
                Button(action: onDismiss) { Image(systemName: "xmark").font(.caption).foregroundStyle(Theme.green) }
                    .accessibilityLabel("Hide what the scan read")
            }
            ForEach(read, id: \.0) { label, value in
                VStack(alignment: .leading, spacing: 2) {
                    Text(label.uppercased()).font(.caption2).tracking(1.4).foregroundStyle(Theme.adaptive(0x5c7a72, dark: 0xd8e6e2))
                    Text(value).font(.ledger(14, relativeTo: .subheadline)).foregroundStyle(Theme.ink)
                }
            }
            ForEach(notes.reasons, id: \.self) { Text($0).font(.subheadline).foregroundStyle(Theme.adaptive(0x365c53, dark: 0xd8e6e2)) }
            if !notes.sawCopyrightPage {
                Text("No copyright page in that scan. Snap it next for the publisher, edition, and printing.")
                    .font(.subheadline).foregroundStyle(Theme.warningInk).padding(12)
                    .background(Theme.warningSurface, in: RoundedRectangle(cornerRadius: 12))
            }
            Text("Read from your photos, not looked up. Check it against the book before you submit.")
                .font(.caption).foregroundStyle(Theme.adaptive(0x5c7a72, dark: 0xd8e6e2))
        }
        .padding(16)
        .background(Theme.tint, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.green.opacity(0.2)))
    }
}

struct DashboardCard: View {
    let systemImage: String
    let label: String
    let value: String

    var body: some View {
        Card(padding: 20) {
            HStack(spacing: 14) {
                Image(systemName: systemImage)
                    .font(.title3)
                    .foregroundStyle(Theme.adaptive(0xfff7ea, dark: 0xfff7ea))
                    .frame(width: 48, height: 48)
                    .background(Theme.adaptive(0x123f38, dark: 0x123f38), in: RoundedRectangle(cornerRadius: 16))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(label).font(.subheadline).foregroundStyle(Theme.brown)
                    Text(value).font(.ledger(24, relativeTo: .title2).weight(.semibold)).foregroundStyle(Theme.ink)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

// A CSV handed to the share sheet as data, so no copy is written to disk
// first.
struct CsvFile: Transferable {
    let name: String
    let text: String

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .commaSeparatedText) { Data($0.text.utf8) }
            .suggestedFileName { $0.name }
    }
}
