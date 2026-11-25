# Selling Pixel Civilization

Original, Real, Idle, Manager, the Atlas, Handbook and playable preview tours are free. Individual theme purchases unlock that appearance on the player's islands. The Rome product covers both Roman art directions. Purchased modes and themes travel with the signed-in game account. Pix's public Workers AI service keeps its existing daily and per-IP limits.

## USD catalog

| Purchase | US price | Included access | Pix messages per billing period | Model-cost allowance |
| --- | ---: | --- | ---: | ---: |
| Any one of ten eras | $0.99 once | One permanent pack | | |
| Survival Mode | $1.99 once | Survival | | |
| God Mode | $3.99 once | God | | |
| Pix Starter | $4.99/month | Survival | 100 | $1.49 |
| Pix Builder | $14.99/month | Starter, God, Rome and Egypt | 350 | $4.49 |
| Pix Studio | $39.99/month | Builder, China, Greece, Medieval and Renaissance | 1,000 | $11.99 |
| Pix Complete | $99.99/month | All ten packs and both premium modes | 2,500 | $29.99 |

Storefronts supply localized prices and tax totals at checkout. Entitlements included in subscriptions last through the paid period. Individually purchased items survive a subscription ending. Each cloud generation counts once, including the separate generation of lower levels following a building design. Both allowances reset each billing period. All three paid model choices share the same account allowance. There are no automatic overage charges. [Catalog and store identifiers](../src/game/storeCatalog.mjs)

### Model cost and margin

The accounting unit is one millionth of a US dollar. Rates below are USD per million standard input and output tokens. Pix records the provider's usage and estimates its nominal cost with the displayed standard rates. Reported cached reads and writes use their model-specific rates. Service credits and negotiated rates can affect the eventual invoice. The game sends fixed model IDs and reserves a conservative maximum before each call. A completed call releases the difference. A provider rejection releases the reservation. A network timeout with unknown upstream usage retains the reservation for that period to bound spending.

| Provider | Model | Input | Output |
| --- | --- | ---: | ---: |
| Google | Gemini 2.5 Flash-Lite | $0.10 | $0.40 |
| OpenAI | GPT-6 Luna | $0.10 | $0.50 |
| Anthropic | Claude Haiku 4.5 | $1.00 | $5.00 |

