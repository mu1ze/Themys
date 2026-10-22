import SwiftUI

@main
struct ThemysMacApp: App {
  var body: some Scene {
    WindowGroup {
      VStack(spacing: 12) {
        Text("Themys")
          .font(.title)
        Text("Enable Themys in Safari → Settings → Extensions.")
          .foregroundStyle(.secondary)
      }
      .padding(32)
      .frame(minWidth: 360, minHeight: 180)
    }
  }
}
