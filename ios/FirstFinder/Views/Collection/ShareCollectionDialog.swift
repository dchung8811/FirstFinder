import SwiftUI

// ShareCollectionDialog: the settings behind the public /c/<slug> page. It
// reads the real row; saving changes only the phone's copy, so the live page
// is never touched. "Open preview" opens the live page, which shows the last
// settings saved on the web, not these.
struct ShareCollectionDialog: View {
    let settings: ShareSettings

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var draft: ShareSettings
    @State private var confirmingReset = false

    init(settings: ShareSettings) {
        self.settings = settings
        _draft = State(initialValue: settings)
    }

    private var dirty: Bool { PublicCollection.settingsChanged(saved: settings, draft: draft) }
    private var sharedItems: [Item] { app.inventory.filter { PublicCollection.isItemShared($0, draft) } }
    private var isLive: Bool { settings.visibility != "off" }

    private var shareURL: URL? {
        guard !settings.slug.isEmpty else { return nil }
        let site = (try? app.config.get().siteURL) ?? AppConfig.defaultSiteURL
        return URL(string: PublicCollection.sharePath(settings.slug), relativeTo: site)?.absoluteURL
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 6) {
                        Eyebrow("Share")
                        Text("Your public collection page").font(.display(28, relativeTo: .title).weight(.semibold))
                        Text("A read-only page you can send to anyone. You choose what it shows — it starts with titles, editions, condition and photos, and nothing about money.")
                            .font(.subheadline).foregroundStyle(Theme.brown)
                    }
                    if let shareURL { linkPanel(shareURL) }
                    visibility
                    Field(label: "Page title", text: $draft.title)
                    presets
                    alsoShow
                    ExploreSettings(draft: $draft, sharedItems: sharedItems)
                    preview
                }
                .padding(20)
            }
            .background(Theme.page)
            .navigationTitle("Share")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(draft.visibility == "off" ? "Save" : "Save and publish") {
                        Task { if await app.saveShare(draft) { dismiss() } }
                    }
                    .disabled(!dirty || app.isSaving)
                }
                ToolbarItem(placement: .bottomBar) {
                    if dirty { Text("Unsaved changes").font(.footnote).foregroundStyle(Theme.brownSoft) }
                }
            }
            .confirmationDialog("Reset your link?", isPresented: $confirmingReset, titleVisibility: .visible) {
                Button("Reset link", role: .destructive) { Task { if await app.resetShareLink() { dismiss() } } }
            } message: {
                Text("Resetting gives you a new address and breaks every link you've already sent.")
            }
        }
    }

    // Grey when off, green when live: color is read first, so it carries the
    // same answer as the words.
    private func linkPanel(_ url: URL) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Circle().fill(isLive ? Theme.green : Theme.adaptive(0xa2957f, dark: 0xa2957f)).frame(width: 8, height: 8)
                Text(isLive ? "YOUR LINK — LIVE NOW" : "YOUR LINK — CURRENTLY OFF").font(.caption).tracking(1.5)
            }
            .foregroundStyle(isLive ? Theme.green : Theme.brownSoft)
            Text(url.absoluteString).font(.ledger(13, relativeTo: .footnote)).foregroundStyle(Theme.ink).textSelection(.enabled)
            FlowLayout(spacing: 8) {
                Button {
                    UIPasteboard.general.string = url.absoluteString
                    app.toasts.push("Link copied.", tone: .success)
                } label: { Label("Copy link", systemImage: "doc.on.doc") }
                    .buttonStyle(isLive ? .ffPrimary : .ffSecondary)
                ShareLink(item: url) { Label("Share…", systemImage: "square.and.arrow.up") }
                    .buttonStyle(.ffSecondary)
                // Not while there are unsaved switches: the live page would
                // contradict them.
                Button("Open preview") { openURL(url) }
                    .buttonStyle(.ffSecondary)
                    .disabled(dirty || draft.visibility == "off")
                Button("Reset link") { confirmingReset = true }
                    .buttonStyle(.ffSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text("Resetting gives you a new address and breaks every link you've already sent — the way to take back a page you shared with the wrong person.")
                .font(.caption).foregroundStyle(Theme.brownSoft)
        }
        .padding(16)
        .background(isLive ? Theme.tint : Theme.adaptive(0xf3ece1, dark: 0x0f332d), in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(isLive ? Theme.green.opacity(0.25) : Theme.border))
    }

    private var visibility: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("WHO CAN SEE IT").font(.caption).tracking(1.5).foregroundStyle(Theme.brownSoft)
            ForEach(PublicCollection.visibilities) { choice in
                Button { draft.visibility = choice.value } label: {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: draft.visibility == choice.value ? "largecircle.fill.circle" : "circle")
                            .foregroundStyle(Theme.green)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(choice.label).font(.subheadline.weight(.medium)).foregroundStyle(Theme.ink)
                            Text(choice.detail).font(.caption).foregroundStyle(Theme.brownSoft)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(12)
                    .background(draft.visibility == choice.value ? Theme.tint : Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(draft.visibility == choice.value ? Theme.green : Theme.borderSoft))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(draft.visibility == choice.value ? .isSelected : [])
            }
        }
    }

    private var presets: some View {
        let presetId = PublicCollection.matchingPresetId(draft)
        return VStack(alignment: .leading, spacing: 8) {
            Text("START FROM").font(.caption).tracking(1.5).foregroundStyle(Theme.brownSoft)
            FlowLayout(spacing: 8) {
                ForEach(PublicCollection.presets) { preset in
                    Button(preset.label) { draft = PublicCollection.applyPreset(draft, presetId: preset.id) }
                        .buttonStyle(presetId == preset.id ? .ffPrimary : .ffSecondary)
                }
                if presetId == nil {
                    Text("Custom").font(.subheadline.weight(.medium)).foregroundStyle(Theme.brownSoft)
                        .padding(.horizontal, 16).padding(.vertical, 10)
                        .overlay(Capsule().strokeBorder(Theme.borderStrong, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text(PublicCollection.presets.first { $0.id == presetId }?.detail ?? "Your own combination of the switches below.")
                .font(.caption).foregroundStyle(Theme.brownSoft)
        }
    }

    private var alsoShow: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("ALSO SHOW").font(.caption).tracking(1.5).foregroundStyle(Theme.brownSoft)
            ForEach(PublicCollection.fieldGroups) { group in
                ShareToggle(group: group, isOn: Binding(get: { draft[keyPath: group.key] }, set: { draft[keyPath: group.key] = $0 }))
            }
        }
    }

    private var preview: some View {
        let hidden = app.inventory.filter(\.hiddenFromShare).count
        let all = app.inventory.count
        return VStack(alignment: .leading, spacing: 10) {
            Text("WHAT VISITORS SEE").font(.caption).tracking(1.5).foregroundStyle(Theme.brownSoft)
            Text("\(sharedItems.count) of \(all) \(all == 1 ? "item" : "items")\(hidden > 0 ? ", \(hidden) hidden individually" : "").")
                .font(.caption).foregroundStyle(Theme.brownSoft)
            if let first = sharedItems.first {
                SharePreviewCard(item: PublicCollection.buildPublicItem(first, draft))
            } else {
                Text("Nothing would appear on your page with these settings.")
                    .font(.caption).foregroundStyle(Theme.brownSoft).padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.borderStrong, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
            }
            Text("Receipt photos are never published, whatever you switch on — they carry addresses and card details. Items with one get a “Receipt on file” badge instead.")
                .font(.caption).foregroundStyle(Theme.brown).padding(12)
                .background(Theme.pill, in: RoundedRectangle(cornerRadius: 16))
            Text("To keep one item off the page, open it from your collection and tick “Hide from my public page”.")
                .font(.caption).foregroundStyle(Theme.brownSoft)
        }
    }
}

struct ShareToggle: View {
    let group: PublicCollection.FieldGroup
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(group.label).font(.subheadline.weight(.medium)).foregroundStyle(Theme.ink)
                Text(group.detail).font(.caption).foregroundStyle(Theme.brownSoft)
                // Warn at the moment of the decision, where it can still change.
                if let warning = group.warning, isOn {
                    Text(warning).font(.caption).foregroundStyle(Theme.warningInk)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(Theme.warningSurface, in: RoundedRectangle(cornerRadius: 10))
                        .padding(.top, 4)
                }
            }
        }
        .toggleStyle(CheckboxToggleStyle())
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.borderSoft))
    }
}

