# Mobile workflow audit — 6–7 November 2026

Owner request: test the application end to end, find flaws and fix them without repeated owner validation. This audit covers the supported shopping, refinement, native navigation, verification, checkout-boundary, test-payment and recovery workflows. It is a bounded AI development matrix, not proof that every possible request/device/retailer works or independent human acceptance.

## Confirmed fixes

1. New headphones and earbuds now retain the explicit new-only condition; the parser previously recognized phones/laptops only.
2. A plain “phone” category switch clears unrelated laptop RAM/storage requirements.
3. An explicit unambiguous storage/RAM clarification clears its earlier conflict while preserving unrelated issues.
4. Decimal TB requirements retain their actual capacity;1.5TB is1536GB, not5TB.
5. Explicitly changing a required brand into a soft preference actually removes the hard restriction.
6. “Only Sony or JBL” is represented and checked as an allowed-brand union. Saved unions are validated on restore.
7. Read-only stale native observations receive bounded reobservation. Unknown-dispatch actions are still never replayed.
8. Flipkart's rotating home placeholder and result-header query can be recognized from native landmarks and a unique observed search rectangle. No old fixed screenshot coordinate or invented label is used.
9. Opening search waits for an actual editable field instead of treating the still-visible home screen as completed navigation. A warm, already-focused editor can replace its old query directly.
10. Duplicate query suggestions no longer make Enter fail solely because the displayed query text is duplicated. A unique focused editor with confirmed input may submit through native focus; arbitrary empty selectors remain rejected.
11. A not-dispatched rotating search target can be rebound once only when the fresh native search control has the same observed bounds. No replay follows an uncertain outcome.
12. Explicit worker cancellation suppresses that generation's automatic main completion **before** aborting and persists the suppression. The baseline cancelled search otherwise spawned a replacement worker; regression coverage checks both live runtime and checkpoint restoration.
13. Scrolling away from a price no longer erases its earlier fresh native frame from the answer. Earlier prices have separate snapshot/time attribution and **are not merged into current eligibility**.
14. An explicit selected product-detail title can establish its page while purchase controls are offscreen. Encoded ampersands no longer break otherwise-identical scroll identity.
15. Actual Flipkart animated price digits produced a false INR9 fragment. The fix excludes standalone currency/digit assembly in a digit-wheel observation while retaining complete explicit stable amounts. The original same-visit snapshot replays **[900 cents] → []**, regular price unknown. The screenshot visually shows a different amount; no substitute OCR price is silently admitted.
16. A direct request for fresh research is explicitly distinguished from an earlier hold in the request guidance. The actual four-turn run started a new research worker on the fresh-lookup turn.
17. Debug variants now have distinct accessibility labels. **Pocket Agent Test phone tools** and **Pocket Agent Preview phone tools** can be distinguished from the original app's service in Android Settings; normal production naming remains unchanged.

Original failed expectations/logs were retained before the fixes. One native probe's first raw JSON was replaced by its subsequent attempt; its original failure log remains, and later attempts have distinct immutable names. No completeness claim is made for that overwritten raw file.

## Workflow results

| Workflow | Evidence and outcome |
| --- | --- |
| Ordinary request without model/SKU | Actual Gemini/native-phone run: headphones under INR5,000, Sony/JBL preferred. Initial run stalled on Flipkart and was stopped; later run completed with discovery holds. |
| Budget/new-only refinement | Actual request lowered to INR3,000/new-only; canonical checks retained. Gemini reached real Sony WH-CH520 and JBL Tune510BT screens. A qualified two-product comparison was **not** established. |
| Fresh lookup after a hold | Actual four-turn run started new native research; it retained a source-reported INR2,989 **conditional cashback** amount, not an unconditional price claim. |
| Selected variant and price evidence | Actual Sony/JBL/Flipkart observations plus source regressions. Missing or truncated seller/condition/stock/final-cost facts remain held; historical frame prices do not certify the current variant. |
| Required versus preferred brands | Actual soft preferences retained; automated hard-brand/allowed-union and explicit relaxation cases pass. |
| Category/capacity/conflict refinement | New ordinary-language transfer cases reproduce six baseline failures and pass after repair. These are synthetic constraint contracts, not additional retailer observations. |
| Native Flipkart search/product navigation | Controlled production tools on the actual phone, zero model calls: confirmed query returns real listings; a selected TRIGGR item opens its real product page. Accessibility omitted its complete title/stable price in that frame, so purchase eligibility remains unknown. |
| INR checkout boundary | Actual four-turn Gemini run refused a final checkout/cart/payment without eligible facts. No INR conversion or merchant mutation. |
| USD sandbox review/return/capture/unknown | Actual headless Chrome + service/SQLite journey with **injected** source/model/provider responses. Success and lost-capture reconciliation cases pass with one create/one capture each, separately labelled simulated provider counts. **Zero actual new PayPal requests**.13 screenshot states retained. |
| Receipt and conversation restoration | Injected receipt restores at320px without duplicate capture. Actual four-turn phone chat restores the same thread and all12messages, INR3k/new-only and idle state. Final APK's authenticated hosted-history read restores the existing completed USD250 purchase and its separate blocked test record, with no new provider capture. |
| New chat/history isolation | Actual new-chat creation plus full runtime/history and UI archive/isolation regressions. No old category/budget is imported into the new request. |
| Stop/cancellation/recovery | Baseline automatic retry after cancellation preserved. New cancellation/runtime-restore regressions pass. Upgrade/instrumentation also exposed a Samsung accessibility-binding failure; see recovery below. |
| Source-app handoffs | Actual source holds include exact native app destinations; native policy and source-link checks preserve explicit gestures and reject unsafe/forged addresses. |
| General Pocket/host tooling | Full runtime, UI, Python and voice lifecycle/startup simulator suites pass. No real contacts, messages, calls, calendar or unrelated automation were mutated in this shopping audit. |

