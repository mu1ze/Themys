import SwiftUI

struct OnboardingScreen: View {
  @AppStorage("themys.didCompleteSafariOnboarding") private var didComplete = false

  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      Text("Turn on the Safari extension")
        .font(.title)
      Text("Themys only sees Terms URLs after you enable the extension in Safari. Until then this app is just an empty history list.")
        .foregroundStyle(.secondary)
      VStack(alignment: .leading, spacing: 8) {
        Label("Open Settings", systemImage: "1.circle")
        Label("Safari → Extensions → Themys", systemImage: "2.circle")
        Label("Allow Themys on All Websites", systemImage: "3.circle")
      }
      Button("Open Settings") {
        if let url = URL(string: UIApplication.openSettingsURLString) {
          UIApplication.shared.open(url)
        }
      }
      .buttonStyle(.borderedProminent)
      Button("I turned it on") {
        didComplete = true
      }
      Spacer()
    }
    .padding(24)
  }
}
