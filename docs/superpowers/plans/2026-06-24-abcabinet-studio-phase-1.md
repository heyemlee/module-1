# ABCabinet Studio Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared Studio visual foundation and convert Round 1 into a responsive dual-mode canvas workspace without changing its domain behavior, routes, persistence, or API contracts.

**Architecture:** Add semantic Studio tokens and reusable primitives first, then isolate workspace mode and layout behavior in focused client components. Keep `ShowroomIntakeApp` as the owner of Round 1 business state while moving shell, mode switching, inspector layout, and responsive presentation into smaller components. Use Motion only for layout continuity and feedback; retain existing GSAP entry behavior only where it does not control the same elements.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 3, Motion 12, Radix UI, Vitest, React server rendering tests

---

## Scope Boundary

This plan implements only Phase 1 from the approved design specification:

- Studio theme tokens and typography
- Shared authenticated shell foundations
- Studio buttons, inputs, statuses, and skeleton styling
- Round 1 Guided and Canvas focus modes
- Persistent mode preference
- Canvas-first responsive layout
- iPad landscape and portrait inspector behavior
- Round 1 interaction, loading, stale, error, and success presentation
- Reduced-motion behavior

The project dashboard, project detail, new-project form, login, renderings gallery, and admin pages remain functionally unchanged except where they inherit safe global tokens. They receive dedicated later plans.

## File Map

### Create

- `src/features/platform/studio-shell.tsx`  
  Shared left application rail and compact project utility bar.

- `src/features/platform/studio-shell.test.tsx`  
  Static contract tests for navigation visibility and admin-only items.

- `src/features/round1/workspace-mode.ts`  
  Pure mode type, storage key, parsing, and initial-mode rules.

- `src/features/round1/workspace-mode.test.ts`  
  Pure unit tests for safe persistence behavior.

- `src/features/round1/workspace-mode-switch.tsx`  
  Accessible Guided and Canvas focus segmented control.

- `src/features/round1/workspace-mode-switch.test.tsx`  
  Static markup and callback contract tests.

- `src/features/round1/round1-workspace-shell.tsx`  
  Responsive desktop and iPad layout boundary for navigation, canvas, and inspector.

- `src/features/round1/round1-workspace-shell.test.tsx`  
  Markup tests for mode-specific layout contracts and inspector semantics.

- `src/features/round1/round1-step-navigation.tsx`  
  Step progress presentation for expanded, compact, and top-strip variants.

- `src/features/round1/round1-step-navigation.test.tsx`  
  Tests for completed, current, available, and locked state output.

- `src/features/round1/round1-inspector.tsx`  
  Stable inspector header, scrolling body, contextual suggestion, and footer actions.

- `src/features/round1/round1-feedback.tsx`  
  Save, stale, generation, failure, and completion feedback primitives.

### Modify

- `src/app/globals.css`  
  Replace mixed legacy styling with semantic Studio tokens, focus rules, motion rules, and retained compatibility aliases.

- `src/app/layout.tsx`  
  Remove serif font dependencies and use the system sans-serif stack.

- `tailwind.config.ts`  
  Map Tailwind semantic colors to Studio CSS variables.

- `src/components/ui/button.tsx`  
  Add Studio variants and tactile feedback.

- `src/components/ui/input.tsx`  
  Add dark-shell and light-inspector field variants through semantic tokens.

- `src/components/ui/checkbox.tsx`  
  Replace hand-authored SVG indicators with Radix icons and Studio focus styling.

- `src/features/platform/platform-header.tsx`  
  Keep a compatibility export while delegating authenticated layout to `StudioShell` where adopted.

- `src/features/platform/route-skeleton.tsx`  
  Add Studio shell and content-shaped skeleton variants without generic spinners.

- `src/features/round1/showroom-intake-app.tsx`  
  Integrate workspace mode, Studio shell, new step navigation, inspector, and feedback components while preserving state ownership.

- `src/features/round1/showroom-intake-controls.tsx`  
  Convert fields and panels to semantic Studio components; remove Lucide usage.

- `src/features/round1/showroom-intake-panels.tsx`  
  Adopt feedback primitives and remove one-off rendering button effects.

- `src/features/round1/layout-preview.tsx`  
  Apply Studio canvas colors, selection states, touch sizing, and mode-aware chrome.

- `src/features/round1/ghost-loader.css`  
  Replace perpetual decorative animation with a reduced-motion-safe content skeleton.

- `src/features/round1/showroom-intake-app.test.tsx`  
  Add integration contracts for the mode switch and stable workflow copy.

- `src/features/round1/layout-preview.test.tsx`  
  Update color contracts and add accessible drag-state assertions.

## Task 1: Establish Studio Tokens and Typography

**Files:**

- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `tailwind.config.ts`
- Test: `src/features/platform/studio-shell.test.tsx`

- [ ] **Step 1: Write a failing token contract test**

Create `src/features/platform/studio-shell.test.tsx`:

```tsx
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("Studio design tokens", () => {
  test("defines the approved one-accent Studio palette", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain("--studio-void: #0b120f");
    expect(css).toContain("--studio-action: #9fcdb1");
    expect(css).toContain("--studio-danger: #e66d63");
    expect(css).toContain("--studio-radius-panel: 12px");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  test("does not load the retired serif product fonts", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");

    expect(layout).not.toContain("Playfair_Display");
    expect(layout).not.toContain("Instrument_Serif");
  });
});
```

- [ ] **Step 2: Run the test and verify the contract fails**

Run:

```bash
npx vitest run src/features/platform/studio-shell.test.tsx
```

Expected: FAIL because the Studio token names do not exist and the serif imports are still present.

- [ ] **Step 3: Replace the root token block and base typography**

At the top of `src/app/globals.css`, retain the Tailwind directives and replace the current `:root`, `body`, `.app-page`, `.app-panel`, and `.app-panel-flat` definitions with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
  --studio-void: #0b120f;
  --studio-shell: #111b16;
  --studio-surface: #17241e;
  --studio-raised: #1d2d25;
  --studio-ink: #edf2ee;
  --studio-muted: #9aa79f;
  --studio-quiet: #6e7c74;
  --studio-line: rgba(231, 239, 233, 0.1);
  --studio-line-strong: rgba(231, 239, 233, 0.18);
  --studio-action: #9fcdb1;
  --studio-action-strong: #78b895;
  --studio-action-ink: #102019;
  --studio-paper: #eef1ec;
  --studio-paper-muted: #dfe5df;
  --studio-paper-ink: #18251f;
  --studio-danger: #e66d63;
  --studio-warning: #d8ae69;
  --studio-success: #9fcdb1;
  --studio-radius-panel: 12px;
  --studio-radius-control: 8px;
  --studio-radius-small: 6px;
  --studio-shadow-raised: 0 24px 64px rgba(3, 9, 6, 0.32);

  /* Compatibility aliases for components not yet migrated in Phase 1. */
  --app-bg: var(--studio-void);
  --app-surface: var(--studio-shell);
  --app-surface-muted: var(--studio-surface);
  --app-ink: var(--studio-ink);
  --app-muted: var(--studio-muted);
  --app-quiet: var(--studio-quiet);
  --app-border: var(--studio-line);
  --app-border-strong: var(--studio-line-strong);
  --app-blue: var(--studio-action);
  --app-blue-soft: rgba(159, 205, 177, 0.1);
  --app-green: var(--studio-success);
  --app-green-soft: rgba(159, 205, 177, 0.1);
  --app-amber: var(--studio-warning);
  --app-amber-soft: rgba(216, 174, 105, 0.12);
  --app-red: var(--studio-danger);
  --app-red-soft: rgba(230, 109, 99, 0.12);
  --app-radius: var(--studio-radius-control);
  --app-shadow: var(--studio-shadow-raised);
}

* {
  box-sizing: border-box;
}

html {
  min-width: 320px;
  background: var(--studio-void);
}

body {
  margin: 0;
  background: var(--studio-void);
  color: var(--studio-ink);
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "SF Pro Text",
    "Segoe UI",
    "PingFang SC",
    "Microsoft YaHei",
    Arial,
    sans-serif;
  font-feature-settings: "kern", "tnum";
  text-rendering: optimizeLegibility;
}

button,
input,
select,
textarea {
  font: inherit;
}

::selection {
  background: rgba(159, 205, 177, 0.32);
  color: var(--studio-ink);
}

.app-page {
  min-height: 100dvh;
  background: var(--studio-void);
  color: var(--studio-ink);
}

