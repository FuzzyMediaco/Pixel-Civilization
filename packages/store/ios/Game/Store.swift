import StoreKit
import WebKit

@MainActor
final class IslandStore: NSObject, WKScriptMessageHandlerWithReply {
    weak var controller: UIViewController?
    var changed: (() -> Void)?
    private var updates: Task<Void,Never>?
    private var finishing: [UInt64:Transaction] = [:]
    private var buying = false

    func observe() {
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self, case .verified(let transaction) = result else { continue }
                self.finishing[transaction.id] = transaction
                self.changed?()
            }
        }
    }
    deinit { updates?.cancel() }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?,String?) -> Void) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == "http", origin.host == "127.0.0.1", origin.port == 42871,
              let body = message.body as? [String:Any], let action = body["action"] as? String,
              let args = body["args"] as? [Any] else { replyHandler(nil,"Invalid store request."); return }
        Task {
            do {
                switch action {
                case "products":
                    guard let ids = args.first as? [String] else { throw StoreIssue.invalid }
                    let offered = ids.filter { $0.hasPrefix("era_") || $0.hasPrefix("mode_") }
                    let items = try await Product.products(for: Array(offered.prefix(64)))
                    replyHandler(items.filter { $0.type == .nonConsumable }.map { ["id":$0.id,"price":$0.displayPrice,"type":"inapp"] },nil)
                case "purchase":
                    guard !buying, args.count == 2, let sku = args[0] as? String, let raw = args[1] as? String,
                          let account = UUID(uuidString:raw) else { throw StoreIssue.invalid }
                    guard sku.hasPrefix("era_") || sku.hasPrefix("mode_") else { throw StoreIssue.renewalsClosed }
                    buying = true
                    defer { buying = false }
                    guard let item = try await Product.products(for:[sku]).first else { throw StoreIssue.unavailable }
                    guard item.type == .nonConsumable else { throw StoreIssue.renewalsClosed }
                    let result = try await item.purchase(options:[.appAccountToken(account)])
                    switch result {
                    case .success(let verification):
                        guard case .verified(let txn) = verification else { throw StoreIssue.unverified }
                        finishing[txn.id] = txn
                        replyHandler(receipt(txn,verification),nil)
                    case .pending: throw StoreIssue.pending
                    case .userCancelled: throw StoreIssue.cancelled
                    @unknown default: throw StoreIssue.unavailable
                    }
                case "pending", "restore":
                    if action == "restore" { try await AppStore.sync() }
                    var receipts: [UInt64:[String:Any]] = [:]
                    for await verified in Transaction.currentEntitlements {
                        if case .verified(let txn) = verified { receipts[txn.id] = receipt(txn,verified) }
                    }
                    for await verified in Transaction.unfinished {
                        if case .verified(let txn) = verified {
                            finishing[txn.id] = txn
                            receipts[txn.id] = receipt(txn,verified)
                        }
                    }
                    replyHandler(Array(receipts.values),nil)
                case "finish":
                    guard let obj = args.first as? [String:Any], let raw = obj["transactionId"] as? String,
                          let id = UInt64(raw) else { throw StoreIssue.invalid }
                    if let txn = finishing.removeValue(forKey:id) { await txn.finish() }
                    replyHandler(true,nil)
                case "manage":
                    guard let scene = controller?.view.window?.windowScene else { throw StoreIssue.unavailable }
                    try await AppStore.showManageSubscriptions(in:scene)
                    replyHandler(true,nil)
                default: throw StoreIssue.invalid
                }
            } catch { replyHandler(nil,error.localizedDescription) }
        }
    }
    private func receipt(_ tx: Transaction,_ verification: VerificationResult<Transaction>) -> [String:Any] {
        ["platform":"apple","productId":tx.productID,"transactionId":String(tx.id),"signedTransaction":verification.jwsRepresentation]
    }
}
private enum StoreIssue: LocalizedError {
    case invalid, unavailable, pending, cancelled, unverified, renewalsClosed
    var errorDescription: String? {
        switch self {
        case .invalid: return "Invalid App Store request."
        case .renewalsClosed: return "Monthly Pix purchases on mobile are currently closed."
        case .unavailable: return "The App Store could not open this item. Refresh the store and try again."
        case .pending: return "Your purchase is pending. Use Restore Purchases after Apple confirms payment."
        case .cancelled: return "Purchase canceled."
        case .unverified: return "Apple could not verify this purchase."
        }
    }
}
