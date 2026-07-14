# SOCD Portal

Internal web portal for the Statistical Operations and Coordination Division —
personnel directory, HR, status reports, meetings, trainings, leave schedule,
comms, and links, in one place.

Built with Next.js, Tailwind CSS, and Supabase (Postgres + Auth), all on free tiers.

## What's here so far

- Dashboard shell with sidebar navigation and topbar (`app/layout.tsx`,
  `components/sidebar.tsx`, `components/topbar.tsx`)
- Dashboard landing page with summary stats and section shortcuts (`app/page.tsx`)
- Personnel Directory, fully built with sample data (`app/directory/page.tsx`)
- Supabase schema covering personnel, leave requests, status reports,
  meetings, trainings, and links (`supabase/schema.sql`)
- Design system: colors, type, and the tick-corner "registration mark" motif
  used throughout, defined in `app/globals.css`

The other sidebar sections (Status Reports, Meetings, Trainings, Leave,
Email Directory, Comms, Links) are linked but not yet built — the directory
page is the template to follow for each.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Connect Supabase (free)

1. Create a project at https://supabase.com (free tier).
2. In the SQL Editor, run `supabase/schema.sql` to create the tables.
3. Copy `.env.local.example` to `.env.local` and fill in your project's
   URL and anon key from Project Settings > API.
4. In Supabase Auth settings, enable the Google provider and restrict sign-in
   to your Workspace domain — staff then log in with their existing
   agency Google accounts.
5. Swap the sample array in `app/directory/page.tsx` for a live query:

   ```ts
   const { data: staff } = await supabase.from("personnel").select("*").order("name");
   ```

## Deploy (free)

1. Push this project to a GitHub repo.
2. Import it at https://vercel.com (free tier) — it auto-detects Next.js.
3. Add the same two env vars from `.env.local` in the Vercel project settings.
4. Deploy. You'll get a free `*.vercel.app` URL reachable from anywhere,
   including outside the office.

## Design notes

- **Colors:** deep navy (`--ink`) for the sidebar and headings, a muted teal
  (`--accent`) as the primary interactive/data color, warm amber (`--warm`)
  for status flags — kept out of the generic "cream + terracotta" or
  "dark + neon" look.
- **Type:** Space Grotesk for headings (display), Public Sans for body text
  (the same family used in many government design systems), IBM Plex Mono
  for data — ext numbers, section codes, stats — reinforcing that this is a
  statistics division.
- **Signature detail:** thin corner tick marks on cards (`.tick-corners` in
  `globals.css`), evoking measurement/survey instruments.
