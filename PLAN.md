# Factor VIII Dashboard — React + FastAPI + SQLite migration

## Context

The current prototype was exported from a Claude Design project as a no-build, in-browser-Babel React app. The expected export is `Factor VIII Dashboard.html` plus `src/decay-engine.js`, `src/factor-chart.jsx`, `src/curve-editor.jsx`, `src/pareto.jsx`, `src/app.jsx`, and `src/styles.css`: state persists to `localStorage`, components are shared through global `window.*` objects, and the decay-curve/Pareto math runs client-side. Notably, `decay-engine.js` is expected to carry the comment *"Port of the FastAPI decay engine to plain JS. Mirrors backend/src/levels/service.py exactly"* — the design already assumed a Python backend would be the source of truth.

`design-reference/` now contains the complete Claude Design ZIP and its extracted contents: the HTML shell, all six referenced local source files, the generated thumbnail, three document-skin references, and two uploaded visual references. The HTML confirms the page title (`Factor VIII Monitor`), Inter and JetBrains Mono fonts, React 18.3.1, and pinned ReactDOM/Babel development scripts. The extracted file inventory matches the ZIP inventory, so source review and migration planning are no longer blocked.

We're migrating this into a real, deployable stack ahead of a move to k8s:
1. A proper React app (Vite + TS + a charting library) instead of script-tag Babel.
2. A FastAPI backend that owns persistence *and* the canonical decay/Pareto math (matching the hint left in the original code).
3. SQLite for storage, structured as its own file/schema for this project but following a pattern that's trivial to replicate per-project when more services land on k8s.

**Decisions confirmed with the user:**
- Frontend: Vite + React + TypeScript, **and** swap the hand-rolled SVG charts for a charting library — picked in Step 2 below via a short comparison, not preselected. Visual output will be close to the original but not pixel-identical — some custom overlays (refill tick marks, flipping "now" label, Pareto front styling) will need the chosen library's custom shape/dot renderers regardless of which one wins.
- Backend is required regardless (SQLite needs a server). Given that, FastAPI becomes the **single source of truth for the curve/Pareto math**, not just persistence:
  - `POST /api/compute/curves` returns the full 168h series + stats (peak/trough/auc/mean/halving time) for a set of curve params. Frontend fetches this whenever curve params change (on load, after save) — not per keystroke.
  - `POST /api/compute/pareto` returns the enumerated schedule candidates + Pareto front, debounced on param change.
  - The moving "now" marker (current hour/level) is **interpolated client-side from the already-fetched hours/levels array** — this mirrors what the existing hover-crosshair code already does client-side (`idxAt`/`valAt` in `factor-chart.jsx`), so it's not a duplication of business logic, just array interpolation, and avoids polling the backend every 60s.
  - The CurveEditor's live "decay rate / halving time" preview (shown while typing, before save) duplicates only the two one-line formulas (`lambda = ln(measured/peak)/elapsed`, `halfLife = abs(ln(2)/lambda)`) client-side in TS for instant feedback — documented as intentional, everything else stays server-side.
- DB: SQLite file owned by this project (`backend/data/factor8.db`), created/migrated at startup. No cross-project `project_id` column — each future project gets its own file following the same `backend/app/db.py` pattern, so splitting onto separate k8s volumes later is trivial.
- No auth — single implicit user, matching today's behavior.
- Project bootstrap is user-owned: the user wants to set up the Vite and Python projects personally. Planning/review may continue, but no agent should run scaffolding commands, install dependencies, or begin application implementation until the user explicitly says setup is complete and asks implementation to start.

## Project setup ownership and handoff

The user performs the initial repository setup. The commands and target structure below are a checklist for that manual setup, not authorization for an agent to execute them.

User-owned setup includes:

- Create `frontend/` with Vite's React + TypeScript template, select/install the charting dependency after Step 2 is decided, and commit `package.json` plus the generated lockfile.
- Create `backend/` with the chosen Python project/dependency manager, FastAPI/Uvicorn and test dependencies, package markers, `pyproject.toml` (preferred over an unresolved `pyproject.toml or requirements.txt` choice), and its lockfile.
- Decide the supported Node and Python versions and record them in normal project tooling/documentation.
- Confirm the initial frontend and backend skeletons run locally before handing the repository back for feature implementation.

