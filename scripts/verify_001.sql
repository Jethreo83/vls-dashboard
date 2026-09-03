-- Verification harness for migration 001. Run against staging before
-- promoting. Each test should produce the labeled outcome; anything else is
-- a FAIL, not a partial pass, per verify-before-done.

-- TEST 1: valid manual event insert should succeed
INSERT INTO vls.case_event (case_id, event_type, source, source_ref, created_by, confirmed, confirmed_by)
VALUES (1, 'intake', 'manual', NULL, 'test_harness', true, 'test_harness');
-- EXPECT: INSERT 0 1

-- TEST 2: bot-extracted event without source_ref should be rejected
DO $$
BEGIN
  BEGIN
    INSERT INTO vls.case_event (case_id, event_type, source, source_ref, created_by)
    VALUES (1, 'demand_sent', 'claims_inbox', NULL, 'test_harness');
    RAISE EXCEPTION 'TEST 2 FAILED: insert without source_ref should have been rejected';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 2 PASSED: source_ref requirement enforced';
  END;
END $$;

-- TEST 3: bot-extracted event WITH source_ref, unconfirmed, should succeed
INSERT INTO vls.case_event (case_id, event_type, source, source_ref, created_by, confirmed)
VALUES (1, 'demand_sent', 'claims_inbox', 'msg-abc123', 'test_harness', false);
-- EXPECT: INSERT 0 1

-- TEST 4: DELETE should be rejected unconditionally
DO $$
DECLARE
  v_id BIGINT;
BEGIN
  SELECT id INTO v_id FROM vls.case_event WHERE case_id = 1 AND event_type = 'intake' LIMIT 1;
  BEGIN
    DELETE FROM vls.case_event WHERE id = v_id;
    RAISE EXCEPTION 'TEST 4 FAILED: DELETE should have been rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%append-only%' THEN
      RAISE NOTICE 'TEST 4 PASSED: DELETE rejected (%: %)', SQLSTATE, SQLERRM;
    ELSE
      RAISE EXCEPTION 'TEST 4 FAILED with unexpected error: %', SQLERRM;
    END IF;
  END;
END $$;

-- TEST 5: mutating a historical field should be rejected
DO $$
DECLARE
  v_id BIGINT;
BEGIN
  SELECT id INTO v_id FROM vls.case_event WHERE case_id = 1 AND event_type = 'intake' LIMIT 1;
  BEGIN
    UPDATE vls.case_event SET notes = 'tampered' WHERE id = v_id;
    RAISE EXCEPTION 'TEST 5 FAILED: historical field mutation should have been rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%immutable%' THEN
      RAISE NOTICE 'TEST 5 PASSED: historical mutation rejected (%: %)', SQLSTATE, SQLERRM;
    ELSE
      RAISE EXCEPTION 'TEST 5 FAILED with unexpected error: %', SQLERRM;
    END IF;
  END;
END $$;

-- TEST 6: the ONE legal update — confirming an unconfirmed event — should succeed
DO $$
DECLARE
  v_id BIGINT;
BEGIN
  SELECT id INTO v_id FROM vls.case_event WHERE case_id = 1 AND event_type = 'demand_sent' AND confirmed = false LIMIT 1;
  UPDATE vls.case_event SET confirmed = true, confirmed_by = 'jed' WHERE id = v_id;
  RAISE NOTICE 'TEST 6 PASSED: confirmation update succeeded';
END $$;

-- TEST 7: revoking a confirmation should be rejected
DO $$
DECLARE
  v_id BIGINT;
BEGIN
  SELECT id INTO v_id FROM vls.case_event WHERE case_id = 1 AND event_type = 'demand_sent' LIMIT 1;
  BEGIN
    UPDATE vls.case_event SET confirmed = false WHERE id = v_id;
    RAISE EXCEPTION 'TEST 7 FAILED: revoking confirmation should have been rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%cannot be revoked%' THEN
      RAISE NOTICE 'TEST 7 PASSED: confirmation revocation rejected';
    ELSE
      RAISE EXCEPTION 'TEST 7 FAILED with unexpected error: %', SQLERRM;
    END IF;
  END;
END $$;

-- Cleanup test data
DELETE FROM vls.case_event WHERE created_by = 'test_harness' AND false; -- no-op, DELETE is blocked; documents intent
-- Real cleanup must happen at the branch level (reset staging from production),
-- not via DELETE, since case_event has no escape hatch by design.

SELECT 'ALL TESTS COMPLETED — check NOTICEs above for PASS/FAIL per test' AS summary;
