-- Verification harness for migration 004 — RLS is the highest-stakes check
-- in this migration. A policy that LOOKS right but silently allows
-- everything is worse than no policy: false confidence. Verify by actually
-- switching role and querying, not by reading the policy definition.

DO $$
DECLARE
  v_person_client_id BIGINT;   -- has a vls.client row -> should be visible to vls_app
  v_person_no_client_id BIGINT; -- no vls.client row -> should be invisible to vls_app
BEGIN
  INSERT INTO platform.person (first_name, last_name, email_normalized, created_by)
  VALUES ('Test', 'ClientPerson', 'test.client@example.com', 'test_harness')
  RETURNING id INTO v_person_client_id;

  INSERT INTO platform.person (first_name, last_name, email_normalized, created_by)
  VALUES ('Test', 'NonClientPerson', 'test.nonclient@example.com', 'test_harness')
  RETURNING id INTO v_person_no_client_id;

  INSERT INTO vls.client (person_id, engagement_date, created_by)
  VALUES (v_person_client_id, CURRENT_DATE, 'test_harness');

  RAISE NOTICE 'person_client_id=% person_no_client_id=%', v_person_client_id, v_person_no_client_id;
END $$;

-- CHECK 1: as table owner (bypasses RLS by default unless FORCE is set —
-- we set FORCE, so even the owner is restricted unless it owns the table).
-- This confirms both rows exist from the privileged connection.
SELECT id, first_name, last_name FROM platform.person WHERE last_name IN ('ClientPerson', 'NonClientPerson') ORDER BY id;
-- EXPECT: 2 rows (privileged/owner connection is not subject to its own FORCE RLS as owner)

-- CHECK 2: as vls_app, should see ONLY the person with a vls.client row.
SET ROLE vls_app;
SELECT id, first_name, last_name FROM platform.person WHERE last_name IN ('ClientPerson', 'NonClientPerson') ORDER BY id;
-- EXPECT: 1 row — ClientPerson only. NonClientPerson must be ABSENT, not
-- flagged, not null-masked — genuinely absent from the result set.
RESET ROLE;

-- CHECK 3: vls_app cannot INSERT into platform.person directly (must go
-- through the identity service).
SET ROLE vls_app;
DO $$
BEGIN
  INSERT INTO platform.person (first_name, last_name, created_by)
  VALUES ('Should', 'Fail', 'vls_app');
  RAISE EXCEPTION 'CHECK 3 FAILED: vls_app should not be able to INSERT into platform.person';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'CHECK 3 PASSED: vls_app blocked from INSERT on platform.person';
END $$;
RESET ROLE;

-- CHECK 4: platform_identity_service sees everything (its whole job is
-- cross-app matching before any app-specific client row exists).
SET ROLE platform_identity_service;
SELECT id, first_name, last_name FROM platform.person WHERE last_name IN ('ClientPerson', 'NonClientPerson') ORDER BY id;
-- EXPECT: 2 rows
RESET ROLE;

SELECT 'ALL CHECKS COMPLETED — CHECK 2 must show exactly 1 row (ClientPerson)' AS summary;