// ExploreSettings: the blurb, the Explore opt-in (only for listed pages),
// and up to eight items to lead with.
struct ExploreSettings: View {
    @Binding var draft: ShareSettings
    let sharedItems: [Item]
    @State private var filter = ""

    var body: some View {
        let listed = draft.visibility == "listed"
        let on = listed && draft.showOnExplore
        VStack(alignment: .leading, spacing: 10) {
            Text("EXPLORE").font(.caption).tracking(1.5).foregroundStyle(Theme.brownSoft)
            VStack(alignment: .leading, spacing: 4) {
                Text("About this collection").font(.subheadline.weight(.medium))
                Text("What you collect and what makes it unique. Shown beside your shelf on Explore and at the top of your page.")
                    .font(.caption).foregroundStyle(Theme.brownSoft)
                TextField("Modern American firsts, mostly bought at estate sales — every one in its original jacket.", text: Binding(
                    get: { draft.blurb },
                    set: { draft.blurb = String($0.prefix(PublicCollection.blurbMax)) }
                ), axis: .vertical)
                .lineLimit(3...6)
                .padding(12)
                .background(Theme.field, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.fieldBorder))
                Text("\(draft.blurb.count)/\(PublicCollection.blurbMax)").font(.caption).foregroundStyle(Theme.brownMuted)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            Toggle(isOn: Binding(get: { on }, set: { draft.showOnExplore = $0 })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Show on Explore").font(.subheadline.weight(.medium)).foregroundStyle(listed ? Theme.ink : Theme.brownMuted)
                    Text(listed
                         ? "Your shelf appears on FirstFinder's public Explore page: its title, item count, and \(Mapping.exploreStripLimit) covers. Never prices, values or notes, whatever you switch on below."
                         : "Explore only includes pages listed on search engines. Choose “Listed on search engines” above to turn this on.")
                        .font(.caption).foregroundStyle(Theme.brownSoft)
                }
            }
            .toggleStyle(CheckboxToggleStyle())
            .disabled(!listed)
            .padding(12)
            .background(listed ? Theme.surfaceRaised : Theme.adaptive(0xf3ece1, dark: 0x0f332d), in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.borderSoft))

