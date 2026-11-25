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
| `STRIPE_PORTAL_CONFIG` | Game-specific management portal for web customers |
| `STRIPE_FUNDED_PORTAL_CONFIG` | Dedicated Pix portal with invoice history and card replacement. Disable price changes, cancellation, pauses and public login. |
| `STRIPE_FUNDED_BILLING_READY` | The operator sets `true` only after validating the complete prepaid-term flow in a separately configured Stripe test environment. An absent value keeps new monthly billing and future extensions closed. |
| `STRIPE_TAX_READY` | Set to `true` once the merchant's tax setup has been confirmed. Checkout requires automatic tax and billing address collection. |
| `STOREFRONT_ORIGIN` | Absolute return origin. Defaults to https://pixelcivilization.app. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | Play-authorized Android Publisher service-account JSON |
| `APPLE_IAP_KEY`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER` | App Store Server API signing credentials |
| `ANDROID_APP_ID`, `IOS_APP_ID` | Store identifiers. Each defaults to `app.pixelcivilization.game`. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` | Optional direct provider credentials. Web Pix enrollment also requires all three verified prepaid gateway models, wallet capacity and Stripe billing readiness. |
| `STORE_LEASE_SIGNING_JWK` | Private P-256 signing JWK in Worker secrets |
| `VITE_STORE_LEASE_PUBLIC_JWK` | Optional build-time override for the bundled public verification key. The browser verifies account-bound offline leases for up to seven days and through the paid term. |

Apply D1 migrations 0002 through 0004 before deploying the billing Worker. The existing account database and session cookie provide identity. For test environments, use separate credentials, database, webhook secret and app origin. In an isolated native review environment set `APPLE_STORE_ENV=Sandbox` or `GOOGLE_PLAY_ALLOW_TEST_PURCHASES=true` for their corresponding sandbox purchases.

SLF Media Group publishes the web game. Store the restricted API key and webhook signing secret in separate encrypted Worker settings. The application uses the following Stripe API resources under `/v1`.

| Restricted-key permission | Calls made by the game |
| --- | --- |
| Customers · write | Create game customers, set their verified default payment method, delete on account closure |
| Checkout Sessions · write | Create a setup or one-time session, retrieve/list sessions and expire abandoned sessions |
| Customer Portal · write | Read the dedicated portal configuration and create account-scoped portal sessions |
| Subscription Schedules · write | Create, list and retrieve schedules, update their phases, cancel a schedule using `POST /subscription_schedules/:id/cancel` |
| Invoices · write | List/retrieve invoices, `POST /invoices/:id/finalize` and `POST /invoices/:id/void` |
| Setup Intents · read | `GET /setup_intents/:id` to verify the bound customer's completed off-session, card-only setup |
| Subscriptions, Prices, Invoice Payments, Payment Intents, Charges and Disputes · read | Verify the exact SKU, paid term, settled card charge, refund or dispute |

The stored card is selected using Customers Write. Editing product catalogs, issuing refunds, deleting payments and broad account-admin access are outside this runtime key's role.

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

## Using Cloudflare AI Gateway for paid Pix

Pix can use the game's existing Cloudflare Workers AI binding to reach all three paid model providers. Each directly configured provider key takes precedence for that provider. The free Pix runtime keeps its own connection. The game disables gateway-backed options when the account has insufficient confirmed credits, the balance check cannot authenticate, or the model has never passed a production acceptance check.

| Server setting | Purpose |
| --- | --- |
| `PIX_GATEWAY_ACCOUNT` | ID of the Cloudflare account that owns the game Worker and prepaid balance |
| `PIX_GATEWAY_ID` | Dedicated authenticated game gateway configured for unified billing |
| `PIX_GATEWAY_READ_TOKEN` | Worker secret containing a dedicated API token restricted to AI Gateway Read on this account |
| `PIX_GATEWAY_VERIFIED_MODELS` | Comma-separated Cloudflare catalog IDs for models successfully exercised with this gateway |

Create the dedicated gateway with authentication enabled, request logging and caching disabled, unified billing enabled and one attempt per request. Keep provider rerouting disabled to use the contracted providers. Set the gateway's spend limit to the approved owner budget. The balance token only reads the billing balance. The game Worker binding authorizes actual inference. No provider access tokens are needed on the binding path.

Only add a catalog ID to `PIX_GATEWAY_VERIFIED_MODELS` after an authorized request to that exact model returns the expected provider-native structure and token counts. The IDs are `openai/gpt-6-luna`, `anthropic/claude-haiku-4.5`, and `google/gemini-2.5-flash-lite`. Until all three providers are usable, paid Pix checkout stays closed. A directly connected and funded provider can take the place of the same gateway provider. The commerce response exposes provider names and storefront readiness only.

