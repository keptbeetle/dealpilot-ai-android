# Native Shopping Functionality — Physical Device Verification (11 November 2026)

## Scope and boundaries
- Repository: `D:\Projects\pocket-agent`, branch `codex/native-gemini-checkout`.
- Device: Samsung Galaxy A71 SM-A715F, Android 13, USB-connected authorized ADB.
- Isolated test application: `dev.pocket.agent.historyvalidation`; original Pocket Agent installations and user data remained untouched. The isolated app's existing conversations were preserved, not cleared.
- **Memory optimization and repeated-memory stress were expressly excluded by the user.** No Java native-memory or runtime heap settings changed in this work.
- Retail research remained **read-only** in real Amazon and Flipkart Android apps. No Add to Cart, checkout, PayPal orders, payments or merchant purchases.

## Verified functional fixes
1. **Both NEW / new wireless over-ear condition retention.** The shopping-request parser previously missed the exact phrase `both NEW` and the original `NEW wireless over-ear headphones`, storing `newOnly:false`. The parser now retains both as explicit new-only requirements. Unit tests exercise the exact prompts, an allowed later used/refurbished relaxation, and unrelated "new features" false positives.
2. **Safe source-grounded budget follow-ups.** A live baseline INR 4,000 follow-up preserved the new budget but incorrectly asserted "In stock (New)" without item-condition evidence. Ordinary replies referencing previous observed offers now rederive their answer from *fresh, same-chat native worker tool observations* with current buyer constraints, instead of trusting unverified model prose. Explicit requests for a fresh search are excluded from this reuse. The device follow-up then reported Sony WH-CH520 INR 3,590, Soundcore Q20i INR 4,998 (over budget), **new condition unknown**, and seller/shipping/taxes/delivered total unknown; no extra retailer worker was started.
3. **Over-ear versus on-ear fit enforcement.** The original broader prompt demanded over-ear but the Amazon listing explicitly said "Sony WH-CH520 ... On Ear"; previously it was partially accepted. Requests now persist allowed headphone fits, and verification checks the selected product title for exactly one supported fit. The source's on-ear title is now **contradicted** for an over-ear-only user request. Mentioning "over-ear versus on-ear" as a comparison no longer widens an earlier explicit "must be over-ear" requirement. Explicit user permission to accept both styles is still allowed; unknown fit remains unknown.
4. **Background chat restore regression.** The earlier open-chat acknowledgment timeout could not be reproduced with the latest installed bridge: changing to an older chat while the Activity was backgrounded acknowledged in ~1.6 seconds, persisted the older chat, and changing back preserved all seven original messages.

## Live physical-phone evidence
- **Named two-model research:** Sony WH-CH520 Black and Soundcore Q20i Black were opened in the native Amazon Android app, complete in 95 seconds. Observed listed prices: **INR 3,590** and **INR 4,998**. Both listed as available on page, but new condition, seller, variant eligibility, shipping, taxes and delivered total were not established. This was a listed-price comparison, never purchase clearance. Mobile UI showed no horizontal overflow and conversation survived WebView reload.
- **Broader original-style shopping:** Real Amazon and Flipkart product detail observations completed in 170 seconds. Sony WH-CH520 On Ear: INR 3,590, page-reported availability; Flipkart JBL Tune 520BT: INR 3,499, stock unknown and product brand/title not independently linked. No two fully qualified in-stock over-ear/new offers were proven.
- **After the final fit fix:** A follow-up asking only for the earlier observed offers and explicitly requiring new over-ear headphones kept the profile `newOnly:true`, `headphoneFits:['over-ear']`, and INR 4,000 budget. The same Amazon observation was reclassified as **headphone fit: contradicted**; Flipkart fit and stock stayed **unknown**. Both remained **not qualified**. The worker count and conversation ID stayed unchanged and no new retailer navigation occurred.
- An intermediate physical test correctly caught a parsing bug where a comparison phrase "over-ear versus on-ear" relaxed the mandatory over-ear fit; fixed and rerun to passing state. Regression added for the exact failure wording.
- Private phone observations and original text stay under ignored `artifacts/device-fixes-20261111/`; no sensitive screenshots were committed.

## Final verification
- Node runtime suite: **352/352 passed**.
- UI/security suite: **52 passed, one pre-existing skip**.
- Android arm64 isolated build and lint: **passed**.
- Focused source-contract tests: native-product source binding, condition, budget, style, source age, source-identity holds and anti-purchase restrictions exercised.
- Installed APK SHA-256 **`25a4d02b9e7ff69e6c41652c5250c1be944b392211c1a9b92b49b347cf0fc93b`**, confirmed byte-for-byte equal to the built arm64 APK after pulling the package from the device. Test accessibility service enabled and bound; no crashed-service entry.
- No push to remote and no purchase activity.

## Remaining source limitations
A product's condition, stock, seller, exact variant, delivery eligibility, taxes, shipping and final total must remain unknown where the native app does not establish them. The broader INR 4,000 over-ear/new comparison **does not yet have two source-verified qualifying offers**. That is an unfulfilled evidence goal, not permission to fabricate facts. A later real-world reinspection with different qualifying retailer listings may resolve it. Repeated-shopping native memory stress remains an explicitly deferred separate issue, not claimed fixed.
