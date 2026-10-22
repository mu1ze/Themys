import SwiftUI
import ClerkKit
import ClerkKitUI

struct SignInScreen: View {
  @EnvironmentObject private var auth: AuthController

  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      Text("Themys")
        .font(.largeTitle)
      Text("Catch Terms pages in Safari. History stays here; the overlay stays on the page.")
        .foregroundStyle(.secondary)
      Text(auth.status)
        .font(.footnote)
        .foregroundStyle(.secondary)
      if ThemysConfig.publishableKey.isEmpty || ThemysConfig.publishableKey.contains("REPLACE") {
        Text("Open this target in Xcode and set CLERK_PUBLISHABLE_KEY.")
          .font(.footnote)
      } else {
        AuthView(isDismissible: false)
          .frame(minHeight: 280)
      }
      Spacer()
    }
    .padding(24)
  }
}
