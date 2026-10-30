import SwiftUI

// The Records view: the web's table, as rows a phone can hold. Name, credit,
// category, status and the two amounts are each tappable to edit in place
// (InlineCell); the change goes through csvUpdateRow, as on the web.
struct RecordsList: View {
    let entries: [Item]
    let highlighted: String?
    let actions: CollectionCard.Actions

    @Environment(AppModel.self) private var app

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Tap any name, category, status, or amount to edit it here.")
                .font(.caption)
                .foregroundStyle(Theme.brownMuted)
                .padding(16)
            ForEach(entries) { entry in
                Divider().overlay(Theme.borderSoft)
                row(entry)
                    .padding(16)
                    .background(highlighted == entry.id ? Theme.tint : .clear)
                    .id(entry.id)
            }
        }
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).strokeBorder(Theme.border))
    }

    private func row(_ entry: Item) -> some View {
        let authored = ItemsLogic.usesAuthorField(entry.category)
        let credit = ItemsLogic.credit(entry)
        let sold = entry.status == "Sold"
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                InlineCell(label: "item name", value: entry.name, display: entry.name.isEmpty ? "Untitled item" : entry.name, bold: true) {
                    app.inlineSave(entry.id, fields: ["name": $0])
                }
                if app.isLocal(itemId: entry.id) { LocalChip() }
            }
            InlineCell(label: authored ? "author" : "maker", value: authored ? entry.author : entry.maker, display: credit.isEmpty ? "Unknown maker" : credit) {
                app.inlineSave(entry.id, fields: authored ? ["author": $0] : ["maker": $0])
            }
            HStack(spacing: 16) {
                InlineCell(label: "category", value: entry.category, options: Vocab.quickCategories) {
                    app.inlineSave(entry.id, fields: ["category": $0])
                }
                InlineCell(label: "status", value: entry.status, options: Vocab.statuses) {
                    app.inlineSave(entry.id, fields: ["status": $0])
                }
            }
            HStack(spacing: 16) {
                LabeledInline(label: "Cost") {
                    InlineCell(label: "what you paid", value: Format.amountText(entry.purchasePrice), display: Format.currency(entry.purchasePrice), numeric: true) {
                        app.inlineSave(entry.id, fields: ["purchasePrice": $0])
                    }
                }
                LabeledInline(label: "Value") {
                    InlineCell(
                        label: sold ? "sold price" : "estimated value",
                        value: Format.amountText(sold ? entry.soldPrice : entry.estimatedValue),
                        display: ItemsLogic.formatEstimatedValue(entry),
                        numeric: true
                    ) {
                        app.inlineSave(entry.id, fields: sold ? ["soldPrice": $0] : ["estimatedValue": $0])
                    }
                }
            }
            HStack(spacing: 8) {
                Button("View \(entry.itemPhotoCount + entry.receiptPhotoCount)") { actions.viewPhotos(entry, .all) }
                    .font(.caption.weight(.medium))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 5)
                    .foregroundStyle(Theme.green)
                    .background(Theme.tint, in: Capsule())
                    .accessibilityLabel("View photos")
                Spacer()
                Button("Edit") { actions.edit(entry) }.buttonStyle(.ffSecondary)
                if sold {
                    Button("Restore") { actions.restore(entry) }.buttonStyle(.ffSecondary)
                } else {
                    Button("Sold") { actions.markSold(entry) }.buttonStyle(.ffSecondary)
                }
                Button { actions.askToDelete(entry) } label: {
                    Image(systemName: "trash").foregroundStyle(Theme.brown).frame(width: 40, height: 40).background(Theme.chip, in: Circle())
                }
                .accessibilityLabel("Delete \(entry.name.isEmpty ? "this item" : entry.name)")
            }
        }
    }
}

private struct LabeledInline<Content: View>: View {
    let label: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased()).font(.caption2).tracking(1.4).foregroundStyle(Theme.brownMuted)
            content
        }
    }
}

// InlineCell: tap to edit in place. Options become a menu; text and amounts
// an alert with a field. Saving an unchanged value does nothing.
struct InlineCell: View {
    let label: String
    let value: String
    var display: String?
    var options: [String]?
    var numeric = false
    var bold = false
    let onSave: (String) -> Void

    @State private var editing = false
    @State private var draft = ""

    var body: some View {
        if let options {
            Menu {
                Picker(label, selection: Binding(get: { value }, set: { next in commit(next) })) {
                    ForEach(options, id: \.self) { Text($0).tag($0) }
                }
            } label: {
                shown
            }
            .accessibilityLabel("Edit \(label): \(value)")
        } else {
            Button {
                draft = value
                editing = true
            } label: {
                shown
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Edit \(label): \(display ?? value)")
            .alert("Edit \(label)", isPresented: $editing) {
                TextField(label, text: $draft)
                    .keyboardType(numeric ? .decimalPad : .default)
                Button("Cancel", role: .cancel) {}
                Button("Save") { commit(draft) }
            }
        }
    }

    private var shown: some View {
        let text = display ?? value
        return Text(text.isEmpty ? "—" : text)
            .font(bold ? .headline : numeric ? .ledger(15, relativeTo: .subheadline) : .subheadline)
            .foregroundStyle(text.isEmpty ? Theme.brownMuted : (bold ? Theme.ink : Theme.brown))
            .underline(color: Theme.border)
            .multilineTextAlignment(.leading)
    }

    private func commit(_ next: String) {
        guard next != value else { return }
        onSave(next)
    }
}
