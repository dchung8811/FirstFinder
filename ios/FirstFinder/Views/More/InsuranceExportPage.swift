import SwiftUI
import UIKit

// InsuranceExportPage: a printable summary of the active collection, for
// insurance, estate planning or the collector's own records. The web prints
// it; the phone renders the same summary to a PDF and hands it to the share
// sheet as data, so no copy is written to disk first.
struct InsuranceExportPage: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        let items = app.activeInventory
        let paid = items.reduce(Decimal(0)) { $0 + Format.toNumber($1.purchasePrice) }
        let value = items.reduce(Decimal(0)) { $0 + (ItemsLogic.valueForTotals($1) ?? 0) }
        let unvalued = items.filter { ItemsLogic.valueForTotals($0) == nil }.count

        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Collection report.").font(.display(36, relativeTo: .largeTitle).weight(.semibold))
                Text("A printable summary of your active collection — for insurance, estate planning, or your own records. Save it as a PDF, or export the raw data as a CSV (photos aren't included in the CSV).")
                    .foregroundStyle(Theme.brown)
                FlowLayout(spacing: 10) {
                    ShareLink(item: ReportPDF(items: items), preview: SharePreview("FirstFinder collection report.pdf")) {
                        Label("Save as PDF", systemImage: "doc.richtext")
                    }
                    .buttonStyle(.ffPrimary)
                    ShareLink(item: CsvFile(name: "firstfinder-collection-export.csv", text: Csv.export(items)), preview: SharePreview("firstfinder-collection-export.csv")) {
                        Label("Export as CSV", systemImage: "doc.text")
                    }
                    .buttonStyle(.ffSecondary)
                    Button("Back to collection") { app.selectedTab = .collection }.buttonStyle(.ffSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                DashboardCard(systemImage: "shippingbox", label: "Active items", value: "\(items.count)")
                DashboardCard(systemImage: "receipt", label: "Total cost basis", value: Format.currency(paid))
                DashboardCard(systemImage: "dollarsign", label: "Total estimated value", value: Format.currency(value))
                if unvalued > 0 {
                    Text("\(unvalued) item\(unvalued == 1 ? " has" : "s have") no estimate and \(unvalued == 1 ? "isn't" : "aren't") counted in the total.")
                        .font(.subheadline).foregroundStyle(Theme.brownMuted)
                }

                if items.isEmpty {
                    EmptyState(systemImage: "doc.text", title: "Nothing to report yet", message: "Items you add show up here, ready to print for an insurer.")
                } else {
                    VStack(spacing: 0) {
                        ForEach(items) { item in
                            ReportRow(item: item)
                            Divider().overlay(Theme.borderSoft)
                        }
                    }
                    .background(Theme.adaptive(0xffffff, dark: 0x123f38), in: RoundedRectangle(cornerRadius: 28))
                    .clipShape(RoundedRectangle(cornerRadius: 28))
                    .overlay(RoundedRectangle(cornerRadius: 28).strokeBorder(Theme.border))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 24)
        }
        .background(Theme.page)
        .navigationTitle(AppView.insuranceExport.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct ReportRow: View {
    let item: Item

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name.isEmpty ? "Untitled item" : item.name).font(.headline)
                    let credit = ItemsLogic.credit(item)
                    Text("\(credit.isEmpty ? "Unknown maker" : credit) · \(item.category)\(item.condition.isEmpty ? "" : " · \(item.condition)")")
                        .font(.subheadline).foregroundStyle(Theme.brown)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Cost \(Format.currency(item.purchasePrice))")
                    Text("Value \(ItemsLogic.formatEstimatedValue(item))")
                }
                .font(.ledger(13, relativeTo: .footnote))
            }
            Text("Purchased \(item.purchaseDate.isEmpty ? "unknown date" : item.purchaseDate) · \(item.source.isEmpty ? "unknown source" : item.source) · \(item.itemPhotoCount + item.receiptPhotoCount) photos")
                .font(.caption).foregroundStyle(Theme.brownMuted)
            if !item.notes.isEmpty { Text(item.notes).font(.caption).foregroundStyle(Theme.brownMuted) }
        }
        .padding(16)
        .accessibilityElement(children: .combine)
    }
}

