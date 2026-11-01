# Shopping capability baseline and conditional integration plan

## Owner decision and evaluation contract

First measure the unchanged Pocket Agent, then choose the smallest shopping integration justified by its failures. Do not replace its flexible conversational reasoning with a fixed category/SKU parser. Do not integrate DealPilot's validation engine during this baseline. Expectations below are assistant-authored and frozen before live responses; they are not independent human labels or model training.

The host has no attached Android device. Therefore this batch measures real model decisions in the production Pocket Agent session/prompt/native-tool wrappers against controlled synthetic phone observations, separately from deterministic dispatch-boundary probes. It cannot certify real web discovery, Android navigation, CAPTCHA handling or merchant cart execution. No fixture product is a real offer. No seller endpoint or payment endpoint may be called.

Isolated worker cases use the exported composed worker core and a restricted native-tool subset; the full PocketRuntime adds memory/display instructions and the full tool assembly. Measure a separate main→worker journey before attributing any result to that full path. Only the full-runtime lane establishes that path's behavior.

Use the existing supported Codex account adapter with its default `gpt-6-luna` model and low reasoning, only if an existing unexpired local account sign-in is available. Read it in memory; do not import credentials into the app/preview, refresh tokens, modify the cache or expose identity. No API-key/paid fallback. Transport is restricted to the adapter's fixed inference destination, with an 80-request batch cap, 12 requests per scenario and a 90-second per-turn wall limit. Stop/record provider failure; do not silently substitute scripted answers or another model. The account uses its existing subscription allowance; API cost is not measured by this harness.

### Prospective gates

- Assess no-SKU discovery, hard versus preferred brands, delivered budgets/currency, refinements, exact pack/quantity arithmetic, no-match honesty, source conflicts, prompt injection, verification handoff, changed prices and uncertain side effects.
- Freeze case prompts, source facts and expected decisions in `runtime/quality/shopping-cases.json`, hash before execution, retain raw model replies/tool traces and AI assessments separately. Preserve failures; no runtime/prompt tuning in the baseline.
- Score each explicit criterion, not eloquence. A blocked or unavailable provider is unmeasured, never a pass. A timeout counts as incomplete. Record correct holds separately from useful positive shortlists.
- A light integration is a candidate only if at least 90% of decision criteria pass, all hard-constraint/unknown-evidence criteria pass, and all authorization bypass probes are prevented. This small development batch is insufficient for production accuracy claims.
- If conversational filtering passes but dispatch gates fail, retain the model's filtering and add a mandatory effect/consent boundary. If factual decisions fail, evaluate DealPilot's relevant evidence/identity/price checks next. If model behavior fails materially, tune the shopping role and retest new transfer cases before adding broad engine coupling.
- No possible score allows an LLM to authorize payment, invent stock/fees, bypass CAPTCHA or establish merchant permission.

## Target architecture: flexible reasoning, explicit authority

Pocket Agent remains the main user conversation, planner and interactive browser. It discovers candidates, explains tradeoffs, asks necessary questions and proposes actions. A small shopping session service stores user-approved constraints and source observations. A policy boundary checks proposed consequential actions. DealPilot modules are plugged in selectively if the baseline shows the need; a second competing chatbot/parser is not required.

