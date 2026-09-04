-- 007_vls_fix_fee_shifting_null_cause.sql
-- Fixes a real bug in migration 002: compute_fee_shifting_eligible()
-- did `RETURN p_cause_of_action = 'contract_chapter_38'` for non-first-party
-- cases. In SQL, `NULL = 'contract_chapter_38'` evaluates to NULL, not
-- false, so any third-party case created WITHOUT a cause_of_action (a
-- perfectly normal state at intake, before the cause is determined)
-- returned NULL from the function, which then violated the
-- fee_shifting_eligible NOT NULL constraint on vls.case with a confusing
-- error that had nothing to do with the actual problem.
--
-- Found via live API fuzz-testing (POST /cases with a third-party case
-- and no cause_of_action) — not a hypothetical, a real insert failure.
--
-- Fix: explicit COALESCE so a NULL cause_of_action is treated as "not yet
-- known, so not (yet) eligible" rather than propagating NULL.

CREATE OR REPLACE FUNCTION vls.compute_fee_shifting_eligible(
  p_is_first_party BOOLEAN,
  p_cause_of_action vls.cause_of_action
) RETURNS BOOLEAN AS $$
BEGIN
  IF p_is_first_party THEN
    RETURN true;
  END IF;
  RETURN COALESCE(p_cause_of_action = 'contract_chapter_38', false);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
