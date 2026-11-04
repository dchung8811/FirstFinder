import SwiftUI

// WishlistPage: "The hunt." What you're looking for and the copy that would
// actually be a yes. None of it counts toward what the collection is worth.
struct WishlistPage: View {
    @Environment(AppModel.self) private var app
    @State private var editing: Want?
    @State private var finding: Want?

    var body: some View {
        let wishlist = app.wishlist
        let openList = WishlistLogic.sort(WishlistLogic.open(wishlist))
        let found = WishlistLogic.found(wishlist)
        let summary = WishlistLogic.summarize(wishlist)
        let itemsById = Dictionary(app.inventory.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })

        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("The hunt.").font(.display(40, relativeTo: .largeTitle).weight(.semibold)).accessibilityAddTraits(.isHeader)
                    Text("What you're looking for, and the copy that would actually be a yes. None of it counts toward what your collection is worth.")
                        .foregroundStyle(Theme.brown)
                    Button("Add a want") { editing = Want(id: "") }.buttonStyle(.ffPrimary)
                }

                if !openList.isEmpty {
                    DashboardCard(systemImage: "magnifyingglass", label: "Still looking for", value: "\(summary.openCount) \(summary.openCount == 1 ? "copy" : "copies")")
                    DashboardCard(
                        systemImage: "dollarsign",
                        label: summary.withCeiling == summary.openCount ? "If you paid every ceiling" : "Ceilings on \(summary.withCeiling) of \(summary.openCount)",
                        value: Format.currency(summary.ceilingTotal)
                    )
                    DashboardCard(systemImage: "checkmark", label: "Found so far", value: "\(summary.foundCount) \(summary.foundCount == 1 ? "copy" : "copies")")
                }

                if wishlist.isEmpty, app.wishlistLoad == .loading || app.wishlistLoad == .idle {
                    LoadingState(label: "Loading your wishlist…")
                } else if wishlist.isEmpty, case .failed(let message) = app.wishlistLoad {
                    ErrorState(title: "Couldn't load your wishlist", message: message) { await app.refreshWishlist() }
                } else if openList.isEmpty {
                    EmptyState(
                        systemImage: "heart",
                        title: found.isEmpty ? "Nothing on the hunt yet" : "Nothing on the list right now",
                        message: found.isEmpty
                            ? "Describe the copy you're after — the edition, the condition, what you won't go over — and the search links write themselves."
                            : "You've found everything you were looking for. Add the next one whenever it occurs to you.",
                        actionTitle: "Add a want",
                        action: { editing = Want(id: "") }
                    )
                } else {
                    ForEach(openList) { want in
                        WantCard(
                            want: want,
                            upgradeFor: want.upgradeForItemId.isEmpty ? nil : itemsById[want.upgradeForItemId],
                            onEdit: { editing = $0 },
                            onFound: { finding = $0 }
                        )
                    }
                }

                // What was hunted and found is the interesting half of collecting.
                if !found.isEmpty {
                    SectionHeading("Found").padding(.top, 16)
                    VStack(spacing: 0) {
                        ForEach(found) { want in
                            VStack(alignment: .leading, spacing: 2) {
                                HStack {
                                    Text(want.name).font(.headline)
                                }
                                if !want.maker.isEmpty { Text(want.maker).font(.subheadline).foregroundStyle(Theme.brown) }
                                Text("Hunted \(WishlistLogic.accountDate(want.createdAt)) — found \(WishlistLogic.accountDate(want.foundAt))")
                                    .font(.subheadline).foregroundStyle(Theme.brownMuted)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                            .overlay(alignment: .bottom) { Rectangle().fill(Theme.adaptive(0xeadfcd, dark: 0x665746)).frame(height: 1) }
                        }
                    }
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 28))
                    .clipShape(RoundedRectangle(cornerRadius: 28))
                    .overlay(RoundedRectangle(cornerRadius: 28).strokeBorder(Theme.border))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 24)
        }
        .background(Theme.page)
        .refreshable { await app.refreshWishlist() }
        .toolbar(.hidden, for: .navigationBar)
        .navigationTitle(AppView.wishlist.title)
        .sheet(item: $editing) { WantDialog(want: $0) }
        .sheet(item: $finding) { FoundItDialog(want: $0) }
    }
}

