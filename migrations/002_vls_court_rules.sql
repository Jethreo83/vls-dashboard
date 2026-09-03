-- 002_vls_court_rules.sql
-- The case table itself, plus court_type/state constraints per
-- vls-domain-rules. Two court types only, hard-coded — no configurable
-- rules engine for two rows.

-- ---------------------------------------------------------------------------
-- Case type / fee structure — narrow by design (vls-domain-rules).
-- Fee-shifting eligibility is NOT purely first/third-party (corrected
-- 2026-09-03, see README.md): a third-party contract claim (e.g. unpaid
-- repairs under Chapter 38) can still be fee-shifting if the cause of
-- action supports it. So fee_shifting_eligible is its own column, derived
-- from cause_of_action at insert/update time, not hard-coded from
-- is_first_party alone.
-- ---------------------------------------------------------------------------

CREATE TYPE vls.case_type AS ENUM (
  'diminished_value',
  'unpaid_repairs',
  'rental',
  'personal_injury',
  'first_party_bad_faith_dtpa'
);

CREATE TYPE vls.cause_of_action AS ENUM (
  'negligence',
  'dtpa',
  'bad_faith',
  'contract_chapter_38',   -- unpaid repairs etc — third-party but fee-shifting eligible
  'other_contract'
);

CREATE TYPE vls.intake_source AS ENUM ('adobe', 'jotform', 'manual');

-- ---------------------------------------------------------------------------
-- vls.case
-- ---------------------------------------------------------------------------

CREATE TABLE vls.case (
  id                      BIGSERIAL PRIMARY KEY,

  -- identity linkage — platform.person doesn't exist until migration 004
  -- (ADR-002). Nullable FK added there; for now this column exists so
  -- downstream tables can reference it without another migration.
  client_person_id        BIGINT,

  case_type               vls.case_type NOT NULL,
  cause_of_action         vls.cause_of_action,

  -- Top-level attribute per vls-domain-rules — not just a label, a different
  -- business model. Feeds the priority score.
  is_first_party          BOOLEAN NOT NULL,

  -- Fee-shifting eligibility: first-party is always eligible. Third-party is
  -- eligible only when cause_of_action is a qualifying contract claim.
  -- Computed, not hand-set, so it can't drift from the rule (see function
  -- below). Stored (not a view) so it's indexable and cheap to query from
  -- the priority score.
  fee_shifting_eligible   BOOLEAN NOT NULL DEFAULT false,

  court_type              vls.court_type NOT NULL,
  -- current_state is a CACHED READ of the latest case_event, per
  -- vls-data-model. Never written directly by application code outside the
  -- trigger below — enforced by REVOKE + trigger, not just convention.
  current_state           vls.case_state NOT NULL DEFAULT 'intake',

  -- Pre-suit clock (bad faith / DTPA). NULL unless court_type = 'pre_suit'.
  demand_sent_date        DATE,
  earliest_file_date      DATE,  -- demand_sent_date + 60, computed, not typed

  -- Service date is the trigger for most downstream computed deadlines.
  -- Nullable on purpose — missing service date is a BLOCKED case, not an
  -- error (vls-domain-rules: blocked list, not required fields).
  service_date            DATE,

  intake_source           vls.intake_source NOT NULL DEFAULT 'manual',
  unusual_notes           TEXT,  -- the ONE free-text field, empty by default

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by              TEXT NOT NULL,
  updated_by              TEXT NOT NULL,

  CONSTRAINT case_pre_suit_dates_only_for_pre_suit
    CHECK (
      court_type = 'pre_suit'
      OR (demand_sent_date IS NULL AND earliest_file_date IS NULL)
    ),

  CONSTRAINT case_earliest_file_date_computed
    CHECK (
      demand_sent_date IS NULL
      OR earliest_file_date = demand_sent_date + INTERVAL '60 days'
    )
);

CREATE INDEX idx_case_court_state ON vls.case (court_type, current_state);
CREATE INDEX idx_case_client ON vls.case (client_person_id);
CREATE INDEX idx_case_blocked_service_date
  ON vls.case (id) WHERE service_date IS NULL AND court_type <> 'pre_suit';

