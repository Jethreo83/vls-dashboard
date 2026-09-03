-- Verification harness for migration 002. Runs as a single DO block so
-- case IDs are captured in PL/pgSQL variables (the embedded psql client
-- used for these checks doesn't support \gset). Behaviors are checked by
-- direct data inspection printed via RAISE NOTICE and by post-block SELECTs.

DO $$
DECLARE
  v_case_a_id BIGINT;  -- JP, third-party, Chapter 38 (fee-shifting correction + JP trap)
  v_case_b_id BIGINT;  -- District, first-party PI
  v_case_c_id BIGINT;  -- District, third-party negligence (control, NOT fee-shifting)
  v_state vls.case_state;
BEGIN
  INSERT INTO vls.case (case_type, cause_of_action, is_first_party, court_type, created_by, updated_by)
  VALUES ('unpaid_repairs', 'contract_chapter_38', false, 'jp', 'test_harness', 'test_harness')
  RETURNING id INTO v_case_a_id;

  INSERT INTO vls.case (case_type, cause_of_action, is_first_party, court_type, created_by, updated_by)
  VALUES ('personal_injury', 'negligence', true, 'district', 'test_harness', 'test_harness')
  RETURNING id INTO v_case_b_id;

  INSERT INTO vls.case (case_type, cause_of_action, is_first_party, court_type, created_by, updated_by)
  VALUES ('personal_injury', 'negligence', false, 'district', 'test_harness', 'test_harness')
  RETURNING id INTO v_case_c_id;

  RAISE NOTICE 'case_a_id=% case_b_id=% case_c_id=%', v_case_a_id, v_case_b_id, v_case_c_id;

  -- Push case A: intake -> filed -> served -> answered (JP)
  INSERT INTO vls.case_event (case_id, event_type, source, created_by, confirmed, confirmed_by)
  VALUES (v_case_a_id, 'filed', 'manual', 'test_harness', true, 'test_harness');
  INSERT INTO vls.case_event (case_id, event_type, source, created_by, confirmed, confirmed_by)
  VALUES (v_case_a_id, 'served', 'manual', 'test_harness', true, 'test_harness');
  INSERT INTO vls.case_event (case_id, event_type, source, created_by, confirmed, confirmed_by)
  VALUES (v_case_a_id, 'answered', 'manual', 'test_harness', true, 'test_harness');

  SELECT current_state INTO v_state FROM vls.case WHERE id = v_case_a_id;
  IF v_state <> 'answered' THEN
    RAISE EXCEPTION 'CHECK 2 FAILED: expected answered, got %', v_state;
  END IF;
  RAISE NOTICE 'CHECK 2 PASSED: case_a advanced to answered';

  -- CHECK 3: JP trap — jumping to discovery_open from answered must fail
  BEGIN
    INSERT INTO vls.case_event (case_id, event_type, source, created_by, confirmed, confirmed_by)
    VALUES (v_case_a_id, 'discovery_open', 'manual', 'test_harness', true, 'test_harness');
    RAISE EXCEPTION 'CHECK 3 FAILED: JP case skipped the motion and reached discovery_open';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%not allowed%' THEN
      RAISE NOTICE 'CHECK 3 PASSED: JP trap enforced (%)', SQLERRM;
    ELSE
      RAISE EXCEPTION 'CHECK 3 FAILED unexpectedly: %', SQLERRM;
    END IF;
  END;

  -- CHECK 4: correct JP path succeeds
  INSERT INTO vls.case_event (case_id, event_type, source, created_by, confirmed, confirmed_by)
  VALUES (v_case_a_id, 'motion_limited_discovery_filed', 'manual', 'test_harness', true, 'test_harness');
  SELECT current_state INTO v_state FROM vls.case WHERE id = v_case_a_id;
  IF v_state <> 'motion_limited_discovery_filed' THEN
    RAISE EXCEPTION 'CHECK 4 FAILED: expected motion_limited_discovery_filed, got %', v_state;
  END IF;
  RAISE NOTICE 'CHECK 4 PASSED: JP motion path succeeded, state=%', v_state;

  -- CHECK 5: direct write to current_state rejected
  BEGIN
    UPDATE vls.case SET current_state = 'settled' WHERE id = v_case_a_id;
    RAISE EXCEPTION 'CHECK 5 FAILED: direct current_state write should have been rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%cannot be written directly%' THEN
      RAISE NOTICE 'CHECK 5 PASSED: direct state write rejected';
    ELSE
      RAISE EXCEPTION 'CHECK 5 FAILED unexpectedly: %', SQLERRM;
    END IF;
  END;

  RAISE NOTICE 'case_b_id for manual follow-up query = %', v_case_b_id;
END $$;

-- CHECK 1 (post-hoc, readable table): fee_shifting_eligible per case
SELECT id, case_type, is_first_party, cause_of_action, fee_shifting_eligible
FROM vls.case ORDER BY id;

-- CHECK 6: blocked list includes the District case with no service_date
SELECT * FROM vls.blocked_cases;

-- CHECK 7: pre-suit earliest_file_date auto-compute
INSERT INTO vls.case (case_type, cause_of_action, is_first_party, court_type, demand_sent_date, created_by, updated_by)
VALUES ('first_party_bad_faith_dtpa', 'bad_faith', true, 'pre_suit', '2026-07-01', 'test_harness', 'test_harness')
RETURNING id, demand_sent_date, earliest_file_date;
-- EXPECT earliest_file_date = 2026-08-30

SELECT 'ALL CHECKS COMPLETED — verify NOTICEs above show PASSED for 2,3,4,5' AS summary;
