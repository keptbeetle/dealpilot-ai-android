# Pocket Agent Test — November 10, 2026 post-audit repair checkpoint

## Scope and provenance

This repair follows the actual Galaxy A71 (Android 13) USB audit saved in `artifacts/device-audit-20261110/REPORT.md`. It is a narrow local remediation, **not** a new claim that complete shopping acceptance, merchant checkout, or Android memory stability has passed.

## Fixed in source and regression tested

1. **Native gallery-to-detail recovery** (`runtime/src/native-store.ts`): after an observed product card is opened, if the app exposes only a gallery and sticky purchase controls with no source-bound title, attempt at most **two read-only native scrolls** within the same package and window. Bind product price/stock only after a qualifying product title is observed. A window switch remains a hold, never a cross-product price attribution. Real checkout/purchase controls remain forbidden.
2. **Fresh product continuity and duplicate discovery handoffs** (`runtime/src/shopping-evidence.ts`): retain qualified fresh product frames independently of the last six discovery snapshots, and collapse duplicate native discovery frames into one link per retailer, after freshness filtering but before truncating the displayed retailer list. Keep original observations in the evidence ledger. This never promotes a search card into a product quote.
3. **Safe chat formatting** (`preview/chat-view.js`, `preview/native.css`): render assistant bold, italic, inline code and headings as DOM text elements while preserving existing safe link handling, escaped comparison tables, and literal user messages. No untrusted HTML execution.
4. **Retired-worker native context cleanup** (`runtime/src/tools.ts`): remove that worker's native selection/target context when its screen UI state is released. This eliminates one unbounded host-lifetime retention path and prevents stale target reuse. **It does not establish that Android's 1.4 GB peak is solved.**

## Validation

- Focused new tests: native gallery recovery success, changed-window refusal, old target ID invalidation, duplicate source handoff, and safe Markdown/XSS behavior.
- Pocket runtime full suite and preview/UI-security suite: see `artifacts/device-audit-20261110/fix-after-install-runtime.log` and `fix-after-install-ui.log` for final run results.
- Offline Android debug build and isolated-device-validation ARM64 build succeeded. Installed only the **isolated** `dev.pocket.agent.historyvalidation` test APK with `adb install -r`, retaining the pre-existing signed package and app data.
- Built/installed ARM64 SHA-256: `b45673185049ea73d640da6df7fb39144d47935f6fbb04ef70c6d9113e88125a`. The installed bytes matched. Prior and new APKs have the same signing-certificate SHA-256.
- Test accessibility service remained bound, and the SQLite app state file remained present after update.
- A focused Gemini live retest was attempted but **not performed**: the phone's lock screen had engaged (`deviceLocked=1`), so the chat control was not interactable. No bypass or credential entry was attempted. The test script exited before submitting a model prompt.

## Still open

- **P0: memory pressure.** November 10 baseline proved Android LOW_MEMORY killed Pocket's main process at about 1.4 GB PSS. A context-retention cleanup is now implemented; real-device repeated-session memory plateau and cold-resume acceptance remain unverified.
- **P1: real source qualification.** Gallery recovery has synthetic source-bound positive/negative tests, but must be exercised in actual Amazon and Flipkart sessions after ordinary phone unlock. Stable seller/variant/price/stock/delivered totals are not broadly accepted.
- **P2: retry UX.** An earlier budget-refinement follow-up asked for a new research request rather than running a fresh lookup; the follow-up explicitly asked to compare existing verified evidence, so automatically dispatching new research without a clear request would exceed scope. Revisit with consent/policy tests.

No push, public release, genuine or sandbox payment operation, merchant order, data reset, or original Pocket Agent app update was performed.
