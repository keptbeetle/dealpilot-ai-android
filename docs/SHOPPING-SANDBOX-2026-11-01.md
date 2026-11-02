# Pocket shopping + genuine PayPal sandbox demo

**2026-11-02 Android audit update:** Actual Android16/API36 emulator pairing/runtime is now verified in `5c76cc6`, with backend `6b37236`; eight defects fixed. [Full results/remaining gaps](EMULATOR-AUDIT-RESULTS-2026-11-02.md), [59-screen report](../artifacts/emulator-audit-20261102/report.html).819 backend tests/build, Pocket204/44/24 and Android build/lint pass. Real INR laptop coverage, physical-device/standalone execution and actual payer-approved capture remain pending. Older compilation-only results below are historical.

Implemented locally on1 November2026. Open **http://127.0.0.1:3090/shopping.html** while the demo launcher is running. Pocket's browser sidebar and Android sidebar also have **Shopping sandbox demo**.

The corresponding DealPilot backend engineering commit is `fe2fc3e`. This document and the implementation contract supersede the earlier planning-only status for the host-assisted demo, while preserving that baseline's original measurements and remaining native-device gates.

This is a **host-assisted shopping mode**: Pocket's actual `MobileSession` model/tool loop, permitted research and payment backend run on Windows. Android packages the shopping interface and pairs privately with that host. It is not a claim that the general on-device phone operator already performs this entire purchase workflow autonomously.

## Run on native Windows

Keep the two checkouts installed side by side: `D:\Projects\pocket-agent` and `D:\Projects\dealpilot-ai`. Pocket runtime dependencies and DealPilot dependencies must be installed. The existing DealPilot `.env` supplies free source credentials and PayPal **sandbox** credentials; keys are never copied into browser code or the APK. Set `DEALPILOT_ROOT` if using a different backend checkout.

```powershell
cd D:\Projects\pocket-agent
# Optional, explicit reuse of this Windows user's existing Codex sign-in:
$env:POCKET_USE_LOCAL_CODEX_AUTH='1'
.\scripts\windows-dev.ps1 -Action ShopDemo
```

The optional existing-account mode reads unexpired credentials into memory, uses Pocket's supported Codex adapter/default `gpt-6-luna`/low, does not import them into Android or the preview vault, and refuses desktop-cache refresh. It uses the existing account allowance; API cost is not measured. Without that flag, connect a supported model in the host Pocket AI settings; the shopping service uses a configured provider. There is no silent model/key fallback.

The launcher starts a private DealPilot API on127.0.0.1:8790 and Pocket on127.0.0.1:3090, with a new private bridge secret passed in process environment. It checks for occupied ports and does not kill another application. Ctrl+C stops its owned processes. `POCKET_PREVIEW_PORT` and `POCKET_BACKEND_PORT` can select different ports; the exact PayPal return origin follows the selected web port.

## Test the flow

