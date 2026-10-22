import SafariServices
import os.log

final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
  func beginRequest(with context: NSExtensionContext) {
    let item = context.inputItems.first as? NSExtensionItem
    let raw = item?.userInfo?[SFExtensionMessageKey]
    let message = raw as? [String: Any] ?? [:]
    let type = message["type"] as? String ?? ""

    var response: [String: Any] = ["ok": true]
    switch type {
    case "GET_SESSION":
      Task { @MainActor in
        do {
          let token = try await ClerkSession.token()
          Self.reply(context, ["ok": true, "token": token.map { $0 as Any } ?? NSNull()])
        } catch {
          Self.reply(context, ["ok": false, "error": "session_unavailable"])
        }
      }
      return
    case "GET_PREFS":
      response["autoDetectEnabled"] = SessionBridge.autoDetectEnabled
    default:
      response["ok"] = false
      response["error"] = "unknown_message"
    }

    Self.reply(context, response)
  }

  private static func reply(_ context: NSExtensionContext, _ response: [String: Any]) {
    let reply = NSExtensionItem()
    reply.userInfo = [SFExtensionMessageKey: response]
    context.completeRequest(returningItems: [reply], completionHandler: nil)
  }
}
