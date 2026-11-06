# Shopping browser tuning — 6 November 2026

This is assistant-operated development evidence on the owner's USB-connected Galaxy A71, Android 13. It is not independent human validation, model-weight training, or universal retailer acceptance. Original failed runs and model drafts remain preserved.

## Changes

- Added explicit Chrome navigation without Android merchant-app interception. The private-display path uses Chrome's exported launcher rather than its URL dispatcher, retains personal-task protection, and refreshes the Shizuku service when a local APK is replaced.
- Kept Chrome's own address bar ahead of document content in bounded accessibility observations. A long product page previously exhausted the observation budget before the source address was included.
- Added `phone_browser`, which combines browser navigation, compact page reading, price/offer observations and optional currency, budget, brand, RAM and storage checks. Its click/scroll action captures a fresh snapshot immediately before dispatch, reducing stale-snapshot failures while a model is thinking. Existing general phone tools remain available.
- Separated regular amounts from bank/card/coupon/exchange/EMI amounts, MRP, savings, shipping, per-piece values and GST breakdowns. Search cards do not qualify as verified product pages. Ambiguous dollar currency, missing specifications, contradictory availability and incomplete observations retain holds.
- Added a focused `shopping-researcher` using the selected model. Fixed memory injection losing registered worker instructions. Store research stays in the rendered browser, with no HTTP-scraping fallback or access-challenge bypass.
- Ended the main inference turn immediately after a successful asynchronous worker handoff. The prior free-model run repeatedly announced that it was stopping while continuing to call tools and notify the user. Failed dispatches and worker dependencies can still continue normally.
- Added shared credential-scoped pacing, provider quota cooldowns with explicit UTC reset dates, model-specific unavailable-model holds, bounded pre-content retries, and a wall-clock stream interruption guard. A stalled SDK body cannot ignore cancellation. No paid model is substituted.
- Added a research-output guard after a live Gemini failure. Research worker conclusions and their main-chat completion are rendered from fresh browser observations. Typical-price ranges and unsupported specifications from the model's draft are withheld. The original draft is retained separately in the private durable transcript. Blocked pages keep handoff links without promoting their prices.
- Extended the guard to quick product lookups performed directly by the main chat. Evidence stays within the current turn or the completed worker, so unrelated earlier listings are not reused. Unit/GST references have explicit labels. Existing buyer-requested sandbox proposals retain their separate quote/review workflow.
- Made source links tappable with visible destination hosts. Native navigation requires an explicit main-frame HTTPS gesture and rejects embedded credentials. Automatic redirects and unsafe links remain blocked.

The output guard covers the focused shopping research path. It is not the full DealPilot product-identity, seller, variant, eligibility or checkout verification engine. General phone workflows and the separately reviewed PayPal sandbox workflow are retained.

## Verification

| Check | Result |
| --- | --- |
| Runtime suite | **241 passed**, including 34 added regressions since the previous 207-test checkpoint |
| Preview/UI suite | **49 passed, 1 skipped** |
| Android isolated debug APK, 3 ABIs, lint | Passed; lint **0 errors, 128 warnings** |
| Opt-in physical-device browser instrumentation | **1 test passed across 2 real product pages** |
| Native external-link validation | **1 additional test passed**, covering gestures, frames, HTTPS and credential rejection |
| General runtime TypeScript audit | Existing **16 diagnostics** remain; no diagnostics in the new browser, provider-limit, shopping-evidence or session modules |
| Installed package | `dev.pocket.agent.historyvalidation`, **Pocket Agent Test**; original differently signed app preserved |

The native test opened ARK Flow and LINQS NFC stickers in Chrome on the same private display and observed each requested host in Chrome's address bar. Original launch and missing-address failures are preserved separately. APK replacement and Android instrumentation required a scoped reconnect of the already-approved test accessibility service, preserving the other enabled services. No wireless debugging broadcast was started.

Actual accessibility observations reported ARK Flow at **$250.00, in stock**. The parser keeps the dollar currency unspecified rather than silently certifying USD. LINQS reported **₹500.00 for 10 pieces**, **₹50.00 per piece**, and **₹424.00 + ₹76.00 GST**. Replaying the same captured LINQS observation now retains ₹500 as the listed total and the other amounts as references. These are source-reported observations, not verified delivered totals or an independent visual price study. The source screenshots contain browser overlays and do not independently establish all off-screen details.

An ordinary no-SKU headphones request exercised real Google, Amazon and Flipkart browser pages. Before the final guard, Gemini produced unsupported “typical” Sony/JBL price ranges and specifications after failing to establish listing prices. That original output is retained. A same-observation replay through the new guard removes those claims and retains the actual observed listing link with unknown price/availability and explicit holds.

The final live headphones retest completed with the focused researcher and the guarded main-chat result. It retained observed Amazon links, explicitly withheld price/availability, and did not repeat progress messages. This is a successful truthfulness/failure-handling retest, not a successful two-product qualifying comparison. A direct LINQS lookup then exposed a separate main-chat guard gap and an invalid selector-less scroll action. Both were fixed. Scrolling now uses a fresh viewport-bound gesture, and truncated observations cannot establish that a tax/offer detail is absent.

The final direct LINQS retest on the installed APK reported **₹500 listed amount, ₹50 per-piece reference, ₹424 excluding GST and ₹76 GST**, with page-reported availability and a retained truncation hold. The source link rendered as a real anchor with its host visible. An actual native-screen tap opened Chrome, and Chrome's address bar confirmed the exact LINQS source path. The return to Pocket preserved the conversation. No order or payment was initiated. A CDP click attempt timed out; the independent native tap and recorded address are the actual handoff evidence.

Installed arm64 APK SHA-256: `72b554cf4eff57bfe20b04bbcde925ed06b4e18455d2e6651dfa73aef610970c`. The saved artifact is `artifacts/browser-tuning-20261106/Pocket-Agent-Test-arm64.apk`. The selected phone provider is the existing Gemini 3.5 Flash Lite connection while OpenRouter's free allowance is exhausted; the free OpenRouter profile remains saved.

OpenRouter's selected free vision model responded with HTTP 200 and reported zero cost after the daily reset. The pre-fix repeated-message run subsequently exhausted its daily allowance. The cooldown now reports this directly instead of repeatedly issuing requests. The latest live retests use the existing Gemini connection when OpenRouter is unavailable. A small successful request does not establish a remaining Gemini daily quota.

Private evidence is under `artifacts/browser-tuning-20261106/`. It includes original failure states, expectations written before phone runs, native launch/observation records, screenshots, original transcripts, the source-time grounding replay, test/build logs and the installed arm64 APK. Files containing user chats, device databases or credentials are excluded from Git. Some earlier harness attempts failed because Android was locked or a settings transition was still active; those are not counted as completed shopping tests.

## Boundaries and remaining work

Broad discovery and a completed constraint-qualified product comparison are separate milestones. This session does not establish universal Amazon/Flipkart success or a completed qualifying ₹80,000 laptop comparison. Page access, stale or hidden details, current model quota and retailer restrictions can still require a hold or user-facing source link. Conditional offers still require genuine eligibility evidence.

No merchant cart, real order, new sandbox payment or remote repository push was performed by this tuning task. The earlier completed sandbox receipt remains separate evidence. Phase 3 and its preserved stash remain paused.

Exact historical score movement is **Phase 1 50/50 → 50/50 (+0), automated Phase 2 40/40 → 40/40 (+0), Phase 3 3/10 → 3/10 (+0), total 93/100 → 93/100 (+0)**.
