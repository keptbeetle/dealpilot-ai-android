# Mobile PayPal sandbox checkout

The November 3 APK contains an HTTPS checkout transport, Android Keystore connection storage, a main-settings checkout entry, purchase history and PayPal browser return handling. Gemini and browsing use the original on-phone assistant and workers.

## Setup on the phone

Open Settings → PayPal sandbox → Checkout connection. Enter the deployed service origin and its access key once. Only the public HTTPS origin and this restricted checkout credential are entered on the phone. PayPal merchant secrets stay on the server.

Choose a USD listing in chat and tap its review button. Review the item subtotal, quantity and source URL, acknowledge and approve the quote, then press Pay. Approve using a PayPal sandbox buyer account. On the return page choose Open Pocket Agent. Pocket matches the order reference and refreshes status. Use its verification button to complete the approved test payment.

An unrecognized return link cannot capture a payment. Interrupted or uncertain payments must be restored and reconciled. The service verifies the original amount, currency, quote identity and completed provider capture before showing success. Merchant cart, order and delivery remain simulated. The seller price is unverified and shipping/tax are unknown and excluded.

## Hosted service

The companion DealPilot checkout service is in `src/api/pocket-mobile.ts`, with `wrangler.pocket.jsonc` and `db/pocket-mobile.sql`. The maintainer deployment guide is `docs/POCKET-MOBILE-PAYPAL-HTTPS-2026-11-03.md` in the sibling DealPilot repository.

Cloudflare Workers and D1 were selected for the free plan. The service needs the owner's Cloudflare authorization before deployment. A compiled APK and Worker dry-run are available locally. Hosted availability, real phone execution and buyer-approved provider capture are still pending. Windows/ADB pairing is supported only by the older development workflow.

The Android implementation uses the existing PayPal Orders API approval page and a return activity. It does not embed the PayPal merchant secret or depend on a model response as proof of payment.

## Verification

Android build/lint pass. Preview tests report 47 pass and one platform skip, including three new checkout UI tests. Backend tests cover device ownership, exact review and approval, provider once-only capture, unknown outcome recovery, durable quota and return-link injection. The new service bundles successfully using Wrangler's dry-run. Android emulator and wireless ADB remained stopped throughout this work as requested. PayPal responses in automated tests are injected.
