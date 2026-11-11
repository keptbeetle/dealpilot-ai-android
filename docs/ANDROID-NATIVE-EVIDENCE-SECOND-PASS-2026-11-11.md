# Native Retailer Evidence and Shopping Comparison — Second Functional Pass

**Date:** 11 November 2026
**Repository:** `D:\Projects\pocket-agent`, `codex/native-gemini-checkout`
**Test device:** Galaxy A71 SM-A715F, Android 13, isolated `dev.pocket.agent.historyvalidation` package.

## Purpose and scope

This pass continued the earlier functionality repairs without changing memory optimizations or purchasing anything. The remaining user-facing problem was an incomplete Flipkart source: the search result named a JBL product, but the opened page exposed a truncated title and separate brand, colour and buy-box labels. The app had omitted that brand and the source-card fit evidence, leaving product identity and fit needlessly unknown.

## Implemented corrections

- **Scoped brand evidence:** recognize a known manufacturer label only when it appears directly beside `Visit store` and the *same opened product-page title*. A brand in unrelated recommendations or an arbitrary page paragraph does not count.
- **Selected card continuity:** a captured native search card may support headphone fit only when its normalized, model-specific title prefix matches the opened detail title and any observed selected colour agrees. A wrong model, absent source snapshot, conflicting selected colour or unlinked result cannot contribute fit evidence.
- **Variant binding:** the product page's explicit selected colour can supplement a truncated page title in source identity checks only when that same selected search card is linked. Conflicting page/card/title colours veto qualification. Native comparison identity requires this linkage or an exact selected product title, not an incidental shared battery statistic.
- **Headphone form factor:** recognize expressions such as `On the Ear` as well as `on-ear`; disqualify on-ear against an over-ear-only buyer request, and do not treat a shortened product title as proof of compatible fit.
- **Condition conflicts:** multiple explicit condition labels on the same native observation (e.g., `Condition: New` and `Condition: Used`) now force a conflict hold, whether or not the buyer explicitly requested new-only.
- **Readable comparison results:** comparison rows name the specific failed or unknown requirements instead of saying only `Unknown or contradicted`. The detailed evidence also notes any independently observed adjacent manufacturer label and the origin of a supported/contradicted headphone-fit claim.

The package still does **not** infer in-stock from the presence of `Buy now` or `Add to cart`. It does not assume `New` for ordinary product listings without a selected-item condition claim.

## Replay of the original physical retailer evidence

A read-only copy of the isolated application's durable database was inspected on the development workstation to recover the previous native tool-result observation; no credentials, unrelated conversation details or private product pages were committed. The replay used the precise native-source snapshot **`8807c575-06b1-4a4b-8936-f2855c1740a0`** captured on 11 November 2026 at approximately 13:41 IST (08:11 UTC), based on its recorded Unix timestamp, and evaluated it at the capture time to test **source interpretation**, not current availability.

- Flipkart opened title: `Tune 520 BT 57Hr Playtime, Pure Bass, Multi Connect 5.3LE Bluetoo...more`.
- Source search card: `JBL, Tune 520 BT ... Black, On the Ear`.
- Opened detail: `Selected Color: Black`, `JBL`, `Visit store`, matching title, and INR 3,499 listed price.
- **Post-fix re-evaluation:** the current page establishes a JBL brand label; the selected search card is linked by model prefix and colour; headphone fit is **contradicted** for an over-ear-only request. INR 3,499 is an observed page-listed price, **new condition is unknown**, stock is **unknown**, and seller, delivery eligibility, fees and final total remain unverified.
- Qualification stays **held/contradicted**. No real merchant purchase, cart mutation, PayPal action or payment occurred.

The previously observed live broad search was completed in about 170 seconds; the Sony WH-CH520 on-ear Amazon product at INR 3,590 and the Flipkart JBL Tune 520BT on-ear product at INR 3,499 did not establish two qualifying new over-ear, in-stock offers. These remain the only supported facts from that run.

## Tests and next gate

- Focused regression tests exercise correct and conflicting source-card identity, selected-colour mismatches, condition conflicts, stock holds, eligibility under an over-ear/new-only request, and transparent comparison tables.
- Separate positive test verifies that **two distinct source-bound new, in-stock, over-ear products with unique regular prices** can be ranked at the listed-price level; purchase readiness stays false.
- Full runtime suite: **356/356 passed**. UI/security suite: **52 passed, 1 existing skip**. Android arm64 isolated build and lint: **passed**. Logs are in ignored `artifacts/device-fixes-20261111/function-round2-final-*.log`.
- Final installed isolated APK SHA-256: **`8abbff61b7a5ce34b278ce9c7779a812e592c7df959542da7a5c5c6d3bfabae5`**, verified byte-for-byte equal to the built APK by pulling the installed package from the phone. Test accessibility service remained enabled and bound; no crashed services. Android stay-awake setting remained `0` and no ADB forwards remained.
- The test phone became **Android keyguard-locked** during the post-build session (`deviceLocked=1`, `NotificationShade`). Normal wake and swipe did not unlock it. We did not attempt a credential, change device security, or bypass the lock. Thus **a fresh real native-app retest of this final build is blocked until the phone is unlocked**. Earlier real evidence was replayed through the updated verifier, not falsely described as a fresh retailer visit.
- The original installed app and separate UI preview package were not changed. No durable user data was cleared; no work was pushed.

## Remaining externally bounded requirement

Finding **two live new, in-stock over-ear headphones under INR 4,000** remains a research goal, not a fact established by the retailers. A product may be absent, out of stock, or omit seller/condition/stock labels. The application must report these source limitations without invented facts. The live acceptance test can resume on the isolated app after normal Android user unlock.
