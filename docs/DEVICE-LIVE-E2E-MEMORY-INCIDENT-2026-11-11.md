# Pocket Agent Test â€” Extended Live Android E2E and Critical Memory Incident
**Date:** 2026-11-11 (Asia/Kolkata)  
**Device:** Samsung Galaxy A71 / SM-A715F, Android 13, USB debug authorized  
**PC project:** `D:\Projects\pocket-agent`, branch `codex/native-gemini-checkout`, starting commit `3db217e`  
**Build:** Isolated `dev.pocket.agent.historyvalidation`, existing signed `0.1.31-local-shell.2`, installed at 2026-11-10 23:58:37.

## Permissions and scope
At 00:07 IST, the user-approved test accessibility service was verified **enabled and bound**, and the phone was unlocked. No payment, PayPal capture, cart action, retailer order, credential change, app reset, or update was conducted in this run. Actions were limited to research and read-only state checks.

## Scenario A â€” Two models in native Amazon (completed)
Request: Compare **Sony WH-CH520** and **Soundcore Q20i**, both NEW, budget INR 5,000, by opening their actual Amazon Android listings.

- Submitted in a new Pocket Agent conversation, completed in **90 seconds**; user-facing final answer delivered, and chat restoration after WebView reload passed.
- Found two **different source-bound product identities**. **Sony WH-CH520 black**, native Amazon page-listed price **INR 3,590**, stock **unknown**. **Soundcore Q20i black**, page-listed price **INR 5,999** in detailed evidence, stock shown as **available**; the INR 5,000 budget was **contradicted**.
- Summary table showed Soundcore listed price as **Unknown** even though evidence contained INR 5,999. This is a **P2 explanatory presentation defect**: display the excluded observed price alongside "over budget" instead of hiding it, without suggesting qualification.
- The engine correctly refused to call both offers qualified: no two comparable in-stock, on-budget offers, and seller, delivered cost, and applicable conditions remained insufficient.
- Mobile viewport: **411px** document and viewport, **no horizontal overflow**. WebView reload restored all messages.
- Memory sampling during Scenario A: **PSS approximately 196â€“244 MB**, same PID `7533`, no low-memory termination.

Source: `artifacts/device-retest-20261110/comparison-accessibility-on/07-two-models-accessibility-on.json`, screenshot and `accessibility-on-memory.csv`.

## Scenario B â€” Same Sony model, Amazon vs Flipkart (aborted; critical)
Request: Open Sony WH-CH520 black product pages in the native Amazon and Flipkart Android apps, compare source-observed price, selection and stock. Never checkout.

- Began around **00:10:34 IST** in another new conversation, after the first scenario completed. The new thread was created; at the first check its request was **not confirmed submitted** (no persisted main messages). **Do not claim that a Flipkart product comparison was executed.**
- The Pocket Agent main process PID `7533` rose from **255,375 KB PSS / 424,824 KB RSS** at **00:10:37**, to **3,264,320 KB PSS / 3,425,532 KB RSS** at **00:10:50**â€”a thirteen-second multi-gigabyte increase.
- At **00:11:02**, memory diagnostic output was unavailable (the process became slow to respond). Calls to `dumpsys meminfo` subsequently timed out; system logs contained severe main-thread jank/skipped frames and EPIPE memory-dump errors.
- I stopped the host harness and memory-monitor process, then intentionally executed `adb shell am force-stop dev.pocket.agent.historyvalidation` at about **00:12:04**. Android's historical process-exit report recorded **USER REQUESTED / FORCE STOP**, with **PSS ~4.0 GB and RSS ~4.0 GB**, confirming the high-water severity. **This incident was not a proven Android low-memory kill; it was a safety stop.**
- The unmodified original `dev.pocket.agent` package was not stopped or changed. The isolated test app's SQLite database remained present (~1.7 MB). ADB remained authorized.
- The test accessibility service was **no longer enabled after force-stop**; original Pocket and UI Preview services remained enabled. No silent security-sensitive change was performed to re-enable the test service.

### Interpretation
This is a **P0 memory stability/reliability failure** during repeated live chat/test workflows. The cause is **not yet established**. Logs showed relatively little Java managed-heap utilization compared with total process memory, so investigate native/runtime/Javet allocations, repeated chat snapshots and activity/work service lifecycle; don't label any one of them the root cause without profiling. The transition to a fresh chat is temporally associated with the spike; the new research prompt had not been confirmed submitted.

## Safe recovery smoke test (passed)
- Relaunched **only** the isolated Pocket Agent Test app with a separate `adb shell ps -A -o PID,RSS,NAME` watchdog sampling every three seconds and automatically prepared to force-stop if **RSS > 700,000 KB**.
- Newly relaunched main PID `13020` remained around **227â€“238 MB RSS** for roughly one minute. The threshold was not triggered. The app was foreground and usable. No model requests were run during this smoke test.
- App data retained, original ADB/USB debugging still authorized, and screen stay-awake setting restored to its original value **0**. Removed the temporary CDP forwarding tunnel.

## Status and next engineering gate
1. **P0 blocker:** reproduce and profile abrupt native/runtime memory growth with an independent RSS guard; install a bounded-memory fail-safe or repair the retention/allocation path before another sustained research test.
2. **P1:** only after memory safety, repeat Amazon/Flipkart cross-retailer source validation and selected-colour/stock/delivered-total checks.
3. **P2:** make excluded, source-observed listed prices visible with an explicit failed-budget label in the two-model table; preserve unknowns and fail-closed purchase gates.
4. **Permissions:** the test accessibility service will need normal user-facing re-enablement before any further real native-store test; do not bypass Android settings.
5. **Payments:** no PayPal order/capture nor merchant order has been executed; no payment acceptance is claimed.

## Evidence paths (local, private)
- `artifacts/device-retest-20261110/comparison-accessibility-on/07-two-models-accessibility-on.json` and PNG
- `artifacts/device-retest-20261110/accessibility-on-memory.csv`
- `artifacts/device-retest-20261110/run-cross-retailer.cjs`
- `artifacts/device-retest-20261110/memory-spike-logcat.txt`
- `artifacts/device-retest-20261110/cold-recovery-rss.csv`
- `artifacts/device-retest-20261110/guard-cold-restart.ps1`

Do not publish raw Android screenshots, conversation transcripts, device logs, or payment-state data without review.
