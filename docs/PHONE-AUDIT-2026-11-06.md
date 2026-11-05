# Physical phone shopping audit — 6 November 2026

Tested by the assistant on the owner's Samsung Galaxy A71 (SM-A715F), Android 13, over USB. This is AI-operated development evidence. Owner acceptance and a completed sandbox capture are separate gates.

## Installed build and provider choice

The existing Pocket app rejected the update because its signing certificate differs from the local development key. Its data was preserved. The current code was installed separately as **Pocket Agent Test**, package `dev.pocket.agent.historyvalidation`. The final test APK is `artifacts/phone-audit-20261106/Pocket-Agent-Test-arm64.apk`.

OpenRouter was not supported by the initial APK. Added a fixed OpenRouter Chat Completions connection with encrypted Android storage and model discovery. Discovery admits only explicitly free, zero-advertised-token-price models with tool support. Paid IDs are rejected before inference. Catalogue reading now accommodates the observed 742 KB response within a bounded 2 MB limit.

The owner's original `nvidia/nemotron-3-ultra-550b-a55b:free` accepts text only. Queried actual OpenRouter metadata and chose `nvidia/nemotron-3.5-super-vl:free`, advertising images and tools with zero prompt/completion price. Live host SDK probes verified tool continuation and reading the heading in an actual phone screenshot. The phone saved the new model normally.

The key then reached OpenRouter's 50-request daily free quota. The response reported zero remaining and reset at **5:30 AM IST on 6 November**. Switching free models does not avoid an account-wide allowance. Added shared request-start pacing and guidance to use one worker at a time. These controls cannot restore an exhausted daily quota. Full phone browsing with the OpenRouter vision model remains unverified.

The existing `gemini-3.5-flash-lite` key passed live inference and phone setup. It was used explicitly as the existing fallback for the completed source browsing case. No paid OpenRouter model was used.

## Actual phone outcomes

| Case | Outcome |
| --- | --- |
| USB installation | Initial signature conflict preserved. Separate test installation succeeded. |
| Shizuku and Accessibility | Initial run lacked test-package authorization. Started installed Shizuku over USB, authorized the test package and enabled its Accessibility service while preserving existing services. |
| Ordinary ₹80,000 ASUS laptop request | Understood without a SKU and dispatched workers. Permission errors and the free request limit prevented a verified comparison. The laptop scenario remains incomplete. |
| Real ARK product-page browsing | Gemini opened Chrome on private display 8. Native accessibility observations show **ARK Flow**, **$250.00**, **In stock**, and **ARK-FLOW** at the requested URL. This is real page evidence. |
| Natural selection | “I choose this ARK Flow at $250 for one unit” produced the sandbox review button in the same chat. |
| HTTPS phone connection | Connected directly to the deployed service, with the access key cleared from the form after saving. No Windows shopping host or ADB reverse was used. |
| Exact quote | One unit × $250 matched the source observation. Pay stayed disabled until explicit quote acknowledgement and approval. Tax/shipping were labelled unknown and excluded. |
| First hosted create | Failed before OAuth completed because the Worker rejected redirect:error. Preserved the original unknown state and screenshots. |
| Unknown recovery | Read-only reconcile did not replay creation, new purchase was held, and reload retained the unknown outcome. |
| Transport fix | Changed to manual redirect handling with rejection of non-2xx responses, so credentials are never forwarded to a redirect target. Live hosted OAuth then passed. |
| Test-record recovery | Preserved the exact original test record and made an annotated, revision-checked maintenance update to blocked after reproducing the pre-OAuth redirect-policy failure. No order-create replay or capture occurred. |
| Fresh sandbox create after fix | A fresh quote and explicit approval created a genuine PayPal sandbox order and opened the actual sandbox login on this phone. |
| Buyer approval and capture | Pending buyer action at the sandbox login. No completed capture is claimed. |

## Confirmed flaws and fixes

1. **OpenRouter missing from the app.** Added native/preview configuration, credential storage, bounded free tool-model discovery and fixed-origin inference.
2. **Original model lacks images.** Selected the verified free VL model and corrected capability recognition for IDs ending in `:free`.
3. **Concurrent workers exhaust the shared free limit.** Added request pacing across assistant/worker streams and single-worker guidance. Daily quota still requires reset.
4. **Cloudflare payment transport rejected redirect:error.** Fixed manual redirect rejection, added bounded transport diagnostics and a regression for credential-safe redirect handling.
5. **Pre-order authentication failure incorrectly trapped the buyer as an unknown order.** Explicitly track dispatch of the PayPal order operation. Future authentication failures before dispatch are blocked without claiming an order exists. Genuinely uncertain outcomes remain unknown.
6. **Stale provider error stayed visible after successful fallback.** Clear the previous notice when the buyer sends the next message.
7. **Installed-app signature mismatch.** Used a separate test package and label to preserve the owner's original installation. The normal installed app has not been replaced.

During development, one deployment command continued after a failed check. That temporary build was replaced by the corrected version after typechecking and the payment regression suite passed. The failed logs are retained.

## Verification and evidence

- Backend full suite **827 passed**, strict app/API typecheck and production build passed.
- Pocket runtime **207 passed**. Preview **47 passed, one platform skip**. Android isolated ARM64/x86-64/universal build and lint passed.
- Payment regressions **71 passed**, including known pre-dispatch failures, duplicate-operation preservation, capture-once, unknown recovery and manual redirect rejection.
- Live service authenticated with PayPal sandbox after deployment of the transport fix. The next physical-phone create returned a genuine approval URL.
- Private ordered screenshot report lives at `artifacts/phone-audit-20261106/report.html`. Raw model, native observation, source, failure and test records remain in the same ignored directory.
- Development screenshots, API keys, credentials, device databases and the private service access key are excluded from source commits.

The full DealPilot shopping verifier remains deferred. Price and stock above are observed page facts, while the payable merchant cart/order and delivery remain simulations. This audit does not establish broad retailer coverage or universal shopping success.

Historical phase-weighted score remains **50/50 + 40/40 + 3/10 = 93/100 (+0)**. The physical-phone acceptance milestone is still incomplete pending actual buyer approval/capture and broader source browsing.
