import StoreKit
import StoreKitTest
import XCTest

// StoreKit's local environment exercises Apple's product and transaction APIs.
// Its test transactions are purposely never submitted to the game's live verifier.
final class StoreCatalogTests: XCTestCase {
    @MainActor
    func testProductsAccountAssociationAndRestoration() async throws {
        let session = try SKTestSession(configurationFileNamed:"PixelCivilization")
        session.resetToDefaultState()
        session.disableDialogs = true
        session.clearTransactions()
        defer { session.clearTransactions() }

        let catalog = ["era_china","era_egypt","era_rome","era_greece","era_medieval","era_renaissance",
                       "era_wwii","era_deco","era_3027","era_wasteland","mode_god","mode_survival",
                       "pix_starter","pix_builder","pix_studio","pix_complete"]
        let products = try await Product.products(for:catalog)
        XCTAssertEqual(Set(products.map(\.id)),Set(catalog))
        XCTAssertEqual(products.filter { $0.type == .autoRenewable }.count,4)
        let account = UUID()
        let rome = try XCTUnwrap(products.first { $0.id == "era_rome" })
        let result = try await rome.purchase(options:[.appAccountToken(account)])
        guard case .success(.verified(let purchase)) = result else { XCTFail("Expected a local verified purchase"); return }
        XCTAssertEqual(purchase.appAccountToken,account)
        XCTAssertEqual(purchase.productID,"era_rome")
        var restored = false
        for await value in Transaction.currentEntitlements {
            if case .verified(let transaction) = value, transaction.id == purchase.id { restored = true }
        }
        XCTAssertTrue(restored)
        await purchase.finish()
    }
}
