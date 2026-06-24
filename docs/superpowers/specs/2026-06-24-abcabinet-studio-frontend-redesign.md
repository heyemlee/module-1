# ABCabinet Studio Frontend Redesign

**Date:** 2026-06-24  
**Status:** Approved visual direction, pending written-spec review  
**Mode:** Full visual and UX overhaul with existing product behavior preserved

## 1. Objective

Redesign the existing internal platform as a coherent professional workspace for cabinet sales and design teams.

The redesign centers the Round 1 workflow. Users should always understand:

1. Which step they are on.
2. What changed in the floor plan.
3. What action is required next.
4. Whether their work is saved, stale, blocked, or ready.

The project dashboard, project detail, renderings, login, and admin surfaces will use the same design system, but Round 1 receives the strongest product and interaction treatment.

## 2. Product Positioning

### Design read

This is an internal spatial-design tool for cabinet sales and design staff. It should feel like a calm professional studio rather than a generic CRUD dashboard or a marketing site.

### Design dials

- `DESIGN_VARIANCE: 7`
- `MOTION_INTENSITY: 4`
- `VISUAL_DENSITY: 6`

These values support an identifiable, canvas-led workspace with moderate information density and restrained state-driven motion.

## 3. Scope and Preservation Rules

### In scope

- Global visual tokens and typography
- Shared application shell and navigation
- Project dashboard
- Project creation
- Project detail
- Round 1 workspace
- Rendering gallery and rendering states
- Login
- Admin user and cabinet-color surfaces
- Desktop and iPad responsive behavior
- Loading, empty, error, disabled, stale, and success states
- Interaction motion and drag feedback

### Preserved unless separately approved

- Route structure and URLs
- Primary product workflows
- Project status values
- Form field names, meaning, and submission order
- API contracts
- Authentication behavior
- Database schema
- Snapshot, rendering, and persistence behavior
- Existing analytics-relevant labels and identifiers, if any are discovered during implementation

The redesign must not silently change business logic.

## 4. Visual Direction

### Theme

Use one dark studio theme across the authenticated application.

The visual language is "dark design studio":

- Deep forest-green shell
- Layered green-charcoal surfaces
- Cool gray-white content surfaces where light contrast is needed
- Sage green as the single global action accent
- Red and amber reserved for semantic danger and warning states
- No pure black
- No neon glow
- No decorative gradients
- No broad glassmorphism treatment

Login may use the same dark theme with a simplified composition. The application must not alternate between unrelated light and dark sections.

### Core color tokens

Initial target values:

```css
--studio-void: #0b120f;
--studio-shell: #111b16;
--studio-surface: #17241e;
--studio-raised: #1d2d25;
--studio-ink: #edf2ee;
--studio-muted: #9aa79f;
--studio-quiet: #6e7c74;
--studio-action: #9fcdb1;
--studio-action-strong: #78b895;
--studio-action-ink: #102019;
--studio-paper: #eef1ec;
--studio-paper-muted: #dfe5df;
--studio-danger: #e66d63;
--studio-warning: #d8ae69;
```

Final values may be adjusted during contrast testing, but the palette family and one-accent rule are fixed.

### Shape system

- Primary panel radius: 12px
- Compact control radius: 8px
- Small nested element radius: 6px
- Pills only for true statuses, segmented controls, and compact metadata
- Buttons are rounded rectangles, not universal pills
- Shadows are rare and tinted toward the green-black background

### Typography

Remove the current Playfair Display and Instrument Serif product treatment.

Use a system sans-serif stack optimized for Apple devices and common Windows fallbacks:

```css
font-family:
  -apple-system,
  BlinkMacSystemFont,
  "SF Pro Text",
  "Segoe UI",
  "PingFang SC",
  "Microsoft YaHei",
  sans-serif;
```

Use tight but readable heading tracking and tabular numeric features for measurements.

Target scale:

- Page title: 28-32px
- Section title: 20-24px
- Panel title: 15-17px
- Body and controls: 13-14px
- Captions and metadata: 11-12px

## 5. Application Shell

### Desktop

Use a persistent left navigation rail for authenticated platform pages.

The rail contains:

- ABCabinet brand mark and name
- Projects
- Renderings where globally useful
- Users for admins
- Cabinet colors for admins
- Account menu anchored at the bottom or top utility area

The current pill-based top navigation will be retired. A compact project-level top bar may remain inside Round 1 for project identity, save state, undo and redo, and workspace-mode controls.

### Navigation behavior

