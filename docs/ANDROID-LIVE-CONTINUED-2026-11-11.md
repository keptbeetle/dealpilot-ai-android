# Galaxy A71 Native Shopping — Continuing Acceptance and OCR Idle Cleanup
**Date:** 2026-11-11 (Asia/Kolkata)

## Scope and safety
- Working tree: `D:\Projects\pocket-agent`, branch `codex/native-gemini-checkout`, baseline `f0477a2`.
- Device: SM-A715F Galaxy A71 / Android 13; USB debugging authorized.
- Only isolated `dev.pocket.agent.historyvalidation` was exercised. No changes to the original `dev.pocket.agent`, user accounts, Android secure accessibility settings, product cart, payments, PayPal, or merchant orders.
- External watchdog sampled process RSS about every 650 ms and force-stopped this isolated package on a sample above **650,000 KB RSS** to avoid another multi-gigabyte runaway.

## Live test A: Amazon Sony WH-CH520 versus Soundcore Q20i — partial success
- At ~00:52 IST, Android confirmed the test accessibility service was enabled/bound and the device unlocked.
- The real native-store worker finished in **105 seconds** without a process restart or watchdog stop.
- It produced distinct Amazon-source observations: **Sony WH-CH520 black**, listed INR 2,989, availability shown as available; **Soundcore Q20i black**, price and stock unknown in this run.
- The output correctly withheld a two-offer ranked/comparable recommendation, seller/delivery/checkout authorization and payment.
- The saved chat survived a WebView reload, 3 messages before/after, idle work state, no horizontal overflow (411px viewport/document).
- Sampled maximum process **RSS = 595,268 KB**. The lower bound is not a long-session safety certification; it approached the external threshold.
- Evidence is private in `artifacts/device-fixes-20261111/two-products-newbundle/` and `newbundle-e2e-rss.csv`.

## Live test B: Amazon vs Flipkart in the next fresh chat — fail
- The second cross-retailer harness started immediately after the successful Amazon session.
- It opened the existing Pocket Activity from the native Amazon foreground and created a new chat, but its cross-retailer request was **not confirmed submitted**, and no product comparison was produced.
- While transitioning, process RSS grew from roughly 412 MB to an external-monitor sample of **779,448 KB**. The independent monitor forced only the test APK to stop.
- Android recorded a **USER REQUESTED / FORCE STOP**, not an OS low-memory kill. The test accessibility service was removed from the enabled-services list after the stop. Saved test data remained.
- Logs around the transition did not establish a duplicate MainActivity, and Java heap usage was modest relative to RSS. Native/ML Kit/V8 or WebView resource lifetime remains an unresolved P0 root-cause investigation; a single transient peak alone does not prove an accumulating leak.
- Evidence is private in `artifacts/device-fixes-20261111/cross-retailer-newbundle-rss.csv` and `cross-retailer-newbundle/error.txt`.

## Targeted repair in this commit
`ScreenTextRecognition` reused one synchronized ML Kit Latin recognizer across images, but kept it for the entire tool-host life. The recognizer now has a **3.5 second sliding idle lease**:
- OCR captures within the lease use the same recognizer.
- Each completed capture invalidates the previous scheduled release.
- The scheduled closure uses a daemon worker and synchronizes with active OCR to avoid closing it mid-operation.
- Explicit tool shutdown cancels pending release and closes the recognizer immediately.
- The OCR bounds (1280px, two attempts per native store collection), independent native RSS guard, V8 heap cap, and truthfulness gates are retained from earlier commits.

### New device validation
- Rebuilt debug and Android instrumentation APKs; Android lint passed.
- **8/8 targeted Android instrumentation tests passed**, including ML Kit client lifetime, repeated store-sized images, OCR size limits, Node/V8 and memory guard.
- Re-ran the idle-lease test alone after adding diagnostics: **1/1 passed**. In that isolated test ML Kit-process PSS changed from **68,614 KB active to 65,029 KB after idle**, a decrease of only ~3.6 MB. This does **not** substantiate a claim of hundreds of MB saved or removal of the production reliability fault.
- New isolated APK SHA-256: `ead95cc1d12679324d54622dcce7992610fcc6cea8e9e33aef290ff1e59c9c71`.
- Existing previous-turn runtime test baseline: **348/348 passing**, UI/security **52 passing, one existing skip**; no runtime TypeScript source changes in this remediation.

## Acceptance status and next actions
**Open P0:** repeated real-retailer sessions can still cross the safety ceiling. The idle model lease is implemented and device-tested, but has **not** yet been validated in another live Amazon/Flipkart session. It must not be called a definitive root-cause fix.

After the owner unlocks the phone and **re-enables Pocket Agent Test phone tools through Android Accessibility Settings**, run at least two consecutive research conversations with a separate RSS guard and per-stage memory diagnostics. Require the second to complete a separate Amazon-vs-Flipkart source comparison, preserved chat, and no unsafe memory escalation. Never infer seller, variant stock, shipping/tax totals, or purchase authorization without actual evidence.

## Final cold-start and history recovery
After installing the idle-cleanup APK and running instrumentation, the isolated app launched with a healthy main process (~213 MB RSS on first sample). The WebView was responsive with a 411px viewport and no horizontal overflow. An explicit open of the finished Amazon comparison chat restored the archived **three messages**, including one assistant reply, from the original persisted conversation. Its SQLite state file remained available (~2.1 MB). The Android screen-awake setting was returned to its original value `0`.

No checkout, purchase, PayPal transaction, remote push or public release occurred.
