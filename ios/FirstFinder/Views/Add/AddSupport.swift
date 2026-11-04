import PhotosUI
import SwiftUI
import UIKit

// What an add form holds while it's being filled: the item, plus the amounts
// and dates as typed. Amounts stay text until save, so a blank estimate
// becomes nil -- never 0.
struct ItemDraft: Equatable {
    var item = Item.empty()
    var paidText = ""
    var valueText = ""
    var purchaseDate: Date? = Date()
    var soldDate: Date?
    var itemPhotos: [Photo] = []
    var receiptPhotos: [Photo] = []

    var isSold: Bool { item.status == "Sold" }

    mutating func setStatus(_ status: String) {
        item.status = status
        if status == "Sold", soldDate == nil { soldDate = Date() }
    }

    func built() -> Item {
        var next = item
        next.purchasePrice = Format.optionalAmount(paidText)
        if isSold {
            next.soldPrice = Format.optionalAmount(valueText)
            next.soldDate = soldDate.map(Format.day) ?? ""
        } else {
            next.estimatedValue = Format.optionalAmount(valueText)
        }
        next.purchaseDate = purchaseDate.map(Format.day) ?? ""
        return next
    }

    mutating func load(_ sample: Item) {
        item = sample
        paidText = Format.amountText(sample.purchasePrice)
        valueText = Format.amountText(sample.status == "Sold" ? sample.soldPrice : sample.estimatedValue)
        purchaseDate = Format.parseDay(sample.purchaseDate)
        soldDate = Format.parseDay(sample.soldDate)
    }
}

// "Take or upload": the photo library, or the camera where there is one.
// Picked photos are held in the overlay's memory and nowhere else.
struct PhotoPickerButton<Label: View>: View {
    var maxCount: Int?
    let onPicked: ([Photo]) -> Void
    @ViewBuilder var label: Label

    @Environment(AppModel.self) private var app
    @State private var choosing = false
    @State private var showingLibrary = false
    @State private var showingCamera = false
    @State private var picked: [PhotosPickerItem] = []

    private var cameraAvailable: Bool { UIImagePickerController.isSourceTypeAvailable(.camera) }

    var body: some View {
        Button {
            if cameraAvailable { choosing = true } else { showingLibrary = true }
        } label: {
            label
        }
        .confirmationDialog("Add a photo", isPresented: $choosing) {
            Button("Take photo") { showingCamera = true }
            Button("Choose from library") { showingLibrary = true }
        }
        .photosPicker(isPresented: $showingLibrary, selection: $picked, maxSelectionCount: maxCount, matching: .images)
        .onChange(of: picked) { _, items in
            guard !items.isEmpty else { return }
            Task {
                var photos: [Photo] = []
                for (index, item) in items.enumerated() {
                    if let data = try? await item.loadTransferable(type: Data.self) {
                        photos.append(app.pendingPhotos.store(data, name: "photo-\(index + 1).jpg"))
                    }
                }
                picked = []
                onPicked(photos)
            }
        }
        .fullScreenCover(isPresented: $showingCamera) {
            CameraPicker { data in
                if let data { onPicked([app.pendingPhotos.store(data, name: "camera.jpg")]) }
            }
            .ignoresSafeArea()
        }
    }
}

private struct CameraPicker: UIViewControllerRepresentable {
    let onDone: (Data?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onDone: onDone) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onDone: (Data?) -> Void
        init(onDone: @escaping (Data?) -> Void) { self.onDone = onDone }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            let image = info[.originalImage] as? UIImage
            onDone(image?.jpegData(compressionQuality: 0.85))
            picker.dismiss(animated: true)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onDone(nil)
            picker.dismiss(animated: true)
        }
    }
}

// CompactUploader / PhotoUploader: a set of photos with a count, a picker,
// and a remove button on each.
struct PhotoUploader: View {
    let title: String
    let systemImage: String
    var eyebrow: String?
    var description: String?
    var prompts: [String] = []
    @Binding var photos: [Photo]

