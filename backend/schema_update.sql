ALTER TABLE links ADD COLUMN IF NOT EXISTS description VARCHAR(1024) NULL;

ALTER TABLE leave_requests MODIFY COLUMN leave_type ENUM('vacation','sick','emergency','official-business','wfh','fieldwork') NOT NULL DEFAULT 'vacation';
