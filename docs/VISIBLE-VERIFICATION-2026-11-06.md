# Visible native shopping and verification — 6 November 2026

The owner explicitly replaced the previous private-only shopping policy with permission to use the visible phone screen. This checkpoint supersedes that policy in the earlier smartphone audit; the old failures and evidence remain unchanged. Amazon and Flipkart research still uses their installed Android apps, without website fallback, access-challenge bypass or purchase permission. General Pocket main/phone-operator functionality remains available.

## Implementation

- `phone_store_app` now defaults to the authorized physical display. Virtual displays remain optional, preserving the native session-isolation protections. The focused research profile still excludes arbitrary shell execution and external-display/file-image substitutes for source evidence.
- Direct user messages update a durable, host-owned shopping request. INR/USD budget, supported RAM/storage requirements, required brand versus soft preferences and new-only condition survive refinement/checkpoint restoration and are copied into research-worker scopes. Canonical checks override relaxed or omitted model tool arguments. This is bounded parsing, not comprehensive interpretation of every possible product specification; arbitrary extra requirements still need richer typed handling.
- Four actual DealPilot pure modules are integrated: product identifiers/checksums, source identity/model/variant comparison, reported purchase costs and observation freshness. Native accessibility observations are adapter inputs; no synthetic HTML, invented seller response or extra merchant access is introduced. Source freshness is limited to 15 minutes.
- Source/seller/condition claims, explicit currency and regular price, selected identity and unresolved variants, stock contradictions, unknown shipping/fees/membership/delivery and stale/truncated observations produce structured supported/unknown/contradicted checks and holds. A source claim is not independent verification. `purchaseReady`, `checkoutVerified` and `independentVerification` remain false; this integration does not certify checkout or authorize payment.
- Module sources are pinned by SHA-256 in `runtime/vendor/dealpilot/SOURCE_MANIFEST.json`; the manifest is packaged inside the APK. `node scripts/sync-dealpilot-verification.mjs` refreshes from the sibling owner workspace without network access. Core DealPilot fix **53807f3** excludes capacities/battery sizes from model identifiers and recognizes compact phone model codes: A26 and A35 must not match simply because both say 128GB.
- Native search accepts the model's query-plus-action sequence by searching and observing first, then validating the action against fresh source evidence. Repeated queries continue only with matching live store context. Search controls receive a bounded readiness wait. One retry is permitted only for an explicitly **not-dispatched** stale action with safe fresh target matching; unknown dispatch is never retried. Accessibility media suffixes no longer break title continuity while scrolling. Missing scroll direction defaults to down; invalid directions still fail.

## Actual phone results

These are AI-operated development tests on the authorized USB Galaxy A71/Android13, Pocket Agent Test, with the existing selected Gemini `gemini-3.5-flash-lite` connection. They are not independent human acceptance, model-weight training or a claim of remaining model allowance.

| Test | Observed outcome |
| --- | --- |
| Normal request, no SKU/model | Actual Gemini used native research and opened Motorola Moto g37 Power 5G and Samsung Galaxy F06 5G product screens on Amazon. This exceeded the previous private-session block, but did not produce a qualified two-product comparison. |
| INR25,000 → INR20,000, minimum128GB, new-only | All examined initial reports used INR2,500,000 cents/minimum128GB; all refinement reports used INR2,000,000 cents/minimum128GB/new-only. Unit coverage separately proves omitted/relaxed model arguments cannot override the canonical checks. |
| Product verification | Some source claims were supported, but ambiguous prices/variants and absent seller, condition, stock or delivered-cost information remained held. No unsupported winner was admitted. |
| Flipkart | Loading/search availability and native target ambiguity still prevented a complete positive comparison. Longer readiness handling is implemented, not claimed as a complete Flipkart fix. |
| Checkout request without payment permission | Refused checkout/final total without an eligible quote; no new cart, PayPal proposal/capture or merchant order. |
| Conversation recovery | Three-turn retest retained the same thread and all eight messages. After subsequent diagnostic follow-ups and final APK upgrade, the current thread retained13 messages, budget20k/minimum128GB/new-only, no busy main and no active workers. |
| Final Gemini follow-up | **Failed to initiate fresh research.** It reused the previous hold, producing zero new workers. This remains an open model/workflow issue, not a successful lookup. |
| Separate controlled production-tool test | Actual `navigateStoreApp` and Android primitives, **zero model calls**, opened the previously observed Galaxy F06 and captured **₹15,290 listed**, **₹16,999 MRP**, and **EMI from₹538** as separate values. Currency/regular budget were supported; selected variant/condition/seller/stock/delivered cost remained unresolved, so verification was held. This is real captured source data at that visit, not a current guaranteed offer or autonomous Gemini success. |

