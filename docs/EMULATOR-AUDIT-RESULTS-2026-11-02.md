# Pocket shopping Android audit — 2026-11-02

The APK was built, installed and exercised in the actual Android emulator. Eight reproduced defects were fixed. The demo works for the tested supported journeys, but it does **not** yet meet the requested ordinary Indian laptop-shopping flow: the permitted real sources cannot return India/INR laptop listings. No sample inventory was substituted for that failure.

[Ordered screenshot report](../artifacts/emulator-audit-20261102/report.html) includes the original failures, retests, exact prompts/replies and one- or two-sentence captions. [Frozen expectations](EMULATOR-AUDIT-CONTRACT-2026-11-02.md) preceded the run. This is assistant-operated development evidence, not owner acceptance or independent accuracy. Finite testing cannot establish that every flaw has been found.

## What actually ran

- Native Windows build; installed `app-x86_64-debug.apk`, package `dev.pocket.agent`, version0.1.31-local-shell.2/code31.
- `Medium_Phone_API_36.1`, Android16/API36, x86-64,1080×2400; WebView411×866 CSS pixels in portrait,914×363 in landscape and411×553 with the keyboard.
- Actual packaged Android WebView → Android Keystore-paired bearer → loopback/adb-reversed Windows host → actual Pocket model/tool loop → existing permitted DealPilot research. UI controls were driven through WebView debugging; screenshots came from Android's `screencap`, with separate full-page WebView companions. SQLite reads were observation only, never used to create a cart or payment.
- Existing-account `gpt-6-luna`/low inference used the previously enabled host allowance, without importing credentials into Android or refreshing the desktop cache. No paid-key fallback or new source permission.
- Installed fixed APK SHA256: `BC89AB842A820A83BD8E7C85FFEB20007CF03EE65C466EC210963BB576A1B652`. Debug signature v2 verifies. ARM64/universal debug APKs also built; only x86-64 was executed.

## Observed journeys

| Task | Actual outcome | Evidence |
|---|---|---|
| Laptop under80k rupees, coding/college, ASUS preferred,16GB RAM/512GB SSD | Correct INR80,000 and constraints; no actual Indian laptop products, because source coverage is absent. Consent-off attempt made no research |04,05b,18 |
| Only ASUS; budget to60k rupees | Initially rejected; after fix retains ASUS/INR60,000/16GB/512GB |06→19 |
| Compare battery/warranty without products | Explained missing results; no invented models/specifications or cart |07 |
| Real wireless headphones under$100, Sony/JBL preferred | Five real catalogue observations; seller pages unverified and cart disabled. Original native10-second timeout falsely showed unavailable although backend completed |08,09 |
| Real ARK GPS under$300 | Three permitted page observations: ARK GPS$225, SAM GPS MINI$75, SAM GPS$75. Condition, battery, warranty, delivered costs/India eligibility remain unknown. Initial timeout and busy follow-ups retained |10–17 |
| Select first real GPS, do not pay | Actual source refresh completed in native UI; exact local simulated cart1×$225, no merchant mutation/payment |16,17 |
| Sample laptop under$800; then$600 | ASUS16GB/512GB at$699; lower budget no-match without substituting Lenovo/weaker specs |20–22 |
| Sample headphone preference→Sony only→selection | Actual model over explicitly fictional inventory; exact$79 simulated cart. Chat Pay request did not pay |23–27 |
| Approval without checkbox; exact approval | Unchecked approval held; exact$79 acknowledged/approved; payment still separate |28,29 |
| PayPal from Android | One actual sandbox order created, native button opened Android Chrome with the genuine approval URL. Initial screenshot captured loading; later read confirmed the PayPal login document. Chrome notification onboarding overlaid that later screenshot |30,31,57 |
| Claim approval without payer sign-in | Actual provider read showed the order unapproved; capture refused. Local uncaptured cancellation recorded; no refund/remote void/order cancellation claim |32,33 |
|20 NFC stickers, two10-packs under$12 |2 purchased packs ×10 =20; exact$10 fictional cart |34–36 |
| INR headphones under3000 | Fictional INR2799 cart; USD-only PayPal held, no conversion |37–39 |
| Disconnect/reconnect host and force-stop/relaunch app | Recoverable error, encrypted pairing retained, same conversation/quote identity restored, no payment duplicate |40–42 |
| Keyboard/rotation | Actual IME/landscape usable; no document overflow in captured app states |43,44 |
| Real US laptop under$800, ASUS preferred | Eight real catalogue offers; stricter ASUS16GB/512GB returned two listings at$679.99 (Staples/Newegg). These are provider observations, not independently verified seller prices or purchase-ready offers |45,46 |
| Portronics hub/boAt headphones in INR | Signed merchant access missing; clearly blocked with no unsigned scraping/sample fallback |47,48 |
| Packrift boxes | Original model put merchant in brand, filtering all10 returned records. After merchant-scope fix, six real shipping-box25-pack observations under$50 returned. Native listing button opened the actual Packrift page, which displayed$22.09/25-pack; no Add to cart action |49→50–52 |
| Budget-only refinement / RAM upgrade | Wireless remains required during budget change. Explicit RAM16→32 upgrade preserves512GB SSD minimum, ASUS and$1000; sample32GB/1TB/$899 qualifies |53–56 |
| Normal main-chat entry | Main chat opens its own AI/model setup; paired shopping host does not configure the general phone agent. Shopping remains a separate sidebar mode |58,59 |