.app-panel,
.app-panel-flat {
  border: 1px solid var(--studio-line);
  border-radius: var(--studio-radius-panel);
  background: var(--studio-shell);
  color: var(--studio-ink);
}

.app-panel {
  box-shadow: var(--studio-shadow-raised);
}

.app-muted {
  color: var(--studio-muted);
}

:focus-visible {
  outline: 2px solid var(--studio-action);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Leave unrelated legacy selectors below this block temporarily. They are removed in Task 8 after all Round 1 references are migrated.

- [ ] **Step 4: Remove serif font loading from the root layout**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ABCabinet Studio",
  description: "Cabinet project intake, spatial planning, and concept rendering"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Map Tailwind semantic colors to CSS variables**

Extend `theme.extend` in `tailwind.config.ts` with:

```ts
colors: {
  studio: {
    void: "var(--studio-void)",
    shell: "var(--studio-shell)",
    surface: "var(--studio-surface)",
    raised: "var(--studio-raised)",
    ink: "var(--studio-ink)",
    muted: "var(--studio-muted)",
    quiet: "var(--studio-quiet)",
    action: "var(--studio-action)",
    "action-strong": "var(--studio-action-strong)",
    "action-ink": "var(--studio-action-ink)",
    paper: "var(--studio-paper)",
    "paper-muted": "var(--studio-paper-muted)",
    "paper-ink": "var(--studio-paper-ink)",
    line: "var(--studio-line)",
    "line-strong": "var(--studio-line-strong)",
    danger: "var(--studio-danger)",
    warning: "var(--studio-warning)",
    success: "var(--studio-success)"
  }
},
borderRadius: {
  "studio-panel": "var(--studio-radius-panel)",
  "studio-control": "var(--studio-radius-control)",
  "studio-small": "var(--studio-radius-small)"
}
```

Do not remove existing shadcn-compatible semantic tokens if they are already declared elsewhere in the config.

- [ ] **Step 6: Run token tests and type-check**

Run:

```bash
npx vitest run src/features/platform/studio-shell.test.tsx
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit the foundation**

```bash
git add src/app/globals.css src/app/layout.tsx tailwind.config.ts src/features/platform/studio-shell.test.tsx
git commit -m "feat: add ABCabinet Studio design tokens"
```

## Task 2: Build Studio Controls and Feedback States

**Files:**

- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/checkbox.tsx`
- Create: `src/features/round1/round1-feedback.tsx`
- Create: `src/features/round1/round1-feedback.test.tsx`

- [ ] **Step 1: Write failing feedback component tests**

Create `src/features/round1/round1-feedback.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Round1Feedback } from "./round1-feedback";

describe("Round1Feedback", () => {
  test("renders saved state as a polite status", () => {
    const html = renderToStaticMarkup(
      <Round1Feedback state="saved" message="Saved just now" />
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("Saved just now");
    expect(html).toContain('data-feedback-state="saved"');
  });

  test("renders failures as alerts", () => {
    const html = renderToStaticMarkup(
      <Round1Feedback state="error" message="Rendering failed" />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Rendering failed");
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run:

```bash
npx vitest run src/features/round1/round1-feedback.test.tsx
```

Expected: FAIL because `round1-feedback.tsx` does not exist.

- [ ] **Step 3: Add Studio button variants and tactile states**

Update the base classes and variants in `src/components/ui/button.tsx`:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-studio-control text-[13px] font-semibold outline-none transition-[transform,background-color,border-color,color,opacity] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-studio-action focus-visible:ring-offset-2 focus-visible:ring-offset-studio-void disabled:pointer-events-none disabled:opacity-45 motion-safe:hover:-translate-y-px motion-safe:active:translate-y-px motion-safe:active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-studio-action text-studio-action-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.34)] hover:bg-[#add7bd]",
        destructive:
          "bg-studio-danger text-[#2b0d0a] hover:bg-[#ef7d73]",
        outline:
          "border border-studio-line-strong bg-transparent text-studio-ink hover:bg-white/[0.05]",
        secondary:
          "bg-studio-surface text-studio-ink hover:bg-studio-raised",
        inspector:
          "border border-[#bdc7c0] bg-white text-studio-paper-ink hover:bg-[#f7f9f7]",
        ghost:
          "bg-transparent text-studio-muted hover:bg-white/[0.05] hover:text-studio-ink",
        link:
          "text-studio-action underline-offset-4 hover:underline"
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5",
        icon: "size-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
```

Add `aria-busy` styling support to the returned component:

```tsx
<Comp
  className={cn(
    buttonVariants({ variant, size, className }),
    props["aria-busy"] && "cursor-wait"
  )}
  ref={ref}
  {...props}
/>
```

- [ ] **Step 4: Convert Input to Studio semantic styling**

Replace the class list in `src/components/ui/input.tsx` with:

```tsx
"flex h-10 w-full rounded-studio-control border border-studio-line-strong bg-studio-surface px-3 py-2 text-[13px] text-studio-ink shadow-none outline-none transition-[border-color,box-shadow,background-color] placeholder:text-studio-quiet focus-visible:border-studio-action focus-visible:ring-2 focus-visible:ring-studio-action/20 disabled:cursor-not-allowed disabled:opacity-50"
```

Add a data-driven inspector appearance:

```tsx
"data-[surface=inspector]:border-[#c5cec7] data-[surface=inspector]:bg-white data-[surface=inspector]:text-studio-paper-ink data-[surface=inspector]:placeholder:text-[#718077]"
```

The caller can opt in with `data-surface="inspector"`.

- [ ] **Step 5: Replace custom checkbox paths with Radix icons**

In `src/components/ui/checkbox.tsx`, import:

```tsx
import { CheckIcon, MinusIcon } from "@radix-ui/react-icons";
```

Use this root styling:

```tsx
"peer size-5 shrink-0 rounded-studio-small border border-studio-line-strong bg-studio-surface text-studio-action-ink outline-none transition-colors focus-visible:ring-2 focus-visible:ring-studio-action focus-visible:ring-offset-2 focus-visible:ring-offset-studio-void disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-studio-action data-[state=checked]:bg-studio-action data-[state=indeterminate]:border-studio-action data-[state=indeterminate]:bg-studio-action"
```

Replace the hand-authored SVG branch with:

```tsx
<CheckboxPrimitive.Indicator className="flex items-center justify-center">
  {props.checked === "indeterminate" ? (
    <MinusIcon className="size-3.5" />
  ) : (
    <CheckIcon className="size-3.5" />
  )}
</CheckboxPrimitive.Indicator>
```

- [ ] **Step 6: Implement the reusable Round 1 feedback primitive**

Create `src/features/round1/round1-feedback.tsx`:

```tsx
import {
  CheckCircledIcon,
  ClockIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
  ReloadIcon
} from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";

export type Round1FeedbackState =
  | "saving"
  | "saved"
  | "stale"
  | "generating"
  | "success"
  | "error";

const stateStyles: Record<Round1FeedbackState, string> = {
  saving: "text-studio-muted",
  saved: "text-studio-action",
  stale: "text-studio-warning",
  generating: "text-studio-muted",
  success: "text-studio-action",
  error: "text-studio-danger"
};

function FeedbackIcon({ state }: { state: Round1FeedbackState }) {
  const className = cn(
    "size-3.5 shrink-0",
    (state === "saving" || state === "generating") &&
      "motion-safe:animate-spin"
  );

  if (state === "saved" || state === "success") {
    return <CheckCircledIcon className={className} aria-hidden />;
  }
  if (state === "stale") {
    return <ExclamationTriangleIcon className={className} aria-hidden />;
  }
  if (state === "error") {
    return <CrossCircledIcon className={className} aria-hidden />;
  }
  if (state === "saving") {
    return <ClockIcon className={className} aria-hidden />;
  }
  return <ReloadIcon className={className} aria-hidden />;
}

export function Round1Feedback({
  state,
  message,
  className
}: {
  state: Round1FeedbackState;
  message: string;
  className?: string;
}) {
  const isError = state === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      data-feedback-state={state}
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 text-[11px] font-medium",
        stateStyles[state],
        className
      )}
    >
      <FeedbackIcon state={state} />
      <span>{message}</span>
    </div>
  );
}
```

- [ ] **Step 7: Run focused tests and type-check**

Run:

```bash
npx vitest run src/features/round1/round1-feedback.test.tsx
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit Studio controls**

```bash
git add src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/checkbox.tsx src/features/round1/round1-feedback.tsx src/features/round1/round1-feedback.test.tsx
git commit -m "feat: add Studio controls and feedback states"
```

## Task 3: Add Workspace Mode Persistence and Accessible Switching

**Files:**

- Create: `src/features/round1/workspace-mode.ts`
- Create: `src/features/round1/workspace-mode.test.ts`
- Create: `src/features/round1/workspace-mode-switch.tsx`
- Create: `src/features/round1/workspace-mode-switch.test.tsx`

- [ ] **Step 1: Write failing pure-mode tests**

Create `src/features/round1/workspace-mode.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  DEFAULT_WORKSPACE_MODE,
  parseWorkspaceMode,
  workspaceModeStorageKey
} from "./workspace-mode";

