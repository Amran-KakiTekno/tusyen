-- Link local Tusyen accounts to Keycloak identities while preserving
-- the existing JWT/password login path for demo and admin-created users.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(32) NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS keycloak_subject VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_keycloak_subject
  ON users(keycloak_subject)
  WHERE keycloak_subject IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_auth_provider
  ON users(auth_provider);