- Active location uses a filled studio surface, not a bright pill
- Navigation remains on one line inside each item
- Icon family must be consistent
- Existing Radix icons may be retained where sufficient
- Existing Lucide usage should be replaced gradually with Radix or another single approved family
- Navigation state transitions use color and opacity only

## 6. Project Dashboard

The dashboard is a high-efficiency entry point, not a card gallery.

### Structure

1. Page title and short functional description
2. Primary "New project" action
3. Compact operational summary
4. Search and filters
5. Project table

### Summary

Show useful counts derived from real data only, such as:

- Needs attention
- Active
- Rendering ready

Do not invent performance metrics.

### Table

- Preserve fast row scanning
- Use subtle row hover rather than scale and lift
- Make the entire row navigable
- Keep checkbox selection for authorized bulk actions
- Keep destructive actions clearly separated
- Preserve semantic status labels
- Add a clear empty state with a single creation action

## 7. Project Creation and Detail

### New project

- Use a focused form layout
- Remove decorative fake preview cards
- Place required fields first
- Keep labels above inputs
- Show errors next to the relevant context
- Keep the primary creation action visible
- On iPad, use a single-column form

### Project detail

Replace the three equal feature cards with a workflow-oriented project overview.

The page should show:

- Customer and project identity
- Current status
- Recommended next action
- Round 1 progress
- Latest rendering when available
- Round 2 availability or locked state

The plan preview must use the real existing preview component or real project-derived output. It must not use decorative div-based fake diagrams.

## 8. Round 1 Workspace

Round 1 is the primary redesign target.

### Shared workspace model

Both workspace modes use the same:

- Step state
- Form values
- Floor-plan state
- Inspector controls
- Save state
- Validation
- Undo and redo history where available

Mode switching changes layout only. It does not remount the workflow, reset local state, navigate to another route, or interrupt an active edit.

### Mode A: Guided

Use when entering data, learning the workflow, or checking completeness.

Desktop layout:

- Expanded step rail or step strip
- Central floor-plan canvas
- Right inspector for the active step

The step navigation shows:

- Completed
- Current
- Available
- Locked
- Error or attention-required state

### Mode B: Canvas Focus

Use when arranging objects or inspecting spatial relationships.

Desktop layout:

- Compressed step navigation
- Expanded central canvas
- Right inspector preserved in the same location

The default mode may initially be Guided for new users. The application remembers the user's most recent mode locally.

### Workspace switch

- Place in the project top bar
- Use a two-option segmented control
- Labels: "Guided" and "Canvas focus"
- Animate shared layout positions rather than cross-fading the whole page
- Complete the transition in approximately 260ms
- Respect reduced motion by switching instantly

### Canvas

The canvas is the primary visual object.

Requirements:

- Strongest usable area on the page
- Stable size without layout jumps
- Grid is subtle and functional
- Zoom controls remain reachable
- Selection state is unmistakable
- Measurements use tabular numerals
- Object labels remain readable over the grid
- Error or constraint states use semantic color plus shape or text, not color alone

### Drag interaction

Dragging must communicate:

- Selected object
- Valid movement area
- Alignment opportunities
- Snapping
- Invalid placement
- Final committed position

Behavior:

- Slight object lift or emphasis at drag start
- Alignment guides appear near valid targets
- Valid release uses a short spring settle
- Invalid release applies resistance and returns to the last valid position
- Keyboard or numeric adjustment remains available
- Touch targets and handles are at least 44px on iPad

No custom cursor is required.

### Inspector

The right inspector contains only controls for the current step.

Each step includes:

- One clear title
- One short instruction
- Current fields
- Contextual validation
- Assistant suggestion only when actionable
- Previous and Continue actions in a stable footer

The current inline lock-button CSS and glowing rendering button will be replaced with system components.

### Rendering step

Rendering must show a full cycle:

- Prerequisites
- Ready
- Generating
- Completed
- Failed
- Stale because inputs changed

The generating state uses a content-shaped skeleton or progress composition. It must not rely on a generic spinner alone.

## 9. iPad Behavior

### Landscape

- Preserve the three-part workspace
- Reduce rail and inspector width before reducing the canvas
- Keep inspector fields at usable widths
- Support touch pan and pinch zoom if the current preview implementation permits it safely

### Portrait

- Step navigation becomes a compact top progress control
- Canvas remains the main surface
- Inspector becomes a bottom sheet
- Bottom sheet supports collapsed, half-height, and expanded positions where practical
- Primary actions remain visible in the sheet

### Touch

- Minimum interactive target: 44px
- Larger drag hit areas than desktop
- Selected objects can be adjusted through numeric controls
- Avoid hover-dependent information

