# Sequential comparison implementation and verification

The subsequent [live comparison retest](LIVE-COMPARISON-FIX-2026-11-07.md) passed with two native Amazon offers. This report preserves the preceding stage-six results.

Owner-directed implementation on 7 November 2026. The [six-stage plan](COMPARISON-DELIVERY-PLAN-2026-11-07.md) was implemented in order, retaining failed expectations and testing each stage before the next local commit. AI-authored tests, actual device operations, archived source replay and injected payment outcomes are separate evidence categories.

## Implemented stages

| Stage | Result and sequential gate |
| --- | --- |
|1 Comparison readiness, d4b47e3 | Different models can be compared by supported attributes without claiming identical products. Unknown seller/delivery costs do not prevent a listed-price comparison; hard requirements, source freshness, identity, price/currency and stock still control ranking. Five new contracts;301 runtime tests/bundle passed. |
|2 Evidence ledger,64b2e7a | Explicit native scroll continuity preserves field snapshots and original times across durable restore. Variant, seller and destination changes invalidate prior facts; conflicting facts remain held. Six contracts;307 runtime/bundle passed. |
|3 Navigation/table UI,083b037 | Native screen states, host-issued targets, one bounded search recovery and safe assistant Markdown tables. Invented targets dispatch nothing.310 runtime/51 UI(+1skip)/bundle passed. |
|4 Screenshot OCR,30dedc6 | Bundled ML Kit on-device recognition with image hash, snapshot/time, native currency anchors and two-capture stable-price admission. Archived Flipkart pixels produce exact INR899; original full-line7899 error and initially weak substring assertion are preserved.315 runtime/51 UI(+1skip),3ABI Android/lint and two actual SDK phone tests passed. [Terms/privacy](SCREEN-OCR-DEPENDENCY-2026-11-07.md). |
|5 Review/simulation,d9e23be | Current-chat source-owned offer IDs resolve explicit selections. Item subtotal stays separate from incomplete merchant totals; changed quantities invalidate unit-specific delivery claims. Compatible observed USD sources permit a separate exact-total sandbox review.22 focused/325 runtime/bundle passed. No merchant cart/order/payment is created by review. |
|6 Transfer/device verification | Three controlled headphone/phone/laptop journeys cover scroll aggregation, restore, comparison, selection, refinement and expiry. Actual-phone testing exposed moving Amazon ad layouts; a failing contract was preserved and fixed. An issued target may follow the exact full unchanged label at a unique fresh position; changed or ambiguous products still hold. Duplicate native targets are consolidated. Final329 runtime/51 UI(+1skip)/28 Python tests,829 backend tests/build and3ABI APK/lint pass.14 native phone checks pass;16 existing general typing diagnostics remain, with no new-module diagnostics. |

Optional cost claims do not certify a seller, selected variant or final checkout. A source-reported estimate is distinct from buyer-verified checkout. A native INR listing without a compatible observed USD product link cannot start this sandbox path; no URL or currency conversion is invented.

## Actual phone observations and limits

Tests use the existing selected Gemini model on the USB Galaxy A71 and native Amazon/Flipkart apps, without requiring a product SKU/model from the shopper. The source request is INR5000 with Sony/JBL preferences, refined to INR4000, followed by explicit review of one unit without payment.

The first run preserved a target-bound movement failure. A later refinement reached the Sony WH-CH520 page and preserved an observed listed amount, while missing stock/cost evidence remained held. The final updated APK can select an actual product and reach its page; incomplete observations are not upgraded into supported stock or prices. The final refinement retained INR4000 and Sony/JBL preferences but ended with Flipkart search-control and Amazon accessibility-busy holds. The explicit one-unit review was refused because no qualified offer was available. All8 messages and the same thread/request restored idle. A fully qualified two-product native comparison remains an acceptance gap. Source holds are not a successful comparison.

The audit monitor initially hit a read-only SQLite-copy race; the failed log is preserved and retry support was added without modifying the phone database. Prompt submission is now checked against durable typed input, avoiding a stale Stop button being mistaken for Send. The test app accessibility service required ordinary Settings off/on recovery after instrumentation; it is not evidence that every OEM recovery is automatic.

## Checkout and packaging

The separate browser/service regression passes injected success and lost-capture-response/unknown reconciliation, with13 screenshots and exactly one injected capture per journey. These are synthetic source/model and intercepted PayPal responses, not actual provider transactions. Its initial external-font page-load timeout is preserved; the harness now blocks unrelated external fonts and waits for DOM readiness plus application controls.

The signed isolated APK is installed as Pocket Agent Test, preserving the original app and data. Packaged runtime/manifest and four vendored DealPilot source pins match disk and installed APK bytes. Final ARM64 SHA256 is `3417ba9d9be1f0baff6733d18e63e2b9cd48c1f63171e373f5dcabb3d1546e39`. Twelve ordered screenshot hashes match. An actual user-gesture source link opens the Amazon Android package. The original awake value0 is restored, task TCP9224/Vite are removed, replay temporary files are cleaned, all three original accessibility services remain enabled with no binding/crash entries, and Shizuku/USB remain intact.

- [Ordered screenshot report](../artifacts/sequential-comparison-20261107/report.html)
- [Final ARM64 test APK](../artifacts/sequential-comparison-20261107/Pocket-Agent-Test-arm64.apk)
- Private raw evidence: `artifacts/sequential-comparison-20261107/`.
- Separate injected checkout walkthrough: `D:/Projects/dealpilot-ai/.local/normal-checkout-sequential-20261107-retest/walkthrough.html`.

No new buyer-approved PayPal transaction, merchant cart/order, independent human acceptance, model-weight training, remote push or Phase3/stash work is claimed. Historical phase movement: **50/50→50/50(+0),40/40→40/40(+0),3/10→3/10(+0),total93/100→93/100(+0)**.
