CREATE TABLE IF NOT EXISTS personnel (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  unit VARCHAR(255) NOT NULL,
  office VARCHAR(255) NOT NULL,
  portal_role VARCHAR(32) NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  local_ext VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'in-office',
  photo_url TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT personnel_status_check
    CHECK (status IN ('in-office', 'wfh', 'on-leave', 'fieldwork')),
  CONSTRAINT personnel_portal_role_check
    CHECK (portal_role IS NULL OR portal_role IN ('SuperAdmin', 'RSSO', 'PSO'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS paps (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Activity template: owned by RSSO/SuperAdmin.
-- No per-province submission data lives here.
CREATE TABLE IF NOT EXISTS pap_monitoring (
  id CHAR(36) NOT NULL PRIMARY KEY,
  pap_id CHAR(36) NOT NULL,
  activity_type VARCHAR(32) NOT NULL,
  quarter VARCHAR(8) NULL,
  month VARCHAR(32) NULL,
  output_deliverable TEXT NOT NULL,
  deadline DATE NOT NULL,
  response_rate_fillable BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pap_monitoring_activity_type_check
    CHECK (activity_type IN ('monthly', 'quarterly', 'one-time')),
  CONSTRAINT pap_monitoring_pap_fk
    FOREIGN KEY (pap_id) REFERENCES paps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Per-province submissions: one row per (activity, province).
-- Created lazily on first save by a PSO.
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
