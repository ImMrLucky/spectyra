-- Platform-wide roles (by email). Grants perpetual billing access and superuser console.
-- Only emails listed here bypass subscription checks when matched to the signed-in user.
--
-- WHERE TO RUN: Apply this file against the API Postgres database (same DATABASE_URL as
-- Railway / Supabase — not on the Mac, not in SQLite). The API selects orgs.platform_exempt
-- on many routes; if this migration was never applied, the desktop and web apps can get 500s
-- when loading org/session data.

CREATE TABLE IF NOT EXISTS platform_roles (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('superuser', 'admin', 'exempt')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_email TEXT
);

CREATE INDEX IF NOT EXISTS idx_platform_roles_role ON platform_roles(role);

-- Bootstrap: sole initial superuser (can grant others via /v1/superuser/platform-users)
INSERT INTO platform_roles (email, role, created_by_email)
VALUES ('gkh1974@gmail.com', 'superuser', 'migration_bootstrap')
ON CONFLICT (email) DO NOTHING;

-- Org-level perpetual access (API key + chat/replay) for QA — toggled by superuser in console.
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS platform_exempt BOOLEAN NOT NULL DEFAULT false;