struct PriorityChip: View {
    let priority: String

    var body: some View {
        let (background, ink): (UInt32, UInt32) = switch priority {
        case "grail": (0xf7e0dc, 0x8f3524)
        case "someday": (0xf0e2cf, 0x665746)
        default: (0xedf4f2, 0x123f38)
        }
        Text(WishlistLogic.priorityLabel(priority).uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(1)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .foregroundStyle(Theme.adaptive(ink, dark: ink))
            .background(Theme.adaptive(background, dark: background), in: Capsule())
    }
}

struct CriteriaChips: View {
    let want: Want

    var body: some View {
        let chips = WishlistLogic.describeCriteria(want)
        if chips.isEmpty {
            Text("Any copy. No conditions set.").font(.subheadline).foregroundStyle(Theme.brownMuted)
        } else {
            FlowLayout(spacing: 8) {
                ForEach(chips, id: \.self) { Chip(text: $0.text, tone: $0.green ? .tint : .neutral) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct WantCard: View {
    let want: Want
    let upgradeFor: Item?
    let onEdit: (Want) -> Void
    let onFound: (Want) -> Void
    @Environment(AppModel.self) private var app

    var body: some View {
        Card(padding: 22) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            PriorityChip(priority: want.priority)
                        }
                        if !want.createdAt.isEmpty {
                            Text("Watching since \(WishlistLogic.accountDate(want.createdAt))").font(.caption).foregroundStyle(Theme.brownMuted)
                        }
                        Text(want.name.isEmpty ? "Untitled want" : want.name).font(.display(22, relativeTo: .title3).weight(.semibold))
                        if !want.maker.isEmpty { Text(want.maker).foregroundStyle(Theme.brown) }
                    }
                    Spacer(minLength: 8)
                    // A ceiling: what the collector won't exceed, never what
                    // the copy is worth.
                    if let max = want.maxPrice {
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("WON'T PAY OVER").font(.system(size: 11)).tracking(1.4).foregroundStyle(Theme.brownMuted)
                            Text(Format.currency(max)).font(.ledger(22, relativeTo: .title3).weight(.medium))
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                if let upgradeFor {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass").font(.caption).foregroundStyle(Theme.brownSoft)
                        Text("Would replace **\(Format.reference(upgradeFor.referenceNumber))**\(upgradeFor.condition.isEmpty ? "" : " — your \(upgradeFor.condition) copy")")
                            .font(.footnote).foregroundStyle(Theme.brown)
                    }
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.page, in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.adaptive(0xeadfcd, dark: 0x665746)))
                }
                CriteriaChips(want: want)
                if !want.notes.isEmpty { Text(want.notes).font(.subheadline).foregroundStyle(Theme.brown) }
                Divider().overlay(Theme.adaptive(0xeadfcd, dark: 0x665746))
                FlowLayout(spacing: 8) {
                    if let links = WishlistLogic.searchLinks(want) {
                        Link("Search AbeBooks", destination: links.abebooks).buttonStyle(.ffSecondary)
                        Link("eBay", destination: links.ebay).buttonStyle(.ffSecondary)
                    }
                    Button("Edit") { onEdit(want) }.buttonStyle(.ffSecondary)
                    Button("I found it") { onFound(want) }.buttonStyle(.ffPrimary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

// ChoiceRow: a labelled row of pill buttons for a short list of choices.
struct ChoiceRow: View {
    let label: String
    let options: [WishlistLogic.Option]
    @Binding var value: String
    var hint: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(label).font(.subheadline.weight(.medium)).foregroundStyle(Theme.brown)
                if let hint { Text(hint).font(.subheadline).foregroundStyle(Theme.brownMuted) }
            }
            FlowLayout(spacing: 8) {
                ForEach(options) { option in
                    Button(option.label) { value = option.value }
                        .font(.footnote.weight(.medium))
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .foregroundStyle(value == option.value ? Theme.onAction : Theme.brown)
                        .background(value == option.value ? Theme.action : Theme.surfaceWarm, in: Capsule())
                        .overlay(Capsule().strokeBorder(value == option.value ? .clear : Theme.borderStrong))
                        .accessibilityAddTraits(value == option.value ? .isSelected : [])
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// WantDialog: not the book -- the copy.
struct WantDialog: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var draft: Want
    @State private var maxPrice: String
    @State private var confirmingRemove = false
    private let isNew: Bool

    init(want: Want) {
        _draft = State(initialValue: want)
        _maxPrice = State(initialValue: Format.amountText(want.maxPrice))
        isNew = want.id.isEmpty
    }

    var body: some View {
        let candidates = app.inventory
            .filter { $0.status != "Sold" }
            .sorted { $0.name.localizedCompare($1.name) == .orderedAscending }
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Eyebrow("Wishlist")
                    Text(isNew ? "What would you actually buy?" : "Edit this want").font(.display(28, relativeTo: .title).weight(.semibold))
                    Text("Not the book — the copy. The more precisely you describe it, the better the search links work.")
                        .font(.subheadline).foregroundStyle(Theme.brown)
                    Field(label: "Title", text: $draft.name)
                    Field(label: "Maker / Author / Brand", text: $draft.maker)

                    VStack(alignment: .leading, spacing: 14) {
                        Text("THE COPY THAT COUNTS").font(.caption).tracking(1.5).foregroundStyle(Theme.green)
                        Text("Conditions, not facts — they describe a copy you have not found yet.").font(.footnote)
                        SelectField(label: "Edition wanted", selection: $draft.wantedEdition, options: Vocab.bookEditionOptions, placeholder: "Any edition")
                        SelectField(label: "Printing wanted", selection: $draft.wantedPrinting, options: Vocab.bookPrintingOptions, placeholder: "Any printing")
                        Field(label: "Publisher & year", text: $draft.publisher)
                        SelectField(label: "Condition, at worst", selection: $draft.minCondition, options: Vocab.conditionOptions, placeholder: "Any condition")
                        ChoiceRow(label: "Dust jacket", options: WishlistLogic.jacketOptions, value: $draft.jacketRequirement)
                        ChoiceRow(label: "Signature", options: WishlistLogic.signatureOptions, value: $draft.signatureRequirement)
                    }
                    .padding(18)
                    .background(Theme.tint, in: RoundedRectangle(cornerRadius: 24))
                    .overlay(RoundedRectangle(cornerRadius: 24).strokeBorder(Theme.green.opacity(0.25)))

                    Field(label: "Won't pay over", text: $maxPrice, kind: .decimal)
                    Field(label: "Preferred seller or country", text: $draft.preferredSource)
                    ChoiceRow(label: "How badly", options: WishlistLogic.priorityOptions, value: $draft.priority)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Upgrade for").font(.subheadline.weight(.medium)).foregroundStyle(Theme.brown)
                        Picker("Upgrade for", selection: $draft.upgradeForItemId) {
                            Text("Not an upgrade").tag("")
                            ForEach(candidates) { entry in
                                Text([Format.reference(entry.referenceNumber), entry.name.isEmpty ? "Untitled item" : entry.name, entry.condition].filter { !$0.isEmpty }.joined(separator: " — "))
                                    .tag(entry.id)
                            }
                        }
                        .pickerStyle(.menu)
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Notes").font(.subheadline.weight(.medium)).foregroundStyle(Theme.brown)
                        TextField("What would make you pass?", text: $draft.notes, axis: .vertical)
                            .lineLimit(3...6)
                            .padding(12)
                            .background(Theme.control, in: RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.controlBorder))
                    }
                    Toggle(isOn: $draft.hiddenFromShare) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Keep this one to myself").font(.subheadline.weight(.medium))
                            Text("Stays off your public wishlist even when the rest of it is published.").font(.caption).foregroundStyle(Theme.brownSoft)
                        }
                    }
                    .toggleStyle(CheckboxToggleStyle())
                    Text("Your ceiling stays private — it is never published, whatever your sharing settings say.")
                        .font(.caption).foregroundStyle(Theme.brownSoft)
                    HStack {
                        if !isNew {
                            Button("Remove") { confirmingRemove = true }.buttonStyle(.ffSecondary)
                        }
                        Button("Cancel") { dismiss() }.buttonStyle(.ffSecondary)
                        Spacer()
                        Button(isNew ? "Add to wishlist" : "Save") {
                            var next = draft
                            next.maxPrice = Format.optionalAmount(maxPrice)
                            Task { if await app.saveWant(next) { dismiss() } }
                        }
                        .buttonStyle(.ffPrimary)
                        .disabled(!WishlistLogic.isSaveable(draft) || app.isSaving)
                    }
                }
                .padding(20)
            }
            .background(Theme.page)
            .scrollDismissesKeyboard(.interactively)
            .confirmationDialog("Remove \"\(draft.name)\" from your wishlist?", isPresented: $confirmingRemove, titleVisibility: .visible) {
                Button("Remove", role: .destructive) { Task { if await app.removeWant(draft.id) { dismiss() } } }
            }
        }
    }
}