The Packrift retest also used a different category string (shipping boxes versus mailer boxes), so the live outcome alone is not a controlled causal comparison. The isolated regression reproduces the merchant-as-brand defect and verifies correction. All observed URLs are exposed development examples, never unseen holdouts.

## Eight confirmed defects and fixes

| ID | Priority / discovery | Before | Fix and verification |
|---|---|---|---|
| F01 | P1 / actual native | OkHttp default10s read timeout cut off longer successful research, then follow-ups hit busy | Explicit95s read/call limit around host90s turn. Actual refreshed real ARK cart took about28s and returned without error |
| F02 | P1 / native + parser | “Reduce the budget to60k rupees” parsed no new amount, rejecting valid plan | Shared budget-to/is parsing and cleanup; conflict/spec-number protections retained. Original native INR prompt/refinement retested; unit regression |
| F03 | P1 / service regression | Configured-provider shopping turns received empty history | Pass preceding conversation, normalize for selected provider, verify provider wire messages and two-turn service context. Existing-account native path already retained history |
| F04 | P1 / injected plan | Model could silently drop required brand on comparison/refinement | Retain brand unless user explicitly names replacement/removes scope; broadening/replacement controls tested |
| F05 | P1 / injected plan | “Do not prepare a cart” could pass affirmative selection guard | Include prepare in negation check; negative compare/preparation cases reject, “prepare cart, do not pay” still works |
| F06 | P1 / injected source | In-stock boolean allowed quantity above explicit observed inventory count | Bound selected quantity to established integer source stock count; one succeeds/two held when count1. No inventory count invented when unknown |
| F07 | P1 / real Packrift + isolated regression | Pocket tool omitted merchant scope, treating Packrift as product brand | Reuse shared user-origin merchant-scope reconciliation, optional tool stores, legacy scope migration; six real candidates/listing handoff retested |
| F08 | P1 / injected malformed plan | Generic “change” keyword disabled unrelated hard-attribute retention; budget change could admit wired item despite “keep wireless” | Reuse shared requirement reconciliation; preserve unrelated hard attributes, reject unstated additions, support explicit typed RAM/storage replacement. Injected replay now retains wireless; native budget and RAM upgrade transfer pass |

F04–F06/F08 are backend fault-injection findings, not claims that the live model spontaneously committed those errors. The model cannot approve/pay/capture/configure consent through its shopping tool. These fixes do not redesign the old general agent's unrestricted shell/worker capabilities outside shopping mode.