    @Environment(AppModel.self) private var app

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    if let eyebrow { Eyebrow(eyebrow) }
                    Label(title, systemImage: systemImage).font(eyebrow == nil ? .headline : .display(22, relativeTo: .title3).weight(.semibold))
                    if let description { Text(description).font(.subheadline).foregroundStyle(Theme.brown) }
                }
                Spacer()
                Text("\(photos.count)").font(.caption).padding(.horizontal, 10).padding(.vertical, 3)
                    .foregroundStyle(Theme.green).background(Theme.tint, in: Capsule())
            }
            PhotoPickerButton(onPicked: { photos.append(contentsOf: $0) }) {
                VStack(spacing: 4) {
                    Image(systemName: systemImage).font(.title2).foregroundStyle(Theme.green)
                    Text("Take or upload").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.ink)
                    if eyebrow != nil {
                        Text("Works with camera or photo library.").font(.caption).foregroundStyle(Theme.brownSoft)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, eyebrow == nil ? 14 : 28)
                .background(Theme.adaptive(0xf7ecdc, dark: 0x0f332d), in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.adaptive(0xcbb894, dark: 0x7d6c5a), style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])))
            }
            .buttonStyle(.plain)
            if !prompts.isEmpty {
                FlowLayout(spacing: 6) { ForEach(prompts, id: \.self) { Chip(text: $0) } }
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if !photos.isEmpty {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                    ForEach(photos) { photo in
                        ZStack(alignment: .topTrailing) {
                            ZStack { Theme.pill; SignedPhoto(path: photo.path) }
                                .frame(height: 80)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            Button {
                                photos.removeAll { $0.path == photo.path }
                                app.pendingPhotos.forget([photo.path])
                            } label: {
                                Image(systemName: "xmark").font(.caption2.weight(.bold)).foregroundStyle(.white)
                                    .frame(width: 26, height: 26).background(Color.black.opacity(0.7), in: Circle())
                            }
                            .padding(5)
                            .accessibilityLabel("Remove \(photo.name)")
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.border))
    }
}

// BookNameField: the item name, with book suggestions from the guides and
// the catalog once three letters are typed. Suggestions are only offered for
// books, as on the web.
struct BookNameField: View {
    let label: String
    @Binding var draft: ItemDraft
    let enabled: Bool

    @Environment(AppModel.self) private var app
    @State private var suggestions: [BookSearch.Suggestion] = []
    @State private var searchTask: Task<Void, Never>?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).font(.subheadline.weight(.medium)).foregroundStyle(Theme.brown)
            TextField("", text: $draft.item.name)
                .focused($focused)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .fieldInks()
                .background(Theme.field, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.fieldBorder))
                .accessibilityLabel(label)
                .onChange(of: draft.item.name) { _, query in search(query) }
            if focused, enabled, !suggestions.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(suggestions) { suggestion in
                        Button {
                            draft.item = BookSearch.apply(suggestion, to: draft.item)
                            suggestions = []
                            focused = false
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                HStack {
                                    Text(suggestion.title).font(.subheadline.weight(.medium)).foregroundStyle(Theme.ink)
                                    if suggestion.tier == .guide { Chip(text: "Guide", tone: .tint) }
                                }
                                let subtitle = BookSearch.subtitle(suggestion)
                                if !subtitle.isEmpty { Text(subtitle).font(.caption).foregroundStyle(Theme.brownSoft) }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                        }
                        .buttonStyle(.plain)
                        Divider().overlay(Theme.borderSoft)
                    }
                }
                .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.border))
            }
        }
    }

    private func search(_ query: String) {
        searchTask?.cancel()
        guard enabled, BookSearch.isSearchable(query) else {
            suggestions = []
            return
        }
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            let catalog = await app.searchBookCatalog(query)
            guard !Task.isCancelled else { return }
            suggestions = BookSearch.merge(guides: BookSearch.searchGuides(query), catalog: catalog)
        }
    }
}

// IdentifyLoadingOverlay: the photo being read, a scan sweeping over it, and
// a rotating line of what's happening. No fake percentage.
struct IdentifyLoadingOverlay: View {
    let photos: [Photo]
    var steps = IdentifyLoadingOverlay.identifyingSteps
    var note = "This usually takes a few seconds. You'll get to review and edit everything before anything is saved."

