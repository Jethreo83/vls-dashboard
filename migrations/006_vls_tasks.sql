-- 006_vls_tasks.sql
-- Task Manager: internal work items, optionally attached to a case.
-- Not a replacement for case_event (which is the legal record of what
-- happened to a case) — tasks are operational to-dos for staff, separate
-- from the append-only legal timeline.

CREATE TYPE vls.task_status AS ENUM ('open', 'in_progress', 'done', 'cancelled');
CREATE TYPE vls.task_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TABLE vls.task (
  id              BIGSERIAL PRIMARY KEY,

  -- Nullable: a task can be general firm work, not tied to any case.
  case_id         BIGINT REFERENCES vls.case (id),

  title           TEXT NOT NULL,
  description     TEXT,

  status          vls.task_status NOT NULL DEFAULT 'open',
  priority        vls.task_priority NOT NULL DEFAULT 'normal',

  -- Assignment is to a staff_user, not a free-text name, so it's always
  -- resolvable to a real login and role.
  assigned_to     BIGINT REFERENCES vls.staff_user (id),

  due_date        DATE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  created_by      TEXT NOT NULL,

  -- completed_at is set only when status transitions to done, and cleared
  -- if it's reopened — enforced by trigger below, not left to app discipline.
  CONSTRAINT task_completed_at_matches_status
    CHECK (
      (status = 'done' AND completed_at IS NOT NULL)
      OR (status <> 'done' AND completed_at IS NULL)
    )
);

CREATE INDEX idx_task_case_id ON vls.task (case_id) WHERE case_id IS NOT NULL;
CREATE INDEX idx_task_assigned_to ON vls.task (assigned_to) WHERE status IN ('open', 'in_progress');
CREATE INDEX idx_task_due_date ON vls.task (due_date) WHERE status IN ('open', 'in_progress');

CREATE OR REPLACE FUNCTION vls.task_manage_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'done' AND OLD.status = 'done' THEN
    NEW.completed_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_manage_completed_at
  BEFORE UPDATE ON vls.task
  FOR EACH ROW EXECUTE FUNCTION vls.task_manage_completed_at();

-- Also set completed_at correctly on INSERT if a task is created already-done
-- (rare, but the CHECK constraint would otherwise reject it without this).
CREATE OR REPLACE FUNCTION vls.task_set_completed_at_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_set_completed_at_on_insert
  BEFORE INSERT ON vls.task
  FOR EACH ROW EXECUTE FUNCTION vls.task_set_completed_at_on_insert();

-- Overdue tasks — open/in_progress with a due_date in the past. Same
-- "surface via a view, don't compute deadlines" discipline as
-- vls.blocked_cases.
CREATE VIEW vls.overdue_tasks AS
SELECT id, case_id, title, priority, assigned_to, due_date
FROM vls.task
WHERE status IN ('open', 'in_progress')
  AND due_date IS NOT NULL
  AND due_date < CURRENT_DATE;

GRANT SELECT, INSERT, UPDATE ON vls.task TO vls_app;
GRANT USAGE, SELECT ON SEQUENCE vls.task_id_seq TO vls_app;
