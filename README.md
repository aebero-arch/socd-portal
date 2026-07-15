# SOCD Portal

Internal web portal for the Statistical Operations and Coordination Division:
personnel directory, PAP monitoring, HR, reports, meetings, trainings, and
division links.

The application uses Next.js for the portal UI and FastAPI for its API. Data
and user accounts are stored in MariaDB, and authentication uses signed JWTs
kept in an HTTP-only cookie.

## Current functionality

- JWT login and protected portal layout
- Personnel Directory with SuperAdmin management controls
- PAP Monitoring with authenticated API access
- MariaDB-backed FastAPI endpoints for personnel, PAPs, and monitoring

Other portal navigation items are visual placeholders until their backend
models and endpoints are implemented.

## Prerequisites

- Node.js 20 or newer
- Python 3.11 or newer
- MariaDB on the Synology server, reachable from the machine running FastAPI

## Configure the application

1. Copy `.env.local.example` to `.env.local`.
2. Set `DATABASE_URL` to the MariaDB database. The expected format is:

   ```text
   mysql+pymysql://USER:PASSWORD@SYNOLOGY_HOST:3306/socd_portal?charset=utf8mb4
   ```

3. Set `JWT_SECRET` to a long, random value. Keep it private and use the same
   value whenever the API server restarts.
4. Set `BACKEND_URL` to the address FastAPI listens on from the Next.js server.
   For both servers on one machine, use `http://127.0.0.1:8000`.

## Initialize MariaDB

Create the database in MariaDB, then import [`backend/schema.sql`](backend/schema.sql).
The schema covers the currently operational directory and monitoring features.

Create the first administrator from the repository root:

```powershell
.venv\Scripts\python backend\add_superadmin.py --name "Portal Admin" --email "admin@example.gov.ph" --password "choose-a-strong-password"
```

The command creates the account if it does not exist, or resets its password
and role if it does. To provision an existing staff member with a different
role, add `--portal-role RSSO` or `--portal-role PSO`.

## Run locally

```powershell
start.bat
```

The script creates the Python environment if needed, installs backend
dependencies, starts FastAPI on port 8000, and starts Next.js on port 3000.
Open `http://localhost:3000` and sign in with the SuperAdmin account.

## Deployment notes

- `BACKEND_URL` is server-side only. It must point from Next.js to FastAPI.
- Set `CORS_ORIGINS` to the public portal origin if a browser will call FastAPI
  directly; the default is `http://localhost:3000`.
- If users access the portal on another computer, expose Next.js through your
  Synology reverse proxy and keep FastAPI reachable only by Next.js where
  possible.
- Configure HTTPS before production use so the session cookie is marked secure.
- The old `supabase/` SQL files are historical reference only; do not apply
  them to MariaDB.