            if on { picker }
        }
    }

    private var picker: some View {
        let sharedIds = Set(sharedItems.map(\.id))
        let picks = draft.exploreItemIds.filter { sharedIds.contains($0) }
        let full = picks.count >= Mapping.exploreStripLimit
        let needle = filter.trimmingCharacters(in: .whitespaces).lowercased()
        let byId = Dictionary(uniqueKeysWithValues: sharedItems.map { ($0.id, $0) })
        let ordered = picks.compactMap { byId[$0] } + sharedItems.filter { entry in
            !picks.contains(entry.id) && (needle.isEmpty || "\(entry.name) \(ItemsLogic.credit(entry))".lowercased().contains(needle))
        }
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Lead with these").font(.subheadline.weight(.medium))
                Spacer()
                Text(picks.isEmpty ? "None chosen — your \(Mapping.exploreStripLimit) most recent show" : "\(picks.count) of \(Mapping.exploreStripLimit) chosen")
                    .font(.caption).foregroundStyle(Theme.brownSoft)
            }
            if sharedItems.count > 12 {
                TextField("Find an item", text: $filter)
                    .padding(10)
                    .background(Theme.field, in: RoundedRectangle(cornerRadius: 12))
                    .accessibilityLabel("Find an item to feature on Explore")
            }
            if sharedItems.isEmpty {
                Text("Nothing would appear on your page with these settings.").font(.caption).foregroundStyle(Theme.brownSoft)
            }
            ForEach(ordered.prefix(60)) { entry in
                let position = picks.firstIndex(of: entry.id)
                let blocked = position == nil && full
                Button {
                    draft.exploreItemIds = PublicCollection.toggleExplorePick(picks, entry.id)
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: position != nil ? "checkmark.square.fill" : "square").foregroundStyle(Theme.green)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(entry.name.isEmpty ? "Untitled item" : entry.name).font(.subheadline).lineLimit(1)
                            let credit = ItemsLogic.credit(entry)
                            Text(credit.isEmpty ? "Unknown maker" : credit).font(.caption).foregroundStyle(Theme.brownSoft).lineLimit(1)
                        }
                        Spacer()
                        if entry.itemPhotos.isEmpty { Chip(text: "NO PHOTO") }
                        if let position {
                            Text("\(position + 1)").font(.caption.weight(.semibold)).foregroundStyle(Theme.onAction)
                                .frame(width: 24, height: 24).background(Theme.action, in: Circle())
                        }
                    }
                    .foregroundStyle(Theme.ink)
                    .opacity(blocked ? 0.5 : 1)
                }
                .buttonStyle(.plain)
                .disabled(blocked)
            }
            if full {
                Text("That's \(Mapping.exploreStripLimit). Untick one to choose another.").font(.caption).foregroundStyle(Theme.brownSoft)
            }
        }
        .padding(12)
        .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.borderSoft))
    }
}

