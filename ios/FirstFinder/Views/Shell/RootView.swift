import SwiftUI

// The top of the app: the prototype banner, the site and offline banners,
// then either the signed-out pages or the tab bar, with toasts over all of it.
struct RootView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        VStack(spacing: 0) {
            PrototypeBanner()
            SiteBannerView()
            OfflineBanner()
            content
                .frame(maxHeight: .infinity)
        }
        .background(Theme.page)
        .overlay(alignment: .bottom) {
            ToastStack().padding(.bottom, 56)
        }
        .tint(Theme.green)
    }

    @ViewBuilder private var content: some View {
        if app.dataMode == .live, case .failure(let problem) = app.config {
            ConfigProblemView(problem: problem)
        } else {
            switch app.auth {
            case .unknown:
                LoadingState(label: "Opening FirstFinder…")
            case .signedOut:
                SignedOutRoot()
            case .signedIn:
                MainTabView()
            }
        }
    }
}

// Shown in Live mode when Secrets.xcconfig is missing or wrong. Sample mode
// still works, so the screen offers it.
struct ConfigProblemView: View {
    let problem: AppConfig.Problem
    @Environment(AppModel.self) private var app

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                PageHeader(eyebrow: "Live mode", title: "Not configured", subtitle: problem.message)
                Button("Use Sample mode") { Task { await app.switchMode(to: .sample) } }
                    .buttonStyle(.ffPrimary)
            }
            .padding(16)
        }
    }
}

// Signed out: Home, Log in, Sign up, Reset password and the public pages.
struct SignedOutRoot: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            SignedOutHome(path: $path)
                .navigationDestination(for: AppView.self) { view in
                    SignedOutDestination(view: view, path: $path)
                }
                .navigationDestination(for: WebRoute.self) { WebPage(route: $0) }
        }
    }
}

// The landing page's slot. HomePage (with featured shelves) is built in its
// own step; until then this offers the way in and the public pages.
struct SignedOutHome: View {
    @Binding var path: NavigationPath
    @Environment(AppModel.self) private var app

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PageHeader(
                    eyebrow: "FirstFinder",
                    title: "Catalog your collection and identify first editions",
                    subtitle: "Home with featured shelves is built in a later step."
                )
                VStack(spacing: 10) {
                    Button("Log in") { path.append(AppView.login) }
                        .buttonStyle(FFButtonStyle(variant: .primary, fullWidth: true))
                    Button("Get started") { path.append(AppView.signup) }
                        .buttonStyle(FFButtonStyle(variant: .secondary, fullWidth: true))
                }
                Card {
                    VStack(alignment: .leading, spacing: 0) {
                        Eyebrow("Explore and learn").padding(.bottom, 8)
                        NavRow(title: "Explore", systemImage: "safari") { path.append(WebRoute.explore) }
                        ForEach([AppView.features, .roadmap, .about, .contribute, .privacy, .terms]) { view in
                            NavRow(title: view.title, systemImage: MoreView.icon(for: view)) { path.append(view) }
                        }
                        NavRow(title: "Book guides", systemImage: "books.vertical") { path.append(WebRoute.bookGuides) }
                        NavRow(title: "Reset password", systemImage: "key") { path.append(AppView.resetPassword) }
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.page)
        .navigationTitle("FirstFinder")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct SignedOutDestination: View {
    let view: AppView
    @Binding var path: NavigationPath

    var body: some View {
        switch view {
        case .login:
            LoginPage(mode: .signin, onViewTerms: { path.append(AppView.terms) }, onViewPrivacy: { path.append(AppView.privacy) })
        case .signup:
            LoginPage(mode: .signup, onViewTerms: { path.append(AppView.terms) }, onViewPrivacy: { path.append(AppView.privacy) })
        case .resetPassword:
            ResetPasswordPage()
        default:
            ScreenPlaceholder(view: view)
        }
    }
}

struct NavRow: View {
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .frame(width: 24)
                    .foregroundStyle(Theme.green)
                    .accessibilityHidden(true)
                Text(title).foregroundStyle(Theme.ink)
                Spacer()
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(Theme.brownMuted)
                    .accessibilityHidden(true)
            }
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
