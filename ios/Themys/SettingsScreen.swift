import SwiftUI

struct SettingsScreen: View {
  @EnvironmentObject private var auth: AuthController
  @State private var autoDetect = SessionBridge.autoDetectEnabled
  @State private var credits = "—"
  @State private var purchasedCredits = "—"
  @State private var plan = "Free"
  @State private var subscriptionStatus = "Ready"
  @State private var clauseCount = 0

  private var dashboardURL: URL {
    ThemysConfig.appOrigin.appending(path: "dashboard")
  }

  private var subscriptionURL: URL {
    var components = URLComponents(url: ThemysConfig.appOrigin, resolvingAgainstBaseURL: false)!
    components.path = "/settings"
    components.fragment = "subscription"
    return components.url!
  }

  var body: some View {
    Form {
      Section {
        VStack(alignment: .leading, spacing: 8) {
          Text("Themys \(plan)")
            .font(.title2.weight(.semibold))
          Text("\(subscriptionStatus) · \(credits) monthly reviews remaining")
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
      }

      Section("Safari extension") {
        Toggle(isOn: $autoDetect) {
          Label("Offer scans on legal pages", systemImage: "safari")
        }
        .onChange(of: autoDetect) { _, value in
          SessionBridge.autoDetectEnabled = value
        }

        Text("Themys detects likely Terms and Privacy pages on-device, then waits for you to tap Scan. Turning this off also hides those prompts.")
          .font(.footnote)
          .foregroundStyle(.secondary)
      }

      Section("Review preferences") {
        NavigationLink {
          ScanPreferencesScreen { profile in
            apply(profile)
          }
        } label: {
          LabeledContent {
            Text("\(clauseCount)")
              .foregroundStyle(.secondary)
          } label: {
            Label("Playbook & custom clauses", systemImage: "list.bullet.clipboard")
          }
        }
      }

      Section("Account & plan") {
        Link(destination: subscriptionURL) {
          Label("Manage subscription", systemImage: "creditcard")
        }
        Link(destination: dashboardURL) {
          Label("Open web dashboard", systemImage: "arrow.up.right.square")
        }
        LabeledContent("Purchased credits", value: purchasedCredits)
        Button("Sign out", role: .destructive) {
          Task { await auth.signOut() }
        }
      }

      Section {
        Link("Privacy policy", destination: URL(string: "https://docs.themys.ca/legal#privacy")!)
        Link("Terms of service", destination: URL(string: "https://docs.themys.ca/legal#terms")!)
      }
    }
    .navigationTitle("Control Center")
    .refreshable { await loadAccount() }
    .task { await loadAccount() }
  }

  private func loadAccount() async {
    async let limitsRequest = ThemysAPI.limitCheck()
    async let profileRequest = ThemysAPI.profile()

    do {
      let profile = try await profileRequest
      apply(profile)
    } catch {
      plan = "Free"
      subscriptionStatus = "Account unavailable"
    }

    do {
      let limits = try await limitsRequest
      purchasedCredits = limits.usage?.creditBalance.map(String.init) ?? "—"
      if let remaining = limits.usage?.scans?.remaining {
        credits = String(remaining)
      } else if limits.upgradeRequired == true || limits.ok == false {
        credits = "0"
      } else {
        credits = "—"
      }
    } catch {
      credits = "—"
      purchasedCredits = "—"
    }
  }

  private func apply(_ profile: ThemysProfile) {
    plan = Self.planLabel(profile.plan)
    subscriptionStatus = Self.statusLabel(profile.subscriptionStatus)
    clauseCount = profile.targetClauses.count
  }

  private static func planLabel(_ plan: String) -> String {
    switch plan {
    case "base": return "Plus"
    case "advanced": return "Advanced"
    case "lifetime": return "Lifetime"
    default: return "Free"
    }
  }

  private static func statusLabel(_ status: String?) -> String {
    switch status {
    case "active": return "Active"
    case "trialing": return "Trial"
    case "past_due": return "Past due"
    case "canceling": return "Cancellation scheduled"
    case "canceled": return "Canceled"
    default: return "Ready"
    }
  }
}

private struct PlaybookOption: Identifiable {
  let id: String
  let name: String
  let topics: [String]
}

private struct ScanPreferencesScreen: View {
  private static let playbooks = [
    PlaybookOption(
      id: "consumer_app",
      name: "Consumer app",
      topics: ["Data sharing", "Auto-renewal", "Arbitration", "Account termination"]
    ),
    PlaybookOption(
      id: "saas_vendor",
      name: "SaaS vendor",
      topics: ["Data processing", "Liability cap", "Indemnification", "Termination for convenience", "Price change", "DPA / audit"]
    ),
    PlaybookOption(
      id: "contractor",
      name: "Contractor / services",
      topics: ["IP assignment", "Non-solicit", "Payment", "Termination"]
    ),
  ]

