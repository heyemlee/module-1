# AI intake assistant — placement in the Round 1 workspace

> Decision record from a 6-lens architecture debate (sales rep · customer · showroom manager · shipping · architecture · risk), Stage 2 openings → Stage 3 code-verified rebuttal → Stage 4 devil's advocate. 2026-06-24.

The debate **reversed its own draft recommendation.** The draft said "upgrade the overlay (#4) to a push panel (#5)." Code-checking falsified the premise behind push, and the conclusion flipped to **ship the overlay, reject push** — then the devil's advocate exposed a desktop-only assumption that the survivors all share.

## Contested questions
- **Q1.** Is "the form stays visible while the assistant is open" a hard requirement (killing tab #2 and picker #3), or nice-to-have?
- **Q2.** When open: OVERLAY content (#4), PUSH/replace the preview column (#5), or PERSISTENT column (#6)?
- **Q3.** Optional/off-by-default (toggle) vs always-present ("常驻")?
- **Q4.** One uniform placement for all 4 steps, or step-dependent (the form's column swaps on Adjust Positions)?
- **Q5.** Ship the current overlay drawer (#4) as-is, or invest in the push refinement (#5)?

(Placements: #1 floating FAB · #2 inspector tab [Form|AI] · #3 entry mode picker · #4 right overlay drawer [current] · #5 right push panel · #6 persistent 4th column · #7 bottom dock · #8 embedded inspector section.)

## Unanimous — adopt directly
- **Q1 → YES, hard requirement (on desktop).** Why: the AI mis-extracts (measured — gpt-4o-mini fabricated dimensions; "window exists, wall unknown" → set status UNKNOWN), and a schema-valid fabricated `216"` is indistinguishable from a measured one downstream with no later backstop. Reviewing a patch against a hidden form is structurally impossible. This **kills the inspector tab (#2) and the entry mode picker (#3)** — both make form and assistant mutually-exclusive views. (Caveat: see the mobile conflict — the gate is *unsatisfiable* on a single-column screen.)
- **Q3 → optional, off by default.** Why: `ai_ctx.md` frames the agent as "OPTIONAL" and mandates graceful degradation when no `LLM_PROVIDER` (the panel renders a "Not configured" card); the customer lens hardened this — a persistent/always-on AI guarantees the AI is on screen during the customer-facing plan reveal, which it must never be; veterans route around a forced AI. `assistantOpen` defaults `false` — correct.
- **Reject #6 (persistent 4th column):** unanimous. It permanently re-templates the already-tight `[176px | 1fr | 480px]` grid for a feature that's off by default and used by a minority — inverting cost and value.

## Majority — adopt with noted dissent
- **Q2 → OVERLAY (#4).** Why (code-verified): on the three capture steps `isFormInMiddle` puts the form in the center `canvas` column and the floor-plan preview in the right 480px `inspector`; the `fixed right-0 w-[min(92vw,400px)]` overlay covers only the **preview**, not the form (≈80px gap @1280px). It is non-destructive — close it and the grid is byte-identical, zero reflow. Push (#5) is both costlier (the form *already* occupies the inspector slot on Adjust Positions → a genuine slot collision, ~6–10 line diff + a special-case, not "one more ternary case") and *functionally worse* (destroys the preview, reflows columns = "the room rebuilding itself around a chatbot").
  - **Dissent (devil's advocate):** the overlay is desktop-only; on tablet/narrow-laptop it covers the form — there a *layout-tracking* placement (push, or even a tab on mobile) would be correct. See conflict below.
- **Q5 → SHIP #4, defer #5.** Why: the rework trades a working, non-destructive drawer for a jankier costlier one that is "structurally purer but functionally worse." Both push champions (architecture, risk) **withdrew** after reading the code. Dissent: same responsive concern.

## Conflicts → resolution
- **Q4 (uniform vs step-dependent).**
  Positions: customer + shipping → strictly uniform (a moving control = rep fumbling = lost trust / two step-machines = bugs); risk + architecture + rep → step-dependent (risk is step-dependent; one rule + an exception).
  **Resolution: uniform ENTRY POINT (the "AI assistant" button stays in the same bar spot on every step) + ONE behavioral exception on Adjust Positions (step 2)** — hide/suppress the assistant there. Won by: shipping and architecture *independently* proposing a `step !== 2` guard (on that step the form swaps into the right inspector so the overlay would occlude it, **and** there are no extractable fields). The customer's "don't move the button" is satisfied by the uniform entry; the exception is behavioral, not a relocation.
  Counter-argument rejected: "strictly uniform everywhere" — rejected because step 2 is a real collision, not a taste call.

- **THE BIG ONE — the responsive / mobile hole (surfaced at Stage 4).**
  Positions: the Stage-3 consensus proved "form stays visible" at **1280px** and generalized it. The devil's advocate verified the breakpoints (`round1-workspace-shell.tsx:37-44`: `grid-cols-1` < 768, single column 768–1279, three columns only at `xl` ≥1280): **below 1280px there is no right preview column** — the form is full-width and the `min(92vw,400px)` overlay covers 39% (iPad landscape) → 52% (iPad portrait) → 92% (phone) of it. The proposed `width ≤ 480px` regression test is **meaningless on mobile** (no 480px column to bound).
  **Resolution:** the overlay is correct on **≥1280px (a maximized showroom monitor — the intended primary display)**, but the placement needs a **responsive treatment below `xl`**: render the assistant as a **bottom-sheet / full-width sheet** (reusing the existing `max-md` inspector-as-bottom-sheet pattern) rather than a right overlay that covers a single-column form. And accept the device constraint: **on one column you cannot show form + AI simultaneously** — Q1's "see it live" relaxes to **"type-then-review"** on small screens. That is a hardware limit, not a fixable bug.
  Won by: the devil's advocate's cross-breakpoint geometry (the only analysis that didn't assume desktop).

## Sharpened points (the debate's real yield)
1. **Draft "push (#5)" → "ship overlay (#4)."** Code-checking killed push's load-bearing premise: the overlay *already* meets form co-visibility on desktop (form center, overlay over the preview), so push's whole justification evaporated, leaving it "purer but worse + a step-2 collision."
2. **Q1: "form visible = universal hard requirement" → "hard on desktop, unsatisfiable on single-column mobile."** The requirement is real but **device-bounded**; mobile is inherently type-then-review.
3. **Customer's hard requirement: "never occlude the plan" (false — every placement hides the preview when open) → "the AI must be ABSENT during the customer-facing review."** The requirement is **temporal, not spatial** — satisfied by off-by-default + easy ✕ dismissal + no persistent presence.
4. **The `step !== 2` guard: "a small fix" → "a symptom that a viewport-`fixed` overlay doesn't track the logical right pane"** — the same reason it breaks on mobile. Acceptable on desktop; it's the seam to watch.

## Minority report
**The adoption / "feature could be moot" view (devil's advocate, steelmanning the original push camp + sales-rep-adoption):** off-by-default + an overlay that covers half the form on a tablet risks **zero adoption** — mooting the whole agent + eval investment. If real showroom hardware turns out to be **tablets / small laptops** rather than maximized ≥1280px monitors, the overlay is the *wrong* primitive and the right answer flips to a **layout-tracking placement (push #5, or a tab on mobile)** and possibly **default-on**. This is the line to revisit first if adoption is poor or the floor uses tablets — it was overridden only by the (unstated, load-bearing) assumption that intake happens on a large maximized display.

## Build sequence
1. **Keep the current right overlay (#4), off by default, toggled from the project bar — validated, no change** on desktop.
2. **Add the `step !== 2` guard:** hide/suppress (or auto-close) the assistant on Adjust Positions.
3. **Add the responsive treatment:** below `xl` (1280px), render the assistant as a bottom-sheet / full-width sheet (reuse the `max-md` pattern), not a right overlay over the single-column form. Document that "see the form fill live" is a desktop affordance; mobile is type-then-review.
4. **Fix the test:** the `width ≤ 480px` assertion is desktop-only and false-comforting on mobile — replace with a responsive assertion (or explicitly scope + document it), and add a test that the assistant is hidden on step 2.
5. **Confirm easy/complete dismissal** (✕ + off-by-default) so the AI is never on screen during the customer-facing review — already satisfied.
6. **Validate the load-bearing assumption:** confirm showroom hardware is maximized ≥1280px displays. If it's tablets, re-open the minority report.
