# SE Daily Planning - Frontend

React 18 + TypeScript frontend for the Pathik SE Daily Planning dashboard, wired up to
the real backend at `../SE_automation_server` (Django, `planning/` app - see that repo's
`planning/views.py` for the source of truth on every response shape).

`SE_Frontend_Build_Prompt.docx` was the original design spec, but its response shapes
are largely **wrong** for the actual backend (it looks like a best-guess draft written
before the backend existed). Field-name/shape corrections made from reading the real
Django views are called out per-file below and in code comments - treat the doc as
directional (routes, view list, general architecture) but not authoritative on payload
shapes.

## Stack

- React 18 + TypeScript, Vite
- React Router v6 (routing)
- TanStack Query (all server state, caching)
- Zustand (client state: scope/date/view selection - see `src/shared/store/appStore.ts`)
- Tailwind CSS + hand-rolled shadcn/ui-style primitives (`src/shared/components/ui`)
- Leaflet / react-leaflet (route origin map in the Plan Drawer)

## Getting started

Two servers, run together:

```bash
# Terminal 1 - Django backend (../SE_automation_server)
cd ../SE_automation_server
source venv/bin/activate
python manage.py runserver 8000

# Terminal 2 - this frontend
npm install
cp .env.example .env   # defaults to /api/planning via the Vite dev proxy below
npm run dev
```

`.env`'s `VITE_API_BASE_URL=/api/planning` is a relative path deliberately - `vite.config.ts`
proxies `/api/planning/*` to `http://localhost:8000`, so the browser's requests are
same-origin and the Django side needs no `django-cors-headers` setup for local dev. Point
`VITE_API_BASE_URL` at an absolute URL instead if you're hitting a deployed backend with
its own CORS config.

```bash
npm run typecheck   # tsc -b --noEmit
npm run build        # production build
npm run lint
```

## Real backend behavior that differs from the spec doc

- **Generation is synchronous, not async.** Every scope/tuff GET (`/se/<email>/`,
  `/state/<name>/`, `/tuff/<TYPE>/<value>/`, ...) runs the full agent pipeline and
  returns the finished plan in one request/response
  (`services.generate_plan_for_scope`/`activate_tuff_scope`). There is no "still
  generating, poll me" state - a large scope (e.g. a State with 100+ SEs) just means a
  slow HTTP response, not multiple requests. The frontend does **not** poll.
- **`Status` is an approval-workflow marker, not a lifecycle stage.** Real values are
  `PENDING_REVIEW | APPROVED | REJECTED` (`PlanRun.Status` in `planning/models.py`), not
  the doc's `PENDING/RUNNING/COMPLETED/FAILED`. `StatusBanner` reflects this - a
  freshly-generated run is `PENDING_REVIEW`, which is normal, not "in progress."
- **Directory/headcount/streaks/completion-stats/scheduled-scopes/pitch response shapes
  are all different from the doc** - snake_case field names for directory endpoints
  (`state`/`node_count` not `State`/`Node_Count`), headcount buckets are plain email
  lists rather than count summaries, streaks/completion-stats drop the SE_Name/DC_Name
  fields the doc invented, and the pitch response uses `Script_Hindi`/`Data_Sources_Used`
  rather than `pitch_script`/`talking_points`. See `src/shared/types/{directory,feedback}.ts`
  for the corrected shapes, each with a comment pointing at the Django source.
- **`RouteStop.purposes` is a single string**, not an array (`Purpose_Of_Visit` is one
  field per task).
- **No display-name field exists for SEs anywhere** - `directory/ses/` only returns
  `se_email`; the ScopeSelector and task tables use email as both value and label.

## Fixed gap: Pitching Agent

`GET /pitch/<daily_task_id>/` needs the `DailyTask` row's own Django primary key, which
`_serialize_task()` (`planning/views.py`) never used to include on a `Task` - only
`DC_ID`/`Sr_No`/etc, neither of which is it. Fixed with one additive field:

```python
# planning/views.py, _serialize_task()
"DailyTask_ID": t.id,
```

`Task.DailyTask_ID` (frontend type), `TaskTable`'s pitch button, and `PitchPanel` are all
wired up to it now - verified end-to-end against a live task (real Hindi script, data
sources used/skipped).

## Fixed bug: selecting a route plan silently reverted

Selecting a plan in the Plan Drawer used to appear to do nothing - the selection would
flip server-side, then immediately look reverted. Root cause: `useSelectRoutePlan`'s
`onSuccess` invalidated the `["scope"]`/`["tuff"]` queries too (to pick up the DailyTask
resync a selection triggers), but **every plain scope/tuff GET regenerates the entire
plan from scratch on every call**, including a brand-new `RoutePlan` set with the
algorithm's own default selection. `resolve_route_plan_run` always resolves to the *most
recent* `PlanRun`, so that fresh regeneration immediately superseded the one the user
had just made a selection on. Fixed by only invalidating the routes query itself (a pure
read, no regeneration) - see the comment in `useRoutes.ts` for the full explanation. The
task table just won't reflect a post-selection DailyTask resync until the user hits
Create/Refresh again; there's no free-of-side-effects way to force that today.

## What's implemented

- **API layer** (`src/shared/api/`): a typed function per endpoint, grouped per the
  spec's endpoint groups, plus React Query hooks and a `normalize.ts` implementing the
  ID-indexing pattern from spec §17.
- **RBAC** (`src/features/rbac/`): role -> default view + allowed view types, and a
  guard so SE/ABM/RBM roles can't be given a free-text field to query someone else's
  scope (the API itself has no auth, so this is the only gate).
- **Auth** (`src/features/auth/`): a placeholder login screen (role + email/employee
  code) standing in for real session/JWT auth. Re-derives RBAC state from the restored
  user on every reload (`AppShell`'s effect) since the Zustand store itself isn't
  persisted - only the auth user is (sessionStorage).
- **Date/Scope selectors**: shared Today/Tomorrow/Custom control, and a cascading
  multi-select scope picker backed entirely by `directory/*` endpoints.
- **Views**: Overall (real headcount buckets), ZBM/State Head (client-side fan-out over
  covered states), State/District/Block/Node/RBM/ABM/SE (one generic `ScopeView`), Ops
  (streaks / completion-stats / scheduled-scopes).
- **PlanRun rendering**: approval-status badge, `Skipped_SEs` dismissible summary
  (`se_id`/`se_email`/`reason`), `Reviewed_By/At` badge, exceptions table (keyed
  defensively since `Record_ID` is often empty), and a task table with an expandable
  planned-vs-actual "Actuals" section per row.
- **Routing Agent**: Plan Drawer with the three named plan cards, feasibility greying,
  origin pin on a Leaflet map, select action. Verified end-to-end against real data.
- **Runs History**: status-filtered list + full re-fetch of a past run.

## Known deviations from the literal component tree (§18)

The spec's `<TopBar>` bundles DateSelector/ScopeSelector/CreateOrRefreshButton once at
the app-shell level. This app instead renders those three components inside each view
(`ScopeView`, `ZbmView`, `OverallView`, `OpsView`) - same shared components, just mounted
per-route instead of a single persistent instance, since each view needs a different
scope type/tuff type.

## Verified against the real backend

Manually tested end-to-end with the Django backend running locally: login -> RBAC-filtered
nav -> State view -> select Haryana -> real plan generation (11 SEs, 407 DCs) -> task
table with expandable actuals -> pitch script drawer with a real generated Hindi script ->
Route Plan drawer with a real Leaflet map, route stops, and a plan selection that
correctly persists -> date switch (Today/Tomorrow) triggering a fresh generation. Zero
console errors across that flow.
