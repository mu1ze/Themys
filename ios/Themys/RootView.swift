import SwiftUI
import ClerkKit

struct RootView: View {
  @EnvironmentObject private var auth: AuthController
  @Environment(Clerk.self) private var clerk
  @AppStorage("themys.didCompleteSafariOnboarding") private var didOnboard = false

  var body: some View {
    Group {
      if !clerk.isLoaded {
        ProgressView("Loading Themys")
      } else if !clerk.isAuthFlowComplete {
        SignInScreen()
      } else if !didOnboard {
        OnboardingScreen()
      } else {
        TabView {
          HistoryScreen()
            .tabItem { Label("Scans", systemImage: "doc.text") }
          NavigationStack {
            SettingsScreen()
          }
          .tabItem { Label("Settings", systemImage: "gear") }
        }
      }
    }
    .onChange(of: clerk.isLoaded) { _, loaded in
      if loaded {
        Task { await auth.sessionDidChange() }
      }
    }
    .onChange(of: clerk.user?.id) { _, _ in
      Task { await auth.sessionDidChange() }
    }
    .onChange(of: clerk.isAuthFlowComplete) { _, complete in
      if complete {
        Task { await auth.sessionDidChange() }
      }
    }
  }
}
