# Factor VIII Dashboard — React + FastAPI + SQLite migration

## Context

The current prototype was exported from a Claude Design project as a no-build, in-browser-Babel React app. The expected export is `Factor VIII Dashboard.html` plus `src/decay-engine.js`, `src/factor-chart.jsx`, `src/curve-editor.jsx`, `src/pareto.jsx`, `src/app.jsx`, and `src/styles.css`: state persists to `localStorage`, components are shared through global `window.*` objects, and the decay-curve/Pareto math runs client-side. Notably, `decay-engine.js` is expected to carry the comment *"Port of the FastAPI decay engine to plain JS. Mirrors backend/src/levels/service.py exactly"* — the design already assumed a Python backend would be the source of truth.

`design-reference/` now contains the complete Claude Design ZIP and its extracted contents: the HTML shell, all six referenced local source files, the generated thumbnail, three document-skin references, and two uploaded visual references. The HTML confirms the page title (`Factor VIII Monitor`), Inter and JetBrains Mono fonts, React 18.3.1, and pinned ReactDOM/Babel development scripts. The extracted file inventory matches the ZIP inventory, so source review and migration planning are no longer blocked.

We're migrating this into a real, deployable stack ahead of a move to k8s:
1. A proper React app (Vite + TS + a charting library) instead of script-tag Babel.
2. A FastAPI backend that owns the canonical default dataset and the canonical decay/Pareto math (matching the hint left in the original code).
3. SQLite for storage, structured as its own file/schema for this project but following a pattern that's trivial to replicate per-project when more services land on k8s.

