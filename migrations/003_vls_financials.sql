-- 003_vls_financials.sql
-- Financials tab — case costs, fee split, one-button settlement breakdown.
-- Per handoff: "Jed rates this highly. Keep the whole flow." Provenance and
-- confirmed/unconfirmed patterns apply here too (vls-data-model): medical
-- bills and extracted costs are not demand-ready until confirmed.

CREATE TYPE vls.cost_category AS ENUM (
  'medical',
  'filing_fee',
  'expert_witness',
  'deposition',
  'mediation',
  'process_serving',
  'court_reporter',
  'other'
);

-- ---------------------------------------------------------------------------
-- case_cost — itemized. recoverable flag drives whether a cost counts
-- toward a fee-shifting recovery claim vs. is purely internal overhead.
-- ---------------------------------------------------------------------------

CREATE TABLE vls.case_cost (
  id              BIGSERIAL PRIMARY KEY,
  case_id         BIGINT NOT NULL REFERENCES vls.case (id),

  category        vls.cost_category NOT NULL,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  incurred_date   DATE NOT NULL,
  description     TEXT,

  -- Recoverable = eligible to be sought back from the opposing party.
  -- Only meaningful (settable true) when the case is fee_shifting_eligible;
  -- enforced by the trigger below, not left to application discipline.
  recoverable     BOOLEAN NOT NULL DEFAULT false,

  -- Provenance pattern (vls-data-model): anything a bot writes must say
  -- where it came from. Manual entries are exempt from source_ref, same
  -- rule as case_event.
  source          vls.event_source NOT NULL DEFAULT 'manual',
  source_ref      TEXT,
  confirmed       BOOLEAN NOT NULL DEFAULT true,
  confirmed_by    TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT NOT NULL,

  CONSTRAINT case_cost_source_ref_required
    CHECK (source IN ('manual', 'system') OR source_ref IS NOT NULL),

  CONSTRAINT case_cost_confirmed_by_required
    CHECK (confirmed = false OR confirmed_by IS NOT NULL)
);

CREATE INDEX idx_case_cost_case_id ON vls.case_cost (case_id);
CREATE INDEX idx_case_cost_unconfirmed ON vls.case_cost (case_id) WHERE confirmed = false;

-- A cost cannot be marked recoverable unless the case is fee_shifting_eligible.
-- This is the check that makes the fee-shifting correction (migration 002)
-- actually matter operationally, not just a flag nobody reads.
CREATE OR REPLACE FUNCTION vls.case_cost_check_recoverable()
RETURNS TRIGGER AS $$
DECLARE
  v_eligible BOOLEAN;
BEGIN
  IF NEW.recoverable THEN
    SELECT fee_shifting_eligible INTO v_eligible FROM vls.case WHERE id = NEW.case_id;
    IF v_eligible IS NOT true THEN
      RAISE EXCEPTION
        'case_cost cannot be marked recoverable: case % is not fee_shifting_eligible',
        NEW.case_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_case_cost_check_recoverable
  BEFORE INSERT OR UPDATE ON vls.case_cost
  FOR EACH ROW EXECUTE FUNCTION vls.case_cost_check_recoverable();

-- ---------------------------------------------------------------------------
-- case_financial — one row per case. Fee split kept separate from costs;
-- fees_sought vs fees_awarded kept separate per the handoff spec.
-- ---------------------------------------------------------------------------

CREATE TABLE vls.case_financial (
  case_id             BIGINT PRIMARY KEY REFERENCES vls.case (id),

  -- Settlement / award total, before fee split.
  gross_recovery      NUMERIC(12,2) CHECK (gross_recovery IS NULL OR gross_recovery >= 0),

  -- Contingency fee percentage (e.g. 0.3333 for 33.33%, 0.40 for litigation).
  -- NULL when the case is pure fee-shifting with no contingency component.
  contingency_pct     NUMERIC(5,4) CHECK (contingency_pct IS NULL OR (contingency_pct >= 0 AND contingency_pct <= 1)),

  -- Fee-shifting amounts, kept separate from contingency per handoff spec.
  -- fees_sought is what's demanded/pled; fees_awarded is what's actually
  -- ordered or agreed. Reconciliation (sought vs awarded) required only
  -- on resolved cases — see the view below.
  fees_sought         NUMERIC(12,2) CHECK (fees_sought IS NULL OR fees_sought >= 0),
  fees_awarded        NUMERIC(12,2) CHECK (fees_awarded IS NULL OR fees_awarded >= 0),

  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          TEXT NOT NULL,

  -- fees_sought/awarded only make sense on a fee-shifting-eligible case.
  -- Enforced in the trigger below (needs a join to vls.case), not here.
  CONSTRAINT case_financial_awarded_le_sought
    CHECK (
      fees_awarded IS NULL
      OR fees_sought IS NULL
      OR fees_awarded <= fees_sought * 1.5  -- courts can award more than sought in rare cases; sanity ceiling, not a hard cap
    )
);

