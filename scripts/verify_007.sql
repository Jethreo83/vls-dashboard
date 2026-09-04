-- Verification for migration 007.
DO $$
DECLARE
  v_case_id BIGINT;
  v_eligible BOOLEAN;
BEGIN
  -- CHECK 1: third-party case with NULL cause_of_action should insert
  -- cleanly now, with fee_shifting_eligible = false (not error).
  INSERT INTO vls.case (case_type, is_first_party, court_type, created_by, updated_by)
  VALUES ('unpaid_repairs', false, 'jp', 'verify_007', 'verify_007')
  RETURNING id, fee_shifting_eligible INTO v_case_id, v_eligible;

  IF v_eligible IS NOT false THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: expected fee_shifting_eligible=false, got %', v_eligible;
  END IF;
  RAISE NOTICE 'CHECK 1 PASSED: third-party, NULL cause_of_action -> eligible=false, no error';

  -- CHECK 2: first-party still always eligible regardless of cause.
  INSERT INTO vls.case (case_type, is_first_party, court_type, created_by, updated_by)
  VALUES ('diminished_value', true, 'district', 'verify_007', 'verify_007')
  RETURNING fee_shifting_eligible INTO v_eligible;

  IF v_eligible IS NOT true THEN
    RAISE EXCEPTION 'CHECK 2 FAILED: expected fee_shifting_eligible=true for first-party, got %', v_eligible;
  END IF;
  RAISE NOTICE 'CHECK 2 PASSED: first-party -> eligible=true regardless of cause';

  -- CHECK 3: third-party with the qualifying cause is still eligible.
  INSERT INTO vls.case (case_type, cause_of_action, is_first_party, court_type, created_by, updated_by)
  VALUES ('unpaid_repairs', 'contract_chapter_38', false, 'jp', 'verify_007', 'verify_007')
  RETURNING fee_shifting_eligible INTO v_eligible;

  IF v_eligible IS NOT true THEN
    RAISE EXCEPTION 'CHECK 3 FAILED: expected fee_shifting_eligible=true for Chapter 38 third-party, got %', v_eligible;
  END IF;
  RAISE NOTICE 'CHECK 3 PASSED: third-party + contract_chapter_38 -> still eligible=true';

  -- CHECK 4: third-party with a non-qualifying cause is not eligible.
  INSERT INTO vls.case (case_type, cause_of_action, is_first_party, court_type, created_by, updated_by)
  VALUES ('personal_injury', 'negligence', false, 'district', 'verify_007', 'verify_007')
  RETURNING fee_shifting_eligible INTO v_eligible;

  IF v_eligible IS NOT false THEN
    RAISE EXCEPTION 'CHECK 4 FAILED: expected fee_shifting_eligible=false for negligence third-party, got %', v_eligible;
  END IF;
  RAISE NOTICE 'CHECK 4 PASSED: third-party + negligence -> eligible=false, unchanged';

  RAISE NOTICE 'ALL CHECKS PASSED';
END $$;
