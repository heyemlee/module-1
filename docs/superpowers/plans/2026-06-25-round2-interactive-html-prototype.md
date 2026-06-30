# Round 2 Interactive HTML Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a standalone interactive HTML prototype that demonstrates the approved Round 2 workflow from measurement entry through final review.

**Architecture:** Build one dependency-free HTML file with embedded CSS and JavaScript. The prototype uses local in-memory UI state, semantic buttons and forms, and representative fixtures; it does not call APIs or an LLM.

**Tech Stack:** HTML5, CSS custom properties, vanilla JavaScript, Codex in-app Browser.

---

### Task 1: Build the standalone workflow prototype

**Files:**
- Create: `docs/prototypes/round2-flow-prototype.html`

- [x] **Step 1: Define the interaction acceptance checks**

Verify manually in the browser that:

1. The entry screen offers `Enter measurement data` as the primary action.
2. `Upload evidence to prefill` opens a supported-evidence panel.
3. Upload simulation prefills standard fields and marks them `AI pending`.
4. Skipping upload reaches the same measurement workspace.
5. The measurement workspace shows a data checklist, current form, and completion summary.
6. Confirming AI values changes their status and updates completion.
7. Missing required values block proposal generation.
8. Completing required values enables proposal generation.
9. The design proposal supports one structured correction and deterministic checks.
10. Drawings and review show contextual issues, source labels, and final review state.

- [x] **Step 2: Implement semantic HTML and the Studio visual system**

Create a single document with:

- Three-task navigation: Measurement data, Design proposal, Drawings and review
- Responsive three-panel measurement workspace
- Inline AI provenance and confirmation controls
- System-check, AI-evidence-alert, and designer-comment treatments
- Prototype notice and non-persistence messaging

- [x] **Step 3: Implement local interaction state**

Add vanilla JavaScript for:

- Entry/upload route selection
- Upload processing simulation
- Measurement category selection
- AI value confirmation
- Required-field completion
- Proposal generation and structured cabinet correction
- Drawing generation
- Contextual issue resolution
- Final review
- Prototype reset

- [x] **Step 4: Verify in the in-app Browser**

Open the prototype at desktop width, execute all ten acceptance checks, inspect the final visual state, and confirm the browser console contains no errors.