**Decisions confirmed with the user:**
- Frontend: Vite + React + TypeScript, managed with **Bun**, with **Recharts** replacing the hand-rolled SVG charts. Recharts was selected because its responsive composed-chart, line/scatter, reference-region, tooltip, and custom-renderer primitives cover both production charts without requiring us to build the chart framework ourselves. Visual output will be close to the original but not pixel-identical — refill tick marks, the flipping "now" label, and Pareto point/front styling will use custom renderers. See the [Recharts TypeScript guide](https://recharts.github.io/en-US/guide/typescript/) and [`ResponsiveContainer` API](https://recharts.github.io/en-US/api/ResponsiveContainer/).
- Frontend linting: **Oxlint** replaces the Vite template's ESLint setup. It provides the needed React, TypeScript, React Hooks/Refresh, and JSX accessibility rule families without adding frontend test libraries. TypeScript compilation remains a separate required check.
- Frontend test libraries are deliberately deferred during bootstrap. Vitest, DOM test environments, React Testing Library, and Playwright will be selected and installed later, when there are production components and user flows to test; the final automated-test acceptance criteria remain unchanged.
- Backend is required regardless (SQLite needs a server). Given that, FastAPI becomes the **single source of truth for the curve/Pareto math**, in addition to serving the canonical defaults:
  - `POST /api/compute/curves` returns the full 168h series + stats (peak/trough/auc/mean/halving time) for a set of curve params. Frontend fetches this whenever curve params change (on load, after save) — not per keystroke.
  - `POST /api/compute/pareto` returns the best discrete schedule for each feasible shot count plus the two-objective efficiency front, debounced on parameter changes.
  - The moving "now" marker (current hour/level) is **interpolated client-side from the already-fetched hours/levels array** — this mirrors what the existing hover-crosshair code already does client-side (`idxAt`/`valAt` in `factor-chart.jsx`), so it's not a duplication of business logic, just array interpolation, and avoids polling the backend every 60s.
  - The CurveEditor performs only structural input validation in the frontend. Decay rate, half-life, curve points, and all other pharmacokinetic values are calculated exclusively by FastAPI and displayed only after a successful backend compute response. There is no frontend decay formula or per-keystroke pharmacokinetic preview.
- DB: SQLite file owned by this project (`backend/data/factor8.db`), created/migrated at startup. All database access uses SQLAlchemy and all schema migrations use Alembic operations; application code and migration files must not execute raw SQL or use Python's `sqlite3` module directly. No cross-project `project_id` column — each future project gets its own file following the same `backend/app/db/` pattern, so splitting onto separate k8s volumes later is trivial.
- No auth — single implicit user, matching today's behavior.
- Runtime configuration has no source-code defaults. The application name, API prefix, database URL, and allowed frontend origins are required `FACTOR8_` environment values. Canonical initial curve/settings payloads are defined in `backend/app/db/seed.py`. Local environment examples belong in `backend/.env.example`; deployment values come from environment/ConfigMap/Secret configuration. Route suffixes remain stable API contracts rather than configurable deployment values.
- Project bootstrap is user-owned: the user wants to set up the Vite and Python projects personally. Planning/review may continue, but no agent should run scaffolding commands, install dependencies, or begin application implementation until the user explicitly says setup is complete and asks implementation to start.

### Canonical defaults and temporary frontend scenarios

The database stores the canonical default curves and default application values. The frontend treats the API response as immutable baseline data and creates a separate working copy for experimentation:

- On every normal browser load or refresh, fetch and display the database-backed defaults first. A previous local experiment must never silently replace them.
- Editing, adding, deleting, hiding, or reordering a curve in the normal dashboard changes only the frontend working set. These actions trigger compute requests with the temporary parameters but do **not** write to SQLite.
- A future “Add as medicine” action from the coverage planner must add only to the current frontend working set and must wait until the curve schema can represent mixed per-infusion doses faithfully.
- A clear **Reset to database defaults** action discards the working set and refetches the canonical defaults.
- LocalStorage may persist harmless display preferences such as theme, density, and skin. It may also store explicit drafts or named scenarios later, but a stored scenario is restored only through an explicit user action; it is never auto-applied on startup.
- The frontend should label modified data as a temporary scenario so the user can distinguish it from the database defaults.
- V1 exposes read endpoints for canonical curves/default settings plus compute endpoints. Normal frontend interactions do not call curve/settings write endpoints. Administrative mutation of canonical defaults is outside the v1 dashboard scope.

### UTC date/time contract

Infusion schedules represent recurring instants, not display strings. V1 uses an exact 168-hour recurrence anchored by timezone-aware UTC datetimes:

- The backend uses timezone-aware Python `datetime` values only. Reject naive datetimes at the API boundary and normalize accepted values to `datetime.UTC` before storage or calculation.
- JSON has no datetime type, so API datetimes use RFC 3339/ISO 8601 strings normalized to UTC with a `Z` suffix, for example `2026-08-19T04:30:00.000Z`. Accept explicit offsets on input only if they are immediately normalized to UTC; reject strings with no offset.
- SQLite stores the same canonical UTC text representation. Never store locale-formatted values, browser offsets, or naive `YYYY-MM-DD HH:MM:SS` values.
- The frontend API layer parses UTC strings into valid JavaScript `Date` objects once at the boundary. Application components use `Date`, not raw date strings. When sending data, use `date.toISOString()` so transport is UTC.
- Display dates with a cached `Intl.DateTimeFormat` using the browser's locale and default timezone. Show the local UTC offset/timezone in schedule and editor contexts where ambiguity matters. Never adjust offsets manually.
- A weekly infusion stores a UTC anchor instant and repeats every exactly 168 elapsed hours. This matches the model's fixed 168-hour cycle. Around daylight-saving changes, its browser-local displayed clock time can therefore shift by one hour; this is intentional for the UTC-interval model.
- If the product later needs “the same local wall-clock time every Wednesday” semantics, replace the fixed UTC interval with an explicit recurrence rule plus an IANA timezone. A numeric offset alone is insufficient because daylight-saving rules change over time.
- The editor presents a recurring weekday plus browser-local time rather than a calendar date. It resolves that choice to the matching occurrence in the current local week, creates a valid `Date`, and serializes it to UTC. Invalid or nonexistent local times must produce a validation error rather than silently changing the schedule.

## Project setup ownership and handoff

The user performs the initial repository setup. The commands and target structure below are a checklist for that manual setup, not authorization for an agent to execute them.

User-owned setup includes:

- Create `frontend/` with Vite's React + TypeScript template using Bun, install Recharts, and commit `package.json` plus `bun.lock`. Do not create or commit `package-lock.json`.
- Create `backend/` with the chosen Python project/dependency manager, FastAPI/Uvicorn and test dependencies, package markers, `pyproject.toml` (preferred over an unresolved `pyproject.toml or requirements.txt` choice), and its lockfile.
- Decide the supported Node and Python versions and record them in normal project tooling/documentation.
- Confirm the initial frontend and backend skeletons run locally before handing the repository back for feature implementation.

Handoff gate:

- Until the user explicitly says the setup is complete, work is limited to reviewing and editing planning/documentation when requested.
- After handoff, first inspect the user-created structure and dependency versions; preserve those choices rather than re-scaffolding or replacing project configuration.
- Implementation begins only on an explicit user request. A completed setup does not itself authorize implementation.

## Frontend bootstrap checklist

This checklist is intentionally separate from feature migration. The user executes each item and we update its checkbox together after verifying the result. Do not start porting dashboard components merely because the bootstrap is complete.

**Progress:** the frontend bootstrap, typed data layer, and Migration Step 8 are complete. Migration Step 9's Recharts `FactorChart` is implemented with all three curve styles, multi-series visibility, refill and current markers, tooltip, and a key-values table alternative; containerized visual verification is the current focused item.

- [x] Agree on the frontend bootstrap sequence and ownership.
- [x] Select **Recharts** as the charting dependency after comparing it with visx and Nivo against the two required chart workflows.
- [x] Use the user's saved Claude Design project as the accepted rendered visual reference. Local baseline screenshots are not required as a bootstrap or implementation gate; the unchanged export in `design-reference/` remains the local source reference.
- [x] Standardize on **Bun 1.3.14** as the frontend package manager and task runner. `package.json` records `"packageManager": "bun@1.3.14"`; commit `bun.lock` and use `bun install --frozen-lockfile` (or `bun ci`) for reproducible CI installs.
- [x] Use **Node 26.x** during development. `frontend/.nvmrc` records `26` and `package.json#engines` requires `>=26 <27`; the inspected environment uses Node 26.5.0. Node 26 remains a Current release until its planned LTS transition, so production deployment must either wait for/use the Node 26 LTS release or use an LTS runtime supported by the locked frontend toolchain.
- [x] Scaffold `frontend/` with Vite's `react-ts` template:

  ```bash
  bun create vite frontend --template react-ts
  cd frontend
  bun install
  ```

- [x] Install the production chart dependency:

  ```bash
  bun add recharts
  ```

- [x] Defer frontend test dependencies during bootstrap. Do not install Vitest, jsdom, React Testing Library, `@testing-library/jest-dom`, `@testing-library/user-event`, or Playwright yet.
- [x] Add Oxlint and a basic React/TypeScript configuration; `bun run lint` passes on the generated scaffold.
- [x] Enable Oxlint's built-in `jsx-a11y` rules. Type-aware Oxlint is deliberately deferred; `tsc` remains the authoritative typecheck.
- [x] Add and verify the initial package scripts: `dev`, `build`, `lint`, and `typecheck`. `typecheck` runs TypeScript without emitting files. Add `test` scripts later with the chosen test tooling.
- [x] Create the production source folders `src/api/`, `src/components/`, and `src/lib/`. They were added with the first production migration slice after bootstrap verification.
- [x] Configure Vite's development server to proxy `/api` to `VITE_API_PROXY_TARGET`, allowing frontend code to use the same relative `/api/...` URLs in development and production. The local fallback remains `http://localhost:8000`.
- [x] Verify the clean skeleton with `bun run lint`, `bun run typecheck`, and `bun run build`, then launch `bun run dev` and confirm the placeholder page renders without console errors. All four checks pass with the minimal Factor VIII placeholder.
- [x] Commit the working frontend bootstrap as its own checkpoint (`e9a0e7`). Production source folders and API proxy are intentionally added in the first migration slice rather than the bootstrap commit.
- [x] Hand the running skeleton back for inspection and explicitly begin implementation. The first feature slice is Step 7's typed data layer.
- [ ] Before final frontend verification, select and install the component/end-to-end test tooling, add the test scripts and shared setup, and implement the automated checks required by the acceptance criteria. This is explicitly outside the bootstrap phase.

## Design inputs and acceptance criteria

Claude Design can export a working design as a ZIP or standalone HTML, so the complete exported code is the primary design reference, not this plan by itself ([Anthropic: Get started with Claude Design](https://support.claude.com/en/articles/14604416-get-started-with-claude-design)). The export is prototype input rather than production architecture: Vite, TypeScript, the API data layer, and the charting library may change the DOM, but they must preserve the agreed experience.

### Required inputs and source-of-truth order

1. **Complete export in `design-reference/`.** It must contain the HTML shell and every local file it loads: `src/styles.css`, `src/decay-engine.js`, `src/factor-chart.jsx`, `src/curve-editor.jsx`, `src/pareto.jsx`, and `src/app.jsx`. Any fonts, icons, images, or other assets referenced by those files must also be present or explicitly documented as external.
2. **Rendered reference.** The user's saved Claude Design project is the accepted visual reference. Local pre-port screenshots are optional rather than a gate. During implementation, verify the migrated application at desktop (1440 px wide), tablet (768 px), and mobile (390 px), including the default dashboard, medicine editor, constant-level medicine, Pareto panel, tooltip/hover state, and Tweaks panel.
3. **Exported source.** For component behavior, labels, default values, validation, chart semantics, and interaction details not visible in a screenshot, the complete Claude Design source is authoritative.
4. **This plan.** Where production architecture intentionally differs from the prototype (canonical defaults versus temporary scenarios, backend math, chart library DOM, error handling), this plan wins. Any intentional visual or behavioral deviation discovered during the port is recorded here before implementation.

The uploaded reference now passes item 1. The three `screenshots/*.jpg` files and two `uploads/*.png` files are visual inspiration supplied to Claude Design, while the saved Claude Design project provides the accepted rendered reference. The generated `.thumbnail` is only a partial convenience preview. No additional local baseline capture is required before implementation.

### Verified design and behavior inventory

The complete source defines the following acceptance surface:

- A centered, single-column dashboard (`max-width: 1080px`) with medicine chips, five headline statistics, a 168-hour multi-medicine chart, per-medicine comparison table, infusion schedule, Pareto accordion, right-side medicine editor, and floating Tweaks panel.
- Two materially different skins: `clinical` (Inter, rounded/pill controls, soft surfaces) and `document` (JetBrains Mono, square controls, dashed rules, heading markers), each with light/dark themes. Clinical also has five accent choices; both skins support spacious/compact density and line curves.
- A responsive breakpoint at 840 px: statistics become two columns, detailed comparison columns are hidden, schedule rows become two columns, Pareto controls stack, and Pareto detail metrics become two columns. The source has no smaller dedicated breakpoint, so 390 px behavior must be checked explicitly rather than assumed.
- The exported prototype has an active-medicine workflow with add, edit, delete, visibility toggling, multiple weekly infusions, explicit constant-level curves, a live signed-rate/half-life preview, and automatic persistence in `localStorage`. Production intentionally changes both behaviors: medicine edits use the canonical-default/temporary-scenario model above, and calculated decay/half-life values appear only after a backend compute response. Only display preferences may auto-persist locally.
- A chart with weekday divisions, active/inactive curve styling, infusion ticks, moving current-level markers, a right-edge-flipping "now" label, and a mouse-only crosshair/tooltip.
- A sport-window planner with a maximum IU constraint, selectable 250/500/1000 IU doses, a linear `reference dose -> immediate rise` calibration, one shared infusion time, configurable start/end weekdays, a soft reference floor, selectable exact shot counts, and concrete schedule metrics.

The source review also confirms production gaps that the acceptance work must address: the editor lacks dialog semantics/focus management/Escape handling, SVG chart points are mouse-only, delete has no confirmation, color swatches share the same accessible name, validation accepts non-decaying measurements, and the Claude Design `postMessage` listener accepts messages from any origin.

### Production decisions to make from the export

- Inventory the exact layout hierarchy, spacing, colors, radii, typography, responsive breakpoints, chart dimensions, animation, and component states before rewriting components.
- Preserve Inter for UI text and JetBrains Mono for numeric/technical text unless the rendered export shows a different usage. Decide whether production may fetch Google Fonts or must self-host them.
- Preserve exported labels, units, numeric precision, weekday ordering, color meanings, hover/click behavior, refill markers, and the right-edge flip behavior of the "now" label.
- Define production states that a happy-path prototype commonly omits: initial loading, empty curve list, API/network failure with retry, form validation, compute-in-progress, Pareto no-results, stale-response suppression, and delete confirmation.
- Treat the exported `postMessage` edit-mode handshake as Claude Design host integration. Remove it unless the deployed app is intentionally embedded in a compatible editor. If retained, document the message schema and validate `event.origin`; do not port an unrestricted listener unchanged.
- Do not copy CDN script tags or in-browser Babel into production. Pin Bun-managed frontend and Python dependencies and commit their lockfiles.

### Frontend design language and reuse

The Claude Design export is the visual and behavioral source reference, while the production design system is owned by Level8. Production code must preserve the recognizable design language without carrying over prototype architecture, Claude host integration, global `window.*` components, or feature-specific assumptions into reusable UI primitives.

#### Visual foundation

The reusable foundation consists of semantic design tokens rather than copied component CSS:

- Color roles: page background, surface, primary and secondary text, muted text, subtle and strong borders, accent, accent surface, and danger.
- Typography roles: Inter for clinical interface text and JetBrains Mono for measurements, schedules, and technical values.
- Geometry: compact square-to-soft radii, pill treatment only for choice controls, a centered `1080px` content width, and thin borders rather than elevation-heavy cards.
- Spacing and density: a small shared spacing scale with spacious and compact density modes. Component spacing should consume the shared scale instead of introducing unrelated one-off values.
- Interaction states: hover, active, disabled, loading, error, selected, hidden, and keyboard focus must have consistent treatments. Visible focus is part of the design language, not a browser-default afterthought.
- Responsive behavior: `840px` remains the primary design breakpoint from the export, with explicit verification at `390px` for mobile overflow and stacking.
- Skins and themes: clinical/document and light/dark are token overrides. Components must not contain theme-specific branching when a token can express the difference.

#### Reuse boundaries

Keep the production frontend in four conceptual layers:

1. **Foundation:** tokens, fonts, reset/base styles, themes, density, and focus treatment. This layer is portable across projects.
2. **UI primitives:** controls such as `Button`, icon buttons, segmented choices, fields, dialogs, status messages, and generic metric presentation. These components accept data and callbacks, contain no API calls, and do not import Factor VIII domain types.
3. **Product components:** `MedTabs`, `StatsRow`, `ScheduleList`, `CompareTable`, `CurveEditor`, `FactorChart`, and Pareto components. They compose primitives and intentionally understand Factor VIII domain models.
4. **Feature orchestration:** `App`, hooks, API clients, DTO mapping, temporary-scenario state, and pharmacokinetic display helpers. This layer is application-specific and must not leak into the design-system package.

`MedTabs` is a product adapter, not the reusable pill primitive: a future generic choice component may accept `{id, label, color}` items, while `MedTabs` maps `Curve` objects into that interface. Likewise, the repeated visual stat treatment may become a generic metric component, but the medical labels and calculations remain in `StatsRow`.

Do not extract a primitive merely because markup appears twice. Extract it when it has a stable visual contract, meaningful behavior, or a demonstrated second consumer. This avoids replacing readable JSX with speculative abstractions.

#### CSS and module organization

`App.css` may remain combined while the first frontend slice is being matched to the reference. Before the design language is reused by another project, separate it along these boundaries:

```text
src/
  styles/
    tokens.css
    base.css
    themes.css
    layouts/
      dashboard.css
  components/
    ui/
      Button.tsx
      ChoicePills.tsx
      Metric.tsx
      StatusState.tsx
    dashboard/
      MedTabs.tsx
      StatsRow.tsx
      DashboardHeader.tsx
```

Foundation and primitive selectors must be scoped or named so they cannot collide with host-project CSS. Product layout selectors remain with the product. Component variants exposed in TypeScript must each have complete styling in every supported skin/theme; the component API and CSS API cannot drift.

Font delivery is part of the reusable foundation. Google Fonts matches the reference during development, but production must make an explicit fetch-versus-self-host decision before this design system is treated as independently deployable.

#### Extraction and verification criteria

The design language is ready to reuse outside Level8 only when:

- foundation tokens and UI primitives can render without importing Factor VIII types, hooks, or API modules;
- every documented component variant has a visual example and keyboard behavior;
- clinical/document and light/dark combinations pass visual and contrast review;
- primitives render correctly at the three target widths without relying on dashboard-specific ancestors;
- automated tests cover component states and accessibility-critical interactions;
- another project can consume the foundation and primitives without copying `App.css`, application hooks, or domain DTOs.

Keep the reusable layers inside this repository until a real second project proves the API. Package extraction, versioning, and a component catalogue are later steps, not prerequisites for completing the Factor VIII dashboard.

### Acceptance criteria

- The complete reference renders without missing local-file requests or console errors before component migration begins.
- At the three target widths (1440, 768, and 390 px), the migrated page preserves information hierarchy, content order, typography roles, main spacing, responsive stacking, controls, and chart meaning. Pixel identity is not required, but all deviations that affect layout, interaction, or interpretation are intentional and documented.
- Every interactive control is reachable and operable with a keyboard, visible focus is retained, form controls have programmatic labels, the editor behaves as a modal/side panel with correct focus return, and charts expose a text/table alternative for their key values.
- Color is not the only way to distinguish medicines, Pareto status, feasibility, or thresholds. Light/dark themes meet WCAG 2.2 AA contrast for text and controls.
- Loading, empty, error, validation, and no-feasible-schedule states are implemented and visually checked in addition to the golden path.
- Automated frontend checks include `lint`, `typecheck`, production build, component tests for forms/state, and end-to-end coverage of the default dashboard, temporary add/edit/delete medicine, constant-level medicine, refresh/reset back to database defaults, theme persistence, and sport-window shot-count selection.
- If visual regression screenshots are introduced later, compare stable migrated states against the accepted Claude Design reference and mask/tolerate the clock-driven "now" marker and other nondeterministic text. A committed local baseline suite is optional.

## Pharmacokinetic decay formula and sign convention

The application uses a deliberately simple mono-exponential model inferred from one post-infusion measurement. Let:

- `P` be the measured peak immediately after infusion;
- `M` be a later measured level;
- `t` be elapsed time in hours, with `t > 0`;
- `lambda` be the signed exponential rate in `h^-1`.

The model is:

```text
L(t) = P * exp(lambda * t)
M    = P * exp(lambda * t)

lambda   = (ln(M) - ln(P)) / t
         = ln(M / P) / t
halfLife = ln(0.5) / lambda
         = abs(ln(2) / lambda)       when lambda < 0
```

This intentionally preserves the convention in the earlier `hemo-insight/backend/src/levels/service.py` and `common/utils.py`: a decaying level has a **negative** `lambda`, curve evaluation uses `exp(lambda * elapsed)`, and the half-life helper takes `abs(ln(2) / lambda)`. Some literature instead names a positive decay constant `k = -lambda` and writes `P * exp(-k*t)`; the two forms are equivalent, but mixing their signs is not. For API compatibility the field remains `decayConstant` and contains the signed negative rate; code and documentation should call it a signed decay rate where ambiguity matters.

For the Altuvoct example (`P=110`, `M=10`, `t=168h`):

```text
lambda   = -0.0142731861 h^-1
halfLife = 48.5628908 h
L(168)   = 10 (within floating-point tolerance)
```

Validation and edge-case contract:

- For an ordinary decaying curve require finite values with `P > 0`, `M > 0`, `t > 0`, and `M < P`. Reject `M > P` as growth/inconsistent input rather than silently producing a positive rate.
- `M == P` gives `lambda == 0` and an undefined/infinite half-life. Represent this through the explicit `is_constant` curve type; return `halvingTime: null`, never divide by zero.
- Reject/normalize NaN and infinity before JSON serialization. Compute with full precision and round only for display.
- The old `calculate_decay_constant_from_measurement()` duplicate accesses `measurement.measured_level`, while its `DecayConstantParameters` schema exposes `second_level_measurement`; the live router avoids this by calling the shared helper with the correct field. Do not copy the dormant field-name bug into the new service.
- The recovered `decay-engine.js` confirms the old weekly behavior: exact refill points use `hour - 0.1`, and the main dashboard initializes the week from only the last refill of the previous week. It also samples every 0.2 hours rather than Python's 0.1 hours, injecting refill times into that grid. Capture these as legacy regression fixtures, but use one documented canonical model rather than claiming the implementations match exactly.
- The recovered optimizer and main dashboard currently disagree: `pareto.jsx` iterates a repeating schedule 60 times toward periodic steady state, while `decay-engine.js` uses the one-previous-refill approximation. A schedule added from Pareto can therefore display different peaks/troughs on the main chart. The backend must use the same periodic steady-state evaluator for both curve display and optimization (prefer an analytic cyclic solution or convergence tolerance over an unexplained fixed 60 iterations).
- The recovered week grid stops before hour 168. This omits the final integration segment and can leave `currentLevel` at its initial zero late on Sunday when there is no next sample for interpolation. The canonical series must include both endpoints `0` and `168` (or explicitly interpolate cyclically), define its sampling interval, and integrate the complete week.
- The export's refill parser accepts display strings and rounds to 0.1 hour (six-minute increments). Production instead derives exact offsets from timezone-aware UTC anchor datetimes, preserves their full precision, and rounds only chart coordinates or displayed values.
- This single-measurement, mono-exponential, additive-dose model is educational and is not a population PK model or dosing recommendation. Keep that limitation visible in the UI and README.

Required formula tests:

- The numerical Altuvoct example above, including rate sign, reconstructed measurement, and half-life.
- Scale invariance: multiplying `P` and `M` by the same positive number does not change `lambda`.
- Constant, invalid-growth, zero/negative, NaN/infinity, and extremely small-rate cases.

## Pareto optimization and decision display

### Confirmed use case and optimization model

The requested decision is narrower than the exported weekly three-objective plot: doses are discrete (initially 250, 500, and 1000 IU), total factor has a hard upper bound (initially 1500 IU), protection is evaluated over a configurable activity window (initially Monday through Thursday), and the user wants to compare exact shot counts.

Research supports individualizing factor dose, interval, and timing around activity, but not treating a high average as a direct guarantee of bleed protection. The WFH says prophylaxis should reflect individual PK, lifestyle, and activity; it specifically notes that sports may be better supported by factor levels at participation time than by trough alone ([WFH Guidelines, chapter 6](https://www1.wfh.org/publications/files/pdf-1863.pdf)). Herbert et al. evaluated exact/grid-searched schedules using time above a threshold, lowest level, and estimated bleed risk, and found that the preferred regimen depends on the person's activity pattern ([Optimization of prophylaxis for hemophilia A](https://pubmed.ncbi.nlm.nih.gov/29447219/)).

The resulting v1 model is:

```text
hard constraints: enabled dose sizes, maximum IU, selected day window, at most one shot per day
within each exact shot count: maximize predicted mean level across the selected window
tie-breakers: maximize the lowest window level, then use less total IU, then stable schedule order
across shot counts: minimize shots and maximize mean level
```

This is a small finite combinatorial problem, so exhaustive enumeration is the correct method. With four days and three dose sizes there are only `(3 + 1)^4 - 1 = 255` non-empty assignments before applying the IU limit. A stochastic/evolutionary optimizer would add uncertainty without benefit.

The two-objective nondominated set remains useful internally for marking efficient trade-offs, but a technical Pareto scatterplot is not the clearest primary UI. The frontend instead shows one best schedule per exact shot count as selectable comparison cards. This directly answers “what happens to the average if I use one, two, three, or four shots?” without selecting a preferred burden/coverage trade-off on the user's behalf.

Average level alone can favor earlier, larger doses and conceal weak coverage near the end of the window. Therefore every option also shows its lowest predicted level and hours below a user-supplied reference floor. The floor is a soft informational reference, not an automatic clinical target or a feasibility rule. The UI keeps the educational-model disclaimer and directs individualized target selection to the treating hemophilia team.

### V1 presentation

1. Default to Monday–Thursday, 1500 IU maximum, and enabled 250/500/1000 IU dose sizes; allow all of these values and the common infusion time to be changed.
2. Show one accessible choice per feasible exact shot count. Each choice displays its best average and the change from the previous shot count; nondominated choices are labelled “Efficient trade-off.”
3. Selecting a shot count shows average level, lowest level, total IU, hours below the reference floor, and the concrete local weekday/time schedule.
4. Use the same analytic 168-hour periodic steady-state contribution model as the main curve calculation. The backend owns enumeration and all pharmacokinetic calculations; the frontend only maps UTC dates and renders results.
5. Do not use an opaque weighted score or label one option “recommended.” The user's chosen shot count supplies the burden preference.

### Uncertainty and correctness requirements

- This is a finite, discrete enumeration problem, so calculate the exact nondominated set after enumeration rather than using an evolutionary approximation unless the search space becomes demonstrably too large.
- Bound `maximumIU`, number/value of `doseSizes`, infusion slots, candidate count, and execution time. Return a clear “search space too large” validation error rather than exhausting the API worker.
- Fix the v1 roles in the API contract: the selected IU maximum is a hard constraint; exact shot count is the user-controlled burden; window mean is maximized within each count; lowest level and time below the soft reference floor are display warnings; the efficiency front minimizes shots and maximizes mean.
- Replace the optimizer's unexplained fixed 60 steady-state iterations with the same analytic cyclic contribution model used by the main curve, so identical schedules produce consistent level predictions.
- Add tests for minimization/maximization direction, equal points, duplicates, tolerance, infeasible schedules, front nondominance, and deterministic ordering. Do not assume injection count must increase monotonically unless that follows from the selected axes and enumeration rules.
- Deterministic point estimates can overstate certainty. V1 must label outputs as model estimates. A later sensitivity view should vary the measured inputs/decay rate over an explicit range and show whether a schedule remains feasible; do not present an uncertainty band without a defined source for that range.
- Explain in plain language that an “Efficient trade-off” is not worse on both shot count and predicted average than another displayed option; it is not a medical recommendation.

## Implementation steps

1. **User setup and design reference.** The source-completeness gate passes, the saved Claude Design project is the accepted rendered reference, and the user keeps the extracted export unchanged. The user scaffolds Vite with React + TypeScript and creates the Python project as described in the setup handoff. No agent executes setup or implementation in this step. After the user explicitly hands off the running skeletons and requests implementation, inspect them and continue without re-scaffolding.
2. **Charting library selection — complete.** The required chart workflow is a multi-series line curve with a custom hover tooltip and "now" markers (`FactorChart`). The sport-window planner uses accessible HTML comparison cards because the revised decision has only one best option per exact shot count and does not benefit from a technical scatterplot. The charting-library candidates were:
   - **Recharts — selected.** Its composable `ComposedChart` and responsive Line/ReferenceDot/ReferenceLine primitives match the factor chart, and it ships TypeScript definitions. App-specific overlays still use custom shapes/renderers.
   - **visx** (Airbnb) — lower-level primitives over D3, with more control for custom overlays such as the flip-label now-marker at the cost of more code per chart.
   - **Nivo** — polished defaults, less flexible for the specific hand-tuned interactions (crosshair tooltip, clickable Pareto points) this app relies on.
3. **Fill in the user-created FastAPI + SQLite backend skeleton after handoff, in reviewable slices.** First add the application/configuration and SQLAlchemy/Alembic foundation. Then implement `GET /api/curves`, `GET /api/settings`, and `POST /api/compute/curves` one at a time. Backend automated tests are deferred until the user explicitly starts the testing phase. `POST /api/compute/pareto` remains a later Pareto-workflow slice rather than part of the initial backend integration. Do not use raw SQL or direct `sqlite3` calls.
4. **Port and unify `decay-engine.js` → `backend/app/services/decay_engine.py`.** Characterize the recovered export against the earlier Python service, then implement the explicit formula/sign/edge-case contract and shared periodic steady-state evaluator above. Add `tests/test_decay_engine.py` with the numerical Altuvoct regression, inverse reconstruction, invalid inputs, constants, complete-week integration/interpolation, refill-boundary behavior, steady-state convergence, and intentionally retained legacy fixtures before moving on.
5. **Port and clarify `pareto.jsx` math → `backend/app/services/pareto.py` — implemented.** The backend performs bounded exact enumeration over the selected window, evaluates schedules analytically at periodic steady state, selects the maximum-window-mean schedule for each exact shot count with deterministic tie-breakers, and returns the two-objective efficiency front. Add `tests/test_pareto.py` for exact nondominance, objective directions, ties, tolerance, bounds, deterministic ordering, integration boundaries, and agreement with the shared curve evaluator when the deferred automated-testing phase begins.
6. **Complete the FastAPI routes incrementally — current v1 routes implemented.** Routes remain thin. `GET /api/curves`, `GET /api/settings`, `POST /api/compute/curves`, and `POST /api/compute/pareto` are wired. Administrative writes to canonical defaults are outside v1. Add API tests only when the deferred backend testing phase begins.
7. **Frontend data layer — complete.** `types.ts`, domain-specific transport contracts under `dto/`, `api/client.ts` (shared HTTP request handling), domain clients `api/curves.ts`, `api/settings.ts`, and `api/pareto.ts` (endpoint wrappers plus UTC-string-to-`Date` boundary mapping), and `lib/dateTime.ts` (UTC validation/serialization, browser-local formatting, sorting, and fixed-week position helpers). No pharmacokinetic formulas are implemented in the frontend.
8. **Migrate the simple components — complete.** `App.tsx` fetches canonical defaults, creates and labels a temporary working set, exposes reset, and wires locally persisted display preferences without the Claude Design `postMessage` handshake. `MedTabs`, `StatsRow`, `ScheduleList`, `CompareTable`, `Tweaks`, and the accessible `CurveEditor` are implemented. Saving the editor updates only the working set and triggers `/api/compute/curves`; it never writes canonical curves to the database. The editor performs structural validation only, resolves recurring browser-local weekday/time choices to UTC API datetimes, returns focus on close, supports Escape, and confirms deletion.
9. **Migrate `FactorChart.tsx` — implemented, visual verification pending.** The Recharts composed chart provides a line-only presentation with active/inactive styling, weekday divisions, refill tick marks, hover/keyboard tooltip, and current marker with a right-edge-flipping label. Values on the unified chart grid are interpolated only from backend-returned arrays; no decay formula has returned to the frontend. The shaded-area and stepped presentations were removed after review. Weekly AUC remains in the computation/API contract; the normalized average level is the corresponding UI summary for the fixed 168-hour window.
10. **Migrate and clarify `ParetoSection.tsx` + `ParetoPlot.tsx` — implemented, visual verification pending.** The section is now a simple sport-window coverage planner: editable day range, common infusion time, maximum IU, 250/500/1000 IU dose toggles, calibration, and soft reference floor; selectable exact-shot-count cards show the best average and efficient front; the selected detail shows average, lowest level, factor used, time below reference, and schedule. Requests use `/api/compute/pareto`, a ~300 ms debounce, cancellation, and stale-response protection. “Add as medicine” is deferred because the current curve model assigns one common peak to every infusion and cannot faithfully represent mixed-dose schedules.
11. **End-to-end verification.** Run backend (`uvicorn`) + frontend (`vite dev`) together, exercise the app in a browser per the Verification section below.
12. **Update `README.md`** with run instructions for both services.

## Target layout

```
level8/
  design-reference/             # complete immutable Claude Design export
    Factor VIII Dashboard.html
    src/                        # complete styles.css, decay-engine.js and exported JSX sources
  frontend/
    index.html
    package.json, bun.lock, vite.config.ts, tsconfig.json
    src/
      main.tsx, App.tsx, styles.css (ported ~verbatim from src/styles.css)
      dto/
        curves.ts              # curve request/response transport contracts
        settings.ts            # settings response transport contract
        pareto.ts              # Pareto request/response transport contracts
      api/client.ts            # shared JSON request and error handling
      api/curves.ts            # canonical curve loading and curve-compute boundary mapping
      api/settings.ts          # canonical settings loading
      api/pareto.ts            # Pareto-compute boundary mapping
      types.ts                 # Curve, ComputedCurve, Settings, ParetoResult types
      lib/
        dateTime.ts            # UTC Date boundary, local formatting, sorting, fixed-week helpers
      components/
        MedTabs.tsx, StatsRow.tsx, ScheduleList.tsx, CompareTable.tsx
        FactorChart.tsx        # chart-library port of factor-chart.jsx (library from Step 2)
        CurveEditor.tsx        # side panel, ports curve-editor.jsx
        ParetoSection.tsx, ParetoPlot.tsx   # sport-window controls and shot-count comparison
        Tweaks.tsx
  backend/
    pyproject.toml, lockfile, README, alembic.ini
    app/
      main.py                  # FastAPI app, CORS for :5173 dev, StaticFiles mount for prod build
      config.py                # typed environment configuration, including the DB path
      api/
        router.py              # combines the API route modules
        routes/
          curves.py            # GET /api/curves canonical defaults
          settings.py          # GET /api/settings canonical defaults
          compute.py           # POST /api/compute/curves, POST /api/compute/pareto
      dto/                     # Pydantic API request/response DTOs
        curves.py
        settings.py
        pareto.py
      services/
        decay_engine.py        # formula-contract implementation, regression-checked against export/legacy
        pareto.py              # explicit enumeration, feasibility, dominance, front and envelope contract
      db/
        connection.py          # SQLAlchemy engine/session configuration
        models.py              # SQLAlchemy persistence models
        repositories.py        # canonical curve/settings reads through SQLAlchemy
        seed.py                # first-run canonical defaults through SQLAlchemy
    migrations/                # Alembic environment; no raw SQL migrations
      env.py
      versions/
        0001_initial.py        # Alembic operations for the initial schema
    tests/
      conftest.py
      unit/
        test_decay_engine.py    # known-value regression tests (Altuvoct example etc.)
        test_pareto.py
      integration/
        test_api.py             # TestClient smoke tests for read + compute endpoints
        test_database.py
    data/
      .gitkeep
  README.md                    # update with run instructions for both services
```

The backend uses compact, explicit boundaries: route modules handle HTTP, `dto/` owns Pydantic transport models, `services/` owns framework-independent calculations, and `db/` owns persistence through SQLAlchemy. Alembic exclusively owns schema migrations. Raw SQL and direct `sqlite3` access are prohibited. Additional application/domain/infrastructure layers are deliberately deferred unless the codebase develops responsibilities that need them.

## DB schema (`backend/migrations/versions/0001_initial.py`, SQLite via Alembic)

The SQLAlchemy persistence model and Alembic migration define:

- `curves`: text primary key, name, peak/measurement values, elapsed time, a JSON list of UTC infusion anchors, color, visibility/constant flags, sort order, and UTC creation/update timestamps.
- `app_settings`: text key/value canonical defaults; harmless display preferences may override these client-side.

Seed `curves` with the current default (Altuvoct) row on first run if the table is empty, matching `DEFAULT_CURVES` in `app.jsx`.

## API surface

- `GET /api/curves` — returns the canonical database-backed default curves. The normal dashboard has no curve write endpoint in v1.
- `GET /api/settings` — returns canonical application defaults. Harmless display preferences may be overridden from localStorage after the canonical data is loaded.
- `POST /api/compute/curves` — body: list of curve params with `weeklyInfusions[].startsAt` as offset-aware datetimes (+ optional `decay_constant` override where explicitly supported) → per-curve `{ windowStart, hours[], levels[], decayConstant, halvingTime, refillHours[], peak, trough, auc, meanLevel, constant }`; `windowStart` is the UTC instant represented by chart hour zero and `halvingTime` is `null` for a constant curve. The backend normalizes infusion anchors to UTC before deriving fixed-week offsets.
- `POST /api/compute/pareto` — body: `{ decayConstant, maximumIU, doseSizes[], referenceDose, referencePeak, windowStart, windowEnd, infusionSlots[], referenceLevel }`, with all datetimes offset-aware and normalized to UTC. It returns `{ windowStart, windowEnd, windowHours, recommendations[], front[] }`; each recommendation contains the best schedule for an exact shot count, UTC refill anchors/doses, total IU, window mean, lowest/peak level, time below reference, mean per 1000 IU, and reference-floor status. The front minimizes shots and maximizes window mean; `maximumIU` is a hard constraint and `referenceLevel` is informational.

## Component porting notes

- `factor-chart.jsx` → `FactorChart.tsx`: chosen library's composed-chart primitive with one `Line` per visible curve, a reference-dot for the "now" marker (custom overlay for the flip-to-left-when-near-right-edge label behavior), custom tooltip content replicating the existing `chart-tip` styling, weekday gridlines at each 24h boundary.
- `curve-editor.jsx` → `CurveEditor.tsx`: same side-panel form, with explicit weekday and browser-local time controls for the recurring weekly schedule. Resolve those controls to a valid current-week `Date` and UTC API string at the boundary. Save updates the temporary frontend working set and triggers `/api/compute/curves`; it does not mutate SQLite. The shell shows when the working set differs from the database defaults and provides an explicit reset.
- `pareto.jsx` → `ParetoSection.tsx` + `ParetoPlot.tsx`: replace the dense weekly plot with accessible shot-count comparison cards for the selected activity window. Keep the soft reference warning, concrete schedule details, debounced `/api/compute/pareto` calls, and cancellation of superseded requests. Mixed-dose add-as-medicine remains deferred until the core curve schema can express a dose/peak per infusion.
- `styles.css` ports over almost unchanged (it's already framework-agnostic); trim/adjust only what's now handled by the charting library's own DOM structure (e.g. `.chart-wrap`/`.chart-tip` become the library's tooltip/wrapper classes).
- `Tweaks.tsx` and theme/density/skin `data-*` attribute wiring on `<html>` port from `app.jsx`. The Claude Design `postMessage` edit-mode handshake does not port by default; retain it only under the reviewed embedding contract above.

## Verification

- Backend: `pytest backend/tests` — formula/sign/edge-case tests including Altuvoct (`lambda ~= -0.0142731861 h^-1`, half-life `~= 48.5629h`, reconstructed level `~= 10` at 168h), refill-boundary/steady-state behavior, exact Pareto nondominance and objective-direction tests, constraint/tie/duplicate/bounds cases, and `TestClient` smoke tests for canonical reads plus both compute endpoints.
- Frontend: run `uvicorn app.main:app --reload` (backend, port 8000) and `bun run dev` (frontend, port 5173) together; open in browser and confirm: database-default Altuvoct renders and matches the original chart shape; add/edit/delete affect only the temporary working set; refresh/reset returns to database defaults; display preferences may persist locally; and the sport-window planner recomputes shot-count options through the API.
- Date/time verification: reject naive API datetimes, prove offset inputs normalize to the same UTC instant, round-trip SQLite values with `Z`, render the same instant correctly in at least two browser timezones, and cover the documented daylight-saving shift for the fixed 168-hour recurrence.
- Drive this manually in a browser before calling the visual work done — golden path (view default curve), edit cases (add medicine and constant-level medicine), and sport-planner cases (1–4 shots, dose toggles, invalid/too-low IU limit, constant curve, and mobile layout).
