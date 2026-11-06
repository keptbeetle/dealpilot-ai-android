# Native Amazon and Flipkart research — 6 November 2026

This is assistant-operated development evidence on the owner's USB-connected Galaxy A71, Android 13. It is AI-labeled, not independent human validation or model-weight training. The owner explicitly chose **private displays and session holds**, with no visible-screen takeover or retailer website fallback.

## Implemented flow

1. An ordinary shopping request delegates to the focused `shopping-researcher`, inheriting the selected model. A SKU or model number is unnecessary.
2. `phone_store_app` checks installed apps and selects Amazon India/global or Flipkart by exact package. It opens the native launcher or a package-bound official HTTPS link on an owned private display.
3. Search uses the observed search control, verifies the typed query and submits it through the native input field. Only an explicit optional guest skip is operated; credentials, challenges and access restrictions are not bypassed.
4. Clicks and scrolls capture fresh native observations. Duplicate WebView labels can use their identical observed bounds; changed, ambiguous, clipped or purchase/account targets fail closed. Coordinate hits stay bounded and are revalidated by the Android backend.
5. Observations retain package, snapshot and timestamp provenance. No website URL or SKU is invented. Search cards are discovery only. A positively observed product identity can continue across an explicit scroll for at most 15 minutes, retaining its original identity snapshot; other navigation must prove identity again.
6. The source output separates listed amounts, MRP, EMI and conditional offers. Seller, variant, stock, eligibility and delivered-total uncertainty remains visible. Native results do not become verified recommendations merely because a price was observed.
7. Missing apps, login/challenges and private-session conflicts produce holds. A user-gesture app handoff opens the installed retailer app; it is not automatic research on the physical screen. Without an observed product URL, that handoff opens the app rather than claiming an exact product deep link.

Amazon/Flipkart URLs are rejected by the browser composite and are package-bound by the native URL primitive. Other supported stores retain Chrome. Original general Pocket tools and the existing PayPal sandbox workflow remain available. No new retailer purchase authority or real merchant fulfilment is claimed.

## Fixes found during actual phone runs

- Amazon India uses `in.amazon.mShop.android.shopping`; relying only on the global package misses the installed app.
- The retailers' public launchers can redirect into singleton sessions. Native launch/deep-link dispatch now checks for existing tasks outside the owned display before acting. Personal and other-worker sessions remain protected.
- Native WebViews retain off-screen ads and duplicate labels. Compact observations prioritize the viewport, source extraction ignores off-screen bounds, and navigation omits ambiguous/clipped/tracking-only selectors. Identical-position label duplicates use a fresh bounded hit without weakening Android's target checks.
- A toolbar-only loading screen is not sufficient to finish a product click/search read. The native driver now waits within a finite bound for body content.
- The old price regex matched the final `rs` in **“stars 32,409 Reviews”** as rupees. A real product-screen test exposed this false ₹32,409 amount. Currency prefixes now require word boundaries; the original failure remains preserved and the corrected run withholds that amount.
- Native source results and session errors now reach the same grounded research-output guard as browser evidence. Native links are safe app handoffs, not fabricated merchant URLs.

## Verification

| Check | Result |
| --- | --- |
| Runtime regressions | **258 passed**, including 17 added since the previous 241-test checkpoint |
| Preview/UI | **50 passed, 1 skipped** |
| Android debug build | ARM64, x86-64 and universal APKs built |
| Android lint | **0 errors, 128 warnings** |
| Final installed APK native policy tests | **4 passed**: URL/package boundaries, session isolation, manual handoff and compact observations |
| USB production-tool driver | Completed actual native Amazon query → scroll → selected product → price observation; test transport performs no model calls |
| Actual source-to-chat replay | ₹2,989 listed amount, ₹5,990 reference and ₹105 conditional EMI retained; false review-count price absent; result fits the 32 KB tool budget |
| Live selected-model chat | Actual Gemini `gemini-3.5-flash-lite` used `phone_store_app`; completed with truthful discovery/session/action holds, **not a qualified comparison** |
| General TypeScript audit | Existing **16 diagnostics** remain; none in native-store, store-policy, browser or shopping-evidence modules |
| APK signature | Verified locally |

The production TypeScript composite was exercised against actual Android primitives through a finite, opt-in, USB-only instrumentation driver. Its synthetic unit fixtures are separate from the native screenshots and records. An earlier native-home probe observed both installed apps; that does not establish successful Flipkart search or price extraction.

The successful source observation was **Sony WH-CH520**, reached from the natural query **“Sony wireless headphones.”** Its private Amazon product screen showed **₹2,989**, **₹5,990 MRP** and **EMI from ₹105**. The source output retained unknown availability and seller/selected-variant/offer/truncation holds. It did not claim a delivered total, bank eligibility or a purchase-ready quote.

Flipkart's existing session was outside the new worker display, so the final native search returned `ACTION_REJECTED` before takeover. No website fallback was used. The later live Gemini journey searched Amazon, attempted native actions, encountered snapshot/geometry changes, and reported the Flipkart session hold. It completed without inventing current prices. A fully autonomous two-product comparison remains **unverified**; the controlled production-tool journey and the independent live-model outcome are deliberately recorded separately.

Failed and intermediate runs remain private, including transient readiness, replayed operation receipts, duplicate/truncated selectors, toolbar loading and the original rating-as-price failure. Repeated host-driver runs use distinct operation IDs; replaying an earlier receipt is not evidence of a newly dispatched action.

## Installed build and evidence

The final ARM64 build was installed as **Pocket Agent Test**, `dev.pocket.agent.historyvalidation`, preserving the differently signed original app and existing settings/history. Final native policy instrumentation passed after installation.

APK SHA-256: `1fef6991607acbb76686c762cfb4641db9befd0b29f7bb1808479d574801820b`.

- [Ordered private screenshot report](../artifacts/native-store-20261106/report.html)
- [Local ARM64 APK](../artifacts/native-store-20261106/Pocket-Agent-Test-arm64.apk)
- Private evidence directory: `artifacts/native-store-20261106/`, including original failures, actual observations, source-time replay, selected-model transcript, screenshot hashes and test/build logs.

After the successful final installation/model run, Android briefly changed USB status to **unauthorized**. Those refused reads are not counted as successful tests. The owner restored USB authorization; the installed APK hash then matched the artifact above, the temporary USB screen-awake override was returned to its saved original value **0**, Pocket Agent Test was reopened, and only the task's CDP forward was removed. Cleanup evidence is saved privately in `final-cleanup.json`. No global ADB/Shizuku shutdown, wireless connection or authorization bypass was attempted.

No merchant cart, real order, new sandbox payment, remote push or publication occurred. The existing owner-approved USD250 PayPal sandbox receipt remains separate evidence; native INR observations are not converted into USD checkout. Full seller/variant verification, broad device/store acceptance and the completed constraint-qualified comparison remain open. Phase 3 and its preserved stash stay paused.

Exact historical score movement: **Phase 1 50/50 → 50/50 (+0), automated Phase 2 40/40 → 40/40 (+0), Phase 3 3/10 → 3/10 (+0), total 93/100 → 93/100 (+0)**.
