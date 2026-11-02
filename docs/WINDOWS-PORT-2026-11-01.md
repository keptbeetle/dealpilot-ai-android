# Windows development acceptance contract

Owner requested native Windows development, builds and verification independent of Linux. This supersedes the upstream CI-only APK compilation recommendation for local development in this fork. Android device execution still targets Android.

Freeze these expectations before implementation. Existing Windows baseline is runtime204/204, bundle build passed, preview12/28 and repository Python17/20. Original failed logs are preserved under ignored `artifacts/windows-port-20261101`.

- Native Windows npm runtime tests, preview tests and bundle build pass. Temporary paths use the host temporary directory. No WSL or Bash is required.
- Credential storage preserves AES-GCM encryption, owner-private access, atomic replacement, file flushing, concurrent key creation and failure recovery. Windows enforces actual ACLs. POSIX retains ownership/mode checks and directory syncing. A writable/readable file for another ordinary user must be rejected by validation.
- Python relay/provisioning and emulator tooling use Windows-compatible private files, local Python executable and Android remote POSIX paths. Secret values never appear in logs. Credential provisioning remains explicitly scoped to the authorized emulator.
- Shell lifecycle tests exercise the production Java session class with native PowerShell on Windows and POSIX shell on Unix, including stop, output, exit code and durable receipts.
- A PowerShell entry point checks dependencies and runs the supported local suite. Android SDK/Gradle prerequisites and local debug build commands are documented and verified as far as installed dependencies permit. Device execution requires an explicitly selected device.
- Add targeted platform/security regressions and a Windows/Linux CI matrix. CI execution and publishing require separate execution scope. Source rights/notices, shopping/payment guards and historical DealPilot score bars remain recorded.

## Native Windows setup

Use PowerShell in `D:\Projects\pocket-agent`. Install Node 22.19 or later, Python 3.12 or later, JDK 17 (including `javac`), and an Android SDK for Android builds. The verified host uses Node22.20.0, npm10.9.3, Python3.13.5 and Temurin17.0.19. No WSL, Bash, Fedora, Xvfb or Linux VM participates in the commands below.

```powershell
.\scripts\windows-dev.ps1 -Action Setup -SdkPath D:\sdk
.\scripts\windows-dev.ps1 -Action Doctor -SdkPath D:\sdk
.\scripts\windows-dev.ps1 -Action Check
.\scripts\windows-dev.ps1 -Action Preview
# Run this separately from the long-running preview:
.\scripts\windows-dev.ps1 -Action BuildAndroid -SdkPath D:\sdk
```

`Setup` creates an ignored `.venv`, installs pinned Python development dependencies, and installs the locked runtime dependencies. It does not install the SDK itself. `Check` runs runtime tests, preview tests, bundle generation and Python discovery, including Java shell/display/voice checks. `Preview` serves the browser companion on port3000 by default. Its provider connections remain separate from Android; starting the UI does not connect an account.

`BuildAndroid` uses the native `gradlew.bat`, builds debug app/fixture APKs and runs Android lint. Install SDK platform36, build-tools36.0.0 and NDK27.2.12479018 with Android Studio's SDK Manager or the Windows `sdkmanager.bat`. Set `ANDROID_HOME`, put SDK `platform-tools` on PATH, or pass `-SdkPath`. The helper discovers Java from `javac` if `JAVA_HOME` is unset and writes an ignored `local.properties` only when absent, with escaped drive colon and forward slashes. Existing custom properties are preserved; an older hand-written `sdk.dir=D:/sdk` must become `sdk.dir=D\:/sdk`. The initial failed lint report is preserved rather than baselined or suppressed.

Local debug keys are development keys, not distribution credentials. Release signing, GitHub workflows, publishing and shopping/payment integration remain separate work.

## What changed

