# DealPilot Agent — native Android and PayPal Sandbox

DealPilot Agent combines native Android conversations, phone browsing, accessibility and Shizuku integrations with buyer-controlled cart preparation and explicit PayPal Sandbox checkout inside the main chat interface.

## Build and install

With JDK 17 and Android SDK installed at `D:\sdk`, run:

```powershell
$env:ANDROID_HOME = 'D:\sdk'
.\gradlew.bat :app:assembleDebug --no-daemon
adb install -r app\build\outputs\apk\debug\app-arm64-v8a-debug.apk
```

The original `dev.pocket.agent` package on the test phone has a different signing certificate. Android rejects updating it. To avoid deleting the existing app and its data, build the dedicated DealPilot Agent package instead:

```powershell
.\gradlew.bat :app:assembleDebug -PfinalDealPilot --no-daemon
adb install -r app\build\outputs\apk\debug\app-arm64-v8a-debug.apk
adb shell am start -n dev.pocket.agent.dealpilot/dev.pocket.agent.MainActivity
```

This dedicated package (`dev.pocket.agent.dealpilot`) displays as **DealPilot Agent**. Android accessibility and Shizuku permissions must be enabled separately for this package before live phone browsing.

## Private PayPal Sandbox host

The private checkout bridge uses the sibling `../dealpilot-ai` local checkout backend. Its dependencies and PayPal **Sandbox** credentials must be configured in its own local `.env`; no provider secret belongs in the APK.

```powershell
node scripts/start-paypal-sandbox.mjs
adb reverse tcp:3490 tcp:3490
```

Read the **12-character time-limited pairing code** from the host terminal. In the app, say `Prepare my cart`, connect with the code and port, verify the selected product and USD test amount, and save the cart. A separate explicit `Proceed to pay` request opens the PayPal Sandbox payment review. The buyer must approve the exact amount before the genuine PayPal Sandbox approval page can open. Payment confirmation requires verification of a matching PayPal Sandbox capture and receipt; there is no real retailer order or shipment.

Normal searching, comparison, browsing and chat do not start checkout. If PayPal redirects to the local checkout page rather than back to Android, return to DealPilot Agent and choose **Verify PayPal Sandbox payment**. The backend checks provider approval before attempting capture. If the host is restarted, pair with its new code.

## Tests

```powershell
node --test preview/test/native-paypal.test.mjs
# In ../dealpilot-ai:
node --import tsx --test src/api/pocket-shopping.test.ts src/api/pocket-mobile.test.ts
```

The PayPal Sandbox uses test money only. Checkout needs a running local host and USB reverse port forwarding; the agent's original phone browsing needs its own model provider and Android permissions.