    static let identifyingSteps = ["Reading the cover…", "Matching the title and author…", "Looking for edition points…", "Checking the number line…", "Searching for comparable sales…", "Weighing sold prices over asking prices…", "Weighing the condition…"]
    static let scanningSteps = ["Reading the cover…", "Reading the copyright page…", "Copying the number line…"]

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var step = 0
    @State private var sweep = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.6).ignoresSafeArea()
            VStack(spacing: 14) {
                if let cover = photos.first {
                    ZStack(alignment: .top) {
                        SignedPhoto(path: cover.path).opacity(0.85)
                        if !reduceMotion {
                            LinearGradient(colors: [.clear, Color(UIColor(hex: 0x2f7d6b)).opacity(0.5), .clear], startPoint: .top, endPoint: .bottom)
                                .frame(height: 96)
                                .offset(y: sweep ? 300 : -60)
                                .animation(.easeInOut(duration: 1.9).repeatForever(autoreverses: false), value: sweep)
                        }
                    }
                    .frame(height: 280)
                    .frame(maxWidth: .infinity)
                    .background(Color.black)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                if photos.count > 1 {
                    Text("READING \(photos.count) PHOTOS TOGETHER").font(.caption).tracking(1.5).foregroundStyle(Theme.brownMuted)
                }
                Text(steps[step % steps.count])
                    .font(.display(18, relativeTo: .headline).weight(.semibold))
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.center)
                    .id(step)
                    .transition(.opacity)
                ProgressView().progressViewStyle(.linear).tint(Color(UIColor(hex: 0x2f7d6b)))
                Text(note).font(.subheadline).foregroundStyle(Theme.brownMuted).multilineTextAlignment(.center)
            }
            .padding(24)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 28))
            .overlay(RoundedRectangle(cornerRadius: 28).strokeBorder(Theme.border))
            .padding(24)
            .accessibilityElement(children: .combine)
        }
        .task {
            sweep = true
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(1700))
                withAnimation(reduceMotion ? nil : .easeOut(duration: 0.3)) { step += 1 }
            }
        }
    }
}

// DuplicateWarningDialog: never blocks the save, only says what looks related.
struct DuplicateWarningDialog: View {
    let matches: [ItemsLogic.DuplicateMatch]
    let onConfirm: () -> Void
    @Environment(\.dismiss) private var dismiss

    private func copy(_ type: ItemsLogic.MatchType) -> (String, Chip.Tone) {
        switch type {
        case .possibleDuplicate: ("POSSIBLE DUPLICATE", .error)
        case .differentCopy: ("DIFFERENT COLLECTIBLE COPY", .neutral)
        case .potentialUpgrade: ("POTENTIAL UPGRADE", .tint)
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Eyebrow("Before you add this")
                    Text("Already something like this in your collection").font(.display(24, relativeTo: .title2).weight(.semibold))
                    Text("This won't stop you from saving it -- collectors deliberately keep multiple copies and upgrades. Just flagging what looks related.")
                        .foregroundStyle(Theme.brown)
                    ForEach(matches) { match in
                        let (label, tone) = copy(match.matchType)
                        let entry = match.entry
                        let details = [
                            ItemsLogic.credit(entry),
                            entry.category == "Book" ? [entry.bookEdition, entry.bookPrinting].filter { !$0.isEmpty }.joined(separator: " / ") : entry.edition,
                            entry.condition,
                        ].filter { !$0.isEmpty }.joined(separator: " • ")
                        VStack(alignment: .leading, spacing: 6) {
                            Chip(text: label, tone: tone)
                            Text((entry.name.isEmpty ? "Untitled item" : entry.name) + (entry.referenceNumber.map { " (\(Format.reference($0)))" } ?? ""))
                                .font(.headline)
                            Text(details.isEmpty ? "No extra details on file" : details).font(.subheadline).foregroundStyle(Theme.brownSoft)
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.adaptive(0xfffaf1, dark: 0x123f38), in: RoundedRectangle(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.adaptive(0xe7dcc7, dark: 0x665746)))
                    }
                    HStack {
                        Button("Go back and edit") { dismiss() }.buttonStyle(.ffSecondary)
                        Spacer()
                        Button("Add anyway") { dismiss(); onConfirm() }.buttonStyle(.ffPrimary)
                    }
                    .padding(.top, 6)
                }
                .padding(20)
            }
            .background(Theme.page)
        }
    }
}
