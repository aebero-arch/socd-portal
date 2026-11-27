# State in the SOCD Portal

Every piece of state that changes over time, what its states are, what moves it
between them, and the one place that owns the rule. Change a rule in its owner
and update this file in the same commit.

## Data (stored or computed by the API)

### Leave request
`backend/main.py` → `update_leave_status`, `add_leave`

```
          ┌──────────► approved
pending ──┤
          └──────────► denied
```

- A request is created `pending`. A SuperAdmin's own entries are created `approved`.
- SuperAdmin/RSSO decide once: `pending → approved` or `pending → denied`.
  Any other change is refused (409). To change a decision, delete the request
  and file it again.
- Deleting is allowed in any state (the owner or a SuperAdmin).

### Staff status
`backend/main.py` → `effective_status`, `statuses_from_leaves`, `leave_status`

```
status shown = the approved leave covering today (Manila date), if any
               otherwise the status set in the directory (default in-office)
```

| Approved leave type | Status shown |
|---|---|
| `wfh` | `wfh` |
| `fieldwork` | `fieldwork` |
| anything else | `on-leave` |

- Worked out each time personnel are read (`/api/personnel`, `/api/me`); never
  written by leave actions. A leave therefore starts and ends on its own dates.
- The directory status dropdown sets the stored status. While an approved leave
  covers today, the leave wins.

### Deliverable (one activity, one office)
`backend/main.py` → `deliverable_state` · `lib/deliverable.ts` → `deliverableState`
(two copies of the same rule, one per language; keep them identical)

```
not submitted:  upcoming ──► due_soon ──► overdue
                (> 30 days)  (≤ 30 days)  (past the deadline)

submitted:      on_time  (on or before the deadline)
                late     (after the deadline)
```

- "Submitted" means the office entered an actual submission date.
- Used by the Dashboard counts, the PAP's All Provinces chips and the
  province tab's Actual Submission column.

### Activity rating (year-end)
`backend/main.py` → `activity_rating`, `compute_ratings`

- Rated: at least one of Quantity, Quality (from response rate) or Timeliness
  (from the submission date) exists; the rating is their average.
- Missing: no rating and the deadline has passed → counts as
  `MISSING_ACTIVITY_RATING` (1.0).
- Pending: no rating and not yet due → left out.
- Rolls up: activity → project per province → province / focal person.

### PAP year
`backend/main.py` → `_pap_years`

- Every PAP has a `year`. Pages open on the current year if it has PAPs,
  otherwise the latest earlier year that does.

### Session
`lib/me.ts` → `getMeResult` · `app/(portal)/layout.tsx` · `app/login/page.tsx`

| `/api/me` result | Where the user goes |
|---|---|
| 200 | the page |
| 401 (no or expired session) | `/login?error=session` |
| 403 (not in the directory) | `/login?error=unauthorized` |
| anything else | `/login?error=unavailable` |

### Module access
`lib/nav.ts` → `MODULES`, `canOpen` · `lib/access.ts` → `requireAccess`

| Access | Who |
|---|---|
| `everyone` | every signed-in account |
| `regional` | everyone except PSO accounts |
| `admin` | SuperAdmin and RSSO |

The sidebar, the Dashboard shortcuts and each page's `requireAccess(href)`
read the same list. Pages a role can't open send it to the Dashboard. The API
enforces its own permissions separately.

## Screens (component state)

Still to make explicit (step 2). Each is listed with the state it should become.

| Where | Now | Becomes |
|---|---|---|
| Forms in every module (~15) | separate `loading` / `saving`, `error`, `success` / `saved` flags | one status: `idle → saving → saved \| failed(message)` |
| PAP Configuration | 7 separate "which dialog is open" values | one `dialog` value: `none \| addPap \| addActivity(pap) \| editActivity(activity) \| editPap(pap) \| focal(pap) \| import(pap) \| copy(years)` |
| Directory, Links, Trainings, Leave | `modalOpen` + `editing…` | one `dialog`: `none \| new \| edit(item)` (the Comms page already works this way) |
| Directory import | `importing`, `importProgress`, `importErrors`, `importSuccessMsg` | `idle → running(current, total) → done(added, errors)` |
| Activity import (PAP Configuration) | `file`, `parsedItems`, `parsing`, `loading`, `error`, `successCount` | `empty → reading → ready(items) → importing → done(count) \| failed(message)` |