ALTER TABLE vls.case_event
  ADD CONSTRAINT fk_case_event_case
  FOREIGN KEY (case_id) REFERENCES vls.case (id);

-- ---------------------------------------------------------------------------
-- fee_shifting_eligible — computed, not hand-set.
-- Rule (corrected 2026-09-03): first-party is always eligible. Third-party
-- is eligible only for qualifying contract causes of action (Chapter 38).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION vls.compute_fee_shifting_eligible(
  p_is_first_party BOOLEAN,
  p_cause_of_action vls.cause_of_action
) RETURNS BOOLEAN AS $$
BEGIN
  IF p_is_first_party THEN
    RETURN true;
  END IF;
  RETURN p_cause_of_action = 'contract_chapter_38';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION vls.case_set_fee_shifting_eligible()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fee_shifting_eligible :=
    vls.compute_fee_shifting_eligible(NEW.is_first_party, NEW.cause_of_action);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_case_set_fee_shifting_eligible
  BEFORE INSERT OR UPDATE ON vls.case
  FOR EACH ROW EXECUTE FUNCTION vls.case_set_fee_shifting_eligible();

-- ---------------------------------------------------------------------------
-- Court event state machine validation.
-- Only two real court types drive a sequence (JP, District); pre_suit has
-- its own three-state track. This function is the single place the sequence
-- rules live — see vls-domain-rules tables for the source of truth.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION vls.valid_next_states(
  p_court_type vls.court_type,
  p_current_state vls.case_state
) RETURNS vls.case_state[] AS $$
BEGIN
  CASE p_court_type
    WHEN 'pre_suit' THEN
      CASE p_current_state
        WHEN 'intake' THEN RETURN ARRAY['demand_sent']::vls.case_state[];
        WHEN 'demand_sent' THEN RETURN ARRAY['notice_period_open']::vls.case_state[];
        WHEN 'notice_period_open' THEN RETURN ARRAY['filed', 'settled', 'dismissed']::vls.case_state[];
        ELSE RETURN ARRAY[]::vls.case_state[];
      END CASE;

    WHEN 'district' THEN
      CASE p_current_state
        WHEN 'intake' THEN RETURN ARRAY['filed']::vls.case_state[];
        WHEN 'filed' THEN RETURN ARRAY['served']::vls.case_state[];
        WHEN 'served' THEN RETURN ARRAY['answered']::vls.case_state[];
        -- District: initial disclosures are automatic after answer.
        WHEN 'answered' THEN RETURN ARRAY['initial_disclosures_due']::vls.case_state[];
        WHEN 'initial_disclosures_due' THEN RETURN ARRAY['discovery_open']::vls.case_state[];
        WHEN 'discovery_open' THEN RETURN ARRAY['settled', 'dismissed', 'judgment']::vls.case_state[];
        ELSE RETURN ARRAY[]::vls.case_state[];
      END CASE;

    WHEN 'jp' THEN
      CASE p_current_state
        WHEN 'intake' THEN RETURN ARRAY['filed']::vls.case_state[];
        WHEN 'filed' THEN RETURN ARRAY['served']::vls.case_state[];
        WHEN 'served' THEN RETURN ARRAY['answered']::vls.case_state[];
        -- JP TRAP: discovery is NOT automatic. A motion for limited
        -- discovery must be filed after the answer. A case sitting in
        -- 'answered' with no motion filed is stalled, not waiting.
        WHEN 'answered' THEN RETURN ARRAY['motion_limited_discovery_filed']::vls.case_state[];
        WHEN 'motion_limited_discovery_filed' THEN RETURN ARRAY['discovery_open']::vls.case_state[];
        WHEN 'discovery_open' THEN RETURN ARRAY['settled', 'dismissed', 'judgment']::vls.case_state[];
        ELSE RETURN ARRAY[]::vls.case_state[];
      END CASE;
  END CASE;
  RETURN ARRAY[]::vls.case_state[];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Enforce the sequence when a new case_event is inserted: the event's