Handoff gate:

- Until the user explicitly says the setup is complete, work is limited to reviewing and editing planning/documentation when requested.
- After handoff, first inspect the user-created structure and dependency versions; preserve those choices rather than re-scaffolding or replacing project configuration.
- Implementation begins only on an explicit user request. A completed setup does not itself authorize implementation.

## Design inputs and acceptance criteria

Claude Design can export a working design as a ZIP or standalone HTML, so the complete exported code is the primary design reference, not this plan by itself ([Anthropic: Get started with Claude Design](https://support.claude.com/en/articles/14604416-get-started-with-claude-design)). The export is prototype input rather than production architecture: Vite, TypeScript, the API data layer, and the charting library may change the DOM, but they must preserve the agreed experience.

### Required inputs and source-of-truth order

1. **Complete export in `design-reference/`.** It must contain the HTML shell and every local file it loads: `src/styles.css`, `src/decay-engine.js`, `src/factor-chart.jsx`, `src/curve-editor.jsx`, `src/pareto.jsx`, and `src/app.jsx`. Any fonts, icons, images, or other assets referenced by those files must also be present or explicitly documented as external.
2. **Rendered baseline.** Once the export is complete, capture reference screenshots at desktop (1440 px wide), tablet (768 px), and mobile (390 px), in every exported theme/skin that materially changes layout or contrast. Capture the default dashboard, medicine editor, constant-level medicine, Pareto panel, tooltip/hover state, and Tweaks panel.
3. **Exported source.** For component behavior, labels, default values, validation, chart semantics, and interaction details not visible in a screenshot, the complete Claude Design source is authoritative.
4. **This plan.** Where production architecture intentionally differs from the prototype (backend persistence/math, chart library DOM, error handling), this plan wins. Any intentional visual or behavioral deviation discovered during the port is recorded here before implementation.

The uploaded reference now passes item 1. The three `screenshots/*.jpg` files and two `uploads/*.png` files are visual inspiration supplied to Claude Design, not approved screenshots of every exported application state. The generated `.thumbnail` shows the Pareto area, but it is too small and partial to serve as the sole visual baseline. Capturing the rendered baselines in item 2 remains a pre-port task.

### Verified design and behavior inventory

The complete source defines the following acceptance surface:

- A centered, single-column dashboard (`max-width: 1080px`) with medicine chips, five headline statistics, a 168-hour multi-medicine chart, per-medicine comparison table, infusion schedule, Pareto accordion, right-side medicine editor, and floating Tweaks panel.
- Two materially different skins: `clinical` (Inter, rounded/pill controls, soft surfaces) and `document` (JetBrains Mono, square controls, dashed rules, heading markers), each with light/dark themes. Clinical also has five accent choices; both skins support spacious/compact density and area/line/stepped curves.
- A responsive breakpoint at 840 px: statistics become two columns, detailed comparison columns are hidden, schedule rows become two columns, Pareto controls stack, and Pareto detail metrics become two columns. The source has no smaller dedicated breakpoint, so 390 px behavior must be checked explicitly rather than assumed.
- An active-medicine workflow with add, edit, delete, visibility toggling, multiple weekly infusions, explicit constant-level curves, live signed-rate/half-life preview, and persistence in `localStorage`.
- A chart with weekday divisions, active/inactive curve styling, infusion ticks, moving current-level markers, a right-edge-flipping "now" label, and a mouse-only crosshair/tooltip.
- A Pareto workflow with weekly IU budget, selectable dose sizes, a linear `reference dose -> peak` conversion, one shared infusion time, a trough/mean objective toggle, soft warning threshold, clickable points/front rows, schedule metrics, and add-as-medicine for uniform-dose schedules.

The source review also confirms production gaps that the acceptance work must address: the editor lacks dialog semantics/focus management/Escape handling, SVG chart points are mouse-only, delete has no confirmation, color swatches share the same accessible name, validation accepts non-decaying measurements, and the Claude Design `postMessage` listener accepts messages from any origin.

### Production decisions to make from the export

- Inventory the exact layout hierarchy, spacing, colors, radii, typography, responsive breakpoints, chart dimensions, animation, and component states before rewriting components.
- Preserve Inter for UI text and JetBrains Mono for numeric/technical text unless the rendered export shows a different usage. Decide whether production may fetch Google Fonts or must self-host them.
- Preserve exported labels, units, numeric precision, weekday ordering, color meanings, hover/click behavior, refill markers, and the right-edge flip behavior of the "now" label.
- Define production states that a happy-path prototype commonly omits: initial loading, empty curve list, API/network failure with retry, form validation, compute-in-progress, Pareto no-results, stale-response suppression, and delete confirmation.
- Treat the exported `postMessage` edit-mode handshake as Claude Design host integration. Remove it unless the deployed app is intentionally embedded in a compatible editor. If retained, document the message schema and validate `event.origin`; do not port an unrestricted listener unchanged.
- Do not copy CDN script tags or in-browser Babel into production. Pin npm/Python dependencies and commit their lockfiles.

### Acceptance criteria

- The complete reference renders without missing local-file requests or console errors before component migration begins.
- At the three baseline widths, the migrated page preserves information hierarchy, content order, typography roles, main spacing, responsive stacking, controls, and chart meaning. Pixel identity is not required, but all deviations that affect layout, interaction, or interpretation are intentional and documented.
- Every interactive control is reachable and operable with a keyboard, visible focus is retained, form controls have programmatic labels, the editor behaves as a modal/side panel with correct focus return, and charts expose a text/table alternative for their key values.
- Color is not the only way to distinguish medicines, Pareto status, feasibility, or thresholds. Light/dark themes meet WCAG 2.2 AA contrast for text and controls.
- Loading, empty, error, validation, and no-feasible-schedule states are implemented and visually checked in addition to the golden path.
- Automated frontend checks include `lint`, `typecheck`, production build, component tests for forms/state, and end-to-end coverage of the default dashboard, add/edit/delete medicine, constant-level medicine, theme persistence, Pareto selection, and add-as-medicine.
- Visual regression screenshots compare the migrated UI against the approved baselines with masks/tolerances for the clock-driven "now" marker and other nondeterministic text.

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
- Refill parsing currently rounds times to 0.1 hour (six-minute increments), even though the editor accepts arbitrary `HH:MM`. Store/compute exact minute offsets and round only chart coordinates or displayed values.
- This single-measurement, mono-exponential, additive-dose model is educational and is not a population PK model or dosing recommendation. Keep that limitation visible in the UI and README.

Required formula tests:

- The numerical Altuvoct example above, including rate sign, reconstructed measurement, and half-life.
- Scale invariance: multiplying `P` and `M` by the same positive number does not change `lambda`.
- Constant, invalid-growth, zero/negative, NaN/infinity, and extremely small-rate cases.
- Backend and the intentionally duplicated live-preview formulas agree within a documented tolerance.

## Pareto optimization and decision display

### Is a Pareto front the right method?

Yes, **if the problem really has two or more conflicting objectives and the user has not supplied a preference weighting**. A Pareto front removes dominated schedules: a schedule is retained when no other feasible schedule improves one objective without worsening another. For two objectives, a 2D scatterplot is the conventional readable view; scatterplots are primarily suited to low-dimensional objective spaces ([pymoo visualization documentation](https://pymoo.org/visualization/scatter.html)).

It is not, by itself, a recommendation system. Research on interactive reference-point methods emphasizes that choosing one final nondominated solution requires preference information from the decision maker ([Ruiz et al., 2009](https://doi.org/10.1016/j.omega.2007.06.001)). In a medicine-adjacent UI, options also need neutral framing, consequences/trade-offs, and more than one presentation format; NICE's decision-aid standards recommend unbiased option presentation and a mixed use of words, numbers, and diagrams ([NICE decision-aid standards](https://www.nice.org.uk/corporate/ecd8/chapter/content-and-process-standards-for-patient-decision-aids)).

The recovered `pareto.jsx` confirms that the current optimizer uses **three** objective directions:

```text
minimize injections per week
minimize total IU per week
maximize the selected protection proxy: trough OR weekly mean level
```

`budget` is currently an upper bound, not an exact weekly total. `threshold` is currently a soft warning/reference used to compute hours below the line; it does not filter candidates or affect dominance. Dose response is assumed linear (`peakPerIU = referencePeak / referenceDose`), all infusions share one time of day, and every assignment of zero or one allowed dose to each of seven days is enumerated. The front then minimizes injections and total IU while maximizing either `trough` or `meanLevel`.

The existing visualization projects that 3D front into `x = injections`, `y = selected protection`, then draws one connected series per total-IU value. This is mathematically defensible as a projection, but it is not a complete 2D Pareto front and the solid lines imply continuous/interpolated schedules that do not exist. The generated thumbnail confirms that the IU-series labels and overlapping lines become difficult to read at small scale.

If the product question is actually singular — for example, “maximize trough subject to weekly IU <= budget and injections <= N” — use constrained single-objective optimization instead and show the optimum plus near-optimal alternatives. A Pareto front is useful only when the user should explore a genuine trade-off. A weighted score is not a better default because weights and normalization hide value judgments; it may be offered only when the user explicitly supplies those preferences.

### Recommended v1 presentation

Use a linked decision view rather than a Pareto chart alone:

1. Preserve the exported inputs and plain-language objective toggle, but make constraint semantics explicit. `Factor available per week` is “at most”; `Warn when below` remains a soft reference unless the user deliberately enables `Require at least`, in which case below-threshold schedules are infeasible and excluded from that front.
2. Keep exact enumeration for the current bounded search space, mark feasibility, and compute the exact three-criterion nondominated set. Domination directions, equality handling, duplicate schedules, and floating-point tolerance are specified and tested.
3. Make the primary exploration genuinely 2D by holding/filtering the third criterion. The design-aligned default is `x = injections`, `y = selected protection`, with a selectable exact weekly-IU total (default to the entered budget). An “all totals” view may use small multiples or a total-IU filter; do not overlay many solid IU lines as if their intermediate values were feasible.
4. Render schedules as discrete scatter points. A thin dashed ordering guide is optional and must be labelled as a guide, never as a continuous feasible curve. Muted dominated points may remain available for exploration.
5. Preserve the threshold reference line and hours-below metric. Shade it as a warning region while it is soft; call it infeasible only when the user enables the hard requirement.
6. Link selection to the exported front list, a compact comparison table, and the canonical 168-hour steady-state level curve. The table lists schedule, injections/week, total IU/week, predicted trough, peak, mean/AUC, hours below threshold, and any constraint violations. If several schedules map to the same objective point, display the count and let the user inspect each schedule instead of silently discarding tied alternatives.
7. Offer three neutral shortcuts from the full nondominated set: **lowest weekly IU**, **fewest injections**, and **highest selected protection**. A **balanced trade-off (knee heuristic)** may be added, but must be labelled as a mathematical heuristic, not “recommended”; knee-focused research treats it as a useful preference-free candidate, not a substitute for the user's values ([Deb and Gupta, 2005](https://www.egr.msu.edu/~kdeb/papers/k2004010.pdf)). Always keep the full front/table accessible.
8. Do not copy the export's automatic `front[front.length - 1]` selection under the variable name `best`; the sort order does not establish a user's preferred solution. Start with no choice or a plainly labelled neutral shortcut. Selecting a schedule previews it; “Add as medicine” remains a separate explicit action.

Because v1 already has three independently meaningful objectives, the API returns all three and the UI uses filtering/small multiples plus a linked table. A parallel-coordinates view is optional for expert exploration, not the default patient-facing display. Do not compress clinical and burden objectives into an opaque score merely to retain two dimensions.

### Uncertainty and correctness requirements

- This is a finite, discrete enumeration problem, so calculate the exact nondominated set after enumeration rather than using an evolutionary approximation unless the search space becomes demonstrably too large.
- Bound `budget`, number/value of `doseSizes`, candidate count, and execution time. Return a clear “search space too large” validation error rather than exhausting the API worker.
- Fix the v1 roles in the API contract: injections and total IU are minimized objectives; exactly one of trough/mean is the maximized objective; budget is a hard constraint; threshold is soft unless `requireThreshold=true`; peak, AUC, time-below, and the unselected protection metric are display metrics.
- Replace the optimizer's unexplained fixed 60 steady-state iterations with an analytic cyclic calculation or a convergence tolerance plus maximum-iteration failure. The curve endpoint and the optimizer must share this evaluator so add-as-medicine reproduces the previewed values.
- Add tests for minimization/maximization direction, equal points, duplicates, tolerance, infeasible schedules, front nondominance, and deterministic ordering. Do not assume injection count must increase monotonically unless that follows from the selected axes and enumeration rules.
- Deterministic point estimates can overstate certainty. V1 must label outputs as model estimates. A later sensitivity view should vary the measured inputs/decay rate over an explicit range and show whether a schedule remains feasible; do not present an uncertainty band without a defined source for that range.
- Explain in plain language: “A frontier point is not better in every way than another frontier point; moving along the frontier trades one displayed goal for another.”

## Implementation steps

1. **User setup and design baseline.** The source-completeness gate now passes. The user keeps the extracted export unchanged, captures/approves the rendered screenshots/states above, scaffolds Vite with React + TypeScript, and creates the Python project as described in the setup handoff. No agent executes setup or implementation in this step. After the user explicitly hands off the running skeletons and requests implementation, inspect them and continue without re-scaffolding.
2. **Research and pick the charting library.** Compare candidates against our actual needs — multi-series area/line/stepped curve with a custom hover tooltip and "now" markers (`FactorChart`), plus a discrete scatterplot with a highlighted Pareto front, exact-IU filter/small multiples, selection, and threshold shading (`ParetoPlot`):
   - **Recharts** — composable `ComposedChart`, easiest to combine Area+Line+Scatter+ReferenceDot/Line/Area, widest usage/docs, decent TS types.
   - **visx** (Airbnb) — lower-level primitives over D3, more control for the custom overlays (flip-label now-marker, stepped curve) at the cost of more code per chart.
   - **Nivo** — polished defaults, less flexible for the specific hand-tuned interactions (crosshair tooltip, clickable Pareto points) this app relies on.
   - Decision recorded here once made, before Steps 9/10 (chart porting) start.
3. **Fill in the user-created FastAPI + SQLite backend skeleton after handoff.** Add `settings.py`, `db.py` (schema init + seed), `models.py` (Pydantic schemas), `routers/` and `services/` packages, and `main.py` wiring CORS + routers. This starts only after the user has completed setup and explicitly requested implementation.
4. **Port and unify `decay-engine.js` → `backend/app/services/decay_engine.py`.** Characterize the recovered export against the earlier Python service, then implement the explicit formula/sign/edge-case contract and shared periodic steady-state evaluator above. Add `tests/test_decay_engine.py` with the numerical Altuvoct regression, inverse reconstruction, invalid inputs, constants, complete-week integration/interpolation, refill-boundary behavior, steady-state convergence, and intentionally retained legacy fixtures before moving on.
5. **Port and clarify `pareto.jsx` math → `backend/app/services/pareto.py`.** Use the recovered `steadyState`, `evaluate`, `enumerateSchedules`, `paretoFront`, and `envelope` as behavioral inputs, but implement the explicit three-objective/constraint/dominance contract above rather than blindly preserving projection and selection ambiguities. Add `tests/test_pareto.py` for exact nondominance, objective directions, ties/duplicates, soft/hard thresholds, deterministic ordering, bounded enumeration, and agreement with the shared curve evaluator.
6. **Build the FastAPI routers.** `routers/curves.py` (CRUD for curves + settings get/put), `routers/compute.py` (`POST /api/compute/curves`, `POST /api/compute/pareto`). Wire into `main.py`. Add `tests/test_api.py` `TestClient` smoke tests for every endpoint.
7. **Frontend data layer.** `types.ts`, `api/client.ts` (fetch wrappers for curves/settings/compute), `lib/weekdays.ts` (WEEKDAYS, sortInfusions, parse/format), `lib/decayPreview.ts` (the two intentionally-duplicated one-line formulas).
8. **Migrate the simple components** (no charting library involved): `App.tsx` shell (curve/settings fetch and theme/density/skin wiring; omit the Claude Design `postMessage` edit-mode handshake unless embedding is explicitly retained), `MedTabs`, `StatsRow`, `ScheduleList`, `CompareTable`, `Tweaks`, `CurveEditor` (side panel form, POST/PUT to `/api/curves` on save).
9. **Migrate `FactorChart.tsx`** using the library chosen in Step 2, matching `factor-chart.jsx`'s area/line/stepped modes, refill tick marks, hover crosshair + tooltip, and now-marker.
10. **Migrate and clarify `ParetoSection.tsx` + `ParetoPlot.tsx`** — preserve the recovered form/front list/detail workflow and add-as-medicine action, make soft/hard threshold and three-objective projection semantics explicit, remove the automatic unlabeled “best” selection, and call `/api/compute/pareto` (debounced ~300ms with stale-request protection) for the discrete plot/filter/table view.
11. **End-to-end verification.** Run backend (`uvicorn`) + frontend (`vite dev`) together, exercise the app in a browser per the Verification section below.
12. **Update `README.md`** with run instructions for both services.

## Target layout

```
level8/
  design-reference/             # complete immutable Claude Design export + approved baselines
    Factor VIII Dashboard.html
    src/                        # complete styles.css, decay-engine.js and exported JSX sources
    baselines/                  # approved desktop/tablet/mobile screenshots
  frontend/
    index.html
    package.json, lockfile, vite.config.ts, tsconfig.json
    src/
      main.tsx, App.tsx, styles.css (ported ~verbatim from src/styles.css)
      api/client.ts            # fetch wrappers for curves/settings/compute endpoints
      types.ts                 # Curve, ComputedCurve, Settings, ParetoResult types
      lib/
        decayPreview.ts        # the 2 duplicated one-line formulas, documented why
        weekdays.ts            # WEEKDAYS const, sortInfusions, parse/format helpers
      components/
        MedTabs.tsx, StatsRow.tsx, ScheduleList.tsx, CompareTable.tsx
        FactorChart.tsx        # chart-library port of factor-chart.jsx (library from Step 2)
        CurveEditor.tsx        # side panel, ports curve-editor.jsx
        ParetoSection.tsx, ParetoPlot.tsx   # chart-library port of pareto.jsx
        Tweaks.tsx
  backend/
    pyproject.toml, lockfile, README
    app/
      main.py                  # FastAPI app, CORS for :5173 dev, StaticFiles mount for prod build
      settings.py              # PROJECT_NAME="factor8", DB path
      db.py                    # sqlite3 connection helper + schema init/migration
      models.py                # Pydantic request/response schemas
      routers/
        curves.py              # GET/POST/PUT/DELETE /api/curves, GET/PUT /api/settings
        compute.py             # POST /api/compute/curves, POST /api/compute/pareto
      services/
        decay_engine.py        # formula-contract implementation, regression-checked against export/legacy
        pareto.py              # explicit enumeration, feasibility, dominance, front and envelope contract
      tests/
        test_decay_engine.py    # known-value regression tests (Altuvoct example etc.)
        test_pareto.py
        test_api.py             # TestClient smoke tests for CRUD + compute endpoints
  README.md                    # update with run instructions for both services
```

## DB schema (`backend/app/db.py`, SQLite)

```sql
CREATE TABLE curves (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  peak_level REAL NOT NULL,
  time_elapsed REAL NOT NULL,
  measured_level REAL NOT NULL,
  weekly_infusions TEXT NOT NULL,   -- JSON array of "Weekday HH:MM AM/PM"
  color TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  is_constant INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,             -- 'active_id','theme','accent','curve_style','density','skin'
  value TEXT NOT NULL
);
```
Seed `curves` with the current default (Altuvoct) row on first run if the table is empty, matching `DEFAULT_CURVES` in `app.jsx`.

## API surface

- `GET /api/curves` / `POST /api/curves` / `PUT /api/curves/{id}` / `DELETE /api/curves/{id}`
- `GET /api/settings` / `PUT /api/settings`
- `POST /api/compute/curves` — body: list of curve params (+ optional `decay_constant` override where explicitly supported) → per-curve `{ hours[], levels[], decayConstant, halvingTime, refillHours[], peak, trough, auc, meanLevel, constant }`; `halvingTime` is `null` for a constant curve.
- `POST /api/compute/pareto` — body: `{ decayConstant, budget, doseSizes[], refDose, refPeak, hourOfDay, threshold, requireThreshold, objective }`, where `objective` is the enum `"trough" | "meanLevel"`; returns `{ candidates[], front[], seriesByTotalIU[] }` with injections, total IU, both protection metrics, peak/AUC/time-below, feasibility, and stable schedule IDs. The API contract defines the three dominance directions and whether the threshold is soft or hard rather than exposing an undocumented `objectiveId`.

## Component porting notes

- `factor-chart.jsx` → `FactorChart.tsx`: chosen library's composed-chart primitive with `Area`/`Line` per visible curve, a reference-dot for the "now" marker (custom overlay for the flip-to-left-when-near-right-edge label behavior), custom tooltip content replicating the existing `chart-tip` styling, weekday gridlines at each 24h boundary.
- `curve-editor.jsx` → `CurveEditor.tsx`: same side-panel form; on Save, `POST`/`PUT` to `/api/curves`, then triggers a curves refetch + `/api/compute/curves` refresh.
- `pareto.jsx` → `ParetoSection.tsx` + `ParetoPlot.tsx`: preserve the form, front rows, selected-schedule details, and add-as-medicine workflow. Replace the overlaid solid per-IU lines with a discrete scatter view filtered by exact weekly IU (or small multiples), optional labelled dashed ordering guides, soft-warning/hard-infeasible threshold treatment, and a linked full-front table. Drive it from `/api/compute/pareto`, debounce ~300ms, and cancel superseded requests or ignore stale responses.
- `styles.css` ports over almost unchanged (it's already framework-agnostic); trim/adjust only what's now handled by the charting library's own DOM structure (e.g. `.chart-wrap`/`.chart-tip` become the library's tooltip/wrapper classes).
- `Tweaks.tsx` and theme/density/skin `data-*` attribute wiring on `<html>` port from `app.jsx`. The Claude Design `postMessage` edit-mode handshake does not port by default; retain it only under the reviewed embedding contract above.

## Verification

- Backend: `pytest backend/app/tests` — formula/sign/edge-case tests including Altuvoct (`lambda ~= -0.0142731861 h^-1`, half-life `~= 48.5629h`, reconstructed level `~= 10` at 168h), refill-boundary/steady-state behavior, exact Pareto nondominance and objective-direction tests, constraint/tie/duplicate/bounds cases, and `TestClient` smoke tests for curve CRUD + both compute endpoints.
- Frontend: run `uvicorn app.main:app --reload` (backend, port 8000) and `npm run dev` (frontend, port 5173) together; open in browser and confirm: default Altuvoct curve renders and matches original chart shape, add/edit/delete a medicine persists (restart backend process → data survives via SQLite), theme/accent/density/skin tweaks persist via `/api/settings`, Pareto "Find the best weekly schedule" panel computes a front and "Add as medicine" round-trips through the API.
- I'll drive this manually in a browser (via the `browse`/dev-server flow) before calling the work done, per house rules for UI changes — golden path (view default curve) plus edit cases (add medicine, constant-level medicine, Pareto add-as-medicine).
