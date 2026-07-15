-- Run this in your Supabase SQL Editor:
ALTER TABLE personnel DROP CONSTRAINT IF EXISTS personnel_portal_role_check;
ALTER TABLE personnel ADD CONSTRAINT personnel_portal_role_check CHECK (portal_role IN ('RSSO', 'PSO', 'SuperAdmin'));