// SharePreviewCard: one item as a visitor would see it under these settings.
struct SharePreviewCard: View {
    let item: PublicCollection.PublicItem

    var body: some View {
        let edition = PublicCollection.editionLine(category: item.category, edition: item.edition, bookEdition: item.bookEdition, bookPrinting: item.bookPrinting)
        let credit = ExploreLogic.credit(category: item.category, author: item.author, maker: item.maker)
        var details: [(String, String)] = []
        if let value = item.estimatedValue { details.append(("Est. value", Format.currency(value))) }
        if let paid = item.purchasePrice { details.append(("Paid", Format.currency(paid))) }
        if let sold = item.soldPrice { details.append(("Sold for", Format.currency(sold))) }
        if let date = item.purchaseDate { details.append(("Acquired", date)) }
        if let source = item.source { details.append(("Source", source)) }

        return VStack(alignment: .leading, spacing: 0) {
            ZStack {
                Theme.chip
                if let photo = item.photos.first { SignedPhoto(path: photo.path) } else { Text("No photo").font(.caption).foregroundStyle(Theme.brownMuted) }
            }
            .frame(height: 128)
            .clipped()
            VStack(alignment: .leading, spacing: 6) {
                Text(item.name.isEmpty ? "Untitled item" : item.name).font(.headline)
                if !credit.isEmpty { Text(credit).font(.subheadline).foregroundStyle(Theme.brown) }
                FlowLayout(spacing: 6) {
                    if !edition.isEmpty { Chip(text: edition, tone: .tint) }
                    if !item.condition.isEmpty { Chip(text: item.condition) }
                    if item.hasReceipt { Chip(text: "Receipt on file") }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                ForEach(details, id: \.0) { label, value in DetailRow(label: label, value: value) }
                if let notes = item.notes {
                    Text("NOTES").font(.caption2).tracking(1.4).foregroundStyle(Theme.brownMuted).padding(.top, 4)
                    Text(notes).font(.caption).lineLimit(3)
                }
            }
            .padding(14)
        }
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.border))
    }
}