// The report as a PDF: the web's print layout, drawn with UIKit text so it
// paginates on letter-size pages. Photos are left out -- they'd need every
// signed image downloaded first, and the CSV leaves them out too.
struct ReportPDF: Transferable {
    let items: [Item]

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .pdf) { report in await report.render() }
            .suggestedFileName("FirstFinder collection report.pdf")
    }

    @MainActor
    func render() -> Data {
        let page = CGRect(x: 0, y: 0, width: 612, height: 792)
        let margin: CGFloat = 48
        let width = page.width - margin * 2
        let renderer = UIGraphicsPDFRenderer(bounds: page)
        let ink = UIColor(hex: 0x201a14)
        let brown = UIColor(hex: 0x665746)
        let muted = UIColor(hex: 0x8a7a64)

        func attributes(_ size: CGFloat, _ color: UIColor, bold: Bool = false) -> [NSAttributedString.Key: Any] {
            [.font: bold ? UIFont.boldSystemFont(ofSize: size) : UIFont.systemFont(ofSize: size), .foregroundColor: color]
        }

        return renderer.pdfData { context in
            var y = page.height
            func ensure(_ height: CGFloat) {
                if y + height > page.height - margin {
                    context.beginPage()
                    y = margin
                }
            }
            func draw(_ text: String, _ attrs: [NSAttributedString.Key: Any], x: CGFloat = margin, w: CGFloat = width) -> CGFloat {
                let string = NSAttributedString(string: text, attributes: attrs)
                let rect = string.boundingRect(with: CGSize(width: w, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin], context: nil)
                string.draw(with: CGRect(x: x, y: y, width: w, height: rect.height), options: [.usesLineFragmentOrigin], context: nil)
                return ceil(rect.height)
            }

            ensure(.greatestFiniteMagnitude)
            y += draw("FirstFinder — Collection Report", attributes(20, ink, bold: true)) + 4
            y += draw("Generated \(Format.todayIso()) · \(items.count) item\(items.count == 1 ? "" : "s")", attributes(11, brown)) + 12

            let paid = items.reduce(Decimal(0)) { $0 + Format.toNumber($1.purchasePrice) }
            let value = items.reduce(Decimal(0)) { $0 + (ItemsLogic.valueForTotals($1) ?? 0) }
            y += draw("Active items: \(items.count)    Total cost basis: \(Format.currency(paid))    Total estimated value: \(Format.currency(value))", attributes(11, ink, bold: true)) + 16

            for item in items {
                ensure(64)
                let top = y
                let title = item.name.isEmpty ? "Untitled item" : item.name
                y += draw(title, attributes(12, ink, bold: true), w: width - 140)
                let credit = ItemsLogic.credit(item)
                y += draw("\(credit.isEmpty ? "Unknown maker" : credit) · \(item.category)\(item.condition.isEmpty ? "" : " · \(item.condition)")", attributes(10, brown), w: width - 140)
                let saved = y
                y = top
                _ = draw("Cost \(Format.currency(item.purchasePrice))\nValue \(ItemsLogic.formatEstimatedValue(item))", attributes(10, ink), x: margin + width - 130, w: 130)
                y = saved
                y += draw("Purchased \(item.purchaseDate.isEmpty ? "unknown date" : item.purchaseDate) · \(item.source.isEmpty ? "unknown source" : item.source)", attributes(9, muted))
                if !item.notes.isEmpty { y += draw(item.notes, attributes(9, muted)) }
                y += 10
                context.cgContext.setStrokeColor(UIColor(hex: 0xe0d2bc).cgColor)
                context.cgContext.stroke(CGRect(x: margin, y: y - 5, width: width, height: 0.5))
            }
        }
    }
}
