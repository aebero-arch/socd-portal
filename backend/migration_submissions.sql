-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Per-Province PSO Submissions
-- Run this against the existing socd_portal database.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the new per-province submissions table
CREATE TABLE IF NOT EXISTS pap_submissions (
  id                CHAR(36)      NOT NULL PRIMARY KEY,
  pap_monitoring_id CHAR(36)      NOT NULL,
  office            VARCHAR(100)  NOT NULL,
  actual_submission DATE          NULL,
  pso_remarks       TEXT          NULL,
  response_rate     DECIMAL(5,2)  NULL,
  rsso_remarks      TEXT          NULL,
  rating_quantity   DECIMAL(5,2)  NULL,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_submission (pap_monitoring_id, office),
  CONSTRAINT pap_submissions_fk
    FOREIGN KEY (pap_monitoring_id)
    REFERENCES pap_monitoring(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Drop per-province columns from pap_monitoring
--    (These are now stored per-province in pap_submissions)
--    WARNING: Any existing data in these columns will be lost.
ALTER TABLE pap_monitoring
  DROP COLUMN actual_submission,
  DROP COLUMN pso_remarks,
  DROP COLUMN rsso_remarks,
  DROP COLUMN response_rate,
  DROP COLUMN rating_quantity;
