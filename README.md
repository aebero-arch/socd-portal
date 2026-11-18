# SOCD Portal

Internal web portal for the Statistical Operations and Coordination Division
(SOCD): personnel directory, monitoring of PAPs (Programs, Activities and
Projects), year-end ratings, trainings, leave schedule and division links.

- **Website:** Next.js 16 (React 19, Tailwind CSS 4), hosted on Vercel.
- **API:** FastAPI (Python), hosted on Render.
- **Database:** MySQL-compatible, hosted on TiDB Cloud.
- **Sign-in:** email and password, or Google. The session is a signed JWT kept
  in an HTTP-only cookie for 8 hours.

## Modules

| Module | What it does |
|---|---|
| 00 Dashboard | Staff count, pending leave requests, activities no province has submitted yet, and upcoming trainings. |
| 01 Personnel Directory | Staff list for the whole region with office, role and status, filterable by office and exportable to CSV. SuperAdmin adds, edits and imports staff (CSV or Excel). |
| 02 PAP Monitoring | One year at a time (year dropdown), with PAPs grouped by Service. Each PAP has a tab per province where the province records submissions and RSSO records ratings. |
| 04 Trainings | Upcoming and past trainings, sign-ups, materials links and attendance. |
| 05 Leave Schedule | Leave requests and approvals. Approving a leave updates the person's status. |
| 07 Links & Resources | Division links by category. |
| 08 PAP Ratings | Year-end ratings per province, per focal person and per project for a chosen year, with Excel export. |
| PAP Configuration | SuperAdmin and RSSO only, one year at a time: create PAPs, set their Service, add activities (or import them from Excel), assign focal persons per province, and copy a year's PAPs into the next. |

Meetings & Agendas (03) and Comms & Announcements (06) are in the sidebar but
not built yet.

### Years

Every PAP belongs to one year. PAP Monitoring, PAP Configuration and PAP
Ratings each have a year dropdown, and the year is part of the page address
(e.g. `/monitoring?year=2027`). Pages open on the current year, or on the
latest earlier year if the current year has no PAPs yet.

To set up a new year, open PAP Configuration for the old year and click
**Copy to next year** (or open the new, empty year and click **Copy from**
the previous year), then tick the PAPs to copy (all are ticked to start
with). Each copied PAP keeps its Service, activities and focal persons, and
its deadlines move forward to the new year. Submissions
and ratings stay with the old year. PAPs that already exist in the new year
(same name) are skipped, so it is safe to run again. PAPs that existed before
years were added were given the year they were created.

### Roles

| Role | Who | Can do |
|---|---|---|
| SuperAdmin | Division administrator | Everything. |
| RSSO | Regional office staff | Manage staff, PAPs, focal persons, trainings and links; enter ratings for every province. |
| PSO | Provincial office staff | See only Dashboard (their province's staff count and PAP progress), Personnel Directory (whole region, read-only), PAP Monitoring (their province) and Comms & Announcements. |

New staff can sign in with Google if their directory email is a Google
account. Password sign-in only works for accounts that have a password set.

### How ratings are calculated

The 08 PAP Ratings module uses the same formulas as the province tab in
monitoring:

- **Quantity:** entered by RSSO.
- **Quality:** from the response rate. 95% or more gives 5, 90% or more gives
  4, 80% or more gives 3, and anything lower gives 2.
- **Timeliness:** submitted on or before the deadline gives 5; late gives 3.
- **Activity rating:** the average of whichever of the three are filled in.

Ratings for a year cover that year's PAPs, whatever their deadline dates (so
a Q4 report due in January still counts toward the PAP's year). If an
activity's deadline has passed and nothing is filled in, the activity counts as **1.0**. To change this, edit
`MISSING_ACTIVITY_RATING` in `backend/main.py`. Activities not yet due are
left out.

A project's rating for a province is the average of its activity ratings. A
province's final rating is the average of its project ratings, and so is a
focal person's (alternates are not credited). A project's rating across all
provinces is the average of its province ratings.

## Run it on your computer

You need Node.js 20 or newer and Python 3.11 or newer.

1. Copy `.env.local.example` to `.env.local` and fill it in (see
   [Settings](#settings)). The API reads the same file.
2. Run:

   ```powershell
   start.bat
   ```

   This sets up the Python environment the first time, installs dependencies,
   starts the API on port 8000 in a second window, and starts the website on
   port 3000.
3. Open `http://localhost:3000`.

You don't need to create any tables. The API creates missing tables and adds
new columns every time it starts. `backend/schema.sql` and the `supabase/`
folder are old and are kept for reference only.

> If `.env.local` points at the production TiDB database, everything you do
> locally changes real data.

## Settings

### API (Render, or `.env.local` locally)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Database connection, e.g. `mysql://USER:PASSWORD@HOST:4000/DATABASE`. Any `mysql://` form is accepted. TiDB Cloud addresses connect over SSL automatically. |
| `JWT_SECRET` | Yes | Long random value used to sign sessions. Keep it private. Changing it signs everyone out. |
| `GOOGLE_CLIENT_ID` | For Google sign-in | Same value as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Google tokens issued for any other app are rejected. |
| `CORS_ORIGINS` | No | Comma-separated website addresses allowed to call the API from a browser. Default: `http://localhost:3000`. |
| `ADMIN_INITIAL_PASSWORD` | Recommended | Password for `admin@socd.gov.ph` when the account is first created, or when it still has the old default password. |
| `ADMIN_RESET_PASSWORD` | Temporary | Set to `true` to reset the admin password to `ADMIN_INITIAL_PASSWORD` on the next start. **Remove it after signing in**, or every restart resets the password again. |

### Website (Vercel, or `.env.local` locally)

| Variable | Required | Purpose |
|---|---|---|
| `BACKEND_URL` | Yes | Address of the API, as seen from the website server. Locally: `http://127.0.0.1:8000`. On Vercel: the Render service address. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | For Google sign-in | Google OAuth client ID used by the login page. |

## Deploying

Both services deploy from the `main` branch of
`github.com/aebero-arch/socd-portal`:

```powershell
git add <changed files>
git commit -m "Describe the change"
git push origin main
```

After pushing, check that both services picked up the new commit:

- **Render (API):** in the service's **Events** tab, the latest deploy should
  show the new commit as **Live**. Keep **Settings → Build & Deploy →
  Auto-Deploy** on with branch `main`; otherwise use **Manual Deploy → Deploy
  latest commit**. Saving environment variables only redeploys the build
  Render already has, not new code.
- **Vercel (website):** the **Deployments** tab should show the new commit.

Deploy the API too whenever `backend/main.py` changes. A new website talking
to an old API can fail or quietly ignore new fields.

## Project layout

```text
app/
  (portal)/          Pages behind sign-in, one folder per module
  login/             Login page and sign-in actions
backend/
  main.py            The whole FastAPI app: tables, migrations and endpoints
  add_superadmin.py  Old helper for creating an admin (not set up for TiDB SSL)
components/          Sidebar and top bar
lib/
  api/server.ts      Server-side helpers for calling the API with the session token
  types.ts           Shared types and constants (offices, services, roles)
proxy.ts             Sends signed-out visitors to the login page
start.bat            Starts both servers locally
```

## Known issues

- The Leave Schedule list doesn't refresh after a change until the page is
  reloaded.
- Focal persons are kept per PAP, and each year has its own copy of a PAP, so
  changes in one year don't affect another. Within a year, though, a focal
  person change moves that PAP's whole rating for the year to the new person.
- `.env.local.example` still lists the old Synology settings. Use the tables
  above instead.
