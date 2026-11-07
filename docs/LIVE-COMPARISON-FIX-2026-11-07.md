# Live comparison repair and phone verification

The earlier implementation added the comparison table, evidence ledger, OCR and selected-offer review. The 7 November 2026 follow-up targeted the live acquisition failures that kept the table from showing two qualified offers.

| Checkpoint | Change and verification |
| --- | --- |
| `cf0993c` | Bounded product-page collection retains evidence from each scroll and stops on a changed product or lack of progress. Three new contracts and 332 runtime tests passed. |
| `fd1d90c` | Flipkart identifies its query toolbar on a scrolled results page without requiring the offscreen filter row. The original failure and the successful live search were captured. 333 runtime tests passed. |
| `82e70cf` | Product price extraction separates protection fees and abbreviated credit limits. Two screenshots can establish stock for the selected Amazon colour. 335 runtime tests passed. |
| `d36d499` | Accessibility health checks use a separate bounded lane. Gesture retries require confirmed non-dispatch and a fresh observation of the same window. Actual screenshots replay the split “Available to ship” claim without inferring the clipped delivery time. 336 runtime tests and 13 Android checks passed. |
| `bace3ab` | Flipkart price scope begins at the selected product title. Monthly instalments and financed totals stay separate. Numeric text animation can coexist with viewport scrolling and Back while click and text freshness remain strict. The recorded JBL screen replays a single listed ₹4,749 with unknown stock. 337 runtime tests and 13 Android checks passed. |
| `d66a610` | Comparison follow-ups reuse fresh qualified native offers from the same chat and category, applying the current constraints. Earlier qualified observations keep their original timestamps. 338 runtime tests passed. |
| `54b8b8d` | The actual model tool schema accepts a host-issued target ID and the collect action. Focused shopping uses guarded navigation. General Pocket controls remain available to the main agent and phone operator. 339 runtime and 51 UI tests passed, with one existing UI skip. |
| `3d88bad` | An established title survives scrolling past the title when a caption would otherwise replace it. A different window or an explicit conflicting title stops collection. 340 runtime tests and the Android build passed. |

The first schema patch changed the navigation function and its prompt but missed the actual model-facing JSON schema. The next phone run reproduced the rejection. The corrected schema is now tested through the same tool validator the model uses.

Live tests used the connected Galaxy A71, its existing Gemini profile and the installed retailer apps. Earlier runs verified the Sony WH-CH520 Blue at ₹2,989 and later the Black variant at ₹3,590. The JBL Tune 520BT run lacked explicit stock evidence. One cancelled attempt dropped the Sony tool report from the active thread history. The passing run finished Soundcore research first and then used a plain-language Sony lookup and comparison in the same chat. Neither prompt supplied a model number or SKU for the Sony lookup.

## Completed live listed-price comparison

The native Amazon app supplied two distinct offers below ₹5,000, each with explicit availability for the selected colour. The phone rendered both in one comparison table and named the Sony the lowest listed price. The conversation restored all eight messages and was idle. The test was AI-operated.

| Model | Selected colour | Listed price | Availability | Native snapshot |
| --- | --- | --- | --- | --- |
| Sony WH-CH520 | Black | ₹3,590 | In stock | `c24bd0f2-689a-4bae-a039-e6084521f420` |
| Soundcore Q20i | Ivory | ₹4,499 | In stock | `d8c1f9fc-e983-4d16-8d76-dda881011030` |

The Soundcore listing title says White and its selected-colour field says Ivory. Both labels are retained with their respective source roles. The comparison qualifies listed price and stock. Seller, precise variant identity, eligibility, delivery charges and delivered total still need checkout evidence. The verbose source section can retain a stock warning from a partial frame alongside the accepted two-frame stock evidence. Flipkart search and product-page navigation advanced, with the recorded ₹4,749 replay still held for stock. A qualified Amazon–Flipkart comparison remains open.

Local evidence is in `artifacts/live-comparison-fix-20261107`. The live comparison assessment, original phone captures and Android integrity results are retained alongside failed traces.

Samsung intermittently left the existing test accessibility service waiting to bind after instrumentation. Turning only that service off, updating the isolated APK while it was off and restoring its existing permission through Settings recovered it. The original app and service approvals were preserved.

The live screenshots also exposed wrapped price and availability values. The final APK keeps both columns on one line. After the CSS-only rebuild, the same completed comparison restored and rendered on the phone. The local `comparison-live.png` and `comparison-availability.png` captures show the updated layout.

The final APK remains isolated as Pocket Agent Test. Its ARM64 SHA-256 is `dd8b2a42e8377bf383fcfdd5ea66b91c71ba0490381ce8ff86de66d41651e6bf`. The four pinned DealPilot verification modules, installed APK bytes and signature matched the packaged output. The checks covered 340 runtime tests, 51 UI tests with one skip, 13 native checks, the runtime bundle and the three-ABI Android build. Sixteen existing diagnostics remain in the extra TypeScript check. The test service was bound, USB and Shizuku were available, the original screen-awake value was restored and the task forward and temporary driver files were removed. The historical score stays **50/50 + 40/40 + 3/10 = 93/100 (+0)**.
