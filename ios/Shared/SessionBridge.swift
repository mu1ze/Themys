import Foundation
import Security
import ClerkKit

enum AppGroup {
  static let id = "group.ca.themys.app"
  static let autoDetectKey = "themys.autoDetectEnabled"
  static let pendingReturnURLKey = "themys.pendingReturnURL"
  static let keychainService = "ca.themys.app.session"
  static let keychainAccount = "clerk.session"
  static let defaultsTokenKey = "themys.session.token"
  static let defaultsUserIdKey = "themys.session.userId"
  static let defaultsExpiresAtKey = "themys.session.expiresAt"
}

struct SessionSnapshot: Codable {
  var token: String?
  var userId: String?
  var expiresAt: Date?
}

enum SessionBridge {
  static var autoDetectEnabled: Bool {
    get {
      let defaults = UserDefaults(suiteName: AppGroup.id)
      if defaults?.object(forKey: AppGroup.autoDetectKey) == nil { return true }
      return defaults?.bool(forKey: AppGroup.autoDetectKey) ?? true
    }
    set {
      UserDefaults(suiteName: AppGroup.id)?.set(newValue, forKey: AppGroup.autoDetectKey)
    }
  }

  static func publish(token: String?, userId: String?, expiresAt: Date? = nil) {
    let snapshot = SessionSnapshot(
      token: token,
      userId: userId,
      expiresAt: expiresAt ?? jwtExpiry(of: token)
    )
    if let data = try? JSONEncoder().encode(snapshot) {
      writeKeychain(data)
    }
    clearLegacyDefaults()
  }

  static func read() -> SessionSnapshot {
    if let data = readKeychain(),
       let snapshot = try? JSONDecoder().decode(SessionSnapshot.self, from: data) {
      return snapshot
    }
    let migrated = readLegacyDefaults()
    if migrated.token != nil {
      publish(token: migrated.token, userId: migrated.userId, expiresAt: migrated.expiresAt)
    }
    return migrated
  }

  static func clear() {
    deleteKeychain()
    clearLegacyDefaults()
  }

  static func storePendingReturnURL(_ returnUrl: String) {
    guard isHttpReturnURL(returnUrl) else { return }
    UserDefaults(suiteName: AppGroup.id)?.set(returnUrl, forKey: AppGroup.pendingReturnURLKey)
  }

  static func takePendingReturnURL() -> String? {
    let defaults = UserDefaults(suiteName: AppGroup.id)
    let value = defaults?.string(forKey: AppGroup.pendingReturnURLKey)
    defaults?.removeObject(forKey: AppGroup.pendingReturnURLKey)
    guard let value, isHttpReturnURL(value) else { return nil }
    return value
  }

  static func signInURL(returnUrl: String) -> URL? {
    var components = URLComponents()
    components.scheme = "themys"
    components.host = "sign-in"
    if isHttpReturnURL(returnUrl) {
      components.queryItems = [URLQueryItem(name: "return", value: returnUrl)]
    }
    return components.url
  }

  static func isHttpReturnURL(_ value: String?) -> Bool {
    guard let value, let url = URL(string: value), let scheme = url.scheme?.lowercased() else {
      return false
    }
    return scheme == "http" || scheme == "https"
  }

  static func jwtExpiry(of token: String?) -> Date? {
    guard let token else { return nil }
    let parts = token.split(separator: ".")
    guard parts.count >= 2 else { return nil }
    var payload = String(parts[1])
      .replacingOccurrences(of: "-", with: "+")
      .replacingOccurrences(of: "_", with: "/")
    let pad = (4 - payload.count % 4) % 4
    payload += String(repeating: "=", count: pad)
    guard let data = Data(base64Encoded: payload),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      return nil
    }
    let exp: TimeInterval?
    if let number = json["exp"] as? TimeInterval {
      exp = number
    } else if let number = json["exp"] as? Int {
      exp = TimeInterval(number)
    } else {
      exp = nil
    }
    guard let exp else { return nil }
    return Date(timeIntervalSince1970: exp)
  }

  private static func readLegacyDefaults() -> SessionSnapshot {
    let defaults = UserDefaults(suiteName: AppGroup.id)
    let token = defaults?.string(forKey: AppGroup.defaultsTokenKey)
    let userId = defaults?.string(forKey: AppGroup.defaultsUserIdKey)
    let expires = defaults?.object(forKey: AppGroup.defaultsExpiresAtKey) as? TimeInterval
    return SessionSnapshot(
      token: token,
      userId: userId,
      expiresAt: expires.map { Date(timeIntervalSince1970: $0) }
    )
  }

  private static func clearLegacyDefaults() {
    let defaults = UserDefaults(suiteName: AppGroup.id)
    defaults?.removeObject(forKey: AppGroup.defaultsTokenKey)
    defaults?.removeObject(forKey: AppGroup.defaultsUserIdKey)
    defaults?.removeObject(forKey: AppGroup.defaultsExpiresAtKey)
  }

  private static var keychainQuery: [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: AppGroup.keychainService,
      kSecAttrAccount as String: AppGroup.keychainAccount,
      kSecAttrAccessGroup as String: AppGroup.id,
    ]
  }

  private static func readKeychain() -> Data? {
    var query = keychainQuery
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    guard status == errSecSuccess else { return nil }
    return item as? Data
  }

  private static func writeKeychain(_ data: Data) {
    deleteKeychain()
    var query = keychainQuery
    query[kSecValueData as String] = data
    query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    SecItemAdd(query as CFDictionary, nil)
  }

  private static func deleteKeychain() {
    SecItemDelete(keychainQuery as CFDictionary)
  }
}

// Both processes use Clerk's supported shared identity store. A copied session JWT
// alone cannot refresh after the containing app is suspended.
@MainActor
enum ClerkSession {
  private static var configured = false
  private static let publicKeyPreference = "themys.clerk.publishableKey"

  static func configure(publishableKey: String? = nil) -> Bool {
    if configured { return true }
    let defaults = UserDefaults(suiteName: AppGroup.id)
    let key = publishableKey ?? defaults?.string(forKey: publicKeyPreference) ?? ""
    guard !key.isEmpty, !key.contains("REPLACE") else { return false }
    Clerk.configure(publishableKey: key, options: .init(
      telemetryEnabled: false,
      keychainConfig: .init(service: "ca.themys.clerk", accessGroup: AppGroup.id),
      redirectConfig: .init(redirectUrl: "themys://callback", callbackUrlScheme: "themys"),
      sharedSessionSync: .enabled
    ))
    // The publishable key is public configuration, never a session credential.
    defaults?.set(key, forKey: publicKeyPreference)
    configured = true
    return true
  }

  static func token() async throws -> String? {
    guard configure() else { return nil }
    let deadline = Date().addingTimeInterval(8)
    while !Clerk.shared.isLoaded {
      guard Date() < deadline else { throw SessionError.unavailable }
      try await Task.sleep(nanoseconds: 50_000_000)
    }
    await Clerk.shared.reloadFromSharedStorage()
    // Force a server check on explicit API actions, including remote revocation.
    return try await Clerk.shared.auth.getToken(.init(expirationBuffer: 15, skipCache: true))
  }

  enum SessionError: Error { case unavailable }
}