describe("workspace mode", () => {
  test("defaults new sessions to guided mode", () => {
    expect(DEFAULT_WORKSPACE_MODE).toBe("guided");
  });

  test("accepts only supported stored values", () => {
    expect(parseWorkspaceMode("guided")).toBe("guided");
    expect(parseWorkspaceMode("canvas")).toBe("canvas");
    expect(parseWorkspaceMode("expanded")).toBe("guided");
    expect(parseWorkspaceMode(null)).toBe("guided");
  });

  test("uses a stable versioned storage key", () => {
    expect(workspaceModeStorageKey).toBe("abcabinet:round1:workspace-mode:v1");
  });
});
```

- [ ] **Step 2: Write failing switch markup tests**

Create `src/features/round1/workspace-mode-switch.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { WorkspaceModeSwitch } from "./workspace-mode-switch";

describe("WorkspaceModeSwitch", () => {
  test("exposes both modes as an accessible radio group", () => {
    const html = renderToStaticMarkup(
      <WorkspaceModeSwitch mode="guided" onModeChange={() => {}} />
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("Guided");
    expect(html).toContain("Canvas focus");
    expect(html).toContain('aria-checked="true"');
  });
});
```

- [ ] **Step 3: Verify both tests fail**

Run:

```bash
npx vitest run src/features/round1/workspace-mode.test.ts src/features/round1/workspace-mode-switch.test.tsx
```

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement the pure workspace-mode module**

Create `src/features/round1/workspace-mode.ts`:

```ts
export const workspaceModeStorageKey =
  "abcabinet:round1:workspace-mode:v1";

export type WorkspaceMode = "guided" | "canvas";

export const DEFAULT_WORKSPACE_MODE: WorkspaceMode = "guided";

export function parseWorkspaceMode(value: string | null): WorkspaceMode {
  return value === "canvas" || value === "guided"
    ? value
    : DEFAULT_WORKSPACE_MODE;
}
```

- [ ] **Step 5: Implement the accessible segmented control**

Create `src/features/round1/workspace-mode-switch.tsx`:

```tsx
"use client";

import { ColumnsIcon, ViewGridIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import type { WorkspaceMode } from "./workspace-mode";

const options: Array<{
  mode: WorkspaceMode;
  label: string;
  icon: typeof ColumnsIcon;
}> = [
  { mode: "guided", label: "Guided", icon: ColumnsIcon },
  { mode: "canvas", label: "Canvas focus", icon: ViewGridIcon }
];

export function WorkspaceModeSwitch({
  mode,
  onModeChange
}: {
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Workspace layout"
      className="inline-flex rounded-studio-control border border-studio-line bg-studio-void p-1"
    >
      {options.map((option) => {
        const selected = mode === option.mode;
        const Icon = option.icon;
        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onModeChange(option.mode)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-studio-small px-3 text-[11px] font-semibold outline-none transition-[background-color,color,transform] duration-200 focus-visible:ring-2 focus-visible:ring-studio-action motion-safe:active:scale-[0.98]",
              selected
                ? "bg-studio-action text-studio-action-ink"
                : "text-studio-quiet hover:bg-white/[0.05] hover:text-studio-ink"
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Run mode tests and type-check**

Run:

```bash
npx vitest run src/features/round1/workspace-mode.test.ts src/features/round1/workspace-mode-switch.test.tsx
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit workspace mode primitives**

```bash
git add src/features/round1/workspace-mode.ts src/features/round1/workspace-mode.test.ts src/features/round1/workspace-mode-switch.tsx src/features/round1/workspace-mode-switch.test.tsx
git commit -m "feat: add Round 1 workspace modes"
```

## Task 4: Build Step Navigation and Inspector Boundaries

**Files:**

- Create: `src/features/round1/round1-step-navigation.tsx`
- Create: `src/features/round1/round1-step-navigation.test.tsx`
- Create: `src/features/round1/round1-inspector.tsx`

- [ ] **Step 1: Write failing step-state tests**

Create `src/features/round1/round1-step-navigation.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Round1StepNavigation } from "./round1-step-navigation";

const steps = ["Room", "Openings", "Layout", "Appliances"] as const;

describe("Round1StepNavigation", () => {
  test("announces current, completed, available, and locked steps", () => {
    const html = renderToStaticMarkup(
      <Round1StepNavigation
        steps={steps}
        currentStep={1}
        maxAccessibleStep={2}
        variant="expanded"
        onStepChange={() => {}}
      />
    );

    expect(html).toContain('aria-current="step"');
    expect(html).toContain('data-step-state="completed"');
    expect(html).toContain('data-step-state="current"');
    expect(html).toContain('data-step-state="available"');
    expect(html).toContain('data-step-state="locked"');
  });

  test("uses the same labels in compact mode", () => {
    const html = renderToStaticMarkup(
      <Round1StepNavigation
        steps={steps}
        currentStep={2}
        maxAccessibleStep={2}
        variant="compact"
        onStepChange={() => {}}
      />
    );

    expect(html).toContain('aria-label="Room, completed"');
    expect(html).toContain('aria-label="Layout, current step"');
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run:

```bash
npx vitest run src/features/round1/round1-step-navigation.test.tsx
```

Expected: FAIL because the navigation component is missing.

- [ ] **Step 3: Implement step navigation with three visual variants**

Create `src/features/round1/round1-step-navigation.tsx` with:

```tsx
"use client";

import { CheckIcon, LockClosedIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";

type StepState = "completed" | "current" | "available" | "locked";
type StepNavigationVariant = "expanded" | "compact" | "strip";

function stepState(
  index: number,
  currentStep: number,
  maxAccessibleStep: number
): StepState {
  if (index < currentStep) return "completed";
  if (index === currentStep) return "current";
  if (index <= maxAccessibleStep) return "available";
  return "locked";
}

function stepAriaLabel(label: string, state: StepState) {
  if (state === "completed") return `${label}, completed`;
  if (state === "current") return `${label}, current step`;
  if (state === "locked") return `${label}, locked`;
  return `${label}, available`;
}

export function Round1StepNavigation({
  steps,
  currentStep,
  maxAccessibleStep,
  variant,
  onStepChange
}: {
  steps: readonly string[];
  currentStep: number;
  maxAccessibleStep: number;
  variant: StepNavigationVariant;
  onStepChange: (step: number) => void;
}) {
  return (
    <nav aria-label="Round 1 steps">
      <ol
        className={cn(
          variant === "expanded" && "grid gap-2",
          variant === "compact" && "grid justify-items-center gap-3",
          variant === "strip" &&
            "grid grid-flow-col auto-cols-fr gap-1 overflow-x-auto"
        )}
      >
        {steps.map((label, index) => {
          const state = stepState(index, currentStep, maxAccessibleStep);
          const disabled = state === "locked";
          return (
            <li key={label}>
              <button
                type="button"
                disabled={disabled}
                aria-current={state === "current" ? "step" : undefined}
                aria-label={stepAriaLabel(label, state)}
                data-step-state={state}
                onClick={() => {
                  if (!disabled) onStepChange(index);
                }}
                className={cn(
                  "group flex min-h-10 w-full items-center rounded-studio-control text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-studio-action disabled:cursor-not-allowed",
                  variant === "expanded" && "gap-3 px-3",
                  variant === "compact" && "size-10 justify-center px-0",
                  variant === "strip" &&
                    "min-w-[88px] justify-center px-2 text-center",
                  state === "current" &&
                    "bg-studio-action text-studio-action-ink",
                  state === "completed" &&
                    "bg-studio-surface text-studio-action",
                  state === "available" &&
                    "text-studio-muted hover:bg-white/[0.05] hover:text-studio-ink",
                  state === "locked" && "text-studio-quiet opacity-55"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                    state === "current" &&
                      "border-studio-action-ink/20 bg-studio-action-ink/10",
                    state === "completed" &&
                      "border-studio-action/30 bg-studio-action/10",
                    (state === "available" || state === "locked") &&
                      "border-current/25"
                  )}
                >
                  {state === "completed" ? (
                    <CheckIcon className="size-3" aria-hidden />
                  ) : state === "locked" ? (
                    <LockClosedIcon className="size-2.5" aria-hidden />
                  ) : (
                    index + 1
                  )}
                </span>
                {variant !== "compact" && (
                  <span className="truncate text-[11px] font-semibold">
                    {label}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

- [ ] **Step 4: Implement the stable inspector shell**

Create `src/features/round1/round1-inspector.tsx`:

```tsx
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Round1Inspector({
  title,
  description,
  children,
  suggestion,
  previousDisabled,
  continueDisabled,
  continueLabel = "Continue",
  onPrevious,
  onContinue,
  footerContent,
  className
}: {
  title: string;
  description?: string;
  children: ReactNode;
  suggestion?: ReactNode;
  previousDisabled: boolean;
  continueDisabled?: boolean;
  continueLabel?: string;
  onPrevious: () => void;
  onContinue?: () => void;
  footerContent?: ReactNode;
  className?: string;
}) {
  return (
    <aside
      aria-label={`${title} settings`}
      className={cn(
        "flex min-h-0 flex-col bg-studio-paper text-studio-paper-ink",
        className
      )}
    >
      <header className="border-b border-black/10 px-5 py-5">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em]">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 text-[12px] leading-5 text-[#607067]">
            {description}
          </p>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {children}
        {suggestion && (
          <section
            aria-label="Assistant suggestion"
            className="mt-5 rounded-studio-control bg-[#dfe9e1] p-3 text-[12px] leading-5"
          >
            {suggestion}
          </section>
        )}
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-black/10 bg-studio-paper px-5 py-4">
        <Button
          type="button"
          variant="inspector"
          disabled={previousDisabled}
          onClick={onPrevious}
        >
          Previous
        </Button>
        {footerContent ??
          (onContinue && (
            <Button
              type="button"
              disabled={continueDisabled}
              onClick={onContinue}
            >
              {continueLabel}
            </Button>
          ))}
      </footer>
    </aside>
  );
}
```

- [ ] **Step 5: Run step tests and type-check**

Run:

```bash
npx vitest run src/features/round1/round1-step-navigation.test.tsx
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit navigation and inspector**

```bash
git add src/features/round1/round1-step-navigation.tsx src/features/round1/round1-step-navigation.test.tsx src/features/round1/round1-inspector.tsx
git commit -m "feat: add Round 1 navigation and inspector shells"
```

## Task 5: Build the Responsive Dual-Mode Workspace Shell

**Files:**

- Create: `src/features/round1/round1-workspace-shell.tsx`
- Create: `src/features/round1/round1-workspace-shell.test.tsx`

- [ ] **Step 1: Write failing layout contract tests**

Create `src/features/round1/round1-workspace-shell.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Round1WorkspaceShell } from "./round1-workspace-shell";

describe("Round1WorkspaceShell", () => {
  test("marks guided mode with the expanded workspace contract", () => {
    const html = renderToStaticMarkup(
      <Round1WorkspaceShell
        mode="guided"
        projectBar={<div>Project</div>}
        stepNavigation={<div>Steps</div>}
        canvas={<div>Canvas</div>}
        inspector={<div>Inspector</div>}
      />
    );

    expect(html).toContain('data-workspace-mode="guided"');
    expect(html).toContain('data-workspace-region="steps"');
    expect(html).toContain('data-workspace-region="canvas"');
    expect(html).toContain('data-workspace-region="inspector"');
  });

  test("marks canvas focus mode without changing region order", () => {
    const html = renderToStaticMarkup(
      <Round1WorkspaceShell
        mode="canvas"
        projectBar={<div>Project</div>}
        stepNavigation={<div>Steps</div>}
        canvas={<div>Canvas</div>}
        inspector={<div>Inspector</div>}
      />
    );

    expect(html).toContain('data-workspace-mode="canvas"');
    expect(html.indexOf("Steps")).toBeLessThan(html.indexOf("Canvas"));
    expect(html.indexOf("Canvas")).toBeLessThan(html.indexOf("Inspector"));
  });
});
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npx vitest run src/features/round1/round1-workspace-shell.test.tsx
```

Expected: FAIL because the shell does not exist.

- [ ] **Step 3: Implement a transform-friendly responsive shell**

Create `src/features/round1/round1-workspace-shell.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import type { WorkspaceMode } from "./workspace-mode";

export function Round1WorkspaceShell({
  mode,
  projectBar,
  stepNavigation,
  canvas,
  inspector
}: {
  mode: WorkspaceMode;
  projectBar: ReactNode;
  stepNavigation: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] as const };

  return (
    <main
      data-workspace-mode={mode}
      className="min-h-[100dvh] bg-studio-void text-studio-ink"
    >
      <div className="sticky top-0 z-30 border-b border-studio-line bg-studio-shell/95 backdrop-blur-xl">
        {projectBar}
      </div>

      <div
        className={cn(
          "grid min-h-[calc(100dvh-56px)] grid-cols-1 bg-studio-void",
          "md:grid-cols-[minmax(0,1fr)]",
          mode === "guided"
            ? "xl:grid-cols-[176px_minmax(0,1fr)_320px]"
            : "xl:grid-cols-[56px_minmax(0,1fr)_320px]"
        )}
      >
        <motion.aside
          layout
          transition={transition}
          data-workspace-region="steps"
          className="hidden border-r border-studio-line bg-[#0e1713] p-3 xl:block"
        >
          {stepNavigation}
        </motion.aside>

        <motion.section
          layout
          transition={transition}
          data-workspace-region="canvas"
          className="relative min-h-[560px] min-w-0 overflow-hidden bg-studio-void p-3 md:min-h-[calc(100dvh-56px)]"
        >
          <div className="mb-3 xl:hidden">{stepNavigation}</div>
          {canvas}
        </motion.section>

        <motion.div
          layout
          transition={transition}
          data-workspace-region="inspector"
          className={cn(
            "min-h-0 border-studio-line",
            "max-xl:border-t",
            "xl:border-l",
            "max-md:sticky max-md:bottom-0 max-md:z-20 max-md:max-h-[52dvh] max-md:overflow-hidden max-md:rounded-t-[16px] max-md:shadow-[0_-20px_60px_rgba(0,0,0,0.34)]"
          )}
        >
          <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-black/25 md:hidden" />
          {inspector}
        </motion.div>
      </div>
    </main>
  );
}
```

The portrait iPad and narrow-tablet breakpoint uses the bottom inspector treatment. Do not add phone-only full editing behavior in this phase.

- [ ] **Step 4: Run workspace tests and type-check**

Run:

```bash
npx vitest run src/features/round1/round1-workspace-shell.test.tsx
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit the responsive shell**

```bash
git add src/features/round1/round1-workspace-shell.tsx src/features/round1/round1-workspace-shell.test.tsx
git commit -m "feat: add responsive Round 1 workspace shell"
```

## Task 6: Integrate the Workspace Shell Without Losing Round 1 State

**Files:**

- Modify: `src/features/round1/showroom-intake-app.tsx`
- Modify: `src/features/round1/showroom-intake-app.test.tsx`
- Modify: `src/features/round1/showroom-intake-controls.tsx`

- [ ] **Step 1: Add failing integration contracts**

Append to `src/features/round1/showroom-intake-app.test.tsx`:

```tsx
import {
  DEFAULT_WORKSPACE_MODE,
  parseWorkspaceMode
} from "./workspace-mode";

describe("Round 1 workspace integration", () => {
  test("uses guided mode as the safe initial workspace", () => {
    expect(DEFAULT_WORKSPACE_MODE).toBe("guided");
    expect(parseWorkspaceMode("unexpected")).toBe("guided");
  });

  test("keeps all six workflow labels in the redesigned workspace", () => {
    const html = renderToStaticMarkup(
      <ShowroomIntakeApp
        projectId="project-1"
        customerName="Elena Park"
        projectName="Elm Street Kitchen"
        userName="Maya"
      />
    );

    for (const label of [
      "Room",
      "Openings",
      "Layout",
      "Appliances",
      "Adjust Positions",
      "Rendering Preferences"
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Guided");
    expect(html).toContain("Canvas focus");
  });
});
```

- [ ] **Step 2: Run the focused test**

Run:

```bash
npx vitest run src/features/round1/showroom-intake-app.test.tsx
```

Expected: the new rendering contract fails because the mode switch is not integrated.

- [ ] **Step 3: Add mode state and safe local persistence**

In `src/features/round1/showroom-intake-app.tsx`, import:

```tsx
import { useReducedMotion } from "motion/react";
import {
  DEFAULT_WORKSPACE_MODE,
  parseWorkspaceMode,
  workspaceModeStorageKey,
  type WorkspaceMode
} from "./workspace-mode";
import { WorkspaceModeSwitch } from "./workspace-mode-switch";
import { Round1WorkspaceShell } from "./round1-workspace-shell";
import { Round1StepNavigation } from "./round1-step-navigation";
import { Round1Inspector } from "./round1-inspector";
import { Round1Feedback } from "./round1-feedback";
```

Add state beside the existing `step` state:

```tsx
const [workspaceMode, setWorkspaceMode] =
  useState<WorkspaceMode>(DEFAULT_WORKSPACE_MODE);
const reduceMotion = useReducedMotion();
```

Add this mount effect:

```tsx
useEffect(() => {
  const stored = window.localStorage.getItem(workspaceModeStorageKey);
  setWorkspaceMode(parseWorkspaceMode(stored));
}, []);
```

Add this callback:

```tsx
const updateWorkspaceMode = useCallback((mode: WorkspaceMode) => {
  setWorkspaceMode(mode);
  window.localStorage.setItem(workspaceModeStorageKey, mode);
}, []);
```

Mode changes must not touch `form`, `step`, `positionOverrides`, `snapshot`, `renderings`, or any persistence ref.

- [ ] **Step 4: Build the compact project utility bar**

Inside `ShowroomIntakeApp`, define:

```tsx
const projectBar = (
  <div className="flex h-14 items-center gap-3 px-4 md:px-5">
    <a
      href={projectId ? `/projects/${projectId}` : "/projects"}
      className="rounded-studio-small px-2 py-1 text-[12px] text-studio-muted transition-colors hover:bg-white/[0.05] hover:text-studio-ink"
    >
      Back
    </a>
    <div className="min-w-0">
      <p className="truncate text-[12px] font-semibold text-studio-ink">
        {projectName ?? "Round 1"}
      </p>
      {customerName && (
        <p className="truncate text-[10px] text-studio-quiet">
          {customerName}
        </p>
      )}
    </div>
    <div className="ml-auto flex items-center gap-3">
      <Round1Feedback
        state={
          persistState === "saving"
            ? "saving"
            : snapshot
              ? "saved"
              : "stale"
        }
        message={
          persistState === "saving"
            ? "Saving"
            : snapshot
              ? "Saved"
              : "Changes not frozen"
        }
      />
      <WorkspaceModeSwitch
        mode={workspaceMode}
        onModeChange={updateWorkspaceMode}
      />
    </div>
  </div>
);
```

Use `Link` instead of `<a>` if `Link` is already imported in the file at implementation time.

- [ ] **Step 5: Replace the existing sidebar renderer with shared step navigation**

Delete the one-off `renderSidebar` JSX and define:

```tsx
const stepNavigation = (
  <Round1StepNavigation
    steps={SHOWROOM_STEPS}
    currentStep={step}
    maxAccessibleStep={maxAccessibleStep}
    variant={workspaceMode === "guided" ? "expanded" : "compact"}
    onStepChange={(nextStep) => {
      localSessionChangedRef.current = true;
      setStep(nextStep);
    }}
  />
);
```

For the `xl:hidden` strip in `Round1WorkspaceShell`, update the shell API to accept `mobileStepNavigation` and pass:

```tsx
<Round1StepNavigation
  steps={SHOWROOM_STEPS}
  currentStep={step}
  maxAccessibleStep={maxAccessibleStep}
  variant="strip"
  onStepChange={(nextStep) => {
    localSessionChangedRef.current = true;
    setStep(nextStep);
  }}
/>
```

Update both shell tests to assert `mobileStepNavigation` renders before the canvas content.

- [ ] **Step 6: Move each current step into the inspector body**

Create a local `activeStepContent`:

```tsx
const activeStepContent = (
  <>
    {step === 0 && <RoomStep form={form} setForm={updateForm} />}
    {step === 1 && (
      <OpeningsStep
        form={form}
        setForm={updateForm}
        setPositionOverrides={updatePositionOverrides}
      />
    )}
    {step === 2 && (
      <LayoutStep
        form={form}
        setForm={updateForm}
        setPositionOverrides={updatePositionOverrides}
      />
    )}
    {step === 3 && <AppliancesStep form={form} setForm={updateForm} />}
    {step === 4 && (
      <AdjustPositionsStep
        hasOverrides={Object.keys(positionOverrides).length > 0}
        fixedPositionsConfirmed={fixedPositionsConfirmed}
        cabinetFillGenerated={cabinetFillGenerated}
      />
    )}
    {step === 5 && (
      <RenderingPreferencesStep
        form={form}
        colors={cabinetColors}
        colorsError={cabinetColorsError}
        onRetryLoadColors={() => void loadCabinetColors()}
        onFormChange={updateRenderingPreferencesForm}
      />
    )}
  </>
);
```

Add description constants:

```tsx
const STEP_DESCRIPTIONS = [
  "Set the room dimensions and fixed obstacles.",
  "Place doors, passages, and windows.",
  "Choose the closest starting kitchen layout.",
  "Add the appliances and fixtures that affect placement.",
  "Fine-tune positions and confirm spatial constraints.",
  "Choose the cabinet finish and generate a concept rendering."
] as const;
```

Render `Round1Inspector` with the current content and existing action logic. For step 5, pass the existing lock and generate controls through `footerContent`. Preserve all current conditions for `canLock`, `preferencesLocked`, `canRenderConcept`, `renderingBusy`, and `hasRenderedConcept`.

- [ ] **Step 7: Make the canvas region stable for every step**

Build one `canvasContent` that always renders `LayoutPreview`, then conditionally adds rendering or elevation output without moving the inspector:

```tsx
const canvasContent = (
  <div className="grid h-full min-h-[540px] min-w-0 gap-3">
    <div className="min-h-0 overflow-hidden rounded-studio-panel border border-studio-line bg-studio-shell">
      <LayoutPreview
        normalized={result.normalized}
        cabinets={preliminaryEstimate.cabinets}
        confirmationItems={confirmationItems}
        positionOverrides={positionOverrides}
        onPositionOverridesChange={updatePositionOverrides}
        highlightDraggableItems={highlightDraggableItems}
        showPositionObjects={step >= ADJUST_POSITIONS_STEP_INDEX}
        previewStage={previewStage}
        svgRef={floorPlanSvgRef}
        showHeader={false}
      />
    </div>
    {(renderingBusy || renderings.length > 0 || renderingError) && (
      <RenderingControls
        canRender={canRenderConcept}
        busy={renderingBusy}
        error={renderingError}
        renderings={renderings}
        cabinetColors={cabinetColors}
      />
    )}
  </div>
);
```

Keep hidden rasterization references outside the visible workspace but inside the component tree.

- [ ] **Step 8: Replace the current top-level JSX with the shell**

The visible return body becomes:

```tsx
<Round1WorkspaceShell
  mode={workspaceMode}
  projectBar={projectBar}
  stepNavigation={stepNavigation}
  mobileStepNavigation={mobileStepNavigation}
  canvas={canvasContent}
  inspector={
    <Round1Inspector
      title={SHOWROOM_STEPS[step]}
      description={STEP_DESCRIPTIONS[step]}
      previousDisabled={step === 0}
      continueDisabled={step === SHOWROOM_STEPS.length - 1}
      onPrevious={() => {
        localSessionChangedRef.current = true;
        setStep(Math.max(0, step - 1));
      }}
      onContinue={goToNextStep}
      footerContent={step === 5 ? renderingFooter : undefined}
      suggestion={step === 4 ? adjustPositionSuggestion : undefined}
    >
      {activeStepContent}
    </Round1Inspector>
  }
/>
```

Preserve all dialogs and hidden reference SVGs after this shell within a fragment. Do not delete the Adjust Positions instructional dialog.

- [ ] **Step 9: Convert field labels to inspector-safe semantic styles**

In `src/features/round1/showroom-intake-controls.tsx`:

- Replace `lucide-react` `ChevronDown` with Radix `ChevronDownIcon`.
- Change heading text to `text-studio-paper-ink`.
- Apply `data-surface="inspector"` to number inputs.
- Style dropdown triggers with `variant="inspector"`.
- Replace `.custom-checkbox` usage with the shared `Checkbox` component and visible label text.

Use:

```tsx
<label className="flex items-start gap-3">
  <Checkbox
    checked={checked}
    onCheckedChange={(value) => onChange(value === true)}
    className="mt-0.5 border-[#9aa79f] bg-white data-[state=checked]:border-studio-action data-[state=checked]:bg-studio-action"
  />
  <span>
    <span className="block text-[13px] font-medium text-studio-paper-ink">
      {label}
    </span>
    {help && (
      <span className="mt-1 block text-[11px] leading-4 text-[#607067]">
        {help}
      </span>
    )}
  </span>
</label>
```

- [ ] **Step 10: Run Round 1 integration tests**

Run:

```bash
npx vitest run src/features/round1/showroom-intake-app.test.tsx src/features/round1/round1-workspace-shell.test.tsx src/features/round1/round1-step-navigation.test.tsx
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 11: Commit the workspace integration**

```bash
git add src/features/round1/showroom-intake-app.tsx src/features/round1/showroom-intake-app.test.tsx src/features/round1/showroom-intake-controls.tsx src/features/round1/round1-workspace-shell.tsx src/features/round1/round1-workspace-shell.test.tsx
git commit -m "feat: integrate dual-mode Round 1 workspace"
```

## Task 7: Restyle the Canvas and Add Drag-State Semantics

**Files:**

- Modify: `src/features/round1/layout-preview.tsx`
- Modify: `src/features/round1/layout-preview-shapes.tsx`
- Modify: `src/features/round1/layout-preview.test.tsx`
- Modify: `src/features/round1/floorplan/plan-geometry.ts` only if a named valid-position helper is required

- [ ] **Step 1: Add failing canvas visual and accessibility contracts**

Append to `src/features/round1/layout-preview.test.tsx`:

```tsx
test("uses Studio canvas semantics for draggable position objects", () => {
  const html = renderPreview({ previewStage: "adjust" });

  expect(html).toContain('data-canvas-theme="studio"');
  expect(html).toContain('data-drag-state="idle"');
  expect(html).toContain('aria-label="Kitchen floor plan editor"');
});

test("keeps a non-drag position control available", () => {
  const html = renderPreview({ previewStage: "adjust" });

  expect(html).toContain("Fine-tune selected position");
});
```

Update legacy color expectations:

```tsx
expect(html).not.toContain('stroke="#c56a16"');
expect(html).toContain('stroke="var(--studio-action)"');
```

Keep reference-mode assertions geometry-based and ensure reference mode does not include interactive labels or handles.

- [ ] **Step 2: Run the canvas tests and verify failure**

Run:

```bash
npx vitest run src/features/round1/layout-preview.test.tsx
```

Expected: FAIL on missing Studio data attributes and legacy colors.

- [ ] **Step 3: Add explicit drag state**

In `src/features/round1/layout-preview.tsx`, define:

```tsx
type DragState = "idle" | "dragging" | "snapping" | "invalid";
```

Add:

```tsx
const [dragState, setDragState] = useState<DragState>("idle");
const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
```

At drag start:

```tsx
setSelectedPositionId(id);
setDragState("dragging");
```

During movement, use the existing geometry validation result:

```tsx
setDragState(nextPositionIsValid ? "dragging" : "invalid");
```

On a valid release:

```tsx
setDragState("snapping");
onPositionOverridesChange(nextOverrides);
window.setTimeout(() => setDragState("idle"), 220);
```

On an invalid release:

```tsx
setDragState("invalid");
window.setTimeout(() => setDragState("idle"), 180);
```

Store timeout handles in refs and clear them in an effect cleanup.

- [ ] **Step 4: Apply Studio canvas attributes and colors**

On the interactive root:

```tsx
<section
  data-canvas-theme="studio"
  data-drag-state={dragState}
  className="relative h-full min-h-[540px] overflow-hidden bg-studio-shell"
>
```

On the SVG:

```tsx
<svg
  aria-label="Kitchen floor plan editor"
  role="img"
  className="h-full min-h-[540px] w-full touch-none select-none bg-[#203128]"
  ...
>
```

Replace visible interactive colors with:

- Room and selected geometry: `var(--studio-action)`
- Grid and passive guides: `rgba(237, 242, 238, 0.08)`
- Passive labels: `var(--studio-muted)`
- Invalid state: `var(--studio-danger)`
- Warning or confirmation: `var(--studio-warning)`

Keep `referenceMode` colors self-contained and suitable for rasterization. Do not use CSS variables inside the hidden reference SVG if rasterization cannot resolve them; use equivalent fixed values there.

- [ ] **Step 5: Increase iPad hit targets without enlarging visible geometry**

For every draggable SVG group:

```tsx
<g
  role="button"
  tabIndex={0}
  aria-label={`Move ${label}`}
  data-position-object={id}
  className="cursor-grab outline-none active:cursor-grabbing"
  onKeyDown={...}
>
  <rect
    x={visualX - 14}
    y={visualY - 14}
    width={visualWidth + 28}
    height={visualHeight + 28}
    fill="transparent"
    pointerEvents="all"
  />
  {visibleShape}
</g>
```

Add keyboard movement:

```tsx
if (event.key === "ArrowLeft") moveSelected(-1);
if (event.key === "ArrowRight") moveSelected(1);
if (event.key === "ArrowUp") moveSelected(-1);
if (event.key === "ArrowDown") moveSelected(1);
```

Use 1-inch logical increments based on the existing position coordinate model. Add Shift for 6-inch increments if the model supports it without new domain behavior.

- [ ] **Step 6: Add the non-drag adjustment disclosure**

When `selectedPositionId` is not null, render outside the SVG:

```tsx
<div className="absolute bottom-4 right-4 rounded-studio-control border border-studio-line bg-studio-shell/95 p-3 shadow-[0_16px_36px_rgba(0,0,0,0.28)] backdrop-blur">
  <p className="text-[11px] font-semibold text-studio-ink">
    Fine-tune selected position
  </p>
  <p className="mt-1 text-[10px] text-studio-muted">
    Use arrow keys for 1-inch adjustments.
  </p>
</div>
```

- [ ] **Step 7: Run geometry and preview tests**

Run:

```bash
npx vitest run src/features/round1/layout-preview.test.tsx src/features/round1/floorplan/plan-geometry.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit canvas interaction styling**

```bash
git add src/features/round1/layout-preview.tsx src/features/round1/layout-preview-shapes.tsx src/features/round1/layout-preview.test.tsx src/features/round1/floorplan/plan-geometry.ts
git commit -m "feat: add Studio canvas drag feedback"
```

## Task 8: Replace One-Off Rendering Effects With Full State Presentation

**Files:**

- Modify: `src/features/round1/showroom-intake-app.tsx`
- Modify: `src/features/round1/showroom-intake-panels.tsx`
- Modify: `src/features/round1/ghost-loader.css`
- Modify: `src/features/round1/rendering-preferences-step.tsx`
- Modify: `src/features/round1/rendering-preferences-step.test.tsx`

- [ ] **Step 1: Add failing rendering state assertions**

Append to `src/features/round1/rendering-preferences-step.test.tsx`:

```tsx
test("uses a contextual retry action when cabinet colors fail", () => {
  const html = renderToStaticMarkup(
    <RenderingPreferencesStep
      form={createDefaultShowroomForm()}
      colors={[]}
      colorsError
      onRetryLoadColors={() => {}}
      onFormChange={() => {}}
    />
  );

  expect(html).toContain("Cabinet colors could not be loaded");
  expect(html).toContain("Try again");
  expect(html).toContain('role="alert"');
});
```

Add to the relevant `RenderingControls` tests in `showroom-intake-app.test.tsx`:

```tsx
test("rendering controls expose generating and stale states without a generic spinner", () => {
  const html = renderToStaticMarkup(
    <RenderingControls
      canRender={false}
      busy
      error={null}
      renderings={[]}
      cabinetColors={[]}
    />
  );

  expect(html).toContain("Building concept rendering");
  expect(html).toContain('aria-busy="true"');
  expect(html).not.toContain("border-t-transparent");
});
```

- [ ] **Step 2: Verify the new tests fail**

Run:

```bash
npx vitest run src/features/round1/rendering-preferences-step.test.tsx src/features/round1/showroom-intake-app.test.tsx
```

Expected: FAIL on the new state copy and markup.

- [ ] **Step 3: Remove the inline lock-button and rendering-glow CSS**

Delete from `showroom-intake-app.tsx`:

- The inline `<style>` block for `.lock-button`
- Hand-authored lock SVG paths
- `.rendering-glow-wrapper`
- `.rendering-glow-button`
- `.rendering-glow-letter`

Replace `RenderingPreferencesLockControl` visual output with shared buttons and Radix icons:

```tsx
import { LockClosedIcon, LockOpen1Icon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";

return (
  <Button
    type="button"
    variant={preferencesLocked ? "secondary" : "inspector"}
    disabled={disabled}
    onClick={() => {
      if (!disabled) onLock();
    }}
    title={title}
  >
    {preferencesLocked ? (
      <LockClosedIcon className="size-4" aria-hidden />
    ) : (
      <LockOpen1Icon className="size-4" aria-hidden />
    )}
    {preferencesLocked ? "Preferences locked" : "Lock preferences"}
  </Button>
);
```

Keep the existing disabled explanation beneath the control.

- [ ] **Step 4: Implement content-shaped generation loading**

In `RenderingControls`, when `busy` is true, render:

```tsx
<section
  aria-busy="true"
  aria-label="Building concept rendering"
  className="rounded-studio-panel border border-studio-line bg-studio-shell p-4"
>
  <div className="overflow-hidden rounded-studio-control border border-studio-line bg-studio-surface">
    <div className="aspect-[16/10] animate-pulse bg-[linear-gradient(110deg,var(--studio-surface)_8%,var(--studio-raised)_18%,var(--studio-surface)_33%)] bg-[length:200%_100%] motion-reduce:animate-none" />
  </div>
  <div className="mt-4 flex items-center justify-between gap-4">
    <div>
      <p className="text-[13px] font-semibold text-studio-ink">
        Building concept rendering
      </p>
      <p className="mt-1 text-[11px] text-studio-muted">
        The frozen floor plan and finish selection are being processed.
      </p>
    </div>
    <Round1Feedback state="generating" message="Generating" />
  </div>
</section>
```

When an existing rendering is stale, show:

```tsx
<Round1Feedback
  state="stale"
  message="Inputs changed. Generate a new rendering when ready."
/>
```

When generation fails, render a contextual alert and retain the previous rendering if one exists.

- [ ] **Step 5: Add cabinet color failure and empty states**

In `rendering-preferences-step.tsx`:

```tsx
if (colorsError) {
  return (
    <div
      role="alert"
      className="rounded-studio-control border border-studio-danger/25 bg-studio-danger/10 p-4"
    >
      <p className="text-[13px] font-semibold text-[#8e312b]">
        Cabinet colors could not be loaded
      </p>
      <p className="mt-1 text-[12px] text-[#6f4b47]">
        Check the connection and try loading the catalog again.
      </p>
      <Button
        type="button"
        variant="inspector"
        className="mt-3"
        onClick={onRetryLoadColors}
      >
        Try again
      </Button>
    </div>
  );
}
```

Keep the admin-configuration empty state when `colorsError` is false and the catalog is empty.

- [ ] **Step 6: Replace `ghost-loader.css` with reduced-motion-safe skeleton CSS**

Use:

```css
.studio-skeleton {
  position: relative;
  overflow: hidden;
  background: var(--studio-surface);
}

.studio-skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent,
    rgba(237, 242, 238, 0.07),
    transparent
  );
  animation: studio-skeleton-sweep 1.5s ease-in-out infinite;
}

@keyframes studio-skeleton-sweep {
  to {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .studio-skeleton::after {
    display: none;
  }
}
```

- [ ] **Step 7: Run rendering state tests**

Run:

```bash
npx vitest run src/features/round1/rendering-preferences-step.test.tsx src/features/round1/showroom-intake-app.test.tsx
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit rendering feedback**

```bash
git add src/features/round1/showroom-intake-app.tsx src/features/round1/showroom-intake-panels.tsx src/features/round1/ghost-loader.css src/features/round1/rendering-preferences-step.tsx src/features/round1/rendering-preferences-step.test.tsx
git commit -m "feat: redesign Round 1 rendering states"
```

## Task 9: Add the Studio Application Rail for Round 1

**Files:**

- Create: `src/features/platform/studio-shell.tsx`
- Modify: `src/features/platform/studio-shell.test.tsx`
- Modify: `src/features/round1/showroom-intake-app.tsx`

- [ ] **Step 1: Add failing shell navigation tests**

Append to `src/features/platform/studio-shell.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { StudioRail } from "./studio-shell";

describe("StudioRail", () => {
  test("shows project navigation for regular users", () => {
    const html = renderToStaticMarkup(
      <StudioRail
        userName="Maya"
        isAdmin={false}
        activeItem="round1"
        projectId="project-1"
      />
    );

    expect(html).toContain("Projects");
    expect(html).toContain("Round 1");
    expect(html).toContain("Renderings");
    expect(html).not.toContain("Users");
    expect(html).not.toContain("Cabinet colors");
  });

  test("adds administration destinations for admins", () => {
    const html = renderToStaticMarkup(
      <StudioRail
        userName="Admin"
        isAdmin
        activeItem="round1"
        projectId="project-1"
      />
    );

    expect(html).toContain("Users");
    expect(html).toContain("Cabinet colors");
  });
});
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npx vitest run src/features/platform/studio-shell.test.tsx
```

Expected: FAIL because `StudioRail` does not exist.

- [ ] **Step 3: Implement the shared Studio rail**

Create `src/features/platform/studio-shell.tsx`:

```tsx
"use client";

import Link from "next/link";
import {
  ColorWheelIcon,
  DashboardIcon,
  DrawingPinIcon,
  ImageIcon,
  PersonIcon
} from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";

type StudioNavItem =
  | "projects"
  | "round1"
  | "renderings"
  | "users"
  | "colors";

export function StudioRail({
  userName,
  isAdmin,
  activeItem,
  projectId,
  compact = false
}: {
  userName: string;
  isAdmin: boolean;
  activeItem: StudioNavItem;
  projectId?: string;
  compact?: boolean;
}) {
  const items = [
    {
      id: "projects" as const,
      href: "/projects",
      label: "Projects",
      icon: DashboardIcon,
      visible: true
    },
    {
      id: "round1" as const,
      href: projectId ? `/projects/${projectId}/round1` : "/projects",
      label: "Round 1",
      icon: DrawingPinIcon,
      visible: Boolean(projectId)
    },
    {
      id: "renderings" as const,
      href: projectId ? `/projects/${projectId}/renderings` : "/projects",
      label: "Renderings",
      icon: ImageIcon,
      visible: Boolean(projectId)
    },
    {
      id: "users" as const,
      href: "/admin/users",
      label: "Users",
      icon: PersonIcon,
      visible: isAdmin
    },
    {
      id: "colors" as const,
      href: "/admin/cabinet-colors",
      label: "Cabinet colors",
      icon: ColorWheelIcon,
      visible: isAdmin
    }
  ];

  return (
    <aside className="flex h-full min-h-[100dvh] flex-col border-r border-studio-line bg-[#0e1713] p-3">
      <Link
        href="/projects"
        className={cn(
          "mb-6 flex h-10 items-center gap-2 rounded-studio-control px-2 text-[13px] font-semibold text-studio-ink",
          compact && "justify-center px-0"
        )}
      >
        <span className="size-6 rounded-[7px] bg-studio-action" aria-hidden />
        {!compact && "ABCabinet"}
      </Link>
      <nav aria-label="Primary navigation" className="grid gap-1">
        {items.filter((item) => item.visible).map((item) => {
          const Icon = item.icon;
          const active = activeItem === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={compact ? item.label : undefined}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-studio-control px-3 text-[12px] font-medium transition-colors",
                compact && "justify-center px-0",
                active
                  ? "bg-studio-surface text-studio-ink"
                  : "text-studio-muted hover:bg-white/[0.05] hover:text-studio-ink"
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {!compact && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div
        className={cn(
          "mt-auto flex min-h-10 items-center gap-2 border-t border-studio-line px-2 pt-3 text-[11px] text-studio-muted",
          compact && "justify-center"
        )}
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-studio-surface text-studio-action">
          <PersonIcon className="size-3.5" aria-hidden />
        </span>
        {!compact && <span className="truncate">{userName}</span>}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Add the rail to the Round 1 outer layout**

Extend `Round1WorkspaceShell` with a `rail` prop and wrap the existing workspace:

```tsx
<div className="grid min-h-[100dvh] grid-cols-[64px_minmax(0,1fr)] lg:grid-cols-[188px_minmax(0,1fr)]">
  <div className="hidden md:block">{rail}</div>
  <div className="min-w-0">{workspace}</div>
</div>
```

Pass from `ShowroomIntakeApp`:

```tsx
rail={
  <StudioRail
    userName={userName}
    isAdmin={isAdmin}
    activeItem="round1"
    projectId={projectId}
    compact={false}
  />
}
```

At `md` to `lg`, pass or style the rail as compact through responsive CSS rather than maintaining a second navigation state.

- [ ] **Step 5: Run shell and integration tests**

Run:

```bash
npx vitest run src/features/platform/studio-shell.test.tsx src/features/round1/round1-workspace-shell.test.tsx src/features/round1/showroom-intake-app.test.tsx
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit the Studio rail**

```bash
git add src/features/platform/studio-shell.tsx src/features/platform/studio-shell.test.tsx src/features/round1/round1-workspace-shell.tsx src/features/round1/showroom-intake-app.tsx
git commit -m "feat: add Studio navigation to Round 1"
```

## Task 10: Update Route Skeletons and Remove Round 1 Legacy Styling

**Files:**

- Modify: `src/features/platform/route-skeleton.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/features/round1/ghost-loader.css`
- Modify: `src/features/round1/showroom-intake-app.tsx`

- [ ] **Step 1: Add a Round 1 workspace skeleton variant**

Extend:

```tsx
type SkeletonVariant =
  | "dashboard"
  | "detail"
  | "table"
  | "plain"
  | "round1";
```

Add:

```tsx
{variant === "round1" && (
  <div className="grid min-h-[calc(100dvh-56px)] grid-cols-1 xl:grid-cols-[176px_minmax(0,1fr)_320px]">
    <div className="hidden border-r border-studio-line bg-[#0e1713] p-3 xl:grid xl:content-start xl:gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <Shimmer key={index} className="h-10 w-full rounded-studio-control" />
      ))}
    </div>
    <div className="bg-studio-void p-3">
      <Shimmer className="h-[calc(100dvh-80px)] min-h-[540px] w-full rounded-studio-panel" />
    </div>
    <div className="border-l border-studio-line bg-studio-paper p-5">
      <Shimmer className="h-5 w-36 bg-black/10" />
      <Shimmer className="mt-3 h-3 w-full bg-black/10" />
      <Shimmer className="mt-7 h-10 w-full bg-black/10" />
      <Shimmer className="mt-3 h-10 w-full bg-black/10" />
      <Shimmer className="mt-3 h-10 w-full bg-black/10" />
    </div>
  </div>
)}
```

Change `Shimmer` to use Studio surfaces:

```tsx
className={cn(
  "studio-skeleton rounded-studio-small bg-studio-surface",
  className
)}
```

Update `src/app/projects/[projectId]/round1/loading.tsx` to:

```tsx
import { RouteSkeleton } from "@/features/platform/route-skeleton";

export default function Loading() {
  return <RouteSkeleton variant="round1" withHeader={false} />;
}
```

- [ ] **Step 2: Remove obsolete Round 1 selectors**

Use:

```bash
rg -n "uiverse-fill-button|rendering-glow|custom-checkbox|lock-button|lock-svgIcon" src
```

Expected before cleanup: references in `globals.css` or migrated Round 1 files.

Delete the corresponding selector blocks from `src/app/globals.css` only after `rg` confirms no JSX references remain.

- [ ] **Step 3: Verify no banned one-off effects remain in Round 1**

Run:

```bash
rg -n "rendering-glow|lock-button|rotate\\(360deg\\)|box-shadow:.*0 0 20px|lucide-react" src/features/round1 src/components/ui
```

Expected: no matches. If `lucide-react` remains outside Phase 1 files, leave it for later phases.

- [ ] **Step 4: Run focused and full automated checks**

Run:

```bash
npx vitest run src/features/round1 src/features/platform/studio-shell.test.tsx
npx tsc --noEmit
npm test
npm run build
```

Expected:

- Focused Round 1 tests PASS
- TypeScript PASS
- Full test suite PASS
- Production build PASS

- [ ] **Step 5: Commit cleanup and loading states**

```bash
git add src/features/platform/route-skeleton.tsx src/app/projects/[projectId]/round1/loading.tsx src/app/globals.css src/features/round1/ghost-loader.css src/features/round1/showroom-intake-app.tsx
git commit -m "feat: finish Studio Round 1 loading and cleanup"
```

## Task 11: Browser Verification and Visual QA

**Files:**

- Modify only files required by findings from this task
- Reference: `docs/superpowers/specs/2026-06-24-abcabinet-studio-frontend-redesign.md`

- [ ] **Step 1: Start the application and prepare an authenticated test user**

Run:

```bash
npm run dev
```

If a local user is not available, use the existing seed scripts documented by the repository. Do not change authentication behavior.

- [ ] **Step 2: Verify desktop Guided mode at 1440x900**

Check:

- Studio rail is visible
- Project bar is 56px high or less
- All six step labels are readable
- Canvas is the largest region
- Inspector controls are not clipped
- Previous and Continue remain visible
- No horizontal page scroll
- Focus ring is visible
- Button labels do not wrap

Capture a screenshot named:

```text
artifacts/qa/round1-guided-desktop.png
```

- [ ] **Step 3: Verify desktop Canvas focus mode**

Switch to Canvas focus and check:

- Form values remain unchanged
- Current step remains unchanged
- Canvas expands
- Inspector stays in place
- Step navigation compresses
- Mode is restored after reload
- Reduced-motion mode switches instantly

Capture:

```text
artifacts/qa/round1-canvas-desktop.png
```

- [ ] **Step 4: Verify iPad landscape at 1180x820**

Check:

- Canvas remains usable
- Navigation rail compresses
- Inspector remains readable
- Touch targets are at least 44px
- Drag handles are reachable
- No hover-only instructions

Capture:

```text
artifacts/qa/round1-ipad-landscape.png
```

- [ ] **Step 5: Verify iPad portrait at 820x1180**

Check:

- Step progress is above the canvas
- Inspector appears as a bottom sheet
- Canvas remains visible above the sheet
- Sheet content scrolls independently
- Primary action remains reachable
- No body-level horizontal scroll

Capture:

```text
artifacts/qa/round1-ipad-portrait.png
```

- [ ] **Step 6: Verify interaction states**

Exercise:

- Loading cabinet colors
- Empty cabinet colors
- Cabinet color request failure and retry
- Rendering generation
- Rendering failure
- Stale rendering after an edit
- Save in progress
- Saved snapshot
- Disabled Continue
- Locked preferences
- Invalid drag and valid snap

Confirm each state uses text plus visual styling and does not rely on color alone.

- [ ] **Step 7: Check browser console and final automated verification**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
```

Inspect the browser console. Expected: no React errors, hydration errors, unhandled promise rejections, or missing-key warnings.

- [ ] **Step 8: Commit only verified QA fixes**

```bash
git diff --name-only -z | xargs -0 git add
git commit -m "fix: polish Studio Round 1 responsive behavior"
```

Skip this commit if QA required no code changes.

## Task 12: Phase 1 Completion Review

**Files:**

- Review: `docs/superpowers/specs/2026-06-24-abcabinet-studio-frontend-redesign.md`
- Review: all Phase 1 commits

- [ ] **Step 1: Verify Phase 1 scope coverage**

Confirm:

- Studio tokens exist
- Serif product fonts are removed
- Round 1 uses one dark studio theme
- Sage is the only general action accent
- Guided and Canvas focus modes work
- Mode changes preserve state
- Desktop and iPad layouts are verified
- Inspector action placement is stable
- Canvas drag feedback is visible and accessible
- Rendering states cover loading, failure, success, and stale
- Reduced motion is honored
- Existing domain tests pass

- [ ] **Step 2: Verify out-of-scope pages were not redesigned**

Review:

```bash
git diff main...HEAD -- src/features/platform src/app
```

Expected: only shared foundations, Studio rail, route skeleton, root layout, and Round 1 adoption changed. Dashboard, project detail, login, and admin page redesigns remain for later plans.

- [ ] **Step 3: Run the final verification suite**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all commands exit successfully.

- [ ] **Step 4: Prepare the next-phase handoff**

Record the verified screenshots and note any shared components ready for Phase 2:

- `StudioRail`
- `Button` Studio variants
- `Input` inspector surface
- `Round1Feedback`
- Studio tokens
- Studio skeleton

Do not begin Phase 2 until Phase 1 visual review is approved.
