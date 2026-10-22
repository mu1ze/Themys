import SwiftUI

struct HistoryScreen: View {
  @State private var scans: [ScanSummary] = []
  @State private var error: String?
  @State private var loading = true

  var body: some View {
    NavigationStack {
      Group {
        if loading {
          ProgressView("Loading scans")
        } else if let error {
          ContentUnavailableView("Could not load scans", systemImage: "exclamationmark.triangle", description: Text(error))
        } else if scans.isEmpty {
          ContentUnavailableView(
            "No scans yet",
            systemImage: "doc.text.magnifyingglass",
            description: Text("Open a Terms page in Safari. Themys badges it on-device; Scan uses a review credit.")
          )
        } else {
          List(scans) { scan in
            NavigationLink {
              GlanceScreen(scan: scan)
            } label: {
              VStack(alignment: .leading, spacing: 4) {
                Text(scan.title?.isEmpty == false ? scan.title! : scan.domain ?? "Scan")
                  .font(.headline)
                Text("\(scan.attentionLabel) · \(scan.flaggedCount ?? 0) flagged")
                  .font(.subheadline)
                  .foregroundStyle(.secondary)
              }
            }
          }
        }
      }
      .navigationTitle("Scans")
      .task { await load() }
      .refreshable { await load() }
    }
  }

  private func load() async {
    loading = scans.isEmpty
    do {
      scans = try await ThemysAPI.history()
      error = nil
    } catch {
      self.error = error.localizedDescription
    }
    loading = false
  }
}

struct GlanceScreen: View {
  let scan: ScanSummary

  var body: some View {
    List {
      Section("Attention") {
        Text(scan.attentionLabel)
        Text("\(scan.flaggedCount ?? 0) flagged clauses")
      }
      Section("Document") {
        if let domain = scan.domain { Text(domain) }
        if let url = scan.url { Text(url).font(.footnote) }
      }
      Section {
        Link("Open in Themys", destination: scan.resultsURL)
      } footer: {
        Text("Informational only. Not legal advice. Full extraction lives in the web results.")
      }
    }
    .navigationTitle(scan.domain ?? "Scan")
  }
}
