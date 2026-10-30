import SwiftUI

// InventoryPage from app/InventoryApp.jsx (issue #257's one-toolbar layout):
// Add and Share up top, the ⋯ menu for the occasional errands, a three-figure
// strip, then search, the layout switch, Filters and sort directly above the
// results they shape.
struct InventoryPage: View {
    @Environment(AppModel.self) private var app

    enum Layout: String, CaseIterable { case tiles, cards, records }

    @State private var statusView = "active"
    // Tiles is the web's default too.
    @State private var layout: Layout = .tiles
    @State private var searchTerm = ""
    @State private var categoryFilter = ""
    @State private var genreFilter = ""
    @State private var editionFilter = ""
    @State private var printingFilter = ""
    @State private var sortOrder = "added"
    @State private var filtersOpen = false
    @State private var shareOpen = false

    @State private var openTile: Item?
    // What to open once the tile's card has finished closing: the page can
    // present one sheet at a time, and one asked for mid-dismissal is dropped.
    @State private var afterTileClose: (() -> Void)?
    @State private var photoViewer: PhotoViewerRequest?
    @State private var editing: Item?
    @State private var markingSold: Item?
    @State private var deleting: Item?
    @State private var highlighted: String?

    private var isSoldView: Bool { statusView == "sold" }
    private var visibleInventory: [Item] { isSoldView ? app.soldInventory : app.activeInventory }