  let onSaved: (ThemysProfile) -> Void

  @State private var clauses: [String] = []
  @State private var draftClause = ""
  @State private var strictMode = false
  @State private var playbookId = "consumer_app"
  @State private var country = ""
  @State private var stateRegion = ""
  @State private var isLoading = true
  @State private var isSaving = false
  @State private var message: String?
  @State private var messageIsError = false

  var body: some View {
    Form {
      if isLoading {
        Section {
          HStack(spacing: 12) {
            ProgressView()
            Text("Loading preferences…")
              .foregroundStyle(.secondary)
          }
        }
      } else {
        Section("Review playbook") {
          Picker("Contract type", selection: $playbookId) {
            ForEach(Self.playbooks) { playbook in
              Text(playbook.name).tag(playbook.id)
            }
          }
          .onChange(of: playbookId) { _, value in
            replacePresetTopics(with: value)
          }
          Text("Changing playbooks replaces preset topics and keeps the custom clauses you added.")
            .font(.footnote)
            .foregroundStyle(.secondary)
        }

        Section("Custom clauses") {
          HStack {
            TextField("Add a clause", text: $draftClause)
              .textInputAutocapitalization(.sentences)
              .submitLabel(.done)
              .onSubmit(addClause)
            Button("Add", action: addClause)
              .disabled(draftClause.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
          }

          ForEach(clauses, id: \.self) { clause in
            HStack {
              Text(clause)
              Spacer()
              Button {
                clauses.removeAll { $0 == clause }
              } label: {
                Image(systemName: "xmark.circle.fill")
                  .foregroundStyle(.secondary)
              }
              .buttonStyle(.borderless)
              .accessibilityLabel("Remove \(clause)")
            }
          }
        }

        Section("Result focus") {
          Toggle("Only show watch-list matches", isOn: $strictMode)
          Text("Strict mode hides other risky clauses. Leave it off for the fullest review.")
            .font(.footnote)
            .foregroundStyle(.secondary)
        }

        Section("Jurisdiction") {
          TextField("Country", text: $country)
            .textContentType(.countryName)
          TextField("Province, state, or region", text: $stateRegion)
            .textContentType(.addressState)
          Text("Themys uses this to prioritize rules that matter where you live.")
            .font(.footnote)
            .foregroundStyle(.secondary)
        }

        Section {
          Button {
            Task { await save() }
          } label: {
            HStack {
              Spacer()
              if isSaving { ProgressView().padding(.trailing, 4) }
              Text(isSaving ? "Saving…" : "Save preferences")
                .fontWeight(.semibold)
              Spacer()
            }
          }
          .disabled(isSaving)

          if let message {
            Text(message)
              .font(.footnote)
              .foregroundStyle(messageIsError ? Color.red : Color.green)
          }
        }
      }
    }
    .navigationTitle("Scan Preferences")
    .navigationBarTitleDisplayMode(.inline)
    .task { await load() }
  }

  private func load() async {
    do {
      let profile = try await ThemysAPI.profile()
      clauses = profile.targetClauses
      strictMode = profile.strictMode
      playbookId = profile.playbookId
      country = profile.country ?? ""
      stateRegion = profile.state ?? ""
      message = nil
    } catch {
      message = error.localizedDescription
      messageIsError = true
    }
    isLoading = false
  }

  private func addClause() {
    let clause = draftClause
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .prefix(120)
    guard !clause.isEmpty else { return }
    if !clauses.contains(where: { $0.localizedCaseInsensitiveCompare(String(clause)) == .orderedSame }) {
      clauses.append(String(clause))
    }
    draftClause = ""
  }

  private func replacePresetTopics(with newPlaybookId: String) {
    guard let playbook = Self.playbooks.first(where: { $0.id == newPlaybookId }) else { return }
    let allPresetTopics = Set(Self.playbooks.flatMap(\.topics))
    let customClauses = clauses.filter { !allPresetTopics.contains($0) }
    clauses = playbook.topics + customClauses
  }

  private func save() async {
    addClause()
    isSaving = true
    message = nil
    messageIsError = false
    defer { isSaving = false }

    do {
      let profile = try await ThemysAPI.updateProfile(
        targetClauses: clauses,
        strictMode: strictMode,
        playbookId: playbookId,
        country: country,
        state: stateRegion
      )
      clauses = profile.targetClauses
      onSaved(profile)
      message = "Preferences saved. Future scans will use these choices."
    } catch {
      message = error.localizedDescription
      messageIsError = true
    }
  }
}