The final recovered selected-model check used native research but ended in Amazon target ambiguity/Flipkart current-screen search holds. It did not establish an individual verified listing or a qualified comparison. Its same thread/all3messages/canonical INR3k/new-only state restored idle with no active workers. A source hold is not a completed shopping comparison.

## Device and environment recovery

The first final-APK model run correctly reported **accessibility not rebound** and supplied no invented product facts. Repeated secure-setting toggles and an exact-test-app restart did not clear Samsung's pending service binding. Direct shell component/detail shortcuts were denied by Android; no extra permission or privileged workaround was installed.

The services had identical labels. After adding the distinct test label, the assistant used normal **Settings → Accessibility → Installed apps → Pocket Agent Test phone tools**, turned only that already-authorized service off/on, and restored its existing approval. Android then reported the service bound with no binding/crash entries. Other services remained enabled. This is an observed environment recovery, not proof the app's automatic recovery handles every OEM binding failure. Automatic recovery remains deliberately deferred while the phone is unlocked.

All phone tests used the existing selected Gemini connection and authorized USB serial. No wireless connection/broadcast, new model-provider setup, paid fallback, remote push or real merchant purchase was performed. Screenshots/state may contain personal location/account data and stay Git-ignored.

## Verification

- **296 runtime tests passed**, including the new workflow regressions; bundle build passed.
- **50 UI tests passed,1 skipped**. **28 Python tests passed** in the project virtual environment, including voice lifecycle/startup simulations. A preliminary system-Python run lacked `aiohttp`; that environment failure is preserved separately.
- **829 backend tests and strict production build passed**, including existing sandbox, approval, quote, source, idempotency and unknown-reconciliation cases.
- ARM64, x86-64 and universal debug APK builds passed; lint **0errors,128warnings**. **10 native policy/source-link/recovery-metadata checks** passed on the phone. Those checks preceded the final accessibility-label-only APK rebuild; Java control logic/runtime are unchanged by that resource update.
- General ESNext/Bundler typing still has **16 existing diagnostics**; no clean complete runtime typecheck is claimed.
- Signature, installed APK bytes, packaged runtime/four-module manifest/source pins, gallery hashes and cleanup are checked in the final audit artifacts. The final APK is installed as **Pocket Agent Test**, preserving the original app/data.

Final installed ARM64 SHA256: `c3deca55aa155eec1284e5a7127f201f6d60507e214cebb9f30bc2f8ecf96846`. All17 gallery hashes match; accessibility is bound and all three originally enabled services remain enabled. Original screen-awake0 restored; task TCP9224 forward and the task-created loopback Vite server removed. Shizuku and USB authorization remain intact.

Reproduce offline checks from `runtime` with `npm test`, `npm run test:ui`, `npm run build`; Python uses the repository `.venv`; build the isolated APK from root with `.\gradlew.bat -PisolatedDeviceValidation :app:assembleDebug :app:lintDebug`. Live tests additionally require the owner's approved/unlocked phone, working accessibility/Shizuku and an available configured model. Provider mocks are not genuine sandbox transactions.

- [Ordered screenshot report](../artifacts/workflow-audit-20261106/report.html)
- [Final ARM64 APK](../artifacts/workflow-audit-20261106/Pocket-Agent-Test-arm64.apk)
- Private evidence: `artifacts/workflow-audit-20261106/`, frozen prompts/expectations, baselines, raw source snapshots, model traces, source replay, test/build/type logs, provider-fixture results, recovery and integrity records.

Remaining acceptance gaps: reliably complete a constraint-qualified two-product comparison; collect stable selected-product title/price/seller/condition/stock/delivered costs on variable native layouts; robust OEM accessibility recovery. Native holds are intentional where facts are incomplete. No fresh payer-approved sandbox transaction, independent human acceptance or model-weight training is claimed.

Historical bars **50/50→50/50 (+0),40/40→40/40 (+0),3/10→3/10 (+0),total93/100→93/100 (+0)**. Phase3/stash remain paused.
