-- 008_platform_person_match.sql
-- The shared match-before-create primitive referenced (but never built) by
-- migration 004's comment: "creation goes through the identity service's
-- match-before-create flow." Per vls-domain-rules (HANDOFF_2026-09-02.md
-- section 10): "match phone/email first, then name+DOB. Exact match
-- attaches; close match queues as 'possible duplicate' for a human to
-- confirm or split; no match creates new. Never auto-merge on fuzzy names."
--
-- This is convention #1 shared infrastructure - platform.person is a thin
-- registry, and the ONE way any project creates/attaches a person record
-- is through this function, called via platform_identity_service. No
-- project's app code should write its own matching logic (same drift risk
-- convention #2 already caught once with the document generator).

-- ---------------------------------------------------------------------------
-- platform.person_match_queue — holds "possible duplicate" cases pending a
-- human confirm-or-split decision. Separate from person_merge, which is for
-- merging two EXISTING person rows after the fact; this table is for the
-- moment of intake, before a second row is even created.
-- ---------------------------------------------------------------------------

CREATE TABLE platform.person_match_queue (
  id                  BIGSERIAL PRIMARY KEY,
  candidate_person_id BIGINT NOT NULL REFERENCES platform.person (id),

  -- The incoming, not-yet-created person's raw attributes, so a human
  -- reviewing the queue can see what was being matched against, and so
  -- "confirm" can create the row using this exact data.
  first_name          TEXT NOT NULL,
  last_name            TEXT NOT NULL,
  date_of_birth        DATE,
  email_normalized     TEXT,
  phone_normalized     TEXT,

  match_reason         TEXT NOT NULL,  -- e.g. 'name_dob_close_match'
  source_project        TEXT NOT NULL,  -- 'vls' | 'collision' | 'elektrica'
  submitted_by          TEXT NOT NULL,
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'confirmed_match', 'confirmed_split')),
  resolved_at            TIMESTAMPTZ,
  resolved_by            TEXT,
  -- If confirmed_split, the newly created person row for the split case.
  resulting_person_id    BIGINT REFERENCES platform.person (id)
);

CREATE INDEX idx_person_match_queue_status ON platform.person_match_queue (status) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON platform.person_match_queue TO platform_identity_service;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA platform TO platform_identity_service;

-- ---------------------------------------------------------------------------
-- platform.match_or_create_person — the one function every project's app
-- backend calls (through platform_identity_service) at intake time.
--
-- Returns a record: (person_id, status) where status is one of:
--   'attached'       - exact phone/email match found, use person_id
--   'queued'         - close name+DOB match found, person_id is the
--                       EXISTING candidate (do not use for the new case -
--                       queue_id identifies the pending review row; caller
--                       must treat this person as NOT YET LINKED)
--   'created'        - no match at all, person_id is a brand new row
--
-- Exact match rule: normalized email OR normalized phone matches exactly.
-- Close match rule: same last_name (case-insensitive) AND same date_of_birth
--   (only fires when DOB is known on both sides - a NULL DOB is never
--   treated as a match, per "never auto-merge on fuzzy names").
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION platform.match_or_create_person(
  p_first_name        TEXT,
  p_last_name          TEXT,
  p_date_of_birth      DATE,
  p_email_normalized   TEXT,
  p_phone_normalized   TEXT,
  p_source_project     TEXT,
  p_submitted_by       TEXT
) RETURNS TABLE (person_id BIGINT, match_status TEXT, queue_id BIGINT) AS $$
DECLARE
  v_exact_id     BIGINT;
  v_close_id     BIGINT;
  v_new_id       BIGINT;
  v_queue_id     BIGINT;
BEGIN
  -- Step 1: exact match on phone or email.
  IF p_email_normalized IS NOT NULL OR p_phone_normalized IS NOT NULL THEN
    SELECT p.id INTO v_exact_id
    FROM platform.person p
    WHERE (p_email_normalized IS NOT NULL AND p.email_normalized = p_email_normalized)
       OR (p_phone_normalized IS NOT NULL AND p.phone_normalized = p_phone_normalized)
    LIMIT 1;
  END IF;

  IF v_exact_id IS NOT NULL THEN
    RETURN QUERY SELECT v_exact_id, 'attached'::TEXT, NULL::BIGINT;
    RETURN;
  END IF;

  -- Step 2: close match on last_name + date_of_birth. Both sides must have
  -- a non-null DOB - a NULL DOB never counts as a match either direction.
  IF p_date_of_birth IS NOT NULL AND p_last_name IS NOT NULL THEN
    SELECT p.id INTO v_close_id
    FROM platform.person p
    WHERE lower(p.last_name) = lower(p_last_name)
      AND p.date_of_birth = p_date_of_birth
    LIMIT 1;
  END IF;

  IF v_close_id IS NOT NULL THEN
    INSERT INTO platform.person_match_queue (
      candidate_person_id, first_name, last_name, date_of_birth,
      email_normalized, phone_normalized, match_reason,
      source_project, submitted_by
    ) VALUES (
      v_close_id, p_first_name, p_last_name, p_date_of_birth,
      p_email_normalized, p_phone_normalized, 'name_dob_close_match',
      p_source_project, p_submitted_by
    ) RETURNING id INTO v_queue_id;

    RETURN QUERY SELECT v_close_id, 'queued'::TEXT, v_queue_id;
    RETURN;
  END IF;

  -- Step 3: no match at all - create a new person row.
  INSERT INTO platform.person (
    first_name, last_name, date_of_birth,
    email_normalized, phone_normalized, created_by
  ) VALUES (
    p_first_name, p_last_name, p_date_of_birth,
    p_email_normalized, p_phone_normalized, p_submitted_by
  ) RETURNING id INTO v_new_id;

  RETURN QUERY SELECT v_new_id, 'created'::TEXT, NULL::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = platform, pg_temp;

REVOKE ALL ON FUNCTION platform.match_or_create_person FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.match_or_create_person TO platform_identity_service;