## Remaining product and acceptance gaps

1. **P1: India laptop source coverage.** Your exact INR request cannot produce a genuine shortlist. Enable an actually permitted India laptop feed/store/API before claiming this scenario works. Converting USD observations or filling real mode with sample products is not a fix.
2. **P1: host-assisted architecture and separate entry.** Shopping requires Windows host, adb reverse and short-lived pairing. Main chat/provider setup is separate; a standalone mobile browsing/search shopper is not delivered by this mode. No physical-device or other Android/API coverage was exercised.
3. **P1: genuine payer-approved capture remains unexecuted.** Actual create/login/read/refusal/cancel passed, but no payer sign-in/approval, provider capture, refund or real receipt acceptance was performed. Injected success/reconciliation tests remain injected.
4. **P1: merchant/evidence coverage.** Portronics/boAt signed access remains missing. US laptop/headphone and Packrift catalogue-only records require permitted seller evidence before payable source carts. Shipping, taxes, eligibility and final delivered totals are not established.
5. **P2: interaction polish.** The shopping entry is in the sidebar; initial setup/legal boundary occupies more than a screen before chat. Some links from an older shortlist render as long raw Markdown when no longer current. Research progress/errors sit below results; richer visible progress and accessible disabled-cart reasons would help. Chrome first-run notification onboarding can cover the external payment page. These observations are not fixed by the eight engineering changes.
6. **P2: finite semantic coverage.** These tests do not certify every natural-language constraint, exact-versus-minimum capacity nuance, multilingual request, hostile merchant response, app lifecycle, device/browser or real source drift. Existing16 general-runtime TypeScript diagnostics and124 Android lint warnings remain prior debt; no production readiness claim.

## Verification and evidence integrity

- Final DealPilot **819/819 tests**,69 suites; strict app/API TypeScript and production Vite build pass.
- Pocket **204/204 runtime**, **44/44 preview/provider/security**, **24/24 Python/JVM** checks; bundle pass. Provider history is tested with an injected transport, not a newly configured external payer/model account.
- Android debug ARM64/x86-64/universal and fixture build/lint pass, **0 errors/124 warnings**. Installed x86-64 debug signature verifies. Native functional evidence is now present; compilation is no longer its only evidence.
- Consent, bridge ownership, wrong order/amount/currency, unknown capture/reconcile, expiry/source drift, concurrent/replayed payment, pack totals and unsupported currency are covered by actual applicable UI checks plus separately injected existing regressions. Actual completed capture is not inferred from those tests.
- The saved emulator snapshot stalled; cold boot succeeded. First install preceded package-service readiness and was retried after boot. Android automatically updated WebView and killed Pocket with exit reason PACKAGE UPDATED; original completed exchange restored. These are environment/startup interruptions, not misreported Pocket crash defects. No Pocket crash trace or app-page JavaScript errors was observed in the completed audit.
- Original native failures and red-test logs remain separate from retests. One diagnostic script overwrote its F08 probe JSON on rerun; baseline fields were recovered from the recorded first tool output, with an explicit provenance note. Its original bytes are not claimed immutable. Human evidence is untouched.
- An additional direct ADB reopen of the sandbox URL was rejected by automatic approval review with only “blocked by policy”; no bypass or further attempt was made. Earlier native handoff/provider evidence remains valid. Payer login was left untouched.
- Raw cookies, pairing codes, private DBs and account credentials remain ignored/private. The report server exposes only the generated report, screenshots and readme text, on loopback. SHA evidence manifest records the final files; no public upload/push.

Historical weighted movement remains **Phase1 50/50→50/50 (+0), automated Phase2 40/40→40/40 (+0), Phase3 3/10→3/10 (+0), total93/100→93/100 (+0)**. Native emulator development evidence improves; owner acceptance, complete sandbox payer acceptance, general-phone authority and Phase3 release remain separate gates. The paused Phase3 stash was not applied.