- Host temporary paths use the actual temporary directory instead of `/tmp`. Python subprocesses reuse the current interpreter rather than assuming `python3` exists.
- Node and Python share a native Windows private-path policy. The Windows PowerShell helper uses Windows DACLs with inheritance removed and only the current user and SYSTEM allowed. It rejects reparse points, unexpected owners and broader grants. POSIX ownership/mode enforcement is retained. No credential values are printed.
- Vault encryption, exclusive temporary files, hard-link key publication, atomic replacement and file flushing remain. Windows does not attempt unsupported directory `fsync`; POSIX retains it. Regression checks cover widened ACL rejection, spaces/Unicode, concurrent key publication, failed writes/flushes and recovery.
- Android still executes its own `/system/bin/sh`. Host shell tests inject native Windows PowerShell and exercise the production session class for stop, persisted receipts, exit codes and UTF-8 output. The existing voice simulators also run on the native host JVM.
- Emulator launch uses `scripts/start_emulator.py`, native SDK tools and an explicit AVD/port. The old Fedora entry point delegates to it. It needs no X server or Linux acceleration flags. It refuses an occupied serial, uses a read-only AVD and terminates only its own launch after failed boot.
- The optional subscription-voice browser probe discovers installed Chrome through Playwright instead of a Linux-only executable path. It separately requires Python Playwright/websockets, Chrome, Windows `espeak-ng`/`ffmpeg` on PATH and explicit account access. No live authenticated voice request was made in this task.
- `.github/workflows/host-checks.yml` defines Windows and Ubuntu host checks. It has not been pushed or executed. Existing Linux APK workflows can remain optional CI; native Windows development does not depend on them.

An emulator launch can be inspected without starting a device:

```powershell
.\.venv\Scripts\python.exe scripts/start_emulator.py --sdk D:\sdk --avd YOUR_AVD_NAME --port 5580 --dry-run
# Remove --dry-run to boot that explicitly selected existing AVD.
# Device tests always require the exact serial and the appropriate opt-in:
.\.venv\Scripts\python.exe scripts/emulator_test.py --help
```

## Verification record — 1 November 2026

All evidence in this section is assistant-operated engineering evidence. Original Windows failures, intermediate failures and final logs are retained under ignored `artifacts/windows-port-20261101/` in this checkout.

| Check | Native Windows result |
| --- | --- |
| Runtime suite | 204/204 pass |
| Preview/service/security suite | 30/30 pass, including two new private-file/vault tests |
| Python/host JVM suite | 24/24 pass, including three emulator-command cases and the voice simulator wrapper |
| Voice simulator details | Existing 12 lifecycle scenarios and actionable startup failure pass |
| Bundle | Pass; 802,304 bytes, gzip214,641 bytes |
| Gradle | Native wrapper9.6.1 on Java17 verified |
| Android debug build | ARM64, x86-64, universal app APKs and fixture APK built natively |
| Android lint | Pass, 0 errors / 124 warnings; no suppressions added |
| Browser Chrome | 1365×900 and390×844; no page errors or horizontal overflow |
| APK payload inspection | ARM64, x86-64 and universal debug APKs pass runtime-manifest and unwanted-file checks |
| Debug APK signature | Universal APK verifies with APK Signature Scheme v2 |

The first Android lint run exposed incorrect Windows SDK property escaping. After correction a cached lint analysis still reported the old line. The helper then generated a fresh properties file and a native Gradle `--rerun-tasks` build/lint passed all117 tasks in40s. The regular `windows-dev.ps1 -Action BuildAndroid` entry point subsequently passed in31s (8 executed /109 up-to-date). No lint check has been disabled. Final evidence: `verified-native-check.log`, `refreshed-android-build.log`, `final-android-build.log`, `apk-payload.jsonl`, `apk-signature.log` and `browser-smoke.json` in the artifact directory.

Browser screenshots: [desktop](../artifacts/windows-port-20261101/desktop.png), [mobile](../artifacts/windows-port-20261101/mobile.png). The browser smoke uses the existing local Playwright test harness and a separate empty preview state. It exercises rendering only; model replies and phone tools are not simulated as verified behavior.

No device was attached (`adb devices` empty). Emulator command construction/dry-run is verified; emulator boot, APK installation, Android tools, real microphone behavior and physical-device execution are not verified by these host checks. Native `.so` files in APKs target Android, as required; this does not make the Android app a Windows desktop application.

No account credentials imported, seller browsing/order, payment, workflow dispatch, remote push or publication. Historical DealPilot bars remain Phase1 **50/50→50/50 (+0)**, automated Phase2 **40/40→40/40 (+0)**, Phase3 **3/10→3/10 (+0)**, total **93/100→93/100 (+0)**. Phase3/stash stay paused; shopping integration is next, not part of this port.
