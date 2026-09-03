-- 004_platform_rls.sql
-- ADR-002: shared person registry, deliberately thin, with row-level
-- security so cross-app visibility only happens through each app's own
-- party table — never automatically.
--
-- HINGE CONDITION (binding, ADR-001): platform schema holds identity and
-- cross-cutting infrastructure only — never domain lifecycle. No state
-- machines, no deadlines, no money, no matter/order/booking attributes.
-- Nothing in this migration violates that; vls.client carries the VLS-
-- specific attributes, platform.person carries only identity.

CREATE SCHEMA IF NOT EXISTS platform;

-- ---------------------------------------------------------------------------
-- platform.person — identity only. Names, DOB, normalised contact points.
-- Does NOT record which businesses a person is involved with — that fact
-- lives only in each app's own party table (vls.client, collision.customer,
-- elektrica.renter — the latter two arrive in future migrations when those
-- apps are built, per ADR-001's "extract only when a second consumer needs
-- it").
-- ---------------------------------------------------------------------------

CREATE TABLE platform.person (
  id                BIGSERIAL PRIMARY KEY,

  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  date_of_birth     DATE,

  -- Normalised for matching (intake: match before create, vls-domain-rules).
  -- Store both raw and normalised so the matcher doesn't reformat on every
  -- query. Normalisation logic lives in application code; this column is
  -- just storage for its output.
  email_normalized  TEXT,
  phone_normalized  TEXT,  -- E.164 digits only, no punctuation

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        TEXT NOT NULL
);

CREATE INDEX idx_person_email ON platform.person (email_normalized) WHERE email_normalized IS NOT NULL;
CREATE INDEX idx_person_phone ON platform.person (phone_normalized) WHERE phone_normalized IS NOT NULL;

-- ---------------------------------------------------------------------------
-- platform.person_merge — append-only, reversible merge log. Per ADR-002:
-- "Merges are append-only and reversible."
-- ---------------------------------------------------------------------------

CREATE TABLE platform.person_merge (
  id                BIGSERIAL PRIMARY KEY,
  surviving_id      BIGINT NOT NULL REFERENCES platform.person (id),
  merged_id         BIGINT NOT NULL REFERENCES platform.person (id),
  merged_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  merged_by         TEXT NOT NULL,
  reversed_at       TIMESTAMPTZ,
  reversed_by       TEXT,

  CONSTRAINT person_merge_distinct CHECK (surviving_id <> merged_id)
);

REVOKE DELETE ON platform.person_merge FROM PUBLIC;

CREATE OR REPLACE FUNCTION platform.person_merge_forbid_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'platform.person_merge is append-only: DELETE is not permitted (id=%)', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_person_merge_forbid_delete
  BEFORE DELETE ON platform.person_merge
  FOR EACH ROW EXECUTE FUNCTION platform.person_merge_forbid_delete();

-- ---------------------------------------------------------------------------
-- vls.client — VLS's own party table, keyed by person_id. Engagement date
-- and fee structure live HERE, not in platform.person, per the hinge
-- condition. The fact that someone is a VLS client is knowable only by a
-- row existing in this table.
-- ---------------------------------------------------------------------------

CREATE TABLE vls.client (
  id                BIGSERIAL PRIMARY KEY,
  person_id         BIGINT NOT NULL REFERENCES platform.person (id),

  engagement_date   DATE NOT NULL,
  intake_source     vls.intake_source NOT NULL DEFAULT 'manual',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        TEXT NOT NULL,

  CONSTRAINT client_one_row_per_person UNIQUE (person_id)
);

CREATE INDEX idx_client_person ON vls.client (person_id);

-- Now that vls.client exists, wire vls.case.client_person_id to it properly.
-- The column already exists (migration 002) as a bare BIGINT placeholder;
-- add the FK now. Note it references platform.person directly (a case is
-- about a person who is a VLS client — the FK to person is the identity
-- link; vls.client existing for that person_id is what makes them a client
-- at all, enforced by application logic at case-creation time, not by a DB
-- constraint here, since a case can theoretically predate client-table
-- backfill during migration).
ALTER TABLE vls.case
  ADD CONSTRAINT fk_case_client_person
  FOREIGN KEY (client_person_id) REFERENCES platform.person (id);

-- ---------------------------------------------------------------------------
-- Row-level security on platform.person.
--
-- ADR-002 (binding condition): "each app reads only rows linked from its
-- own party table. A VLS-only client is invisible to Collision and
-- Elektrica — not hidden, invisible."
--
-- Mechanism: a Postgres role per app. vls_app can see a person row only if
-- a matching vls.client row exists. Collision/Elektrica roles are created
-- in their own future migrations when those schemas exist, following the
-- identical pattern.
--
-- Identity resolution at intake (matching phone/email across sources) runs
-- as a separate, logged, platform-privileged service — not through the
-- per-app RLS-scoped roles. That service role is created here since it's
-- platform-level, not app-level.
-- ---------------------------------------------------------------------------

ALTER TABLE platform.person ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.person FORCE ROW LEVEL SECURITY;  -- applies even to the table owner

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vls_app') THEN
    CREATE ROLE vls_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'platform_identity_service') THEN
    CREATE ROLE platform_identity_service NOLOGIN;
  END IF;
END $$;

-- Allow the branch owner role to SET ROLE into these for testing and for
-- application connection pooling that authenticates as the owner and
-- switches role per request. Real deployments should connect the app
-- server directly as vls_app / platform_identity_service where possible.
GRANT vls_app TO neondb_owner;
GRANT platform_identity_service TO neondb_owner;

GRANT USAGE ON SCHEMA platform TO vls_app;
GRANT SELECT ON platform.person TO vls_app;
GRANT USAGE ON SCHEMA vls TO vls_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA vls TO vls_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA vls TO vls_app;

-- Platform identity service bypasses RLS deliberately (its whole job is
-- cross-app matching) — it gets a separate, explicitly-granted role rather
-- than BYPASSRLS superuser-style access, so the grant is visible and
-- revocable, and every action it takes should be logged by the application
-- layer that connects as this role.
GRANT USAGE ON SCHEMA platform TO platform_identity_service;
GRANT SELECT, INSERT, UPDATE ON platform.person TO platform_identity_service;
GRANT SELECT, INSERT, UPDATE ON platform.person_merge TO platform_identity_service;
ALTER TABLE platform.person FORCE ROW LEVEL SECURITY;

CREATE POLICY vls_app_sees_own_clients ON platform.person
  FOR SELECT
  TO vls_app
  USING (
    EXISTS (
      SELECT 1 FROM vls.client c WHERE c.person_id = platform.person.id
    )
  );

-- The identity service needs its own bypass policy since FORCE ROW LEVEL
-- SECURITY applies even to roles with broad grants unless a policy exists.
CREATE POLICY identity_service_sees_all ON platform.person
  FOR ALL
  TO platform_identity_service
  USING (true)
  WITH CHECK (true);

-- vls_app may not write new person rows directly — creation goes through
-- the identity service's match-before-create flow (vls-domain-rules:
-- "match on phone/email, then name+DOB; exact match attaches; close match
-- queues for human confirm-or-split; no match creates new"). Enforce by
-- granting SELECT only on platform.person, already done above (no INSERT
-- grant to vls_app).
