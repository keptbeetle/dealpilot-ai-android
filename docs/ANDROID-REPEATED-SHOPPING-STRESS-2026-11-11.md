# Repeated Native Shopping Acceptance — 11 November 2026

## Environment and boundaries
- Repo: `D:\Projects\pocket-agent` on `codex/native-gemini-checkout`.
- Device: Samsung Galaxy A71 (SM-A715F), Android 13, USB ADB.
- Installed package: `dev.pocket.agent.historyvalidation` (separate test package). The original Pocket Agent package and saved data were not reset or modified.
- Test prompts: two read-only native retailer research flows (Sony WH-CH520 black on Amazon vs Flipkart; then Sony WH-CH520 vs Soundcore Q20i on Amazon), with a distinct fresh main chat for each. No cart, checkout, purchase or PayPal transaction.
- External RSS sampler every ~650 ms with a 650,000 KB termination threshold. The app's own existing 700 MiB sustained RSS / 1000 MiB immediate hard guard remained enabled.

## Defect fixed and physically verified: New Chat acknowledgment race
- **Before:** `/native/new` queued an asynchronous service Intent, then immediately returned a snapshot of the previous chat, so a subsequent send/reload could race creation of a new thread. A real test observed `NEW_THREAD` pointing to the previous ID while the following `TURN_BEGIN` pointed to a different ID.
- **Now:** `MainActivity.createChatFromWeb` awaits a direct `RuntimeHost.dispatch(new_main)` result, then reads saved state, checks the main thread ID actually changed and acknowledges only that persisted new thread. It fails closed when a real new chat cannot be confirmed.
- **Device result:** three immediate `/native/new` calls on the Galaxy A71 passed; each acknowledged a changed, empty and persisted thread. No user messages were lost.

## Memory stability remains an unresolved P0
- Before this turn, Android had observed resident peaks of 695–859 MB when starting a second shopping conversation following a complete one.
- The first cross-retailer conversation repeatedly completed in the same process in ~85–110 seconds, with sampled RSS peaks of about 506–530 MB, source-backed native Amazon/Flipkart observations and successful persisted chat reload.
- A second freshly created shopping conversation **repeatedly failed before finishing**. Sampled RSS rose from approximately 350–390 MB to 700–859 MB in roughly two seconds. Android's internal memory guard or the independent PC guard stopped only the isolated test app. Logs confirmed significant native PSS (~440–447 MB), with modest Java heap, but a precise allocation origin remains unknown.
- Removing the harness's optional pre-send WebView reload did **not** eliminate this crash. V8 compaction and the smaller Node heap did **not** eliminate it either. Browser rendering and source evidence guardrails remained correct when the first flow completed.
- Experimental Node isolate recycling at an idle New Chat boundary was evaluated. A targeted device test verified fresh Node initialization and chat persistence, and an additional test verified worker-safe recycling constraints; however **two live consecutive-session stress attempts still failed** with memory growth before the second conversation could finish. Therefore the experimental runtime recycle code and its related tests were removed from the final candidate rather than shipped unproven. This leaves the persistent history untouched.
- Device logs, RSS traces and private test summaries are retained under ignored `artifacts/device-fixes-20261111/`. No private screenshots/transcripts were committed or shared.

## Candidate build changes retained
1. The verified native bridge New Chat acknowledgment fix in `MainActivity`.
2. Lower V8 old-space ceiling to 192 MiB (288 MiB total reported V8 heap limit), down from 384 MiB; this reduces potential old-space headroom but has **not** proven a cure for the native spike.
3. Do not request synchronous V8 full compaction on the chat transition critical path. Existing idle and soft-pressure compaction and independent emergency guard remain active.

## Final verification
- Final Android arm64 test APK SHA-256: `5ea0e192eaa7226dcad0ce2528a2464c4e59279fb0f20f7a93806b7f4152117e`, installed on the Galaxy A71.
- Final Android build and lint: **passed**.
- Final targeted instrumentation: **7/7 passed** including Node compatibility/heap ceiling, safe explicit compaction, RSS thresholds and OCR-size guard.
- Runtime TypeScript suite (unchanged JS in this turn): **348/348 pass**.
- UI/security tests: **52 pass, 1 existing skip**.
- Final physical phone real-retailer 2-session stress: **FAILED**; not production accepted. The emergency memory guard protected the isolated app; saved data remains on disk.

## Next engineering acceptance gate
Collect time-correlated native allocations when moving from a completed retailer worker to a new chat (including native heap high-water allocation stack, Javet isolate lifecycle, ML Kit/TFLite buffers, Activity/WebView transition and large snapshots) using Android native allocation profiling / heap dumps where permitted. Then fix the actual allocation cause, and require at least two full read-only retailer research conversations back-to-back in one process with peak resident memory safely below 650,000 KB, no restart, correct evidence and successful chat reload.

No source or APK was pushed to a public repository, no payment was attempted and this report does not mark the P0 leak resolved.
