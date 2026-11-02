# Download the latest test APK

Open [Downloadable Android APKs](https://github.com/keptbeetle/pocket-agent/actions/workflows/debug-apk.yml), select the newest successful run for your branch, then use its **Download this build** links or **Artifacts** section. GitHub requires sign-in to download workflow artifacts. Download the ZIP, extract it and install the APK inside:

| Artifact | Use |
|---|---|
| `Pocket-Agent-arm64-…` | Most Android phones; recommended |
| `Pocket-Agent-x86_64-…` | Android emulator |
| `Pocket-Agent-universal-…` | Both supported architectures in one larger APK |

The workflow runs on code pushes to every branch, PR creation/updates and manual **Run workflow**. Markdown/docs-only changes skip the automatic build. Uploads last seven days; if an older build expired, run the workflow again. The workflow appears in the default-branch Actions menu after the PR is merged; before merge, open the PR's checks or its branch-push run. No automatic release/tag, store upload or merge occurs.

Runtime/provider/host tests, the bundle build, Android debug lint, all three APK signatures and payload checks must pass before the APK upload steps. Each download includes `SHA256SUMS.txt`, `source-commit.txt`, `build.json`, signature/payload reports and a build note identifying the exact source and Actions run. CI version codes are `100000 + run_number`, keeping newer CI builds above the local version31. PR source is GitHub's checked-out merge commit, not necessarily the branch head.

## Signing and installation

`CI_DEBUG_KEYSTORE_BASE64` is an optional repository Actions secret containing a normal Android **debug** keystore (alias `androiddebugkey`, standard debug password `android`). For this fork it is configured from the existing local debug key, so push/manual APKs can update the previous locally signed debug installation without changing identity. It is not a production signing key, never placed in the app/download/cache, and cleaned from the runner after use. CI uses this secret only on push/manual builds; PR builds always use a disposable runner debug key. Choose the branch-push build for repeat installations. A PR artifact with a different signature requires removing a previous installation first, which deletes its local data; do not do that merely to compare builds when retaining pairing/history matters.

Other forks can omit the secret: APK building still works with disposable debug signatures. Do not import real payment credentials into CI. No model, merchant, PayPal or paid provider keys are required for the build. This workflow produces test APKs; it does not establish on-device acceptance of every change.

The inherited distribution/scheduled-prerelease workflows remain available to the original upstream repository. Forks must explicitly opt in with repository variable `ENABLE_DISTRIBUTION_BUILDS=true` plus their distribution secrets, or manually request disposable validation signing. They are not the secret-free test download path.

Shopping remains a host-assisted mode: installing the APK does not install the sibling DealPilot backend or configure a phone model. Follow [shopping setup](SHOPPING-SANDBOX-2026-11-01.md). Merchant cart/fulfilment is simulated; genuine sandbox payment needs its separately configured host. This CI task adds no payment, marketplace access or release acceptance.

GitHub references: [download workflow artifacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts), [artifact retention](https://docs.github.com/en/actions/tutorials/store-and-share-data). Public repository standard runners are used; this change does not raise billing limits or enable paid runners.
