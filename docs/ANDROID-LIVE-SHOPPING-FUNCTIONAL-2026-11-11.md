# Galaxy A71 Live Shopping Functionality Retest — 11 November 2026

## Goal and safe scope
Revalidate the native Amazon/Flipkart shopping-research workflow after commit `390441a` with memory optimization out of scope. Test only isolated package `dev.pocket.agent.historyvalidation`, retaining the original and UI-preview installations and their data. No cart, checkout, address, account or payment actions.

## Physical-phone end-to-end research
- Device: Samsung Galaxy A71 SM-A715F, Android 13, user unlocked; test Accessibility bound and operational.
- A fresh main conversation was created and acknowledged, ID `fa117441-943d-4f91-b4a3-f22ce6bef409`.
- User-like request: two **different NEW wireless over-ear headphone models under INR 4,000**, preferred JBL/Soundcore but alternatives permitted, researched using native Amazon and Flipkart app observations. Exclude known on-ear WH-CH520/Tune 520BT and fail closed for unverified facts.
- **Live completion:** 190 seconds, completed normally, worker count returned to idle. Tool trace includes native Flipkart discovery and individual Amazon product-page observations.
- JLab JBuds LUX ANC over-ear listing: **INR 3,999 page-listed**, Amazon snapshot `bf66e897-0d89-4999-bac3-1b66b414cf8c`.
- Noise Airwave Max XR over-ear listing: **INR 3,499 page-listed**, Amazon snapshot `1dadc679-b0a4-498c-a508-45abfdf39d12`.
- Both native pages support over-ear via title. **Selected item new condition and stock were unknown.** Seller, exact variant eligibility and delivered total not established. Both correctly shown as `not qualified` and not purchase-ready. The visible `Buy now` control is not accepted as stock proof. No checkout.
- The main WebView had **411px viewport and 411px document width** (no horizontal overflow). The initial three-message thread survived a WebView reload.
- Private test observations, screenshots and worker tool results remain in ignored `artifacts/device-fixes-20261111/functional-final-live/`; they are not committed or published.

## Further flaws found and repaired
1. **Unrecognized real alternative manufacturers.** The verification and buyer-request brand catalog omitted JLab and Noise (also boAt, Skullcandy, Philips, Sennheiser, Edifier, Zebronics and Boult). The source-owning product title consequently triggered `The product-page title does not establish the stated manufacturer` even for a clearly labeled alternative. The catalog is now shared between user-request matching and source verification, with a safeguard that the generic term `noise cancellation` does **not** establish the Noise brand.
2. **Negated fresh-search instructions bypassed grounding.** In the saved conversation, `Compare only the two existing observed... Do not search again` was interpreted as a fresh search because it included the literal phrase `search again`. The model then authored a plausible summary without invoking the host source-grounding path. A regression test reproduces this exact failure. The fresh-search detector now treats negated searches as instructions to use the existing source ledger, while allowing affirmative requests for renewed research.

## On-device retest after repairs
- Same main thread, same saved source records. A source-only follow-up with `Do not search again or interact with a retailer` was repeated on the updated APK.
- **Passed:** final assistant answer starts `Source-observed listing evidence follows`; includes Amazon source snapshot IDs and observed prices, distinguishes reference and conditional price claims; identifies the brand claims without falsely calling either purchase-ready; stock and new condition stay `unknown`.
- The structured request remains INR 4,000, `newOnly=true`, `headphoneFits=['over-ear']`. **No new retailer worker** was started. After WebView reload, all **seven messages persisted** in the same thread. UI still 411px wide without horizontal overflow.
- A first intermediate retest *failed as expected*, revealing the negation bug. The exact same request then passed after the repair.

## Final verification
- TypeScript runtime unit/integration tests: **357/357 passed**.
- Android isolated APK assembly and lint: **passed**.
- UI/security suite: **52 passed, one previously skipped** (see ignored `artifacts/device-fixes-20261111/final-live-grounding-ui.log`).
- Isolated test APK SHA-256: `1bdda87d9daf079f2a49380629ef8626886abe064756168d4e58f68a6fd9a865`; confirm installed bytes on device.
- Test accessibility service enabled; phone unlocked during the acceptance work. Original apps, saved user data and memory settings were not altered.
- Nothing was pushed to a public remote. No payments, simulated transactions, merchant orders or shopping carts were created.

## Remaining factual acceptance boundary
The native retailer evidence in this run does **not** establish two simultaneously available, explicitly new, fully qualifying products. This is a source-data limitation, not permission to infer stock or item condition. Additional fresh retailer observations can establish qualifying alternatives if they actually show the required information; never substitute model guesses for such evidence.
