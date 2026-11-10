# Android Shopping Reliability Remediation — 2026-11-11

## Device/build
- Samsung Galaxy A71 / SM-A715F / Android 13 via USB on @test1.
- Local branch `codex/native-gemini-checkout`; isolated test app `dev.pocket.agent.historyvalidation`.
- Original `dev.pocket.agent` app and accounts untouched; no payment, PayPal capture, retailer order or source data reset.

## Implemented
1. **Resident-memory emergency protection.** A separate Android watcher reads `/proc/self/status` RSS every 500ms, recording a warning then stopping the process at 700 MB sustained for two samples or 1000 MB immediately. It does not depend on the potentially wedged Node/JavaScript thread. The next app launch explains the interruption. This is a safety backstop, not a proof the root native allocation issue is eliminated.
2. **Embedded Node V8 heap budget.** Configure 384 MB old-space plus memory-saver before isolate creation; on-device `memoryStats()` verified V8 total heap limit of **503,316,480 bytes** (~480 MiB). This does not cap all native/ML Kit or WebView allocations.
3. **Native screenshot OCR resource reuse.** Previously every `ScreenTextRecognition.recognize()` constructed and closed a new ML Kit Latin recognizer. It now reuses one synchronized client across screen captures, closing it from `NativeTools.close()`; decoded bitmaps/crops still recycle in finally. Twelve consecutive real on-device synthetic OCR captures passed and reused the same instance. This is a plausible fix for native-resource churn, not yet a proved full retailer-run memory fix.
4. **Background chat opening.** `/native/open-chat` now awaits a direct `RuntimeHost.dispatch` result and then reads durable state instead of depending on an Activity event observer that was unsubscribed in `onStop`. Six physical-phone new-chat + background reopen cycles passed with 713–968 ms acknowledgment and peak 358,360 KB RSS. Original archived conversation restored each time.
5. **Comparison explanations.** The source-backed table now names each retailer and displays a fresh unconditional listed price even when the product is rejected as over budget (e.g. `INR 5999.00 (over budget)` for Soundcore Q20i). Ranking/qualification remains independently guarded: invalid or stale prices cannot become eligible, and unknown stock/seller/delivery prevents purchase readiness.
6. **Runtime diagnostics.** Memory stats now report V8 heap ceiling alongside Node process memory.

## Verification evidence
- Real phone targeted Android instrumentation after heap guard: **3/3 passed**, including Node compatibility and memory guard thresholds.
- Real phone after OCR reuse: **5/5 passed**, including **12 OCR repetitions**, bound image transcription, memory guard and V8 heap limit. Node heap ceiling measured ~480 MiB.
- Six browser-operated chat switches on real phone: **6/6 passed**, peak RSS ~358 MB, background ack 713–968ms.
- `npm test --prefix runtime`: **347/347 passed**, `npm run test:ui --prefix runtime`: **52 passed, 1 existing skip, 0 failures**.
- Android debug APK, Android instrumentation APK and lint: passed offline build.
- Saved evidence lives in ignored `artifacts/device-fixes-20261111` and `artifacts/device-retest-20261110`. Keep raw screenshots/logs/transcripts private.

## A critical acceptance gate remains open
**The memory leak is not yet independently certified fixed.** Before the OCR reuse change, a real two-product Gemini/Amazon retest grew rapidly from ~345 MB RSS to **653 MB RSS** at ~00:28 IST; an independent PC watchdog intentionally force-stopped only the isolated test process to protect the phone. That was not an Android OS kill. The new V8 limit and watchdog were active but did not prevent external memory from climbing under research load. OCR reuse was implemented and Android-tested *after* this result; a new sustained real-retailer E2E run has not been possible yet because the phone subsequently locked and Android disabled the test accessibility service after force-stop. No root cause is claimed until that retest passes under guarded monitoring.

After normal unlock and user re-enablement of **Pocket Agent Test phone tools** in Android Accessibility settings, rerun:
- Two-product Amazon-native comparison Sony WH-CH520 vs Soundcore Q20i, verifying displayed over-budget exclusion and no fabricated stock.
- Same-Sony Amazon vs Flipkart native cross-retailer comparison, without cart/payments.
- Repeated follow-up/new-chat stress with a separate <650MB RSS guard, snapshot/restart recovery and unchanged data.
- Buyer-review refusal without complete selected-seller/variant/stock/delivered-cost proof.

## Release status
This work should be treated as local engineering remediation, **not** comprehensive production acceptance or payment certification. No push/public release was authorized.