Check these model prices and availability before changes to the catalog or model IDs. [Google pricing](https://ai.google.dev/gemini-api/docs/pricing) · [OpenAI model pricing](https://developers.openai.com/api/docs/models/gpt-6-luna) · [Anthropic model pricing](https://platform.claude.com/docs/en/about-claude/pricing)

The caps reserve approximately 30% of each retail price for standard inference costs. For example, 1,000 input and 500 output tokens on the configured Claude model use $0.0035 of allowance. A $14.99 plan using its full $4.49 model allowance leaves $10.50 before storefront or processor fees, taxes, hosting and support. At an illustrative 30% store commission that leaves about $6.00 before other operating costs. Actual store terms and market-specific fees determine the achieved margin.

## Existing islands

Accounts with a God or Survival autosave already in cloud storage at migration 0004 automatically receive lifelong access to that mode. Existing named slots qualify too, including compacted saves. The migration freezes their current compressed revisions and the next authenticated store access reads them. After recognizing the modes it discards those temporary copies. New saves cannot change the cutoff or confer a grandfathered entitlement. The active island and original cloud saves stay on their existing save paths.

A previously anonymous, device-only island provides no server-side proof of ownership. Keep the original island on the device. A support operator who verifies pre-store play can grant the specific mode to a known signed-in account using `node scripts/store/grant-existing-mode.mjs GAME_ACCOUNT_UUID god|survival`. Supply `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` and a D1-write-scoped `CLOUDFLARE_API_TOKEN` in the operator's environment. The operation is idempotent, requires an existing account and accepts only the two game modes. No client or public route can issue that grant.

## Billing connections

Web purchases use Stripe-hosted Checkout and an account-specific link to the hosted Customer Portal. Native storefronts use their platform purchasing interfaces. Both verify through the same game service. Product IDs, pricing, identity and access come from the server. The web return page can ask the server to retrieve the Checkout Session, and webhooks independently complete fulfillment.

| Worker setting | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Server-side Stripe API key and signing secret for this application's endpoint |
| `STRIPE_PAYMENT_LINKS` | JSON object mapping each one-time SKU to its dedicated Stripe Payment Link ID and buy.stripe.com URL. |
| `STRIPE_PRICE_IDS` | JSON object mapping each catalog ID to its Stripe Price ID |
| `STRIPE_PORTAL_CONFIG` | Dedicated Stripe portal configuration for the four Pix products |
| `STRIPE_TAX_READY` | Set to `true` once the merchant's tax setup has been confirmed. Checkout requires automatic tax and billing address collection. |
| `STOREFRONT_ORIGIN` | Absolute return origin. Defaults to https://pixelcivilization.app. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | Play-authorized Android Publisher service-account JSON |
| `APPLE_IAP_KEY`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER` | App Store Server API signing credentials |
| `ANDROID_APP_ID`, `IOS_APP_ID` | Store identifiers. Each defaults to `app.pixelcivilization.game`. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` | Paid providers. The web subscription sale becomes available when all three are configured. |
| `STORE_LEASE_SIGNING_JWK` | Private P-256 signing JWK in Worker secrets |
| `VITE_STORE_LEASE_PUBLIC_JWK` | Optional build-time override for the bundled public verification key. The browser verifies account-bound offline leases for up to seven days and through the paid term. |

Apply D1 migrations 0002 through 0004 before deploying the billing Worker. The existing account database and session cookie provide identity. For test environments, use separate credentials, database, webhook secret and app origin. In an isolated native review environment set `APPLE_STORE_ENV=Sandbox` or `GOOGLE_PLAY_ALLOW_TEST_PURCHASES=true` for their corresponding sandbox purchases.

The live web publisher is SLF Media Group. The game uses dedicated Stripe customers and prices. The server key needs write access for customers, Checkout Sessions and Customer Portal sessions and read access to prices, subscriptions, invoices and invoice payments, payment intents, charges and disputes. Save it directly to the encrypted Worker setting. The restricted key and webhook signing secret have separate purposes.

Configure Stripe to send Checkout completion, successful delayed payments, subscription creation/update/deletion, invoice paid/payment failed, charge refunds, and dispute creation/closure to `/api/commerce/stripe/webhook`. The handler verifies the signature on the raw body, tolerates redelivery, retrieves the current payment or subscription from Stripe and records the result against a mapped customer. A fully refunded or disputed card charge removes its benefit. A new paid period can restore access. [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment) · [Subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)

Apple verification fetches the transaction from Apple's authenticated HTTPS Server API with the app's bundle ID. Google verification uses the Android Publisher API and acknowledges the purchase after the grant has been written. Both require the game account UUID from checkout. A scheduled job rechecks native purchases and a signed-in account refreshes due grants. Payment-pending purchases wait for confirmation. A revocation clears access on the next check. Reconnecting refreshes the device's offline lease. [Apple transaction lookup](https://developer.apple.com/documentation/appstoreserverapi/get-transaction-info) · [Apple subscription status](https://developer.apple.com/documentation/appstoreserverapi/get-all-subscription-statuses) · [Google purchases](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2/getproductpurchasev2) · [Google subscription states](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2)

## Release evidence

Run `node --import tsx --test tests/storeCommerce.test.ts tests/accountApi.test.ts` for deterministic integration tests. Store replies in these tests are fixtures. Real purchase, renewal, refund and restore certification requires the merchant's Stripe sandbox and native test accounts against correctly provisioned products. A signed native build and product creation alone do not establish that checkout completed.

## One-time web purchases with Payment Links

An operator can connect the ten era packs and two premium modes with fixed-price Stripe Payment Links. Apply migration 0005 before enabling checkout. Each entry in `STRIPE_PAYMENT_LINKS` is keyed by the game's SKU, for example `{"era_rome":{"id":"plink_…","url":"https://buy.stripe.com/…"}}`. Enable a single unit of the catalog's exact USD price, automatic tax and a billing address. Disable adjustable quantities and promotion codes. Keep `STRIPE_TAX_READY` false until tax collection is authorized. The Worker requires the endpoint signing secret and currency/amount/tax checks for fulfillment. Key-backed Checkout remains available for subscriptions and for products with a configured Stripe price.

Configure the completion redirect to `https://pixelcivilization.app/?purchase=complete&session_id={CHECKOUT_SESSION_ID}`. Deliver signed snapshot events for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, and `charge.dispute.closed`. Preserve the additional customer subscription and invoice events used by Pix. Keep old SKU-to-link mappings when retiring a link until its open payments have settled. Stripe Dashboard can resend webhook events for support.

The game gives each signed-in account an opaque 30-minute reference. A Stripe session created during that window stays bound to the purchasing game account even when payment or webhook delivery takes longer. A payment made directly on a public link can be claimed once by signing in on its return page. The full Stripe return URL is a private receipt. The authenticated claim uses the unguessable session ID plus a verified signed webhook. Opening the return page before the webhook produces a pending response and can be retried. An existing account assignment takes precedence over anyone else who opens the same URL. If a buyer closes an anonymous Stripe checkout before returning, support can use the original payment and Stripe's private session return URL to help verify and recover it.

The game store checks ownership before presenting checkout. Public Stripe URLs can be used more than once. If the buyer pays twice, Stripe records two transactions and the merchant can refund the duplicate through its dashboard. A full refund or an open/lost dispute revokes that payment's access. A won dispute reinstates it if the payment still qualifies. Partial refunds keep the lifetime product. Another independently paid copy remains active. A small ledger retains hashed session, payment and dispute identifiers and their status after account deletion. It drops the game account reference and stores no payer email, name, billing address or card information. This makes previously assigned receipts unusable on replacement accounts. Native StoreKit and Google Play receipts likewise remain bound to the original game account under its store-supplied identifier.

[Stripe Payment Link parameters](https://docs.stripe.com/payment-links/url-parameters) · [Stripe completion pages](https://docs.stripe.com/payments/checkout/custom-success-page) · [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment) · [Stripe disputes](https://docs.stripe.com/api/disputes/object)
