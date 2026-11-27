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
| 503 (maintenance, not a SuperAdmin) | `/login?error=maintenance` |
| anything else | `/login?error=unavailable` |

A token (`backend/main.py` → `verify_session`) is valid until the first of:
its 8 hours run out; sign-out (its id goes into `revoked_tokens`); a password
change, or a role or email change by an admin (`personnel.sessions_valid_after`).

### Sign-in attempts
`backend/main.py` → `_check_login_allowed`, counted from `audit_log`

```
allowed ──10 failures in 15 min (account)──▶ paused 15 min ──▶ allowed
        └─30 failures in 15 min (IP, with INTERNAL_API_KEY)─▶ paused 15 min
```
A successful sign-in with a weak password goes to `/account?required=1`.

### Module access
`lib/nav.ts` → `MODULES`, `canOpen` · `lib/access.ts` → `requireAccess`

| Access | Who |
|---|---|
| `everyone` | every signed-in account |
| `regional` | everyone except PSO accounts |
| `admin` | SuperAdmin and RSSO |
| `superadmin` | SuperAdmin only (Activity Log) |

The sidebar, the Dashboard shortcuts and each page's `requireAccess(href)`
read the same list. Pages a role can't open send it to the Dashboard. The API
enforces its own permissions separately.

## Screens (component state)

### Form status
`lib/form-status.ts` → `useSaveStatus`

```
idle ──submit──▶ saving ──ok──▶ saved (the dialog closes)
                    └──error──▶ failed(message) ──submit──▶ saving
```

- Every form uses it: `run(() => serverAction(...))` returns the result on
  success and `null` on failure; `fail(message)` is for checks before saving.
- While `saving`, the dialog can't be closed and its button shows progress.
- A successful save closes the dialog straight away; the updated list is the
  confirmation (no "Saved!" banners or timed closes).
- Exceptions, kept on purpose: Focal persons keeps one error per province;
  the login form uses React's `useActionState`.

### Dialogs
`components/dialog.tsx` → `Dialog`, `DialogActions`, `FormError`, `EditDialog<T>`

- One shell for every dialog: title, close button, scrolling body, footer.
  Escape and the backdrop close it unless it is busy. `stacked` opens it over
  another dialog (the response rate calculator); Escape closes only the top one.
- Each page keeps a single value for which dialog is open:

| Page | Value |
|---|---|
| Comms, Directory, Links, Trainings | `EditDialog<T>`: `null \| { kind: "new" } \| { kind: "edit", item }` |
| Leave | `bookingOpen` (it has one dialog) |
| PAP Configuration | `PapDialog`: `null \| addPap \| editPap(pap) \| addActivity(pap) \| editActivity(activity) \| focal(pap) \| import(pap) \| copy(years, PAPs)` |
| PAP province tab | `editingAct` (the submission being edited) |

- The form inside a dialog owns its own status, so it starts fresh each time
  it opens.

### Imports

| Import | File | States |
|---|---|---|
| Personnel list | `directory/personnel-directory-client.tsx` → `ImportState` | `idle → running(current, total) → done(added, errors) \| failed(message)` |
| Activities from Excel | `pap-config/pap-config-client.tsx` → `ImportStep` | `empty → reading(file) → ready(file, items) → importing → (closes) \| failed(file, items, message)` |

A failed activity import keeps the parsed rows, so it can be retried without
choosing the file again.

### Lists after a change
- Leave: the list comes from the server; after any change the page refreshes
  (`router.refresh()`). It no longer keeps its own copy.
- Trainings and Directory refresh the same way. Comms, Links and PAP
  Configuration put the saved item straight into the list from the server's
  reply.
