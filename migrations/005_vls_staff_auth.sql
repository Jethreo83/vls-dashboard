-- 005_vls_staff_auth.sql
-- Staff authorization layer. Authentication itself happens via Google
-- OAuth (Sign in with Google, restricted to @vlslawfirm.com) verified in
-- the API layer — this table is authorization only: who's allowed in and
-- what role they hold. Not a password store; no password column exists.

CREATE TYPE vls.staff_role AS ENUM ('attorney', 'paralegal', 'admin');

CREATE TABLE vls.staff_user (
  id                BIGSERIAL PRIMARY KEY,

  -- Identity link is optional: not every staff login needs a
  -- platform.person row (that's for clients/parties to cases). Staff can
  -- exist purely as an authorization record.
  person_id         BIGINT REFERENCES platform.person (id),

  google_email      TEXT NOT NULL UNIQUE,
  role              vls.staff_role NOT NULL,
  active            BOOLEAN NOT NULL DEFAULT true,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        TEXT NOT NULL,

  CONSTRAINT staff_user_email_domain
    CHECK (google_email LIKE '%@vlslawfirm.com')
);

CREATE INDEX idx_staff_user_email ON vls.staff_user (google_email) WHERE active = true;

-- vls_app needs to read this table to authorize requests (login lookup),
-- but never write it directly from request handlers — staff provisioning
-- is an admin action, done via unsafeOwnerQuery in the API, not vls_app.
GRANT SELECT ON vls.staff_user TO vls_app;
