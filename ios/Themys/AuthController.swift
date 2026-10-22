import Foundation
import SwiftUI
import ClerkKit

@MainActor
final class AuthController: ObservableObject {
  @Published var isSignedIn = false
  @Published var status = "Sign in to enable Safari capture."

  private var refreshTask: Task<Void, Never>?
  private var eventTask: Task<Void, Never>?
  private static var bootstrapped = false

  static func bootstrapClerk() -> Bool {
    let key = ThemysConfig.publishableKey
    guard !key.isEmpty, !key.contains("REPLACE") else { return false }
    guard ClerkSession.configure(publishableKey: key) else { return false }
    bootstrapped = true
    return true
  }

  func configure() async {
    let key = ThemysConfig.publishableKey
    if key.isEmpty || key.contains("REPLACE") {
      status = "Add CLERK_PUBLISHABLE_KEY to Info.plist."
      return
    }
    listenForAuthEvents()
    await waitUntilClerkLoaded()
    await publishCurrentSession()
  }

  func handleOpenURL(_ url: URL) async {
    if let returnValue = URLComponents(url: url, resolvingAgainstBaseURL: false)?
      .queryItems?
      .first(where: { $0.name == "return" })?
      .value {
      SessionBridge.storePendingReturnURL(returnValue)
    }
    guard Self.bootstrapped else { return }
    try? await Clerk.shared.handle(url)
    await publishCurrentSession()
  }

  func sessionDidChange() async {
    await publishCurrentSession()
  }

  func publishCurrentSession() async {
    guard Self.bootstrapped else { return }
    guard Clerk.shared.isLoaded else { return }
    guard Clerk.shared.user != nil, Clerk.shared.session?.status == .active else {
      applySignedOut(status: "Sign in to enable Safari capture.")
      return
    }
    do {
      guard let jwt = try await Clerk.shared.auth.getToken(Session.GetTokenOptions(expirationBuffer: 15)), !jwt.isEmpty else {
        applySignedOut(status: "Sign in to enable Safari capture.")
        return
      }
      publish(jwt: jwt)
    } catch {
      if Clerk.shared.user == nil {
        applySignedOut(status: "Session expired. Sign in again.")
      } else {
        status = "Could not refresh session."
        scheduleRefresh(before: Date().addingTimeInterval(20))
      }
    }
  }

  func signOut() async {
    refreshTask?.cancel()
    refreshTask = nil
    if Self.bootstrapped {
      do {
        try await Clerk.shared.auth.signOut()
      } catch {
        status = "Could not sign out. Please try again."
        return
      }
    }
    applySignedOut(status: "Signed out.")
  }

  private func waitUntilClerkLoaded(timeoutSeconds: Double = 8) async {
    let deadline = Date().addingTimeInterval(timeoutSeconds)
    while !Clerk.shared.isLoaded, Date() < deadline {
      try? await Task.sleep(nanoseconds: 50_000_000)
    }
  }

  private func listenForAuthEvents() {
    eventTask?.cancel()
    eventTask = Task { [weak self] in
      for await event in Clerk.shared.auth.events {
        guard let self, !Task.isCancelled else { break }
        await self.handleAuthEvent(event)
      }
    }
  }

  private func handleAuthEvent(_ event: AuthEvent) async {
    switch event {
    case .signInCompleted(signIn: _), .signUpCompleted(signUp: _):
      await publishCurrentSession()
    case .sessionChanged(_, let newValue):
      if newValue == nil {
        guard Clerk.shared.isLoaded else { return }
        applySignedOut(status: "Sign in to enable Safari capture.")
      } else {
        await publishCurrentSession()
      }
    case .signedOut(session: _), .accountDeleted:
      applySignedOut(status: "Signed out.")
    case .tokenRefreshed(let token):
      guard !token.isEmpty else { return }
      publish(jwt: token)
    case .signInNeedsContinuation(signIn: _), .signUpNeedsContinuation(signUp: _):
      break
    }
  }

  private func publish(jwt: String) {
    let expiresAt = SessionBridge.jwtExpiry(of: jwt)
    SessionBridge.publish(
      token: jwt,
      userId: Clerk.shared.user?.id,
      expiresAt: expiresAt
    )
    isSignedIn = true
    status = "Signed in."
    scheduleRefresh(before: expiresAt)
    resumeSafariIfNeeded()
  }

  private func applySignedOut(status: String) {
    refreshTask?.cancel()
    refreshTask = nil
    SessionBridge.clear()
    isSignedIn = false
    self.status = status
  }

  private func scheduleRefresh(before expiresAt: Date?) {
    refreshTask?.cancel()
    let fireDate = (expiresAt ?? Date().addingTimeInterval(45)).addingTimeInterval(-15)
    let delay = max(5, fireDate.timeIntervalSinceNow)
    refreshTask = Task { [weak self] in
      let nanoseconds = UInt64(delay * 1_000_000_000)
      try? await Task.sleep(nanoseconds: nanoseconds)
      guard !Task.isCancelled else { return }
      await self?.publishCurrentSession()
    }
  }

  private func resumeSafariIfNeeded() {
    guard isSignedIn, let raw = SessionBridge.takePendingReturnURL(), let url = URL(string: raw) else {
      return
    }
    UIApplication.shared.open(url)
  }
}
