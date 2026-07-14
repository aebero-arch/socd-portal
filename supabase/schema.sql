-- SOCD Portal — Supabase schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).

create table if not exists personnel (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  unit text not null,
  email text not null unique,
  local_ext text,
  status text not null default 'in-office'
    check (status in ('in-office', 'wfh', 'on-leave', 'fieldwork')),
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references personnel(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  leave_type text not null default 'vacation'
    check (leave_type in ('vacation', 'sick', 'emergency', 'official-business')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied')),
  approver_id uuid references personnel(id),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists status_reports (
  id uuid primary key default gen_random_uuid(),
  unit text not null,
  week_of date not null,
  content text not null,
  submitted_by uuid references personnel(id),
  created_at timestamptz not null default now()
);

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_date timestamptz not null,
  agenda_doc_link text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists trainings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  training_date date not null,
  materials_link text,
  created_at timestamptz not null default now()
);

create table if not exists training_attendees (
  training_id uuid references trainings(id) on delete cascade,
  staff_id uuid references personnel(id) on delete cascade,
  primary key (training_id, staff_id)
);

create table if not exists links (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  url text not null,
  category text not null default 'general',
  created_at timestamptz not null default now()
);

-- Row Level Security: enable and restrict to authenticated (signed-in) users only.
-- Combine with Google OAuth domain restriction in Supabase Auth settings
-- so only accounts on your agency's Workspace domain can sign in.
alter table personnel enable row level security;
alter table leave_requests enable row level security;
alter table status_reports enable row level security;
alter table meetings enable row level security;
alter table trainings enable row level security;
alter table training_attendees enable row level security;
alter table links enable row level security;

create policy "Authenticated users can read personnel" on personnel
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read leave_requests" on leave_requests
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read status_reports" on status_reports
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read meetings" on meetings
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read trainings" on trainings
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read links" on links
  for select using (auth.role() = 'authenticated');

-- Write policies are intentionally left out here — add insert/update policies
-- scoped to an "admin" role once you set up custom claims or a role column.
