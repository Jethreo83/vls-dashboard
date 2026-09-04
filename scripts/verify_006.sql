-- Verification harness for migration 006.

DO $$
DECLARE
  v_task_open BIGINT;
  v_task_case BIGINT;
  v_staff_id BIGINT;
BEGIN
  SELECT id INTO v_staff_id FROM vls.staff_user LIMIT 1;

  -- CHECK 1: basic insert, no case attached
  INSERT INTO vls.task (title, priority, assigned_to, due_date, created_by)
  VALUES ('Call opposing counsel', 'high', v_staff_id, CURRENT_DATE - 1, 'test_harness')
  RETURNING id INTO v_task_open;

  IF (SELECT completed_at FROM vls.task WHERE id = v_task_open) IS NOT NULL THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: new open task should have NULL completed_at';
  END IF;
  RAISE NOTICE 'CHECK 1 PASSED: task created, completed_at is NULL';

  -- CHECK 2: overdue_tasks view picks up the past-due task
  IF NOT EXISTS (SELECT 1 FROM vls.overdue_tasks WHERE id = v_task_open) THEN
    RAISE EXCEPTION 'CHECK 2 FAILED: task with due_date in the past should appear in overdue_tasks';
  END IF;
  RAISE NOTICE 'CHECK 2 PASSED: overdue_tasks view correct';

  -- CHECK 3: marking done sets completed_at automatically
  UPDATE vls.task SET status = 'done' WHERE id = v_task_open;
  IF (SELECT completed_at FROM vls.task WHERE id = v_task_open) IS NULL THEN
    RAISE EXCEPTION 'CHECK 3 FAILED: completed_at should be set when status -> done';
  END IF;
  RAISE NOTICE 'CHECK 3 PASSED: completed_at auto-set on completion';

  -- CHECK 4: done task no longer appears in overdue_tasks (even though still past due)
  IF EXISTS (SELECT 1 FROM vls.overdue_tasks WHERE id = v_task_open) THEN
    RAISE EXCEPTION 'CHECK 4 FAILED: done task should not appear in overdue_tasks';
  END IF;
  RAISE NOTICE 'CHECK 4 PASSED: done tasks excluded from overdue view';

  -- CHECK 5: reopening clears completed_at
  UPDATE vls.task SET status = 'open' WHERE id = v_task_open;
  IF (SELECT completed_at FROM vls.task WHERE id = v_task_open) IS NOT NULL THEN
    RAISE EXCEPTION 'CHECK 5 FAILED: completed_at should clear when status leaves done';
  END IF;
  RAISE NOTICE 'CHECK 5 PASSED: completed_at cleared on reopen';

  -- CHECK 6: task attached to a real case
  SELECT id INTO v_task_case FROM vls.case LIMIT 1;
  IF v_task_case IS NOT NULL THEN
    INSERT INTO vls.task (case_id, title, created_by)
    VALUES (v_task_case, 'Follow up on discovery request', 'test_harness');
    RAISE NOTICE 'CHECK 6 PASSED: task attached to case % succeeded', v_task_case;
  ELSE
    RAISE NOTICE 'CHECK 6 SKIPPED: no existing case to attach to';
  END IF;

  -- CHECK 7: direct insert of a done task with no completed_at still gets one
  INSERT INTO vls.task (title, status, created_by)
  VALUES ('Already finished task', 'done', 'test_harness')
  RETURNING id INTO v_task_open;
  IF (SELECT completed_at FROM vls.task WHERE id = v_task_open) IS NULL THEN
    RAISE EXCEPTION 'CHECK 7 FAILED: inserting status=done should auto-set completed_at';
  END IF;
  RAISE NOTICE 'CHECK 7 PASSED: insert-as-done sets completed_at';
END $$;

SELECT id, title, status, priority, due_date, completed_at FROM vls.task ORDER BY id;
SELECT 'ALL CHECKS COMPLETED' AS summary;