1. **Choose product data.** Real permitted sources are the default. Enable source consent, plus Channel3 consent when needed. For a reproducible demo, explicitly select **Sample inventory — simulated** and apply the setting. A failed real search never silently changes mode.
2. **Describe a need in chat.** Try wireless headphones under$100, Sony/JBL preferred. Pocket discovers/filter/compares through its bounded shopping tool. Product facts come from the backend, not model-authored records.
3. **Refine or compare.** For example: onlySony, reduce budget by20; or ASUS laptops under800 with16GB RAM/512GB SSD. Hard requirements/currency/budget survive unrelated follow-ups; no-match is a valid result.
4. **Select naturally or click a candidate.** “I want the JBL option, quantity1. Prepare the simulated cart, do not pay yet.” The backend refreshes exact price/stock/variant, checks quantity/budget and reads back the saved simulated cart. For20 stickers in packs of10, purchase quantity is2; the quote displays20 contents.
5. **Review the exact quote.** Read identity, purchased quantity, currency, amount and expiry. Check the explicit sandbox acknowledgement, then approve the exact quote. This does not create a payment. INR is retained and blocked for this USD-only adapter; unsupported currencies are not converted/relabelled.
6. **Press Pay with PayPal sandbox.** The backend creates one genuine sandbox order and supplies an actual `www.sandbox.paypal.com` approval link. The agent has no approval/payment tool.
7. **Approve on PayPal.** Open the genuine sandbox page and sign in with a **sandbox buyer** account. No payer credentials are sent to Pocket's model. Returning from PayPal is not payment success. On Android, return to Pocket after approval.
8. **Verify and capture.** Use “I approved at PayPal — verify and capture.” The backend reads the exact stored provider order, verifies payer approval, quote/custom ID/amount/currency and fresh source state, then reserves one capture. Only a matching completed capture creates the demo receipt.
9. **Review the outcome.** A verified receipt means sandbox test payment and a **simulated merchant order**. Nothing ships. An unknown outcome locks further payments; reconciliation is read-only and never retries capture. Cancellation is not a refund. New purchase conversations retain earlier test purchase records and cannot abandon an uncertain payment.

Suggested requests: headphones/no SKU; brand preferences→hard restriction; laptop RAM/SSD; impossible budget; total pack contents; INR; real ARK GPS; a comparison question without selection. The sample catalogue is deliberately small, not a real store coverage claim.

## Functional versus simulated

| Step | Behavior |
| --- | --- |
| Conversation/tool loop | Functional Pocket model inference; up to8 shopping tool calls and12 model generations per90-second turn |
| Real-source search | Functional existing permission/consent/quota-scoped DealPilot research, page/cross-check and handoff links |
| Sample search | Explicitly simulated products, prices, stock and specifications; no genuine product claim |
| Comparison | Functional model reasoning over supplied source/sample facts; safe in-chat table/bold/link rendering |
| Exact cart/quote/readback | Functional durable backend state; the merchant cart itself is simulated |
| Shipping/tax | Sample scenario assumes0; real seller shipping/tax/fees are unknown and excluded from the item-only test amount |
| Offers/discounts | No invented coupon/bank discount or eligibility; the observed source/sample unit price is used |
| Real held/catalogue-only source | Actual listing link and hold; cannot become a payable cart without permitted page evidence |
| PayPal create/approval/capture/reconcile | Genuine sandbox adapter, fixed sandbox transport; no exposed fake-success payment mode |
| Merchant order/fulfilment | Explicit simulation even after verified sandbox capture; no real merchant order or shipment |
| UI receipt/unknown screenshots marked INJECTED | Test-only rendered responses; not genuine PayPal capture evidence |

## Android development setup

Build `app/build/outputs/apk/debug/app-arm64-v8a-debug.apk` with `windows-dev.ps1 -Action BuildAndroid -SdkPath D:\sdk`. Install on an explicitly chosen test device. The November2 audit installed the x86-64 debug APK on `emulator-5554` and verified pairing, actual model/source flows, lifecycle and sandbox create/login/unapproved hold/cancel; physical-phone transfer remains unverified.

```powershell
# Replace SERIAL with the intended development device/emulator:
adb -s SERIAL reverse tcp:3090 tcp:3090
```

Open Pocket's sidebar → Shopping sandbox demo. Stop active phone work first. Enter port3090 and the pairing code printed by the host (valid10 minutes; restart for a fresh code). The buyer bearer is encrypted by Android Keystore and never supplied to model credentials. Private loopback HTTP is permitted only for this development bridge; remote MCP's HTTPS rule remains intact. PayPal and seller pages open externally by buyer action.

Entering this mode pauses background automation; native phone/shell dispatch is blocked while it is active. The shopping model itself receives only the bounded shopping tool, with no shell, arbitrary HTTP, native mutation, schedule or remote MCP tools. Leave using the shopping screen's Back link; resume background automation separately in settings if desired. This isolates the new host-assisted demo, rather than claiming the old general assistant's standing shell grants were globally redesigned.

