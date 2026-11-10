# Android Retailer Memory — V8 Compaction and Soft-Pressure Recovery
**Date:** 11 November 2026 (IST)
**Repo:** `D:\Projects\pocket-agent`, `codex/native-gemini-checkout`
**Target:** Isolated `dev.pocket.agent.historyvalidation` on Galaxy A71 / Android 13

## Context and observed failure
Previous real-device runs confirmed a Sony WH-CH520 Amazon and Flipkart evidence comparison in 115 seconds, then a **second** shopping conversation caused the test process to rise from roughly 389 MB RSS to 695 MB RSS during new-chat setup, before the request was submitted. An independent PC watchdog force-stopped the isolated app to protect the phone. No merchant checkout or payment was attempted. A separate four-cycle UI reopen/reload-only test without new retailer work kept RSS below ~370 MB.

This demonstrates an unresolved **repeated-shopping memory stability defect**. It does not prove a specific root cause.

## Read-only checkpoint analysis
A temporary read-only copy of the isolated app's SQLite database was analyzed for **aggregate sizes only**; the raw copy was deleted afterward. The durable `runtime_state` row measured about **1,415,006 bytes**, with `workerMessages` contributing approximately **1,277,356 bytes** across 12 retained worker transcripts. The live UI snapshot row was approximately 142,764 bytes. Preservation of completed worker history is intentional, but chat transitions currently archive, serialize and republish substantial retained state. The sizes alone do not establish that snapshot copies caused the 695 MB spike.

## Changes to memory lifecycle
- In `RuntimeHost.dispatch`, successful `new_main` and `open_main` commands now invoke Javet's `NodeRuntime.lowMemoryNotification()` on the thread that owns the V8 isolate, **after** the state transition completes. An error from compaction is logged without causing an otherwise successful chat switch to fail.
- When the runtime becomes idle, the host schedules a compaction after 3 seconds, cancels it on renewed activity, and limits automatic idle compactions to a ten-second cooldown. Shutdown removes any scheduled compaction work.
- `RuntimeMemoryGuard` now recognizes **sustained** soft resident-memory pressure at **450 MiB RSS** (two 500 ms samples), with a **20-second request cooldown**. It requests compaction asynchronously on the V8 owner; a stalled runtime cannot block the guard's own thread. The existing hard protection at 700 MiB for two samples or 1000 MiB immediately remains unchanged.
- Added numeric memory-class diagnostics (RSS, Java native PSS, Dalvik PSS, other PSS, V8 heap used and Node external memory) without logging transcript text or credentials.

## Verification
- Physical Galaxy A71 Android instrumentation: **8/8 passed** for Node compatibility, explicit V8 compaction, memory pressure thresholds, native screenshot bounds and OCR idle-release behavior.
- Measured V8 compaction on the actual phone: process PSS decreased from **196,722 KB** to **176,534 KB** (~20 MB) in a targeted test, Node `heapUsed` about 12.8 MB and `external` about 6.2 MB afterward. The isolate retained its original 480 MiB total V8 heap ceiling and remained queryable.
- `npm test --prefix runtime`: **348/348 passed**.
- `npm run test:ui --prefix runtime`: **52 passed; 1 pre-existing skip; 0 failures**.
- Offline Gradle debug, instrumentation, and Android lint: passed.
- Built and installed isolated ARM64 debug APK SHA-256: `466ff2e2522d65fc01ae9b026a8c3e9c0f0f6f177fed39d07e2b987f8c5c7bce`. The original app and saved test database were not reset.
- A UI-driven chat transition attempted after installation could not proceed: the Android device's keyguard had locked, and the button was not interactable. The test did not enter a second research prompt and is **not** an end-to-end acceptance result.

## Remaining acceptance requirements
**P0 remains open:** the automatic V8 compaction may reduce garbage/temporary allocation peaks, but **has not been validated in two consecutive real Amazon/Flipkart sessions**. Once the owner unlocks the device normally, rerun two research conversations in the same process with a separate 650,000 KB RSS cutoff, capture new per-category diagnostics if soft-pressure fires, verify both source-bound retailer observations, preserve chat history and enforce strict buyer approval. Do not attribute a product price, variant, seller, availability or delivered total to a listing without fresh source evidence. No checkout or PayPal operation is authorized.

All changes are local. No public release or push was made.
