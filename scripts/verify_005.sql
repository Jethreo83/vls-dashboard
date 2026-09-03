-- Verification harness for migration 005.

DO $$
BEGIN
  -- CHECK 1: valid @vlslawfirm.com email succeeds
  INSERT INTO vls.staff_user (google_email, role, created_by)
  VALUES ('cmbamali@vlslawfirm.com', 'attorney', 'test_harness');
  RAISE NOTICE 'CHECK 1 PASSED: valid domain email accepted';

  -- CHECK 2: non-vlslawfirm.com email must be rejected
  BEGIN
    INSERT INTO vls.staff_user (google_email, role, created_by)
    VALUES ('someone@gmail.com', 'paralegal', 'test_harness');
    RAISE EXCEPTION 'CHECK 2 FAILED: non-domain email should have been rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%staff_user_email_domain%' THEN
      RAISE NOTICE 'CHECK 2 PASSED: non-domain email rejected';
    ELSE
      RAISE EXCEPTION 'CHECK 2 FAILED unexpectedly: %', SQLERRM;
    END IF;
  END;

  -- CHECK 3: duplicate email rejected (UNIQUE)
  BEGIN
    INSERT INTO vls.staff_user (google_email, role, created_by)
    VALUES ('cmbamali@vlslawfirm.com', 'admin', 'test_harness');
    RAISE EXCEPTION 'CHECK 3 FAILED: duplicate email should have been rejected';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'CHECK 3 PASSED: duplicate email rejected';
  END;
END $$;

-- CHECK 4: vls_app can SELECT (needed for login lookup)
SET ROLE vls_app;
SELECT google_email, role, active FROM vls.staff_user;
RESET ROLE;

-- CHECK 5: vls_app CANNOT INSERT (staff provisioning is admin-only)
SET ROLE vls_app;
DO $$
BEGIN
  INSERT INTO vls.staff_user (google_email, role, created_by)
  VALUES ('robert@vlslawfirm.com', 'paralegal', 'vls_app');
  RAISE EXCEPTION 'CHECK 5 FAILED: vls_app should not be able to INSERT into staff_user';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'CHECK 5 PASSED: vls_app blocked from provisioning staff';
END $$;
RESET ROLE;

SELECT count(*) AS staff_count FROM vls.staff_user;
-- EXPECT 1 (only the valid insert from CHECK 1 landed)

SELECT 'ALL CHECKS COMPLETED' AS summary;