Original failed harness runs, pre-fix query/action errors, raw model calls and source reports are preserved privately. A backgrounded Activity's cached UI snapshot initially made completion look stalled; the later harness reads durable worker completion before returning Pocket to foreground. No success is inferred from the cached spinner.

## Verification and installed artifact

- **279/279 runtime tests passed**; **50 UI tests passed,1 skipped**. Coverage includes canonical refinement/restore, relaxed tool arguments, stale/contradictory source evidence, unknown costs, wrong variants, checksum rejection, visible authorization, shell restrictions and retry dispatch semantics.
- **829/829 backend tests and strict production build passed**, including two new model-identity regressions in core commit53807f3.
- ARM64, x86-64 and universal debug builds passed. Android lint: **0 errors,128 warnings**. Final four native policy tests passed on the USB phone after APK installation.
- Extra general TypeScript audit still reports **16 existing diagnostics** with ESNext/Bundler resolution; no clean full runtime typecheck is claimed. An additional NodeNext probe produced three JSON import-mode diagnostics and is preserved separately. No diagnostic targets the new shopping request/verifier/vendor modules.
- Final **isolated** Pocket Agent Test APK signature verified; installed APK bytes match SHA-256 `4f183a32da736b2ff79631f489cc93515831e27acc4a808d897550e45b3bcf58`. One intermediate build used the normal package setting; Android rejected its installation for signature mismatch. It did not replace the original app. The corrected final build uses `-PisolatedDeviceValidation`.
- Packaged runtime and four-module manifest match their final local artifacts; adapted-module and upstream-source hashes match. All nine gallery screenshot hashes verified.
- Rebound only the previously approved test accessibility component after instrumentation, preserving other enabled services. Restored the verified original screen-awake setting **0**, removed only task TCP9224 forwarding, and left USB authorization/Shizuku intact. No wireless connection or broadcast was started. The original app/data and historical sandbox receipt were preserved.

Reproduction commands (repo root unless specified):

```powershell
# Inside runtime:
npm test
npm run test:ui
npm run build
# Repository root; preserves the original app's package:
.\gradlew.bat -PisolatedDeviceValidation :app:assembleDebug :app:lintDebug
```

## Evidence and remaining work

- [Nine ordered screenshots with captions](../artifacts/visible-verification-20261106/report.html)
- [Installed ARM64 APK copy](../artifacts/visible-verification-20261106/Pocket-Agent-Test-arm64.apk)
- Private evidence folder: `artifacts/visible-verification-20261106/`, including immutable baseline/retest traces, `audit-results.json`, source/price captures, final no-retry follow-up, build/test logs, bundle integrity and cleanup confirmations. Screenshots and app-state copies may contain account/location data and remain Git-ignored.

Next: make a requested fresh lookup reliably initiate research after a prior hold; resolve Flipkart loading/search targeting; deliberately collect selected variant/condition/seller/stock and delivered-cost evidence across multiple frames; then establish a genuine constraint-qualified autonomous comparison. Full authority/evidence certification and broad independent acceptance remain separate. No new payment, currency conversion, remote push or Phase3/stash action occurred.

Historical movement: **50/50→50/50 (+0),40/40→40/40 (+0),3/10→3/10 (+0),total93/100→93/100 (+0)**. These roadmap bars are not a mobile-shopping success score.