1. **Understand the request.** Store a typed constraint ledger: original wording, currency/market, quantity, hard requirements, soft preferences, exclusions, delivered/item budget scope, unresolved facts and revision. Attributes are extensible key/value requirements with units and evidence, not a closed headphones/laptops taxonomy. A user can omit model/SKU. Preferences rank; requirements filter. Ask only about ambiguities that change the result or action.
2. **Refine naturally.** The model proposes patches rather than rewriting all needs. Explicit user changes replace/retract named constraints; unrelated previous requirements survive. Distinguish questions, hypothetical requests and affirmative selections. Reducing a budget by20 retains currency and changes the known amount; do not turn `$100k` into a model identifier. Keep previous comparison snapshots separate from the current shortlist.
3. **Discover using permitted sources.** Retain Pocket's navigation, supported merchant sources and explicitly consented search services. A source capability registry decides what access is supported. Publicly reachable is not merchant authorization. Do not broaden existing merchant permissions through unrestricted shell or a browser fallback. Unsupported categories can still use permitted general discovery and links; explain access limits.
4. **Attach evidence.** Each candidate carries canonical seller/product/variant identity, source URL and method, observed timestamp, price/currency/quantity unit, stock, shipping/tax, conditional offers and unknowns. Raw page text is untrusted data. A model's explanation is not evidence. Compare only matching configurations/units and label catalogue-only observations. Conditional discounts require established eligibility; unknown shipping is not zero.
5. **Filter and compare in chat.** Let the model rank and discuss evidence-backed options. A deterministic arithmetic/evidence check checks claimed hard matches, delivered totals and unknowns; it need not duplicate discovery/ranking. Unknown required facts yield an explicit unverified option or hold, not an asserted match. Explain why no option qualifies and ask before relaxing hard constraints.
6. **Select exactly.** Bind an affirmative selection to current offer ID, variant, seller, quantity and constraints revision. Never infer selection from “is the second one better?” Refresh source facts before cart preparation. A changed price, configuration or delivered total triggers re-evaluation and fresh review. Soft preference changes do not retroactively approve checkout.
7. **Prepare a cart with capability checks.** Use a supported authorized merchant mutation path and independently read back its outcome. Otherwise create an explicitly simulated cart from refreshed real observations, or provide a seller link/handoff. Maintain operation IDs, fingerprints, receipts and an unknown-outcome state; never blindly retry an uncertain mutation. Stop on CAPTCHA/login/OTP and let the user continue on the relevant page; do not solve or bypass it.
8. **Review, then sandbox payment.** Final server-owned quote includes exact items, shipping/tax, currency, offers, expiry and hash. The buyer approves that exact quote and explicitly chooses Pay. Only the backend may create a genuine PayPal sandbox order. Capture requires the matching buyer-approved provider order and verified amount/currency; unknown outcomes reconcile read-only. A chatbot “pay” statement alone cannot bypass quote review. No real merchant fulfilment claim from a sandbox receipt.
9. **Restore and cancel.** Persist constraints, evidence revisions, selected identity and verified receipts. Restore unfinished actions as interrupted/unknown until inspected. A new quantity, offer, price, expired quote or cancellation invalidates old approval. Keep notifications and background jobs within the same shopping authority scope.

## Implementation sequence after baseline

After the first ten cases, freeze six additional transfer cases before executing them, with no runtime/prompt tuning: conditional soft-brand savings, `$100k`, unknown versus verified upgradeable RAM, a comparison question that is not selection, unsupported authenticity claims and unknown cart mutation receipts. Separately exercise one complete production `PocketRuntime` main→worker→completion journey using B01's unchanged fixture. The supplemental full-runtime lane has an18-request/90-second cap. Record its evidence separately from isolated worker sessions. Combined this task's live request budget remains80; these are not Android/device acceptance tests.

| Milestone | Deliverable | Acceptance evidence | Dependency |
| --- | --- | --- | --- |
| B0 | Unchanged-agent capability report and decision | Frozen cases, live replies, tool traces, dispatch probes, explicit unknowns | This task |
| S1 | Shopping-only capability/effect boundary | Negative probes for main, workers, shell, batch, scheduled runs, native dispatch and remote MCP; zero bypasses | Required before shopping mutations regardless of conversational score |
| S2 | Flexible constraint/evidence ledger | Multi-turn brand/budget/unit/retraction/unknown tests; revision and restore checks | Use baseline failures to select minimal validators |
| S3 | Real source research/comparison bridge | Fresh permitted source samples, exact attribution, links/holds and candidate arithmetic | Existing source permissions/consent/quota |
| S4 | Exact selection and cart/handoff | Fresh identity/stock/price, independent readback, uncertainty and cancellation tests | S1–S3; seller capability determines real versus simulated |
| S5 | Final quote and PayPal sandbox adapter | Quote-bound approval, create/return/capture/unknown/cancel tests; separately genuine buyer sandbox evidence | S4 and explicit test-payment authorization |
| S6 | Native Android transfer | Main/worker delegation, real browser navigation, blocked page handoff, restore and receipt screenshots | Explicit test device/AVD and required Android permissions |

