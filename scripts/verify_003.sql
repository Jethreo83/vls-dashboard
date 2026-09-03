-- Verification harness for migration 003.

DO $$
DECLARE
  v_case_fee_shifting BIGINT;  -- JP, chapter_38, fee-shifting eligible
  v_case_contingency BIGINT;   -- District, third-party negligence, NOT fee-shifting
BEGIN
  INSERT INTO vls.case (case_type, cause_of_action, is_first_party, court_type, created_by, updated_by)
  VALUES ('unpaid_repairs', 'contract_chapter_38', false, 'jp', 'test_harness', 'test_harness')
  RETURNING id INTO v_case_fee_shifting;

  INSERT INTO vls.case (case_type, cause_of_action, is_first_party, court_type, created_by, updated_by)
  VALUES ('personal_injury', 'negligence', false, 'district', 'test_harness', 'test_harness')
  RETURNING id INTO v_case_contingency;

  -- CHECK 1: recoverable cost on the fee-shifting-eligible case should succeed
  INSERT INTO vls.case_cost (case_id, category, amount, incurred_date, recoverable, created_by, confirmed, confirmed_by)
  VALUES (v_case_fee_shifting, 'filing_fee', 350.00, CURRENT_DATE, true, 'test_harness', true, 'test_harness');
  RAISE NOTICE 'CHECK 1 PASSED: recoverable cost allowed on fee-shifting-eligible case';

  -- CHECK 2: recoverable cost on the NON-fee-shifting case must be rejected
  BEGIN
    INSERT INTO vls.case_cost (case_id, category, amount, incurred_date, recoverable, created_by, confirmed, confirmed_by)
    VALUES (v_case_contingency, 'filing_fee', 350.00, CURRENT_DATE, true, 'test_harness', true, 'test_harness');
    RAISE EXCEPTION 'CHECK 2 FAILED: recoverable cost should have been rejected on non-fee-shifting case';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%not fee_shifting_eligible%' THEN
      RAISE NOTICE 'CHECK 2 PASSED: recoverable cost rejected on non-fee-shifting case';
    ELSE
      RAISE EXCEPTION 'CHECK 2 FAILED unexpectedly: %', SQLERRM;
    END IF;
  END;

  -- A non-recoverable cost on the contingency case should still succeed
  INSERT INTO vls.case_cost (case_id, category, amount, incurred_date, recoverable, created_by, confirmed, confirmed_by)
  VALUES (v_case_contingency, 'expert_witness', 1200.00, CURRENT_DATE, false, 'test_harness', true, 'test_harness');

  -- Unconfirmed medical bill, bot-extracted, with provenance
  INSERT INTO vls.case_cost (case_id, category, amount, incurred_date, source, source_ref, created_by, confirmed)
  VALUES (v_case_contingency, 'medical', 4500.00, CURRENT_DATE, 'claims_inbox', 'msg-xyz789', 'test_harness', false);

  -- CHECK 3: cost without source_ref from a bot source should be rejected
  BEGIN
    INSERT INTO vls.case_cost (case_id, category, amount, incurred_date, source, created_by, confirmed)
    VALUES (v_case_contingency, 'medical', 100.00, CURRENT_DATE, 'claims_inbox', 'test_harness', false);
    RAISE EXCEPTION 'CHECK 3 FAILED: bot-sourced cost without source_ref should have been rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%source_ref%' THEN
      RAISE NOTICE 'CHECK 3 PASSED: source_ref requirement enforced on case_cost';
    ELSE
      RAISE EXCEPTION 'CHECK 3 FAILED unexpectedly: %', SQLERRM;
    END IF;
  END;

  -- CHECK 4: case_financial fee-shifting fields rejected on non-eligible case
  BEGIN
    INSERT INTO vls.case_financial (case_id, gross_recovery, contingency_pct, fees_sought, updated_by)
    VALUES (v_case_contingency, 50000.00, 0.3333, 5000.00, 'test_harness');
    RAISE EXCEPTION 'CHECK 4 FAILED: fees_sought should have been rejected on non-fee-shifting case';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%not fee_shifting_eligible%' THEN
      RAISE NOTICE 'CHECK 4 PASSED: fee-shifting fields rejected on contingency-only case';
    ELSE
      RAISE EXCEPTION 'CHECK 4 FAILED unexpectedly: %', SQLERRM;
    END IF;
  END;

  -- Correct financial record for the contingency case: no fees_sought/awarded
  INSERT INTO vls.case_financial (case_id, gross_recovery, contingency_pct, updated_by)
  VALUES (v_case_contingency, 50000.00, 0.3333, 'test_harness');

  -- Correct financial record for the fee-shifting case: has fees_sought
  INSERT INTO vls.case_financial (case_id, gross_recovery, fees_sought, fees_awarded, updated_by)
  VALUES (v_case_fee_shifting, 8000.00, 3500.00, 3200.00, 'test_harness');

  RAISE NOTICE 'case_fee_shifting=% case_contingency=%', v_case_fee_shifting, v_case_contingency;
END $$;

-- CHECK 5: cost summary shows confirmed vs pending correctly
SELECT * FROM vls.case_cost_summary ORDER BY case_id;
-- Expect: fee_shifting case confirmed_total=350, pending=0, confirmed_recoverable=350
--         contingency case confirmed_total=1200, pending=4500, confirmed_recoverable=0

-- CHECK 6: settlement breakdown computes net_to_client correctly for the
-- contingency case: 50000 - (50000*0.3333) - (1200 - 0) = 50000-16665-1200 = 32135
SELECT case_id, gross_recovery, contingency_fee_amount, costs_confirmed, costs_recoverable, net_to_client
FROM vls.settlement_breakdown ORDER BY case_id;

SELECT 'ALL CHECKS COMPLETED' AS summary;