## Verification and original failures

- DealPilot **813/813 tests**, including **40 new Pocket backend/payment tests**, and strict app/API typing plus production build pass.
- Pocket **204/204 runtime**, **43/43 preview/service/security**, **24/24 Python/host JVM** checks and bundle pass on native Windows. The additional provider test verifies only the supplied shopping tool is advertised and failed inference remains an error.
- Original November1 Android debug ARM64/x86-64/universal and fixture APK builds/lint pass:0 errors/124 warnings. The November2 x86-64 emulator audit now verifies actual native runtime and installed debug signature; ARM64/physical-device execution remains unverified.
- Actual Pocket model/browser journey: headphones→comparison→natural selection→$69 simulation→exact review→genuine sandbox order creation→actual sandbox login page→unapproved capture held→local cancellation. No payer sign-in, buyer approval or successful genuine capture occurred.
- Other live-model browser cases: ASUS-only/spec filters, budget reduction/no-match, INR hold, real Channel3 no-match without substitution, fresh real ARK research and refreshed$75 simulation, two packs of10=20 stickers/$10, desktop/390px rendering and restore after host restart. No page script errors or body overflow in the verified browser runs.
- Real ARK evidence:3 permitted rendered product observations; each successful research/refresh reported4 catalogue GETs and3 page visits. Identity/price/stock agree with source evidence, condition remains UNKNOWN and purchase recommendation remains withheld. Only a source-informed cart simulation was allowed; no seller cart was touched. These observed URLs are exposed development examples, not blind evaluation cases.
- Injected API tests cover successful capture, unknown capture/read-only recovery, wrong order/amount/currency, drift/expiry, concurrent clicks, duplicate operation IDs, ownership, absent keys/consent, unsupported currencies and agent attempts to invoke buyer-only operations. Injected browser receipt/unknown screens are visibly marked.

Failures are retained under ignored `artifacts/shopping-sandbox-20261101/` and backend `.local/pocket-*.log`: first Windows ACL startup error, original cart refusal caused by “do not pay,” remote-backend constructor leaking an SQLite handle in a negative test, initial no-match from generic GPS query terms, total-count-as-specification pack failure, and initial no-space currency-prefix regression. Fixed with DACL-only updates (no unnecessary owner change), scoped selection negation, validation before opening the DB, concise search instructions, a separate enforced total-item ledger and money-context checks that do not mistake CAD software for currency. No retries were relabelled as original successes.

The general Pocket production TypeScript debt noted in the earlier baseline remains separate; this task does not claim to have cleaned its16 pre-existing diagnostics. DealPilot's strict build passes. Original human labels, previous scores and baseline evidence remain unchanged.

## Evidence and limits

[Ordered local walkthrough](../artifacts/shopping-sandbox-20261101/walkthrough.html) contains the original verified journey, corrected transfer cases, current chat rendering and separately labelled injected states. Raw browser cookies, pairing files, provider references and source evidence remain private/ignored; do not publish the artifact directory wholesale.

The backend uses [PayPal's Orders create→buyer approval→capture workflow](https://developer.paypal.com/api/rest/integration/orders-api). Its fixed sandbox transport is reused from DealPilot; it verifies response identity and amounts, stores idempotency keys and treats uncertain outcomes as unknown. A fake local success can never fill the genuine capture acceptance gate.

**Pending:** actual sandbox buyer approval and successful provider capture, physical-device/standalone execution, real INR laptop/signed merchant coverage and autonomous general-phone shopping. Android16 x86-64 emulator pairing/runtime is now verified. No public deployment/push, real payment, merchant order, fulfilment or Phase3 release work.

Historical movement: Phase1 **50/50→50/50 (+0)**, automated Phase2 **40/40→40/40 (+0)**, Phase3 **3/10→3/10 (+0)**, total **93/100→93/100 (+0)**.