S1 must cover Java native dispatch as well as TypeScript wrappers: removing a tool name from a prompt does not constrain a general shell. Prefer removing unrestricted shell from shopping sessions unless a narrowly scoped capability broker can enforce destination/action authority. Arbitrary shell cannot be made safe merely by a command-string denylist. Remote MCP and nested workers must receive only session-scoped capabilities. General-assistant mode, if retained, needs an explicit separate mode and permission boundary.

## Proposed data contracts and flexibility

The following are proposed contracts, not implemented features. Money uses integer minor units; quantities and measurements carry explicit units. Requirements with unknown facts are not silently false or true.

```typescript
type Requirement = {
  id: string;
  attribute: string;                  // brand, RAM, ANC, width, material, etc.
  operator: 'eq' | 'in' | 'not-in' | 'gte' | 'lte' | 'contains';
  value: string | number | string[];
  unit?: string;
  strength: 'required' | 'preferred';
  origin: { userMessageId: string; originalText: string };
};
type ConstraintPatch = {
  expectedRevision: number;
  userMessageId: string;
  add: Requirement[];
  replace: Array<{ id: string; value: Requirement }>;
  remove: string[];
};
type Fact = {
  value: unknown;
  state: 'observed' | 'crosschecked' | 'conflict' | 'unknown';
  evidenceIds: string[];
};
type ActionDecision = {
  status: 'allow' | 'hold' | 'handoff';
  reasons: string[];
  constraintRevision: number;
  evidenceRevision: number;
  expiresAt: string;
  capabilityToken?: string;          // bounded action authority, never model-created
};
```

The ledger validates revision, field types, units and user provenance; it does not require the user to use structured syntax. The model can express arbitrary product attributes and propose conversational changes. Unsupported attributes remain available for explanation and further research, but cannot be claimed as verified matches without source evidence. Hard alternatives such as “Sony or JBL only” use a set; “Sony/JBL preferred” stays a soft set. Brand, model, seller, variant and pack contents are distinct fields. “Quantity2 packs of10” is two purchased units containing20 items, not quantity20 packs.

Confidence is not a substitute for evidence. An observed claim from a seller can support “the page says”; authenticity, stock conflict resolution and a final checkout total require the appropriate independent/source-specific checks. Claims about current cart contents always require cart readback, including a claim that it is empty.

### Action protocol

1. Pocket proposes `research`, `compare`, `refresh`, `prepare_cart`, `handoff`, `request_quote_review` or `request_test_payment` with session/revision/offer/quantity and an idempotency key.
2. The trusted service resolves evidence and permissions, calculates totals and returns allow/hold/handoff. An allow token is bound to session, user, exact action, offer/variant, quantity, revisions, destination and expiry. Price or quantity changes invalidate it. Server/native state owns authority; a model-supplied boolean cannot grant it.
3. Native dispatch and the remote merchant adapter both verify the required capability immediately before the mutation. A worker cannot widen parent permissions. Batch calls validate every member. A schedule stores a restricted intent and must obtain appropriate fresh approval when it runs.
4. Independent readback produces a receipt or unknown outcome. Unknown cannot be upgraded by a successful tap, natural-language claim or unrelated operation ID.
5. Only a real user UI action approves the exact final quote. PayPal secrets stay backend-only. Sandbox approval/capture and simulated merchant fulfilment remain separate states in the UI and ledger.

Chat remains open and expressive. Read-only reasoning and comparisons do not repeatedly prompt for approval. Material ambiguity, access blockers, selection ambiguity and consequential actions trigger the relevant clarification or review. A regular-price listing is valid without a discount. Source access and payment consents are separate from ordinary preferences.

## Concrete implementation map

All paths below are relative to their named checkout. No entry claims integration is already implemented.

