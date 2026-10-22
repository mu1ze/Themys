/// Hostname-only matcher for the Network Extension sequel.
/// v1 does not ship a VPN or content filter. This type is the on-device rule
/// that must stay in lockstep with `packages/tos-detection` `matchesHostnameShape`.
/// Do not persist unmatched hostnames. Do not decrypt TLS.
enum HostnameMatcher {
  private static let labels: Set<String> = [
    "legal", "terms", "privacy", "tos", "eula", "policy", "agreements", "agreement",
  ]

  static func matches(_ hostname: String) -> Bool {
    let host = hostname.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
    guard !host.isEmpty else { return false }
    for label in host.split(separator: ".") {
      let value = String(label)
      if value.isEmpty || value == "www" { continue }
      if labels.contains(value) { return true }
      if value.hasPrefix("terms-") || value.hasPrefix("privacy-") || value.hasPrefix("legal-") || value.hasPrefix("tos-") {
        return true
      }
    }
    return false
  }
}