Phone layouts are not a target for full Round 1 editing. Phones should provide a readable fallback or project-status view rather than a cramped design canvas.

## 10. Motion and Feedback

Motion follows Apple-like continuity and pacing, not Apple visual imitation.

### Timing

- Press feedback: 120-160ms
- Hover and focus transitions: 160-200ms
- Panel and mode transitions: 240-320ms
- Drag settle: spring motion with low overshoot
- Toast or save-state transitions: 180-240ms

### Allowed purposes

- Explain hierarchy
- Preserve spatial continuity
- Confirm interaction
- Show state change
- Reassure during waiting

### Button feedback

- Hover: translate upward by 1px where pointer hover exists
- Active: translate downward and scale to approximately 0.98
- Disabled: no movement
- Loading: preserve button width and replace content without layout shift
- Success: swap to confirmation state briefly when useful

### Panel switching

- Animate transform and opacity
- Shared controls move to their new location
- Do not fade the entire application to white or black
- Do not animate width or height per frame when a transform-based layout transition is possible

### Reduced motion

Every automatic animation must honor `prefers-reduced-motion`.

Reduced-motion behavior:

- No pulsing
- No spring overshoot
- No parallax
- Mode changes are immediate
- Loading indicators retain non-motion progress text

## 11. Component Policy

Uiverse is a reference source, not a dependency or visual system.

Acceptable inspiration:

- Tactile button press
- Segmented switch
- Checkbox and toggle feedback
- Skeleton loaders
- Save confirmation

Rejected patterns:

- Neon outer glow
- 3D flipping controls
- Rotating lock icons
- Perpetual button shimmer
- Oversized animated shadows
- Decorative particle effects

Existing Radix primitives remain useful for accessible behavior. Components will be restyled through shared tokens rather than individually themed with copied snippets.

## 12. State and Accessibility Requirements

### Required states

Every redesigned interactive surface must account for:

- Default
- Hover
- Focus-visible
- Active
- Disabled
- Loading
- Empty
- Error
- Success
- Stale where applicable

### Accessibility

- WCAG AA text and control contrast
- Visible keyboard focus
- Logical focus order
- No information conveyed only by color
- Labels above inputs
- Errors connected to their controls
- Dialogs and bottom sheets return focus correctly
- Touch targets meet the iPad requirement
- Canvas operations have a non-drag alternative where feasible

## 13. Technical Direction

### Existing stack

- Next.js 15
- React 19
- Tailwind CSS 3
- Radix UI primitives
- Motion
- GSAP

### Animation choice

Use Motion for:

- Layout transitions
- Inspector transitions
- Button and status feedback
- Reduced-motion-aware UI animation

Keep GSAP only where an existing complex interaction genuinely needs it. Do not use GSAP and Motion to control the same element.

### Architecture

Create shared design foundations before page-level changes:

- Semantic CSS variables
- Shared shell
- Shared navigation
- Shared buttons and fields
- Status component
- Workspace mode control
- Inspector shell
- Loading and feedback components

The large `showroom-intake-app.tsx` should be split only where necessary to isolate layout and motion responsibilities. Business state and domain behavior should not be broadly rewritten as part of the visual redesign.

## 14. Delivery Phases

### Phase 1: Foundation and Round 1

- Design tokens
- Typography
- Shared shell
- Navigation
- Core controls
- Round 1 dual-mode workspace
- Canvas interaction feedback
- iPad landscape and portrait behavior
- Round 1 loading, error, stale, and success states

### Phase 2: Project surfaces

- Project dashboard
- New project
- Project detail
- Renderings
- Login
- Route skeletons

### Phase 3: Administration and cleanup

- Users
- User logs
- Quotas
- Cabinet colors
- Remove obsolete one-off CSS
- Final visual and accessibility QA

Each phase must leave the product in a working and testable state.

## 15. Validation

Implementation is accepted when:

- Existing unit and integration tests pass
- New mode-switch and responsive behavior has test coverage
- Desktop and iPad layouts are visually checked
- Keyboard navigation is checked
- Reduced motion is checked
- Button, field, and status contrast passes WCAG AA
- Round 1 state survives mode switching
- Current workflow behavior and API calls remain intact
- No route, field, or business-status changes are introduced
- No decorative Uiverse effect conflicts with the studio design system

## 16. Approved References

- Uiverse component library: <https://uiverse.io/>
- Apple design analysis: <https://getdesign.md/apple/design-md>
- Local Apple analysis: `/Users/abcabinet/Desktop/module-2/awesome-design-md/design-md/apple/DESIGN.md`

These references inform interaction quality and restraint. They are not templates to copy directly.