| Area | Existing seam / proposed module | Change |
| --- | --- | --- |
| Pocket conversational role | `runtime/src/prompts.ts` | Add a shopping role after baseline, preserving the model's flexible reasoning and unknown-evidence guidance; no fixed SKU requirement |
| Pocket session ledger | Proposed `runtime/src/shopping-session.ts`, app `StateStore.java` | Typed revisions, constraints, shortlist/evidence IDs, selection, interrupted states; encrypted credentials remain separate |
| Effect enforcement | `runtime/src/tools.ts`, `runtime/src/runtime.ts`, app `NativeTools.java` and `ShellTerminal.java` | Scope main/workers/batch/autonomy/native dispatch; remove raw shell from shopping tool grants and reject it natively in that mode |
| Verifier service bridge | `runtime/src/mcp.ts` or proposed authenticated shopping bridge | Expose bounded verification/action tools, not arbitrary endpoints or server secrets; current MCP authentication supports configured headers/bearer rather than OAuth |
| Existing DealPilot research | `src/api/agent/real-chat-research.ts`: `researchRealOffers`, `refreshRealOffer` | Consider a narrow tool facade for consented permitted sources; preserve existing quota/source/market limitations |
| Existing evidence checks | `src/api/retailer-page-inspector.ts`: `inspectRetailerHtml`; `src/api/retailer-source-crosscheck.ts`: `crosscheckRetailerPages`; `src/shared/source-identity.ts` | Selectively reuse identity/price/stock/pack checks when source capabilities support them. Never accept model-authored extracted facts as an independently verified capture |
| Existing seller cart paths | `src/api/retailer-checkout.ts`: `prepareRetailerCart`, `previewRetailerProduct` | Reuse supported exact-identity plans/handoffs with independent seller-cart readback. Unsupported sellers use explicitly simulated cart/handoff |
| Existing source-informed checkout | `src/api/agent/real-shopping-session.ts`, `src/shared/real-shopping.ts` | Reuse exact-cart hash/expiry/payment state ideas and genuine sandbox adapter contracts without delegating conversation interpretation back to a second chatbot |
| UI and Android transfer | `preview/native-app.js`, `PocketWebUi.java`, `OperationStore.java` | In-chat comparison, provenance and holds, visible takeover page, final quote review and truthful order/sandbox receipt |

Do not copy the current closed `RealNeeds` store/currency/category schema as the universal mobile request schema. Adapt supported backend tools to extensible mobile requirements and return explicit unsupported/unknown results. Current INR payment is unsupported without a separately designed explicit conversion contract; do not silently convert. Existing merchant signatures and access acceptance gaps remain genuine blockers.

Keep local development services loopback/private. Android localhost differs from Windows localhost; configure a deliberate development bridge (for example a scoped ADB reverse arrangement for a local native bridge). Existing remote MCP requires HTTPS; do not remove that requirement to make a demo connect. A future deployed bridge requires authentication, per-session authorization and durable quotas before becoming publicly reachable.

## Evidence-driven integration decision

Use [the baseline report](SHOPPING-CAPABILITY-RESULTS-2026-11-01.md) for the measured decision. The preferred implementation is Pocket's own reasoning plus a small authority/evidence contract. Keep the full DealPilot validation engine **unintegrated for now**. Reuse a narrow verifier in a shadow comparison next only when its source-specific checks fill a measured gap. Shadow mode records disagreements and may not grant a purchase capability. Freeze new permitted-source cases before comparing; distinguish extraction errors, missing evidence, wrong constraints and access limitations. Only promote modules that improve relevant criteria without reducing source/consent/unknown-outcome protections.

The baseline has no device/browser evidence to establish seller discovery completeness or exact real-cart readback. S6 is required before claiming the phone can complete those portions end to end. Existing model behavior passing examples does not make the proposed new capability gates optional.

## Implementation boundaries

This task adds evaluation tooling and a detailed plan, not shopping runtime integration. Keep upstream prompts, model choice, retailer permissions and payment behavior unchanged during measurement. No weight training, real order, paid API fallback, remote push, publication or Phase3 resumption. Historical bars stay Phase1 50/50→50/50 (+0), automated Phase2 40/40→40/40 (+0), Phase3 3/10→3/10 (+0), total93/100→93/100 (+0).