// FoundItDialog: the copy you got, checked against what you wanted, and the
// moment to photograph it and its receipt.
struct FoundItDialog: View {
    let want: Want
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var found: WishlistLogic.Found
    @State private var acquired: Date? = Date()
    @State private var itemPhotos: [Photo] = []
    @State private var receiptPhotos: [Photo] = []

    init(want: Want) {
        self.want = want
        _found = State(initialValue: .init(source: want.preferredSource))
    }

    var body: some View {
        let criteria = WishlistLogic.describeCriteria(want)
        let ceiling = WishlistLogic.compareToCeiling(want, paid: found.purchasePrice)
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Eyebrow("Found it")
                    Text(want.name).font(.display(28, relativeTo: .title).weight(.semibold))
                    Text([want.maker, want.createdAt.isEmpty ? "" : "wanted since \(WishlistLogic.accountDate(want.createdAt))"].filter { !$0.isEmpty }.joined(separator: " · "))
                        .foregroundStyle(Theme.brown)

                    if !criteria.isEmpty {
                        panel("You wanted") {
                            FlowLayout(spacing: 8) { ForEach(criteria, id: \.self) { Chip(text: $0.text) } }
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }

                    panel("What you got") {
                        VStack(alignment: .leading, spacing: 14) {
                            SelectField(label: "Condition of this copy", selection: $found.condition, options: Vocab.conditionOptions, placeholder: "Not graded")
                            VStack(alignment: .leading, spacing: 4) {
                                Field(label: "What you paid", text: $found.purchasePrice, kind: .decimal)
                                if let max = want.maxPrice {
                                    Text("You said you wouldn't pay over \(Format.currency(max))").font(.caption).foregroundStyle(Theme.brownMuted)
                                }
                                if let ceiling {
                                    Text(ceiling.difference == 0 ? "Exactly your ceiling." : ceiling.under ? "\(Format.currency(ceiling.difference)) under your ceiling." : "\(Format.currency(ceiling.difference)) over your ceiling.")
                                        .font(.caption)
                                        .foregroundStyle(ceiling.under ? Theme.adaptive(0x1c5c4a, dark: 0xd8e6e2) : Theme.adaptive(0x8f3524, dark: 0xe2b6a1))
                                }
                            }
                            Field(label: "Where it came from", text: $found.source)
                            OptionalDateField(label: "Date acquired", date: $acquired)
                        }
                    }

                    PhotoUploader(title: "Photos of this copy", systemImage: "camera", photos: $itemPhotos)
                    PhotoUploader(title: "Receipt / proof", systemImage: "receipt", photos: $receiptPhotos)

                    Text("It joins your collection. The hunt stays on record rather than being deleted.")
                        .font(.caption).foregroundStyle(Theme.brownSoft)
                    HStack {
                        Button("Not yet") { dismiss() }.buttonStyle(.ffSecondary)
                        Spacer()
                        Button("Add to collection") {
                            var details = found
                            details.purchaseDate = acquired.map(Format.day) ?? ""
                            Task {
                                if await app.markWantFound(want, found: details, itemPhotos: itemPhotos, receiptPhotos: receiptPhotos) { dismiss() }
                            }
                        }
                        .buttonStyle(.ffPrimary)
                        .disabled(app.isSaving)
                    }
                }
                .padding(20)
            }
            .background(Theme.page)
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private func panel<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title.uppercased()).font(.system(size: 11)).tracking(1.4).foregroundStyle(Theme.brown)
                .padding(.horizontal, 16).padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.chip)
            content().padding(16).background(Theme.surfaceRaised)
        }
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .overlay(RoundedRectangle(cornerRadius: 24).strokeBorder(Theme.border))
    }
}
