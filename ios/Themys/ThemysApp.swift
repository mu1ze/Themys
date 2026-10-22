import SwiftUI
import ClerkKit
import ClerkKitUI

@main
struct ThemysApp: App {
  @StateObject private var auth = AuthController()
  @Environment(\.scenePhase) private var scenePhase
  private let clerkDidConfigure: Bool

  init() {
    clerkDidConfigure = AuthController.bootstrapClerk()
  }

  var body: some Scene {
    WindowGroup {
      Group {
        if clerkDidConfigure {
          RootView()
            .prefetchClerkImages()
            .environment(Clerk.shared)
        } else {
          SignInScreen()
        }
      }
      .environmentObject(auth)
      .task { await auth.configure() }
      .onOpenURL { url in
        Task { await auth.handleOpenURL(url) }
      }
      .onChange(of: scenePhase) { _, phase in
        if phase == .active || phase == .background {
          Task { await auth.publishCurrentSession() }
        }
      }
    }
  }
}
