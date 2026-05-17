CREATE TABLE IF NOT EXISTS parent_alert_statuses (
  parent_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_id   TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT false,
  dismissed  BOOLEAN NOT NULL DEFAULT false,
  follow_up  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (parent_id, child_id, alert_id)
);