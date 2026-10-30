import SwiftUI

// FullAddPage, the "Add an item" tutorial: every field, then item photos,
// then receipts, then a review before saving.
struct FullAddPage: View {
    let onSaved: (ItemDraft, @escaping () -> Void) -> Void

    @Environment(AppModel.self) private var app
    @State private var draft = ItemDraft()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Add the complete record.")
                        .font(.display(38, relativeTo: .largeTitle).weight(.semibold))
                        .accessibilityAddTraits(.isHeader)
                    Text("Use this guided tutorial when you want to capture every field, item photo, and receipt/proof image before saving.")
                        .foregroundStyle(Theme.brown)
                    Button("Try a sample") {
                        if let sample = Vocab.sampleItems.randomElement() { draft.load(sample) }
                    }
                    .buttonStyle(.ffSecondary)
                }

                Card(padding: 22) {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Eyebrow("Step 1")
                                Text("Item record").font(.display(24, relativeTo: .title2).weight(.semibold))
                            }
                            Spacer()
                            Chip(text: "Detailed", tone: .tint)
                        }
                        BookNameField(label: "Item name", draft: $draft, enabled: draft.item.category == "Book")
                        SelectField(label: "Category", selection: $draft.item.category, options: Vocab.quickCategories)
                        if ItemsLogic.usesAuthorField(draft.item.category) { Field(label: "Author", text: $draft.item.author) }
                        Field(label: "Make / Publisher / Brand", text: $draft.item.maker)
                        if draft.item.category == "Book" {
                            Field(label: "Genre", text: $draft.item.bookGenre)
                            SelectField(label: "Edition", selection: $draft.item.bookEdition, options: Vocab.bookEditionOptions, placeholder: "Select edition")
                            SelectField(label: "Printing", selection: $draft.item.bookPrinting, options: Vocab.bookPrintingOptions, placeholder: "Select printing")
                        } else {
                            Field(label: "Edition / Variant / Details", text: $draft.item.edition)
                        }
                        SelectField(label: "Status", selection: Binding(get: { draft.item.status }, set: { value in draft.setStatus(value) }), options: Vocab.statuses)
                        if draft.isSold { OptionalDateField(label: "Sold on", date: $draft.soldDate) }
                        SelectField(label: "Condition", selection: $draft.item.condition, options: Vocab.conditionOptions, placeholder: "Not set")
                        OptionalDateField(label: "Purchase date", date: $draft.purchaseDate)
                        Field(label: "Where purchased", text: $draft.item.source)
                        Field(label: "What you paid", text: $draft.paidText, kind: .decimal)
                        Field(label: draft.isSold ? "Sold for" : "Estimated value", text: $draft.valueText, kind: .decimal)
                        Field(label: "Notes", text: $draft.item.notes)
                    }
                }

                PhotoUploader(
                    title: "Item photos", systemImage: "camera", eyebrow: "Step 2",
                    description: "Capture condition, edition points, signatures, defects, tags, labels, or packaging.",
                    prompts: Vocab.itemPhotoPrompts, photos: $draft.itemPhotos
                )
                PhotoUploader(
                    title: "Receipt / proof photos", systemImage: "receipt", eyebrow: "Step 3",
                    description: "Save receipts, invoices, order confirmations, auction records, or payment screenshots.",
                    prompts: Vocab.receiptPhotoPrompts, photos: $draft.receiptPhotos
                )

                Card(padding: 22) {
                    VStack(alignment: .leading, spacing: 14) {
                        Eyebrow("Step 4")
                        Text("Review and save").font(.display(24, relativeTo: .title2).weight(.semibold))
                        HStack(spacing: 10) {
                            SummaryPill(label: "Item photos", value: "\(draft.itemPhotos.count)")
                            SummaryPill(label: "Receipt photos", value: "\(draft.receiptPhotos.count)")
                            SummaryPill(label: "Status", value: draft.item.status)
                        }
                        if draft.receiptPhotos.isEmpty {
                            Text("Add a receipt or proof photo if you want to be able to prove what you paid later.")
                                .font(.subheadline).foregroundStyle(Theme.warningInk).padding(12)
                                .background(Theme.warningSurface, in: RoundedRectangle(cornerRadius: 12))
                        }
                        Button("Save to collection") { onSaved(draft) { draft = ItemDraft() } }
                            .buttonStyle(FFButtonStyle(variant: .primary, fullWidth: true))
                        Button("Reset form") {
                            app.overlay.forgetPhotos((draft.itemPhotos + draft.receiptPhotos).map(\.path))
                            draft = ItemDraft()
                        }
                        .buttonStyle(FFButtonStyle(variant: .secondary, fullWidth: true))
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 24)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.page)
        .navigationTitle(AppView.tutorial.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct SummaryPill: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased()).font(.caption2).tracking(1.4).foregroundStyle(Theme.brownSoft)
            Text(value).font(.headline).foregroundStyle(Theme.ink).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Theme.pill, in: RoundedRectangle(cornerRadius: 16))
        .accessibilityElement(children: .combine)
    }
}
