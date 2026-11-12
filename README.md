# DealPilot AI

Maintained by [keptbeetle](https://github.com/keptbeetle). Upstream source credits and dependency notices are recorded in [source provenance](THIRD_PARTY_NOTICES.md).

**An AI-powered Android agent for getting things done on your phone.** Discover and compare products through a conversational interface, work with native Android tools, prepare a cart from the product selected in chat, and proceed to an explicitly authorized **PayPal Sandbox** test checkout.

DealPilot AI combines on-device agent orchestration, live phone browsing, and a focused chat interface. Searching and comparing products are separate from checkout: **nothing starts a payment until you request it.**

## Android app

**Android 12 (API 31) or newer** is required.

[**Download the latest Android APK from GitHub Releases**](../../releases)

Choose **ARM64** for most recent Android phones, or **Universal** if you are unsure of your device architecture. The current downloadable build is intended for testing and is debug-signed, not a production Play Store release.

After installing, open **DealPilot AI**, connect your preferred AI provider in Settings, and grant the Android permissions needed for the requested phone actions. Live screen interaction uses Android Accessibility and can use **Shizuku** for additional on-device capabilities.

## Features

- **Phone browsing:** Research products using native Android browsing and phone tools.
- **Comparison:** Review models, features, prices, availability and sources in the chat.
- **Chat-based product selection:** Choose an exact model (for example, “I choose Sony WH-CH720N”). The cart resolves the selection from the current conversation, not a fixed catalogue.
- **Cart preparation:** Say “Prepare my cart.” Review the selected product, HTTPS listing, and exact USD test subtotal.
- **Explicit checkout:** Say “Proceed to pay.” Approve the amount before opening PayPal Sandbox.
- **Verified test receipt:** Payment completes only after the matching PayPal Sandbox order and capture have been verified.
- **Android assistance:** Delegate tasks, manage agent workers and conversations, and use supported voice input and Android capabilities.

If chat results only contain estimated prices, price ranges, or non-USD amounts, the cart requests an exact USD **test** subtotal rather than inventing one. The Sandbox does not place a merchant order or arrange shipping.

## Example shopping conversation

1. **Discover:** “Find wireless over-ear headphones under ₹10,000. Browse sources and show models, prices, and links.”
2. **Compare:** “Compare the top three options by price, features, and battery life.”
3. **Select:** “I choose the Sony WH-CH720N.”
4. **Cart:** “Prepare my cart.” Review the product, direct listing, and test amount.
5. **Checkout:** “Proceed to pay.” Review and approve the PayPal Sandbox test amount.
6. **Confirm:** Return to DealPilot AI to verify the Sandbox capture and view the test receipt.

Search, comparison, selection, and cart preparation never create a retailer purchase.

## Set up the local PayPal Sandbox host

The Android checkout connects to a **private local companion service**. Install the companion backend alongside this repository and configure its PayPal **Sandbox** client credentials in the backend's local environment. Keep credentials out of APKs and Git.

From this Android repository:

```powershell
node scripts/start-paypal-sandbox.mjs
adb reverse tcp:3490 tcp:3490
```

The host prints a **12-character time-limited pairing code**. In DealPilot AI, request cart preparation and enter the code and host port when prompted. A separate payment request and exact-amount approval are required to open PayPal Sandbox.

The local host and USB reverse tunnel must remain connected for this setup; the APK alone does not provide an internet-hosted checkout backend. See [Sandbox setup, build, and payment verification](docs/DEALPILOT-NATIVE-PAYPAL.md).

## Build Android from source

Install JDK 17, Android SDK 36, and the Android NDK specified in Gradle. For Windows PowerShell:

```powershell
$env:ANDROID_HOME = 'D:\sdk'  # Replace with your installed SDK path
.\gradlew.bat :app:assembleDebug -PfinalDealPilot --no-daemon
adb install -r app\build\outputs\apk\debug\app-arm64-v8a-debug.apk
```

The Android application ID is `dev.pocket.agent.dealpilot`. When upgrading, use APKs signed with the same certificate; Android will reject updates with a different signing key. Production builds require a controlled release signing key.

### Run focused tests

```powershell
node --test preview/test/native-paypal.test.mjs
.\gradlew.bat :app:assembleDebug -PfinalDealPilot --no-daemon
```

The checkout tests cover chat-based product selection, ambiguous product matches, non-invented prices, and preserving the prepared cart across “Proceed to pay.” The Sony selection, cart preparation, and PayPal Sandbox review were verified on a connected Android phone. Live Sandbox buyer approval and capture have **not** been verified end to end.

## Documentation

- [Android and PayPal Sandbox integration](docs/DEALPILOT-NATIVE-PAYPAL.md)
- [Mobile UI validation](docs/MOBILE_UI_VALIDATION.md)
- [Android permissions and host lifecycle](docs/ANDROID_HOST.md)
- [Voice features](docs/VOICE.md)
- [Authentication](docs/AUTH.md)
- [Runtime architecture](docs/RUNTIME.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

**Payment notice:** PayPal Sandbox uses test transactions only. It does not transfer real funds, reserve merchant inventory, place an order with a retailer, or arrange delivery.
