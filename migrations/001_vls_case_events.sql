-- 001_vls_case_events.sql
-- Append-only event log. Case state is DERIVED from this table, never typed
-- directly. See docs/HANDOFF_2026-09-02.md (vls-data-model, vls-domain-rules).

CREATE SCHEMA IF NOT EXISTS vls;

-- ---------------------------------------------------------------------------
-- Enumerated types — narrow by design, per vls-domain-rules.
-- Only two court types are in scope; do not build a configurable rules engine.
-- ---------------------------------------------------------------------------

CREATE TYPE vls.court_type AS ENUM ('jp', 'district', 'pre_suit');

-- Every state that appears across pre-suit, JP, and District tracks.
-- Kept as one enum (not per-court-type) so case_event.new_state can reference
-- a single domain without a discriminated union at the DB layer.
CREATE TYPE vls.case_state AS ENUM (
  -- pre-suit (bad faith / DTPA)
  'intake',
  'demand_sent',
  'notice_period_open',
  -- shared filed track
  'filed',
  'served',
  'answered',
  -- district-specific
  'initial_disclosures_due',
  'discovery_open',
  -- JP-specific (the trap: discovery is not automatic after answer)
  'motion_limited_discovery_filed',
  -- terminal states
  'settled',
  'dismissed',
  'judgment'
);

CREATE TYPE vls.event_source AS ENUM (
  'manual',        -- human-entered via dashboard
  'claims_inbox',  -- extracted from forwarded firm email
  'adobe',         -- signed engagement letter
  'jotform',       -- intake form
  'black_book',    -- valuation API
  'court_efile',   -- e-filing system callback, if/when integrated
  'system'         -- computed/derived, not a real-world event
);

-- ---------------------------------------------------------------------------
-- case_event — append-only. This is the source of truth. Case.state is a
-- cached read of the latest event, never written independently.
-- ---------------------------------------------------------------------------

CREATE TABLE vls.case_event (
  id            BIGSERIAL PRIMARY KEY,
  case_id       BIGINT NOT NULL,  -- FK added in a later migration once vls.case exists
  event_type    vls.case_state NOT NULL,
  event_date    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Provenance — required on every row per vls-data-model. NULL source_ref is
  -- allowed only for manual/system events; enforced below.
  source        vls.event_source NOT NULL,
  source_ref    TEXT,             -- email message ID, envelope ID, API record ID
  notes         TEXT,

  -- Confirmed/unconfirmed pattern from vls-data-model. Bot-proposed events
  -- (e.g. "this looks like a settlement offer") start unconfirmed.
  confirmed     BOOLEAN NOT NULL DEFAULT true,
  confirmed_by  TEXT,             -- human user or named bot that confirmed

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    TEXT NOT NULL,

  CONSTRAINT case_event_source_ref_required
    CHECK (
      source IN ('manual', 'system')
      OR source_ref IS NOT NULL
    ),

  CONSTRAINT case_event_confirmed_by_required
    CHECK (
      confirmed = false
      OR confirmed_by IS NOT NULL
    )
);

CREATE INDEX idx_case_event_case_id ON vls.case_event (case_id, event_date DESC);
CREATE INDEX idx_case_event_unconfirmed ON vls.case_event (case_id) WHERE confirmed = false;

-- ---------------------------------------------------------------------------
-- Append-only enforcement: no DELETE, no UPDATE to historical fields.
-- The only permitted UPDATE is flipping confirmed/confirmed_by on a row that
-- is still unconfirmed — a human clicking "yes" on a bot's proposal.
-- ---------------------------------------------------------------------------

REVOKE DELETE ON vls.case_event FROM PUBLIC;

CREATE OR REPLACE FUNCTION vls.case_event_forbid_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'case_event is append-only: DELETE is not permitted (id=%)', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_case_event_forbid_delete
  BEFORE DELETE ON vls.case_event
  FOR EACH ROW EXECUTE FUNCTION vls.case_event_forbid_delete();

CREATE OR REPLACE FUNCTION vls.case_event_restrict_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow only a confirmation transition: confirmed false->true (+confirmed_by).
  -- Every other column must be unchanged.
  IF NEW.case_id       IS DISTINCT FROM OLD.case_id
     OR NEW.event_type IS DISTINCT FROM OLD.event_type
     OR NEW.event_date IS DISTINCT FROM OLD.event_date
     OR NEW.source     IS DISTINCT FROM OLD.source
     OR NEW.source_ref IS DISTINCT FROM OLD.source_ref
     OR NEW.notes      IS DISTINCT FROM OLD.notes
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION
      'case_event history is immutable: only confirmed/confirmed_by may change (id=%)', OLD.id;
  END IF;

  IF OLD.confirmed = true AND NEW.confirmed = false THEN
    RAISE EXCEPTION
      'case_event confirmation cannot be revoked once set (id=%)', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_case_event_restrict_update
  BEFORE UPDATE ON vls.case_event
  FOR EACH ROW EXECUTE FUNCTION vls.case_event_restrict_update();
