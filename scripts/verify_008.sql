-- verify_008.sql
-- Confirms platform.match_or_create_person implements
-- vls-domain-rules section 10 correctly: exact match attaches, close
-- name+DOB match queues (never auto-merges), NULL DOB never counts as a
-- match, no match creates new. Run with neondb_owner; test data is
-- cleaned up at the end regardless of pass/fail.

DO $$
DECLARE
  v_created_id BIGINT;
  v_attached_id BIGINT;
  v_diff1_id BIGINT;
  v_queue_id BIGINT;
  v_null_dob_id BIGINT;
  v_status TEXT;
  v_qstatus TEXT;
BEGIN
  -- CHECK 1: no match creates a new row.
  SELECT person_id, match_status INTO v_created_id, v_status
  FROM platform.match_or_create_person('Verify1','VerifyZZZ',NULL,'verify1zzz@example.com',NULL,'vls','verify_008');
  IF v_status != 'created' THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: expected created, got %', v_status;
  END IF;
  RAISE NOTICE 'CHECK 1 PASSED: no match creates new (person_id=%)', v_created_id;

  -- CHECK 2: exact email match attaches to the same person, no new row.
  SELECT person_id, match_status INTO v_attached_id, v_status
  FROM platform.match_or_create_person('Verify1Again','VerifyZZZ',NULL,'verify1zzz@example.com',NULL,'collision','verify_008');
  IF v_status != 'attached' OR v_attached_id != v_created_id THEN
    RAISE EXCEPTION 'CHECK 2 FAILED: expected attached to %, got % status %', v_created_id, v_attached_id, v_status;
  END IF;
  RAISE NOTICE 'CHECK 2 PASSED: exact email match attaches to existing person';

  -- CHECK 3: close match (same last_name + DOB, different email) queues,
  -- does NOT create or attach.
  SELECT person_id INTO v_diff1_id
  FROM platform.match_or_create_person('Diff1','CloseVerifyZZZ','1985-06-15',NULL,NULL,'vls','verify_008');

  SELECT person_id, match_status, queue_id INTO v_attached_id, v_status, v_queue_id
  FROM platform.match_or_create_person('Diff2','CloseVerifyZZZ','1985-06-15','diff2verify@example.com',NULL,'elektrica','verify_008');
  IF v_status != 'queued' OR v_attached_id != v_diff1_id OR v_queue_id IS NULL THEN
    RAISE EXCEPTION 'CHECK 3 FAILED: expected queued against %, got % status % queue_id %', v_diff1_id, v_attached_id, v_status, v_queue_id;
  END IF;

  SELECT status INTO v_qstatus FROM platform.person_match_queue WHERE id = v_queue_id;
  IF v_qstatus != 'pending' THEN
    RAISE EXCEPTION 'CHECK 3 FAILED: queue row status expected pending, got %', v_qstatus;
  END IF;
  RAISE NOTICE 'CHECK 3 PASSED: close name+DOB match queues for human review, does not auto-merge (queue_id=%)', v_queue_id;

  -- CHECK 4: same last_name but NULL DOB never counts as a match - must
  -- create a distinct new person, not queue against Diff1.
  SELECT person_id, match_status INTO v_null_dob_id, v_status
  FROM platform.match_or_create_person('Diff3','CloseVerifyZZZ',NULL,NULL,NULL,'vls','verify_008');
  IF v_status != 'created' OR v_null_dob_id = v_diff1_id THEN
    RAISE EXCEPTION 'CHECK 4 FAILED: NULL DOB must never match - expected created distinct person, got % status %', v_null_dob_id, v_status;
  END IF;
  RAISE NOTICE 'CHECK 4 PASSED: NULL DOB never counts as a match (never auto-merge on fuzzy names)';

  RAISE NOTICE 'ALL 4 CHECKS PASSED for migration 008 (platform.match_or_create_person)';
END $$;

-- Clean up all verify_008 test data regardless of outcome above.
DELETE FROM platform.person_match_queue WHERE submitted_by = 'verify_008';
DELETE FROM platform.person WHERE last_name IN ('VerifyZZZ', 'CloseVerifyZZZ');