    private var searched: [Item] {
        let query = searchTerm.lowercased().trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return visibleInventory }
        return visibleInventory.filter { entry in
            [entry.name, entry.category, entry.author, entry.maker, entry.source, entry.status, entry.notes, entry.edition]
                .joined(separator: " ").lowercased().contains(query)
        }
    }

    private var displayed: [Item] {
        ItemsLogic.sort(
            searched
                .filter { categoryFilter.isEmpty || $0.category == categoryFilter }
                .filter { genreFilter.isEmpty || $0.bookGenre == genreFilter }
                .filter { editionFilter.isEmpty || $0.bookEdition == editionFilter }
                .filter { printingFilter.isEmpty || $0.bookPrinting == printingFilter },
            by: sortOrder
        )
    }

    private var activeFilters: [(label: String, clear: () -> Void)] {
        var filters: [(String, () -> Void)] = []
        if !categoryFilter.isEmpty { filters.append((categoryFilter, { categoryFilter = "" })) }
        if !genreFilter.isEmpty { filters.append((genreFilter, { genreFilter = "" })) }
        if !editionFilter.isEmpty { filters.append((editionFilter, { editionFilter = "" })) }
        if !printingFilter.isEmpty { filters.append((printingFilter, { printingFilter = "" })) }
        return filters
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    statStrip.padding(.top, 20)
                    toolbar.padding(.top, 20)
                    countLine.padding(.top, 16)
                    results.padding(.top, 20)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 24)
            }
            .background(Theme.page)
            .refreshable { await app.refreshInventory() }
            .onChange(of: app.focusItemId, initial: true) { _, id in
                focus(on: id, proxy: proxy)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .navigationTitle(AppView.inventory.title)
        .sheet(isPresented: $filtersOpen) { filtersSheet }
        .sheet(item: $openTile, onDismiss: {
            afterTileClose?()
            afterTileClose = nil
        }) { item in
            TileCardSheet(itemId: item.id, actions: actions) { next in afterTileClose = next }
        }
        .sheet(item: $photoViewer) { PhotoViewerModal(request: $0) }
        .sheet(item: $editing) { EditItemModal(item: $0) }
        .sheet(item: $markingSold) { item in MarkSoldDialog(entry: item) }
        .sheet(isPresented: $shareOpen) {
            if let settings = app.shareSettingsOrDefault {
                ShareCollectionDialog(settings: settings)
            }
        }
        .alert(
            "Delete \"\(deleting.map { $0.name.isEmpty ? "Untitled item" : $0.name } ?? "")\"?",
            isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
            presenting: deleting
        ) { item in
            Button("Cancel", role: .cancel) {}
            Button("Delete item", role: .destructive) { app.deleteItem(item.id) }
        } message: { _ in
            Text("This removes the item and its saved photos permanently. This can't be undone.\n\nIn the prototype it's hidden on this phone only, until the app quits.")
        }
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(isSoldView ? "Sold collectibles" : "Your collectibles")
                .font(.display(36, relativeTo: .largeTitle).weight(.semibold))
                .foregroundStyle(Theme.ink)
                .accessibilityAddTraits(.isHeader)
            if isSoldView {
                Text("Sold items stay preserved here, with what you paid and what you got for them.")
                    .foregroundStyle(Theme.brown)
            }
            HStack(spacing: 8) {
                Button("Add to collection") { app.selectedTab = .add }
                    .buttonStyle(FFButtonStyle(variant: .primary, fullWidth: true))
                Button(action: openShare) {
                    HStack(spacing: 6) {
                        Image(systemName: "link")
                        Text("Share")
                        // Always the verb, never the status; the dot says
                        // the page is live.
                        if let visibility = app.shareSettings?.visibility, visibility != "off" {
                            Circle().fill(Theme.green).frame(width: 7, height: 7)
                                .accessibilityLabel("your page is live")
                        }
                    }
                }
                .buttonStyle(.ffSecondary)
                Menu {
                    Button { app.selectedTab = .more; app.pendingMoreRoute = .insuranceExport } label: {
                        Label("Export for insurance", systemImage: "doc.text")
                    }
                    Button { statusView = isSoldView ? "active" : "sold" } label: {
                        Label(isSoldView ? "Back to your collection (\(app.activeInventory.count))" : "View sold items (\(app.soldInventory.count))", systemImage: "receipt")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .frame(width: 44, height: 44)
                        .foregroundStyle(Theme.ink)
                        .background(Theme.surfaceWarm, in: Circle())
                        .overlay(Circle().strokeBorder(Theme.borderStrong))
                }
                .accessibilityLabel("More")
            }
        }
    }

    private func openShare() {
        if app.shareSettingsOrDefault == nil {
            app.toasts.push("Still loading your sharing settings — try again in a moment.", tone: .warning)
            return
        }
        shareOpen = true
    }

    // One strip rather than three cards, as on the web.
    private var statStrip: some View {
        let paid = visibleInventory.reduce(Decimal(0)) { $0 + Format.toNumber($1.purchasePrice) }
        let value = visibleInventory.reduce(Decimal(0)) { $0 + (ItemsLogic.valueForTotals($1) ?? 0) }
        let change = visibleInventory.reduce(Decimal(0)) { $0 + (ItemsLogic.gain($1) ?? 0) }
        return HStack(spacing: 0) {
            StatStripItem(label: isSoldView ? "You paid" : "Paid", value: Format.currency(paid))
            Divider().overlay(Theme.borderSoft)
            StatStripItem(label: isSoldView ? "Sold for" : "Value", value: Format.currency(value))
            Divider().overlay(Theme.borderSoft)
            StatStripItem(label: isSoldView ? "Gain/loss" : "Change", value: Format.currency(change))
        }
        .padding(.vertical, 14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).strokeBorder(Theme.border))
    }

    // MARK: Toolbar

    private var toolbar: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                HStack {
                    Image(systemName: "magnifyingglass").foregroundStyle(Theme.brownMuted)
                    TextField("Search by title, author, maker, or source", text: $searchTerm)
                        .font(.subheadline)
                        .submitLabel(.search)
                        .autocorrectionDisabled()
                    if !searchTerm.isEmpty {
                        Button { searchTerm = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.brownMuted) }
                            .accessibilityLabel("Clear search")
                    }
                }
                .padding(.horizontal, 16)
                .frame(height: 44)
                .background(Theme.surfaceRaised, in: Capsule())
                .overlay(Capsule().strokeBorder(Theme.border))
                .accessibilityLabel("Search your collection")

                // Icons rather than words: most people never change layout.
                HStack(spacing: 2) {
                    ForEach(Layout.allCases, id: \.self) { mode in
                        Button { layout = mode } label: {
                            Image(systemName: mode == .tiles ? "square.grid.3x3" : mode == .cards ? "rectangle.grid.1x2" : "list.bullet")
                                .font(.footnote)
                                .frame(width: 34, height: 36)
                                .foregroundStyle(layout == mode ? Theme.onAction : Theme.brown)
                                .background(layout == mode ? Theme.action : .clear, in: Capsule())
                        }
                        .accessibilityLabel("\(mode.rawValue.capitalized) view")
                        .accessibilityAddTraits(layout == mode ? .isSelected : [])
                    }
                }
                .padding(4)
                .background(Theme.surfaceRaised, in: Capsule())
                .overlay(Capsule().strokeBorder(Theme.border))
            }

            HStack(spacing: 8) {
                Button { filtersOpen = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "slider.horizontal.3")
                        Text("Filters")
                        if !activeFilters.isEmpty {
                            Text("\(activeFilters.count)")
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 7)
                                .padding(.vertical, 1)
                                .foregroundStyle(Theme.onAction)
                                .background(Theme.action, in: Capsule())
                        }
                    }
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.ink)
                    .padding(.horizontal, 16)
                    .frame(height: 44)
                    .background(Theme.surfaceRaised, in: Capsule())
                    .overlay(Capsule().strokeBorder(Theme.border))
                }
                Menu {
                    Picker("Sort", selection: $sortOrder) {
                        ForEach(ItemsLogic.sortOptions) { Text($0.label).tag($0.value) }
                    }
                } label: {
                    HStack {
                        Text(ItemsLogic.sortOptions.first { $0.value == sortOrder }?.label ?? "")
                            .lineLimit(1)
                        Spacer(minLength: 4)
                        Image(systemName: "chevron.down").font(.caption)
                    }
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.ink)
                    .padding(.horizontal, 16)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(Theme.surfaceRaised, in: Capsule())
                    .overlay(Capsule().strokeBorder(Theme.border))
                }
                .accessibilityLabel("Sort: \(ItemsLogic.sortOptions.first { $0.value == sortOrder }?.label ?? "")")
            }

            if !activeFilters.isEmpty {
                FlowLayout(spacing: 8) {
                    ForEach(activeFilters, id: \.label) { filter in
                        Button(action: filter.clear) {
                            HStack(spacing: 4) {
                                Text(filter.label)
                                Image(systemName: "xmark").font(.caption2)
                            }
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Theme.green)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 5)
                            .background(Theme.tint, in: Capsule())
                        }
                        .accessibilityLabel("Remove filter: \(filter.label)")
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 4)
            }
        }
    }

    private var countLine: some View {
        let all = visibleInventory.count
        let shown = displayed.count
        let sold = isSoldView ? "sold " : ""
        return HStack {
            Text(shown == all ? "\(all) \(sold)\(all == 1 ? "item" : "items")" : "\(shown) of \(all) \(sold)items")
            Spacer()
            if isSoldView {
                Button("‹ Back to your collection") { statusView = "active" }.underline().foregroundStyle(Theme.green)
            } else if !app.soldInventory.isEmpty {
                Button("View \(app.soldInventory.count) sold ›") { statusView = "sold" }.underline().foregroundStyle(Theme.green)
            }
        }
        .font(.subheadline)
        .foregroundStyle(Theme.brown)
    }

    // MARK: Results

    @ViewBuilder private var results: some View {
        if visibleInventory.isEmpty, app.inventoryLoad == .loading || app.inventoryLoad == .idle {
            Card(padding: 28) {
                VStack(spacing: 12) {
                    Image(systemName: "receipt").font(.title2).foregroundStyle(Theme.green)
                        .frame(width: 56, height: 56).background(Theme.tint, in: RoundedRectangle(cornerRadius: 16))
                    Text("Just a sec…").font(.display(24, relativeTo: .title2).weight(.semibold))
                    Text("Pulling your collection together.").foregroundStyle(Theme.brown)
                }
                .frame(maxWidth: .infinity)
            }
        } else if visibleInventory.isEmpty, case .failed(let message) = app.inventoryLoad {
            ErrorState(title: "Couldn't load your collection", message: message) { await app.refreshInventory() }
        } else if visibleInventory.isEmpty {
            // Nothing catalogued -- a different thing from nothing matching.
            EmptyState(
                systemImage: "receipt",
                title: isSoldView ? "Nothing sold yet" : "Nothing in your collection yet",
                message: isSoldView ? "Items you mark sold are kept here with what they sold for." : "Add an item or import a CSV to start building your cost-basis record.",
                actionTitle: isSoldView ? nil : "Add to collection",
                action: isSoldView ? nil : { app.selectedTab = .add }
            )
        } else if displayed.isEmpty {
            EmptyState(
                systemImage: "magnifyingglass",
                title: "No matches",
                message: "Try a different search term or filter.",
                actionTitle: activeFilters.isEmpty && searchTerm.isEmpty ? nil : "Clear search and filters",
                action: clearAll
            )
        } else {
            switch layout {
            case .tiles:
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12, alignment: .top), count: 3), spacing: 20) {
                    ForEach(displayed) { entry in
                        Button { openTile = entry } label: {
                            CollectionTile(entry: entry, highlighted: highlighted == entry.id)
                        }
                        .buttonStyle(.plain)
                        .id(entry.id)
                    }
                }
            case .cards:
                LazyVStack(spacing: 16) {
                    ForEach(displayed) { entry in
                        CollectionCard(entry: entry, highlighted: highlighted == entry.id, actions: actions)
                            .id(entry.id)
                    }
                }
            case .records:
                RecordsList(entries: displayed, highlighted: highlighted, actions: actions)
            }
        }
    }

    private var actions: CollectionCard.Actions {
        CollectionCard.Actions(
            viewPhotos: { entry, kind in photoViewer = PhotoViewerRequest(itemId: entry.id, kind: kind) },
            edit: { editing = $0 },
            markSold: { markingSold = $0 },
            restore: { entry in
                app.restoreSold(entry.id)
                statusView = "active"
            },
            askToDelete: { deleting = $0 }
        )
    }

    private func clearAll() {
        searchTerm = ""
        categoryFilter = ""
        genreFilter = ""
        editionFilter = ""
        printingFilter = ""
    }

    // A cover tapped on the dashboard asks for one item: in Tiles its card
    // opens over the tiles; in the other layouts the list scrolls to it and
    // marks it, briefly.
    private func focus(on id: String?, proxy: ScrollViewProxy) {
        guard let id else { return }
        clearAll()
        statusView = app.soldInventory.contains { $0.id == id } ? "sold" : "active"
        if layout == .tiles, let entry = app.inventory.first(where: { $0.id == id }) {
            openTile = entry
        }
        highlighted = id
        Task {
            try? await Task.sleep(for: .milliseconds(150))
            withAnimation { proxy.scrollTo(id, anchor: .center) }
            try? await Task.sleep(for: .seconds(2.6))
            if highlighted == id { highlighted = nil }
            if app.focusItemId == id { app.focusItemId = nil }
        }
    }

    // MARK: Filters

    private var filtersSheet: some View {
        let genres = Array(Set(visibleInventory.map(\.bookGenre).filter { !$0.isEmpty })).sorted()
        let editions = Array(Set(visibleInventory.map(\.bookEdition).filter { !$0.isEmpty })).sorted()
        let printings = Array(Set(visibleInventory.map(\.bookPrinting).filter { !$0.isEmpty })).sorted()
        return NavigationStack {
            Form {
                FilterPicker(label: "Category", allLabel: "All categories", selection: $categoryFilter, options: Vocab.quickCategories)
                if !genres.isEmpty { FilterPicker(label: "Genre", allLabel: "All genres", selection: $genreFilter, options: genres) }
                if !editions.isEmpty { FilterPicker(label: "Edition", allLabel: "All editions", selection: $editionFilter, options: editions) }
                if !printings.isEmpty { FilterPicker(label: "Printing", allLabel: "All printings", selection: $printingFilter, options: printings) }
                Section {
                    Button("Clear all") { categoryFilter = ""; genreFilter = ""; editionFilter = ""; printingFilter = "" }
                        .disabled(activeFilters.isEmpty)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.page)
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    // Filters apply as they're chosen; this is the way back.
                    Button("Show \(displayed.count) \(displayed.count == 1 ? "item" : "items")") { filtersOpen = false }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

private struct FilterPicker: View {
    let label: String
    let allLabel: String
    @Binding var selection: String
    let options: [String]

    var body: some View {
        Picker(label, selection: $selection) {
            Text(allLabel).tag("")
            ForEach(options, id: \.self) { Text($0).tag($0) }
        }
    }
}

// One figure in the stats strip.
struct StatStripItem: View {
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 4) {
            Text(label.uppercased()).font(.system(size: 11)).tracking(1.5).foregroundStyle(Theme.brownMuted)
            Text(value)
                .font(.ledger(17, relativeTo: .headline).weight(.semibold))
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 6)
        .accessibilityElement(children: .combine)
    }
}

struct PhotoViewerRequest: Identifiable, Hashable {
    enum Kind { case all, receipt }
    var itemId: String
    var kind: Kind
    var id: String { itemId + (kind == .all ? ":all" : ":receipt") }
}

// A tile is the cover and nothing else; tapping it lays that item's card
// over the tiles. Looked up by id on every render, so it shows edits as they
// land and closes itself when the item leaves this view.
private struct TileCardSheet: View {
    let itemId: String
    let actions: CollectionCard.Actions
    let queue: (@escaping () -> Void) -> Void
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            if let entry = app.inventory.first(where: { $0.id == itemId }) {
                CollectionCard(entry: entry, highlighted: false, actions: handOff)
                    .padding(16)
            } else {
                Color.clear.onAppear { dismiss() }
            }
        }
        .background(Theme.page)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    // The photo viewer, edit form and dialogs open from the collection page:
    // queue the action, close this card, and the page runs it on dismissal.
    private var handOff: CollectionCard.Actions {
        func later(_ run: @escaping () -> Void) {
            queue(run)
            dismiss()
        }
        return CollectionCard.Actions(
            viewPhotos: { entry, kind in later { actions.viewPhotos(entry, kind) } },
            edit: { entry in later { actions.edit(entry) } },
            markSold: { entry in later { actions.markSold(entry) } },
            restore: { entry in actions.restore(entry) },
            askToDelete: { entry in later { actions.askToDelete(entry) } }
        )
    }
}
