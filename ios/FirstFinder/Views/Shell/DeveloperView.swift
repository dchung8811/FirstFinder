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

            Section {
                Picker("Next AI result", selection: Binding(get: { app.fakeAI.outcome }, set: { app.fakeAI.outcome = $0 })) {
                    ForEach(FakeAI.Outcome.allCases) { Text($0.rawValue).tag($0) }
                }
                LabeledContent("Identifications left today", value: "\(app.fakeAI.remainingToday) of \(FakeAI.dailyLimit)")
                Button("Reset today's count") { app.fakeAI.resetUsage() }
            } header: {
                Text("Sample mode's AI")
            } footer: {
                Text("In Sample mode, Identify and Snap a picture never call the real service. They answer after 1.5 seconds with a sample result, or with the failure chosen above, in the web's words. Live mode uses the real service and your account's real daily allowance.")
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
