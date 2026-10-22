import Foundation

struct ThemysConfig {
  static let appOrigin = URL(string: "https://themys.ca")!
  static let clientHeader = "safari-ios"

  static var publishableKey: String {
    Bundle.main.object(forInfoDictionaryKey: "CLERK_PUBLISHABLE_KEY") as? String ?? ""
  }
}

struct ScanSummary: Decodable, Identifiable {
  let id: String
  let title: String?
  let url: String?
  let domain: String?
  let riskScore: Double?
  let flaggedCount: Int?
  let createdAt: String

  var resultsURL: URL {
    var components = URLComponents(url: ThemysConfig.appOrigin, resolvingAgainstBaseURL: false)!
    components.path = "/scan/results"
    components.queryItems = [URLQueryItem(name: "id", value: id)]
    return components.url!
  }

  var attentionLabel: String {
    guard let riskScore else { return "Standard" }
    if riskScore >= 7 { return "Needs attention" }
    if riskScore >= 4 { return "Worth reviewing" }
    return "Standard"
  }
}

struct HistoryResponse: Decodable {
  let scans: [ScanSummary]
}

struct LimitCheckResponse: Decodable {
  let ok: Bool?
  let upgradeRequired: Bool?
  let usage: LimitUsage?

  struct LimitUsage: Decodable {
    let tier: String?
    let creditBalance: Int?
    let scans: LimitBucket?
  }

  struct LimitBucket: Decodable {
    let remaining: Int?
    let limit: Int?
  }
}

struct ThemysProfile: Decodable {
  let plan: String
  let subscriptionStatus: String?
  let country: String?
  let state: String?
  let targetClauses: [String]
  let strictMode: Bool
  let playbookId: String
}

struct ProfileResponse: Decodable {
  let profile: ThemysProfile
}

enum ThemysAPIError: LocalizedError {
  case signedOut
  case server(String)

  var errorDescription: String? {
    switch self {
    case .signedOut: return "Sign in to see your scans."
    case .server(let message): return message
    }
  }
}

enum ThemysAPI {
  static func history(limit: Int = 20) async throws -> [ScanSummary] {
    let data = try await post(path: "/api/scans/history", body: ["limit": limit])
    return try JSONDecoder().decode(HistoryResponse.self, from: data).scans
  }

  static func limitCheck() async throws -> LimitCheckResponse {
    let data = try await post(path: "/api/extension/limit-check", body: [:], allowedStatuses: [200, 402])
    return try JSONDecoder().decode(LimitCheckResponse.self, from: data)
  }

  static func profile() async throws -> ThemysProfile {
    let data = try await get(path: "/api/profile")
    return try JSONDecoder().decode(ProfileResponse.self, from: data).profile
  }

  static func updateProfile(
    targetClauses: [String],
    strictMode: Bool,
    playbookId: String,
    country: String,
    state: String
  ) async throws -> ThemysProfile {
    let data = try await post(
      path: "/api/profile",
      body: [
        "targetClauses": targetClauses,
        "strictMode": strictMode,
        "playbookId": playbookId,
        "country": country,
        "state": state,
      ]
    )
    return try JSONDecoder().decode(ProfileResponse.self, from: data).profile
  }

  private static func get(path: String) async throws -> Data {
    guard let token = try await ClerkSession.token(), !token.isEmpty else { throw ThemysAPIError.signedOut }
    var components = URLComponents(url: ThemysConfig.appOrigin, resolvingAgainstBaseURL: false)!
    components.path = path
    guard let url = components.url else { throw ThemysAPIError.server("Invalid API URL") }
    var request = URLRequest(url: url)
    request.setValue(ThemysConfig.clientHeader, forHTTPHeaderField: "X-Themys-Client")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    return try await perform(request)
  }

  private static func post(path: String, body: [String: Any], allowedStatuses: Set<Int> = [200]) async throws -> Data {
    guard let token = try await ClerkSession.token(), !token.isEmpty else { throw ThemysAPIError.signedOut }
    var components = URLComponents(url: ThemysConfig.appOrigin, resolvingAgainstBaseURL: false)!
    components.path = path
    guard let url = components.url else { throw ThemysAPIError.server("Invalid API URL") }
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(ThemysConfig.clientHeader, forHTTPHeaderField: "X-Themys-Client")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.httpBody = try JSONSerialization.data(withJSONObject: body)
    return try await perform(request, allowedStatuses: allowedStatuses)
  }

  private static func perform(_ request: URLRequest, allowedStatuses: Set<Int> = [200]) async throws -> Data {
    let (data, response) = try await URLSession.shared.data(for: request)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    if status == 401 {
      SessionBridge.clear()
      throw ThemysAPIError.signedOut
    }
    if allowedStatuses.contains(status) {
      return data
    }
    if status >= 400 {
      let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]).flatMap { $0["error"] as? String }
      throw ThemysAPIError.server(message ?? "Request failed (\(status))")
    }
    return data
  }
}
