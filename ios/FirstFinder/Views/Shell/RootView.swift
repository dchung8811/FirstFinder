import SwiftUI

// The top of the app: the prototype banner, the site and offline banners,
// then either the signed-out pages or the tab bar, with toasts over all of it.
struct RootView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        VStack(spacing: 0) {
            SampleModeBanner()
            SiteBannerView { app.followBannerLink($0) }
            OfflineBanner()
            content
                .frame(maxHeight: .infinity)
        }
        .background(Theme.page)
        .overlay(alignment: .bottom) {
            ToastStack().padding(.bottom, 56)
        }
        .tint(Theme.green)
        // A reset link signs in first, then asks for the new password.
        .sheet(isPresented: Binding(get: { app.choosingNewPassword }, set: { app.choosingNewPassword = $0 })) {
            NavigationStack { ResetPasswordPage().solidNavigationBar() }
        }
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

// More → Developer is reachable signed out too, so Sample mode can be
// switched on before anyone signs in.
struct DeveloperRoute: Hashable {}

// Signed out: Home, Log in, Sign up, Reset password and the public pages.
struct SignedOutRoot: View {
    @Environment(AppModel.self) private var app
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            SignedOutHome(path: $path)
                .navigationDestination(for: AppView.self) { view in
                    SignedOutDestination(view: view, path: $path)
                }
                .navigationDestination(for: WebRoute.self) { WebPage(route: $0).solidNavigationBar() }
                .navigationDestination(for: DeveloperRoute.self) { _ in DeveloperView().solidNavigationBar() }
        }
        .onChange(of: app.pendingSignedOutView) { _, view in
            guard let view else { return }
            path.append(view)
            app.pendingSignedOutView = nil
        }
        .onChange(of: app.pendingWebRoute) { _, route in
            guard let route, app.profile == nil else { return }
            path.append(route)
            app.pendingWebRoute = nil
        }
    }
}

// Signed out, Home is the web's landing page with the web's header: the
// mark and name on the left, Log in and the menu on the right.
struct SignedOutHome: View {
    @Binding var path: NavigationPath

    var body: some View {
        HomePage(path: $path)
            // The web's header, as a solid bar that stays put while the page
            // scrolls under it -- not the system's floating glass buttons,
            // which sit over the hero and the covers.
            .safeAreaInset(edge: .top, spacing: 0) { SiteHeader(path: $path) }
            .toolbar(.hidden, for: .navigationBar)
    }
}

// SiteNav for someone signed out: mark and name, Log in, and the menu.
struct SiteHeader: View {
    @Binding var path: NavigationPath

    var body: some View {
        HStack(spacing: 10) {
            LogoMark(size: 34)
            Text("FirstFinder")
                .font(.headline)
                .foregroundStyle(Theme.ink)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Button("Log in") { path.append(AppView.login) }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.onAction)
                .padding(.horizontal, 16)
                .frame(minHeight: 36)
                .background(Theme.action, in: Capsule())
            Menu {
                Button("Get Started") { path.append(AppView.signup) }
                Button("Explore") { path.append(WebRoute.explore) }
                Button(AppView.roadmap.title) { path.append(AppView.roadmap) }
                Button(AppView.about.title) { path.append(AppView.about) }
                Button(AppView.features.title) { path.append(AppView.features) }
                Button(AppView.contribute.title) { path.append(AppView.contribute) }
                Button("Book guides") { path.append(WebRoute.bookGuides) }
                #if DEBUG
                Divider()
                Button("Developer") { path.append(DeveloperRoute()) }
                #endif
            } label: {
                Image(systemName: "line.3.horizontal")
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.ink)
                    .frame(width: 36, height: 36)
                    .background(Theme.surfaceRaised, in: Circle())
                    .overlay(Circle().strokeBorder(Theme.border))
            }
            .accessibilityLabel("Menu")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Theme.page)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.borderSoft.opacity(0.6)).frame(height: 1) }
    }
}

struct SignedOutDestination: View {
    let view: AppView
    @Binding var path: NavigationPath

    var body: some View {
        switch view {
        case .login:
            LoginPage(mode: .signin, onViewTerms: { path.append(AppView.terms) }, onViewPrivacy: { path.append(AppView.privacy) })
                .solidNavigationBar()
        case .signup:
            LoginPage(mode: .signup, onViewTerms: { path.append(AppView.terms) }, onViewPrivacy: { path.append(AppView.privacy) })
                .solidNavigationBar()
        case .resetPassword:
            ResetPasswordPage().solidNavigationBar()
        default:
            PublicPage(view: view).solidNavigationBar()
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
