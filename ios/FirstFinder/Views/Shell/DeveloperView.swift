import SwiftUI

// More → Developer: the switches that make every state of every screen
// reachable without touching the real account.
struct DeveloperView: View {
    @Environment(AppModel.self) private var app
    @State private var scenario: SampleStore.Scenario = .full

    var body: some View {
        @Bindable var app = app
        List {
            Section {
                Picker("Data", selection: Binding(get: { app.dataMode }, set: { mode in Task { await app.switchMode(to: mode) } })) {
                    ForEach(DataMode.allCases) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                if !app.isLiveAvailable {
                    Text(liveProblem).font(.footnote).foregroundStyle(Theme.errorInk)
                }
            } header: {
                Text("Data source")
            } footer: {
                Text("Live reads your real account and never writes to it. Sample is invented data, safe for screenshots. Switching discards local changes.")
            }

            Section {
                Picker("Sample data", selection: $scenario) {
                    ForEach(SampleStore.Scenario.allCases) { Text($0.rawValue).tag($0) }
                }
                .disabled(app.dataMode != .sample)
                .onChange(of: scenario) { _, next in Task { await app.setSampleScenario(next) } }
            } header: {
                Text("Sample scenario")
            } footer: {
                Text("Empty and failing scenarios show each screen's empty and error states.")
            }

            Section {
                Toggle("Act as offline", isOn: $app.forceOffline)
            } footer: {
                Text("Shows the offline banner and stops fetches, keeping whatever was last loaded.")
            }

            Section("Local changes") {
                LabeledContent("Changes on this phone", value: "\(app.overlay.changes.count)")
                Button("Discard all local changes", role: .destructive) { app.overlay.revertAll() }
                    .disabled(app.overlay.isEmpty)
            }

            Section("Reload") {
                Button("Refetch everything") { Task { await app.refreshAll() } }
                Button("Show the site banner again") { app.dismissedBannerId = nil }
            }

            Section("About this build") {
                LabeledContent("Mode", value: app.dataMode.rawValue)
                LabeledContent("Signed in as", value: app.profile?.email ?? "—")
                LabeledContent("Photo URLs", value: "Signed for \(PhotoSigning.ttlSeconds / 60) min, memory only")
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.page)
        .navigationTitle("Developer")
        .onAppear { scenario = app.sampleStore.scenario }
    }

    private var liveProblem: String {
        if case .failure(let problem) = app.config { return problem.message }
        return ""
    }
}
