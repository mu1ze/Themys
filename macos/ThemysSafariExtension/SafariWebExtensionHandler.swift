import SafariServices

final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
  func beginRequest(with context: NSExtensionContext) {
    let reply = NSExtensionItem()
    reply.userInfo = [SFExtensionMessageKey: [
      "ok": false,
      "error": "native_session_not_used_on_macos",
    ]]
    context.completeRequest(returningItems: [reply], completionHandler: nil)
  }
}
