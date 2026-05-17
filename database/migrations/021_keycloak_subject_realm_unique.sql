-- Add realm column so the same Keycloak subject in different realms maps to different users.
-- Drop the realm-agnostic unique index from migration 009 first.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS keycloak_realm VARCHAR(255);

DROP INDEX IF EXISTS idx_users_keycloak_subject;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_keycloak_subject_realm
  ON users (keycloak_subject, keycloak_realm)
  WHERE keycloak_subject IS NOT NULL;