CREATE OR REPLACE FUNCTION vls.case_financial_check_fee_shifting_fields()
RETURNS TRIGGER AS $$
DECLARE
  v_eligible BOOLEAN;
BEGIN
  IF NEW.fees_sought IS NOT NULL OR NEW.fees_awarded IS NOT NULL THEN
    SELECT fee_shifting_eligible INTO v_eligible FROM vls.case WHERE id = NEW.case_id;
    IF v_eligible IS NOT true THEN
      RAISE EXCEPTION
        'case % is not fee_shifting_eligible: fees_sought/fees_awarded must be NULL',
        NEW.case_id;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_case_financial_check_fee_shifting_fields
  BEFORE INSERT OR UPDATE ON vls.case_financial
  FOR EACH ROW EXECUTE FUNCTION vls.case_financial_check_fee_shifting_fields();

-- ---------------------------------------------------------------------------
-- Confirmed vs pending cost totals — vls-data-model: "the case shows both
-- totals — confirmed and pending. Nothing goes into a demand unconfirmed."
-- ---------------------------------------------------------------------------

CREATE VIEW vls.case_cost_summary AS
SELECT
  case_id,
  COALESCE(SUM(amount) FILTER (WHERE confirmed = true), 0) AS confirmed_total,
  COALESCE(SUM(amount) FILTER (WHERE confirmed = false), 0) AS pending_total,
  COALESCE(SUM(amount) FILTER (WHERE confirmed = true AND recoverable = true), 0) AS confirmed_recoverable_total
FROM vls.case_cost
GROUP BY case_id;

-- ---------------------------------------------------------------------------
-- One-button settlement breakdown — the view Jed rates highly. Joins
-- case + financial + cost summary into the numbers a PDF generator needs.
-- ---------------------------------------------------------------------------

CREATE VIEW vls.settlement_breakdown AS
SELECT
  c.id AS case_id,
  c.case_type,
  c.is_first_party,
  c.fee_shifting_eligible,
  cf.gross_recovery,
  cf.contingency_pct,
  ROUND(cf.gross_recovery * cf.contingency_pct, 2) AS contingency_fee_amount,
  cf.fees_sought,
  cf.fees_awarded,
  ccs.confirmed_total AS costs_confirmed,
  ccs.pending_total AS costs_pending,
  ccs.confirmed_recoverable_total AS costs_recoverable,
  -- Net to client: gross recovery minus contingency fee minus confirmed non-recoverable costs.
  ROUND(
    COALESCE(cf.gross_recovery, 0)
    - COALESCE(cf.gross_recovery * cf.contingency_pct, 0)
    - (COALESCE(ccs.confirmed_total, 0) - COALESCE(ccs.confirmed_recoverable_total, 0)),
    2
  ) AS net_to_client
FROM vls.case c
LEFT JOIN vls.case_financial cf ON cf.case_id = c.id
LEFT JOIN vls.case_cost_summary ccs ON ccs.case_id = c.id;

-- ---------------------------------------------------------------------------
-- Reconciliation required only on resolved cases (vls-data-model).
-- Surfaces resolved cases where fees_sought/awarded aren't both set.
-- ---------------------------------------------------------------------------

CREATE VIEW vls.unreconciled_financials AS
SELECT c.id AS case_id, c.current_state, cf.fees_sought, cf.fees_awarded
FROM vls.case c
JOIN vls.case_financial cf ON cf.case_id = c.id
WHERE c.current_state IN ('settled', 'judgment')
  AND c.fee_shifting_eligible = true
  AND (cf.fees_sought IS NULL OR cf.fees_awarded IS NULL);
