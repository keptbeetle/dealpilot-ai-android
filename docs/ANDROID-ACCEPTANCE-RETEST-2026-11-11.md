# Continued Galaxy A71 Acceptance and Remediation — 2026-11-11

**Project:** `D:\Projects\pocket-agent` on `codex/native-gemini-checkout`  
**Device:** Samsung Galaxy A71 / SM-A715F / Android 13, USB ADB connected  
**Scope:** Isolated `dev.pocket.agent.historyvalidation` only. The original `dev.pocket.agent` package, shopping accounts, saved databases and payment state were not modified.

## Critical findings

### 1. Live native-shopping memory growth still reproduced after recognizer reuse
The user-approved accessibility service and unlocked handset were verified at the start. A fresh real Gemini/Amazon two-product comparison was submitted and active. The independent USB monitor recorded RAM fluctuations near 350–400 MB RSS and spikes above 600 MB. At 00:39:48 IST it measured **658,936 KB RSS** and deliberately force-stopped only the isolated APK. The completed comparison, cross-retailer source proof, and purchase readiness **were not established**. ML Kit/TFLite native OCR activity appeared in the logs near the spikes, but this timing is not sufficient to establish the precise allocation source. This is still an **open P0 acceptance blocker**.

Evidence: ignored private `artifacts/device-fixes-20261111/retest-ocr-reuse-rss.csv` and the native test harness outputs. The restored conversation was later stopped using the app's own Stop command, preserving the messages.

### 2. Android build was silently packaging old TypeScript
Before this change the ignored `app/src/main/assets/runtime.cjs` still had the 1800-pixel OCR request and lacked the newly added comparison retailer column, despite source tests and earlier APK builds passing. The previous local build had not run `npm run build`. This was an actual **artifact/source consistency defect**, now corrected.

The `buildPocketRuntime` Gradle task generates the runtime and manifests automatically and `preBuild` depends on it; Gradle tracks relevant TypeScript, vendor, pinned-source and build inputs. A clean build invoked this task, and the APK's `assets/runtime.cjs` byte-for-byte matched the generated local runtime, included the retailer column and 1280px OCR setting, and contained no old 1800px request. `scripts/check_apk.py` validated package metadata and absence of forbidden bundled files.

## Additional bounded-memory changes

- Source-driven native-store OCR now requests images of at most **1280 pixels** instead of 1800 and limits recognition to **two attempts per product collection**; missing product facts stay explicitly unknown rather than becoming fabricated offers. This limits repeated work *within one collection call*; it is not a global lifetime memory cap.
- The Java phone-observation boundary independently clamps any caller's OCR screenshot request to 1280px; non-OCR screenshots retain existing behavior.
- A focused TypeScript test verifies the OCR limit, truthful unknown stock/price and recognition-budget hold. Two Android device tests verify server-side enforcement.
- A real-device synthetic OCR test runs six repeated store-sized 720×1280 captures and checks the recognized price and **between-capture** PSS growth. It passed but cannot rule out transient spikes during native recognition or prove a real Amazon/Flipkart research run.

## Results after rebuilding from current source

- Runtime tests: **348/348 pass**.
- UI/security tests: **52 pass, 1 skipped, 0 fail**.
- Android debug + instrumentation APK and lint: **pass**.
- Android selected instrumentation: **7/7 pass** (Node compatibility and heap limit, resident-memory guard, OCR reuse, typical-size recognition, and OCR bounds).
- Three valid archived chat-switch / background reopen cycles on the freshly bundled APK: **3/3 pass**, acknowledgments **786–853 ms**, peak measured **343,444 KB RSS**. These were non-shopping recovery tests.
- Installed isolated arm64 APK SHA-256: `98f3ef429e7efa2d6449ea864de9577739bc6a17628cdd12fbe823c171c15d2f`; the APK bundle matched the current generated asset.

## Incomplete acceptance

After the watchdog force-stop Android disabled **Pocket Agent Test phone tools** accessibility; the handset later locked. Do not bypass this Android permission. To complete live acceptance a user needs to unlock and re-enable that service in Settings > Accessibility, then the following guarded tests need to pass on the installed build: two separate Amazon product pages, same Sony product in Amazon and Flipkart, observed variant/stock/price correctness, WebView reload/recovery, repeated new conversation with active retailer work, and fail-closed purchase checks. A separate RAM cutoff must remain active during these tests.

No PayPal capture, merchant order, payment, purchase or checkout occurred. No release was published or pushed. The P0 native shopping memory defect remains **unverified after the new OCR limits**, not fixed by assertion.
