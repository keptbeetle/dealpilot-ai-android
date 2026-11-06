# Smartphone end-to-end audit — 6 November 2026

Actual assistant-operated testing on the connected Galaxy A71, Android 13, using Pocket Agent Test and the saved Gemini `gemini-3.5-flash-lite` connection. This is AI development evidence, not independent human acceptance or model training. The same frozen prompts were used before and after the fix.

## User journey tested

1. “I need a new Android smartphone under Rs 25,000 in India. Samsung and Motorola are preferred. I want at least 128 GB storage and good battery life.” Search Amazon and Flipkart native apps, private displays only; no model/SKU supplied.
2. Lower the budget to Rs 20,000, retain new-only/128 GB, and exclude exchange/bank discounts from the regular price.
3. Request checkout for the cheapest genuinely eligible result, with the final total shown before approval; explicitly prohibit payment/order placement.
4. Reload the app and check conversation restoration.

The expectations and prompts were saved before execution. Baseline/retest prompt SHA-256: `5fad72da967c19b36b4f76b48da22a7c735e98e04d7c1c67a9f8494885767636`.

## Results

| Stage | Genuine outcome |
| --- | --- |
| Initial prerequisite | Shizuku was not running. The original native/private path returned `shizuku_unavailable`. Restored over authorized USB using the installed upstream starter. No wireless debugging connection was initiated. |
| Baseline private-only instruction | **Failed.** The old focused worker fell back to visible Google/Chrome after the private backend failed. The actual physical-screen screenshot and original tool transcript are preserved. This run is not counted as a pass. |
| Privacy correction | **Fixed and retested.** Focused shopping dispatch rejects physical screens before any native call, including composites and nested batches. Arbitrary shell execution, external image reads and explicit display IDs are disabled for that profile. General Pocket main/phone-operator functionality retains its original shell capabilities. |
| Native smartphone discovery after fix | **Blocked.** Amazon refused a new private session because an existing session was elsewhere. Flipkart opened privately but showed loading placeholders and did not expose search within the bounded attempt. No current product listing was established. |
| Budget/storage refinement | **Partial; defect remains.** The new queries included `20000` and `128GB`, but the model omitted the structured `checks` object on both refinement searches. Initial searches correctly supplied INR, 2,500,000 cents and minimumStorageGB 128. Textual preservation does not establish enforced constraint preservation. |
| Qualified two-product comparison | **Not reached.** No product prices/specifications were admitted and no eligible winner was invented. |
| Checkout request | **Correct refusal.** The app explained that it could not prepare checkout or a final total without an eligible verified listing. No payment proposal marker, merchant cart or new PayPal transaction was produced. |
| Recovery | **Passed.** Reload retained the same thread and all eight messages; the app was idle afterward. |

The post-fix run made four `phone_store_app` research calls across two workers. Its saved raw tool trace contains **zero `phone_browser`, shell or physical-display calls**. That actual result supplements the direct regression checks that reject an adversarial physical request; it does not establish universal authority isolation across every general Pocket tool or MCP route. Full shopping authority remains a separate open milestone.

The privacy fix is deliberately scoped to the focused shopping worker, derived again on worker restore. Its tool schemas advertise only virtual screens and bounded shell helpers; runtime dispatch enforces the restriction even if a model ignores the schema. Its prompt explicitly resolves the prior conflict with general unrestricted-shell guidance. Existing personal/other-worker retailer sessions remain protected.

## Verification and installed build

- **263 runtime tests passed**, including five new private-profile regressions: metadata/general-tool preservation, composite/direct dispatch, nested batches, shell/display escapes and restored workers.
- Final ARM64, x86-64 and universal debug APK build passed. Android lint: **0 errors, 128 warnings**.
- **Four native policy tests passed** on the updated installed build. The three post-fix chat stages and renderer recovery executed through the actual phone app.
- Existing general TypeScript audit: **16 diagnostics**, unchanged count; this task does not claim a clean full typecheck.
- APK signature verified and installed APK hash matched the saved artifact: `fa7783837eda63449f2b14a1a9f6377923385009e2293e39f18f0d2b8ab17c1a`.
- Restored the original screen-awake value **0**, removed only this task's CDP forward and left USB authorized with Pocket Agent Test open. Shizuku was left running for the owner's testing; no global service shutdown or wireless broadcast was used.

The installed [upstream Shizuku starter](https://raw.githubusercontent.com/RikkaApps/Shizuku/master/manager/src/main/java/moe/shizuku/manager/starter/Starter.kt) provides its ADB startup command. This was environment recovery for the actual phone, not a simulated backend success.

## Evidence and next work

- [Eight ordered, captioned screenshots](../artifacts/smartphone-e2e-20261106/report.html)
- [Installed ARM64 APK copy](../artifacts/smartphone-e2e-20261106/Pocket-Agent-Test-arm64.apk)
- Private evidence: `artifacts/smartphone-e2e-20261106/`, containing original baseline, unchanged expectations, post-fix screenshots/state/raw tool calls, actual constraint gaps, audit results, hashes, build/test logs and cleanup confirmation. Private app-state copies and screenshots are excluded from Git.

Next: make refinement constraints durable and independent of model-supplied tool arguments; improve Flipkart loading/search readiness; establish a genuine positive native two-product comparison under the owner's chosen private-session policy. Current session holds must not be relabeled as successful product research. No owner validation is needed for these AI development batches, but independent human acceptance remains unclaimed.

**No successful purchase E2E is claimed.** These smartphone cases never reached a quote, PayPal approval/capture or merchant order. The previous USD250 sandbox receipt remains separate historical evidence. No currency conversion, new payment, repository push or Phase 3/stash action occurred.

Historical phase movement: **50/50→50/50 (+0), 40/40→40/40 (+0), 3/10→3/10 (+0), total 93/100→93/100 (+0)**. These roadmap bars are not a mobile-shopping success or accuracy score.
