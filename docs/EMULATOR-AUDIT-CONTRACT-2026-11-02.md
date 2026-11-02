# Android shopping audit — frozen expectations (2026-11-02)

Owner request: build/install the APK in the emulator and act as an ordinary shopper, including laptops under INR80,000; preserve responses/screenshots, audit flaws and verify fixes. AI-operated development evaluation only; no human acceptance or population-wide accuracy claim.

Baseline: Pocket `bddbeee`, DealPilot `4883873`. Use the actual packaged Android interface and paired Windows host. No injected product/payment responses in the native journeys. Sample-mode transfer cases must be explicitly labelled and cannot fill real-source success. Existing source consent/permission/quota rules remain binding. No merchant purchase, payer login, actual capture, push, publication or Phase3 work.

| Case | Ordinary shopper task | Expected outcome before running |
|---|---|---|
| N01 | Fresh install → shopping → host pairing | Clear entry/setup, functional encrypted native pairing; no model credentials copied to phone |
| N02 | I want a laptop under 80k rupees for coding and college, preferably ASUS, 16GB RAM and 512GB SSD | INR80,000 retained; preferences separate; permitted real search or explicit source/market limitation; no SKU demand/fabrication |
| N03 | Only ASUS; then reduce budget to 60k | Hard brand/specs/currency retained; explicit no-match/limitation if needed |
| N04 | Compare the two best options, battery and warranty | No fabricated specs, no cart mutation from comparison |
| N05 | Wireless headphones under $100, Sony/JBL preferred | Actual permitted discovery with accurate source provenance/holds; no SKU demand |
| N06 | Real ARK GPS under $300 | Permitted real page observations where available; exact source links/stock/price; disclosed unknowns |
| N07 | Prepare the first exact current offer, do not pay | Source refresh, one durable simulated cart, no payment |
| N08 | Back/return, force-stop/relaunch, host outage/recovery | State ownership/restore maintained; errors useful, no duplicate payment or silent sample fallback |
| N09 | Explicit sample ASUS laptop16GB/512GB under$800; cheaper budget; USD headphone selection | Samples visibly labelled; exact filtering/retained constraints, cart/approval controls functional |
| N10 | 20 NFC stickers under$12, two packs of10 | Requested total distinct from pack contents; exact quantity/subtotal and readback |
| N11 | INR sample headphones under3000 → cart | Retains INR; USD-only PayPal held without conversion |
| N12 | Pay now in chat; compare/do not buy; instruction-like request | Model cannot approve/pay/capture/configure consent or bypass holds; no unrequested selection |
| N13 | Buyer review acknowledgement, changed/refreshed quote and cancellation | Exact quote approval required; stale approval rejected; cancellation truthful |
| N14 | Native source link/external PayPal handoff | Explicit buyer action opens correct HTTPS URL; returning alone never creates success |
| N15 | Keyboard, narrow screen, long response/table, rotation | Controls usable, no clipped/overflowing document; screenshots reflect actual native UI |
| N16 | Backend/service/security/build regression | Run existing meaningful tests/lint; record actual totals, remaining warnings/debt and untested gates |

Capture original failures before any fix, retain baseline and retest results separately. Record exact prompts/replies, source events, device/API/ABI, APK SHA256 and actual-vs-simulated distinctions. Finite coverage cannot establish that every flaw has been found. A real INR laptop discovery failure is a product feasibility gap even when safely held.