Cloudflare charges the provider's inference rates and adds a 5% fee when credits are purchased. Gateway calls debit only provider inference from a player's allowance. The fee is a separate merchant expense paid when loading credit. The accounting view `game_pix_settled_costs` reports provider inference and estimated funding fees separately. The Worker records provider-reported input, output and cache usage under the specific catalog ID. It checks the account's prepaid balance against each request's maximum possible charge. A single database reservation enforces the player's allowance and the shared wallet across concurrent users. It conservatively holds recent costs for two minutes while remote debits propagate. Credit checks cache for up to thirty seconds per Worker isolate. External billing activity can affect the same account, so the owner should also configure gateway spending controls. A free Pix or public catalog request never generates a paid inference.

[Unified billing and its funding fee](https://developers.cloudflare.com/ai-gateway/features/unified-billing/) · [Workers binding and request privacy controls](https://developers.cloudflare.com/ai-gateway/usage/worker-binding-methods/) · [Account balance API](https://developers.cloudflare.com/api/resources/ai_gateway/) · [OpenAI pricing](https://developers.cloudflare.com/ai/models/openai/gpt-6-luna/) · [Anthropic pricing](https://developers.cloudflare.com/ai/models/anthropic/claude-haiku-4.5/) · [Gemini pricing](https://developers.cloudflare.com/ai/models/google/gemini-2.5-flash-lite/)

The production gateway passed three structured-response probes on November 25, 2026. OpenAI returned valid JSON with 53 input and 12 output tokens. Anthropic returned a native tool result with 663 input and 33 output tokens. Gemini returned valid JSON with 14 input and 9 output tokens. The probes used the game's actual Worker binding, provider request builders and response parsers. They ran from an isolated local endpoint backed by Cloudflare's live gateway. No player data was submitted. The release configuration lists those three verified models.

### Funding each subscription month

Migration 0007 reserves the full maximum provider cost of each term before Stripe may create a collectible invoice. An initial checkout to save billing details has a 30-minute provisional hold. Once a collectible invoice can exist, the hold is pinned. A local timeout, delayed webhook or delayed payment cannot release those funds. The billing service releases a pinned allocation only after confirming the invoice can no longer collect. A paid term keeps its remaining allowance through the paid end date.

The store reports affordability per tier. It counts existing subscriber obligations, future periods already reserved, recent provider debits, and other shoppers' outstanding commitments. A $10.50 top-up provides $10.00 of service capacity. The $0.50 fee never increases the wallet or reduces a customer's allowance. Six Starter terms cost up to $8.94, while a seventh would cost $10.43. Two Builder terms cost up to $8.98; an additional Starter would require $10.47 in total. A subscriber cannot spend beyond their own published budget even if more wallet capacity is available. A single Studio or Complete term needs more funding. Availability changes as real commitments and model usage change. The app publishes tier availability without disclosing the merchant's wallet balance.

A renewal requires a separately reserved, contiguous month. Stripe's cancellation date must already protect the billing boundary. The processor may extend it only after the new month has been fully backed. With no funds for that extension, the current month remains playable and the next month is not charged. The payment integration must independently enforce this remote stop date even when the game is offline. Public reusable subscription Payment Links and native recurring enrollment cannot enforce this contract and stay closed. Native purchase restoration remains available.

An operator can verify admission without charging anyone by reading `GET /api/commerce/access`. `pixAdmission.tiers` distinguishes an available plan, wallet capacity, provider connectivity and online billing readiness. `webSubscriptionsReady` is true only when at least one plan can accept a new checkout. To activate checkout, apply migrations through 0008 and verify the operator checklist below. The mobile storefronts keep new monthly enrollment closed.

### Monthly checkout and renewal

A signed-in player selects a Pix plan in the Island Store. The store displays an unchecked, plan-specific authorization naming SLF Media Group, the price and monthly timing, applicable tax, the separately paid first invoice and the way to stop renewals. The server records the accepted text, version, price and timestamp against that account and funding reservation. Stripe Checkout repeats the disclosure while collecting the card and billing address. The default Stripe card-use notice and card authentication are preserved. [Stripe’s guidance on saving cards for future charges](https://docs.stripe.com/payments/save-and-reuse#compliance) Saving the card has no charge. The server verifies the exact Checkout Session, SetupIntent, account, customer and consent. It pins the plan's provider budget, then creates a single-month Stripe Subscription Schedule with `end_behavior=cancel`. The player reviews the first tax-calculated invoice on Stripe and explicitly pays it. Pix unlocks when the signed receipt and matching paid card charge reconcile to that funded month. Closing the browser leaves the invoice accessible in the store.

The quarter-hour reconciliation job checks for renewal within the final three days. It extends the finite schedule by exactly one calendar month only after reserving that month's full allowance. A later renewal uses the customer's current saved card and automatic tax. Without a new reservation, the original Stripe cutoff takes effect even during an application outage. **Stop Pix renewal** in the store removes the upcoming phase and preserves the current paid term. Before the first payment, Stop also voids the open invoice. **Manage billing** opens invoice history and card replacement. The dedicated Stripe portal disables subscription updates, reactivation, pauses, cancellations and public login. Deleting the game account cancels managed schedules and verifies that every outstanding draft or open invoice can no longer collect before removing the account. [Stripe subscription schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules) · [Hosted invoices](https://docs.stripe.com/invoicing/hosted-invoice-page) · [Customer portal](https://docs.stripe.com/customer-management)

### Operator verification before enabling monthly sales

1. In a separate Stripe test environment, configure the four recurring catalog prices, the dedicated customer portal, tax setup and signing secret. Target that same environment's API key and webhook endpoint. Use an isolated accounts database and test wallet. Enable `STRIPE_FUNDED_BILLING_READY` there for the rehearsal.
2. Complete the card setup, review the exact tax-inclusive invoice, pay it with Stripe's test card and verify the account gets exactly its own plan. Exercise card replacement, replayed events, refund, insufficient funds for renewal, a funded renewal, cancellation and account deletion. Confirm on Stripe that the last funded phase ends in cancellation and unpaid invoices are void.
3. Before enabling the live flag, independently verify production tax registration, real price identifiers, the plan-specific authorization shown to the player, portal restrictions, all three prepaid providers, funding headroom and webhook delivery. Enabling the flag permits new real monthly invoices at the selected catalog price. No purchase occurs solely by changing the flag. Disabling it prevents new authorizations. A month already reserved and scheduled on Stripe remains collectible until canceled in the game.

### Run an actual Stripe test-mode billing cycle

From the repository root, use Node 24 or later. Set `PIX_STRIPE_TEST_KEY` in a private local environment to an existing Stripe **test-mode** key. The script ignores every live deployment setting and refuses to make its first write unless Stripe confirms `livemode=false`. The test merchant needs an active Stripe Tax configuration and an initialized customer portal. You can pass an existing dedicated test portal in `PIX_STRIPE_TEST_PORTAL_CONFIG`; otherwise the command creates and later archives a test configuration. It never edits the merchant's default.

```sh
node scripts/store/rehearse-stripe.mjs --check
node scripts/store/rehearse-stripe.mjs --run
```

The read-only preflight checks the balance mode and Stripe Tax status. The run creates a test clock, catalog, test customers and isolated local game accounts. It creates a real hosted card setup and expires it, then confirms a real off-session SetupIntent with Stripe’s Visa test fixture. It exercises the game’s funded billing code with this confirmed intent. Stripe finalizes the first tax-calculated invoice, receives an explicit test payment and gets a separate unpaid invoice to void. The script opens a protected portal session, advances the test clock, verifies that low funds preserve Stripe’s original cutoff, funds one more term, waits for an automatic renewal payment and confirms that refunding it revokes access. The simulated provider wallet never contacts an AI provider or the game’s live database. Tax can correctly be zero when the test account has no applicable registration.

To also verify a **completed hosted card setup and hosted first payment**, use `node scripts/store/rehearse-stripe.mjs --run --hosted` and open the two private test-mode links when prompted. Enter Stripe’s test card and a test billing address. The script retrieves the real completed Checkout Session and SetupIntent before it creates the first invoice. A successful run writes a JSON receipt to standard output containing the API version, verified checkpoints, invoice totals and cleanup result. Private hosted URLs appear only in the interactive console. The script deletes its test clock and archives its catalog and temporary portal. Stripe retains its own test event history. If interrupted, use the printed Pixel test run UUID to identify those fixtures in the test account. [Stripe's test cards](https://docs.stripe.com/testing) · [Stripe's test clocks](https://docs.stripe.com/billing/testing/test-clocks/api-advanced-usage) · [Stripe's guidance on automated testing](https://docs.stripe.com/automated-testing)

The rehearsal key is separate from the production Worker’s restricted key. It needs the runtime permissions listed above plus Balance and Tax Settings **Read**, and Test Clocks, Products, Prices, Payment Methods, SetupIntents and Refunds **Write**. Creating a dedicated temporary portal also requires portal configuration writes. It uses the same pinned Stripe API version as the Worker. It does not create tax registrations, store a key or use real funds.

This command verifies processor state via authenticated Stripe API requests. Signed-delivery testing is a separate test-environment release check. Forward sandbox events using Stripe CLI or a test Dashboard webhook to a separately configured test Worker, save that endpoint’s signing secret in its encrypted Worker setting and confirm a successful delivery for Checkout completion, paid invoice, failed payment and charge reversal. Keep the production monthly-billing flag off until the test result and deployed webhook delivery have both been reviewed. [Stripe webhook testing](https://docs.stripe.com/webhooks/test)