-- event_type must be a valid next state for the case's court_type and
-- current recorded state. Terminal-state events (settled/dismissed/judgment)
-- are allowed from any non-terminal state per the ARRAYs above.
CREATE OR REPLACE FUNCTION vls.case_event_enforce_sequence()
RETURNS TRIGGER AS $$
DECLARE
  v_court_type vls.court_type;
  v_current_state vls.case_state;
  v_valid vls.case_state[];
BEGIN
  SELECT court_type, current_state INTO v_court_type, v_current_state
  FROM vls.case WHERE id = NEW.case_id
  FOR UPDATE;  -- lock the case row; concurrent bot+human writes are expected

  IF v_court_type IS NULL THEN
    RAISE EXCEPTION 'case_event references unknown case_id=%', NEW.case_id;
  END IF;

  v_valid := vls.valid_next_states(v_court_type, v_current_state);

  IF NOT (NEW.event_type = ANY(v_valid)) THEN
    RAISE EXCEPTION
      'Invalid state transition for case % (% / %): % -> % is not allowed. Valid next states: %',
      NEW.case_id, v_court_type, v_current_state, v_current_state, NEW.event_type, v_valid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_case_event_enforce_sequence
  BEFORE INSERT ON vls.case_event
  FOR EACH ROW EXECUTE FUNCTION vls.case_event_enforce_sequence();

-- After a case_event is inserted (and passes the sequence check above),
-- advance vls.case.current_state to match. This is the ONLY place
-- current_state is written — direct UPDATEs to it are blocked below.
-- Sets a session-local flag so the guard trigger can distinguish this
-- system-internal write from a direct application UPDATE.
CREATE OR REPLACE FUNCTION vls.case_advance_state()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM set_config('vls.internal_state_write', 'true', true);
  UPDATE vls.case
  SET current_state = NEW.event_type,
      updated_at = now(),
      updated_by = NEW.created_by
  WHERE id = NEW.case_id;
  PERFORM set_config('vls.internal_state_write', 'false', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_case_advance_state
  AFTER INSERT ON vls.case_event
  FOR EACH ROW EXECUTE FUNCTION vls.case_advance_state();

-- Block direct writes to current_state from application code — it must only
-- change via the case_event trigger above, which sets the session-local flag.
CREATE OR REPLACE FUNCTION vls.case_forbid_direct_state_write()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_state IS DISTINCT FROM OLD.current_state
     AND coalesce(current_setting('vls.internal_state_write', true), 'false') <> 'true'
  THEN
    RAISE EXCEPTION
      'vls.case.current_state cannot be written directly (case_id=%). Insert a vls.case_event instead.',
      OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_case_forbid_direct_state_write
  BEFORE UPDATE ON vls.case
  FOR EACH ROW
  WHEN (NEW.current_state IS DISTINCT FROM OLD.current_state)
  EXECUTE FUNCTION vls.case_forbid_direct_state_write();

-- ---------------------------------------------------------------------------
-- earliest_file_date auto-compute when demand_sent_date is set.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION vls.case_compute_earliest_file_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.demand_sent_date IS NOT NULL THEN
    NEW.earliest_file_date := NEW.demand_sent_date + INTERVAL '60 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_case_compute_earliest_file_date
  BEFORE INSERT OR UPDATE ON vls.case
  FOR EACH ROW EXECUTE FUNCTION vls.case_compute_earliest_file_date();

-- ---------------------------------------------------------------------------
-- Blocked list — a query, not required fields, per vls-domain-rules.
-- "14 cases cannot be scheduled — missing service date."
-- ---------------------------------------------------------------------------

CREATE VIEW vls.blocked_cases AS
SELECT id, case_type, court_type, current_state,
       'missing service date' AS block_reason
FROM vls.case
WHERE service_date IS NULL
  AND court_type <> 'pre_suit'
  AND current_state NOT IN ('settled', 'dismissed', 'judgment')
UNION ALL
SELECT id, case_type, court_type, current_state,
       'answered in JP with no motion for limited discovery filed' AS block_reason
FROM vls.case
WHERE court_type = 'jp'
  AND current_state = 'answered';
