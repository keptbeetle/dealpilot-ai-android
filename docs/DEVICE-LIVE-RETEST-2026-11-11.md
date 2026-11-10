# Pocket Agent Test — Galaxy A71 live retest and background-state fix (November 10–11, 2026)

## Environment and boundaries
- PC: @test1; repo `D:\Projects\pocket-agent`, branch `codex/native-gemini-checkout`.
- Phone: Galaxy A71 SM-A715F, Android 13, USB ADB, isolated `dev.pocket.agent.historyvalidation` test package.
- Tested the installed signed APK, real Gemini, native Amazon Android app, and actual app WebView. No merchant purchase actions, PayPal orders/capture/cancel, app-data reset, original-package update or remote push.
- Latest local repair before this retest: `2d46928`.

## Test 1: Sony WH-CH520 native Amazon research
- Submitted in fresh chat at approximately 23:48 IST on November 10.
- A source-backed worker finished at **23:50:08 IST**, within about 74 seconds of its execution start.
- Retained product identity: Sony WH-CH520, black, Amazon native Android app; observed displayed listed amount **INR 3,590**, distinctly reported from conditional/reference prices.
- Source provenance includes multiple same-window native snapshots and an offer review ID.
- Product remained **held**: selected-colour stock unknown; seller, mandatory fees, membership/eligibility, shipping, tax, full delivery cost and new condition were not established for purchase readiness. No price guesses were used.
- The original read-only CDP harness incorrectly reported a 245-second timeout and worker cancellation failure. It was sampling a *stale Activity snapshot while the native store was foreground*. Durable state and eventual main-chat history prove the worker had already completed at 23:50:08. Do not classify the worker as hung based on the stale UI snapshot alone.
- A test-package-only force-stop/relaunch was performed before this discrepancy was understood; app data and the archived task result survived.

## Root cause and repair: stale WebView snapshot
- `MainActivity.onStop()` unsubscribes from `AgentService` events when Amazon/Flipkart is foregrounded; the old `/native/snapshot` route returned an in-memory `state` field captured before `onStop`.
- Changed `app/src/main/java/dev/pocket/agent/MainActivity.java` to load the RuntimeHost-persisted snapshot from `StateStore.load()` inside the existing `uiReads` executor for each `/native/snapshot` request.
- This keeps WebView polling current even while the Activity is stopped, without doing disk I/O on the UI thread.
- Installed the new isolated ARM64 debug APK in-place with `adb install -r`. New build SHA-256: `808ccf4c50732f8493e4f94789436b8c50bc7123b97fd9488d46ec1cc162ab36`; pulling the installed APK back from Android confirmed an exact byte-for-byte SHA-256 match.
- Final validation: 345/345 Pocket runtime tests passed; 52/53 UI/security tests passed with one existing skip; Android unit-test and lint Gradle tasks both passed; Android debug build succeeded.
- Live integration check: with Pocket backgrounded to Android launcher, `/native/new` changed the service state and `/native/snapshot` reported the new thread promptly **without bringing Pocket foreground**. Original chat was reopened and its completed worker and messages persisted.
- Narrow additional limitation: the `/native/open-chat` command acknowledgment timed out when sent while its Activity was stopped, despite the command having completed and being visible after returning foreground. Its acknowledgment still relies on an observer unsubscribed in `onStop`; investigate separately if background-originated UI commands are supported.

## Test 2: two-model comparison
- Started approximately 00:00 IST on November 11, requested Sony WH-CH520 versus Soundcore Q20i from native Amazon with condition/budget/stock evidence checks.
- Run completed within 60 seconds; source report **correctly held** the comparison with no product price assertions because the native accessibility service was unavailable.
- Android `enabled_accessibility_services` contained the original Pocket Agent and UI Preview services but **not** `Pocket Agent Test phone tools`. The test service is installed but not enabled/bound. This configuration changed after the app updates/recovery; exact Android trigger not established.
- This is an environment permission blocker, **not** a proven fresh product-qualification failure.
- Re-enable only via the user's normal Android Accessibility settings. No silent secure-setting or privileged service changes were performed.

## Real phone UI regression
- Opened the November 10 audit chat in the currently installed build, measured 411px viewport and 411px document width with no horizontal overflow.
- Markdown source had `**` emphasis. Rendered DOM contained **7 `strong` elements and 2 headings**, no raw `**` text on assistant messages, demonstrating the formatting fix in the actual Android WebView.
- Reopened the original chat and checked persistence; passed.

## Memory and stability
- Test 1: 37 samples, PSS min **78,946 KB** (after recovery), max **241,824 KB**. Main process remained alive during the actual native research; it was later stopped deliberately for test cleanup.
- Test 2: 11 samples, PSS max **247,791 KB**, same main process PID throughout. No new LOW_MEMORY death observed.
- These are successful bounded tests only; the earlier ~1.4 GB baseline failure is not disproven by a few short runs, and no full long-session memory acceptance is claimed.
- Original USB/ADB authorization preserved. Screen stay-awake setting restored to `0`; original Pocket Agent package untouched.

## Acceptance status
1. Native single-product source observation: **partial pass**, safe offer hold.
2. Previously reported long worker timeout: **false-negative harness result due stale Activity snapshot**, source repaired and background polling smoke test passed.
3. Native two-product comparison: **blocked by disabled test accessibility service**; needs user re-enable and a new full run.
4. Source UI formatting and mobile width: **pass on physical Android WebView**.
5. Memory trend and process stability: **pass within sampled intervals**, long stress gate outstanding.
6. Buyer checkout and PayPal capture: **not executed**.

## Local evidence (private)
- `artifacts/device-retest-20261110/memory.csv`
- `artifacts/device-retest-20261110/sony-recovered.json`
- `artifacts/device-retest-20261110/comparison-memory.csv`
- `artifacts/device-retest-20261110/comparison/05-known-comparison.json`
- `artifacts/device-retest-20261110/background-state-retest.json`
- `artifacts/device-retest-20261110/chat-render-retest.json`
- `artifacts/device-retest-20261110/final-gradle-checks.log`

Do not publish the raw screenshots or archived transcript. Source observations are session-bound and expire; a future purchase requires fresh evidence and explicit buyer approval.
