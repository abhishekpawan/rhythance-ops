-- Synthetic test data. Nothing here is real: names are invented, addresses end in @example.test, phone
-- numbers are +1 555, every id is fixed so the same request gives the same answer on every run.
-- Loaded by tests/scripts/db-seed.mjs after the accounts exist (tests/seed/users.mjs), and only through
-- the local-only guard. Dates are fixed; the test server's clock is 2026-11-17 10:00 in Toronto.
--
-- Money edge cases covered (the numbers are the ones tests/unit/*.test.ts work out by hand):
--   * ordinary position, overtime position (40 h threshold), subcategory (invoicing-only) positions
--   * SIN direct deposit, cash with a 10% deduction, hybrid SIN + cash and SIN + e-Transfer (hours cap,
--     the split into two timesheet rows, bonus and deduction on the SIN row), corporation with HST
--   * invoices taxed per province: Ontario HST 13%, Quebec GST 5% + QST 9.975%, British Columbia GST 5%,
--     Alberta zero rated; one invoice in USD

-- Users: ids from tests/seed/ids.mjs
-- 1 admin  2 superadmin  3 recruiter  4 bookkeeper  5 recruiter_manager  6 accountant_manager  7 sales
-- 8 recruiter_director  11..15 jobseekers (sin, cash, hybrid, corp, hybridEt)

-- Clients --------------------------------------------------------------------------------------------

INSERT INTO public.clients (id, company_name, billing_name, short_code, list_name, client_manager, sales_person,
  accounting_person, currency, work_province, contact_person_name1, email_address1, mobile1,
  street_address1, city1, province1, postal_code1, preferred_payment_method, terms, pay_cycle, credit_limit,
  is_draft, created_at, created_by_user_id, updated_at, updated_by_user_id, last_activity_at)
VALUES
 ('00000000-0000-4000-8000-000000000021', 'Northwind Test Staffing Client', 'Northwind Test Billing', 'NW', 'Northwind',
  'Test Recruiter Manager', 'Test Sales', 'Test Bookkeeper', 'CAD', 'ON', 'Nora North', 'nora.north@example.test', '+15555550121',
  '1 Test Street', 'Toronto', 'ON', 'M5V 0A1', 'Cheque', 'Net 30', 'Weekly - 1 week hold', '50000',
  false, '2026-06-01T14:00:00Z', '00000000-0000-4000-8000-000000000001', '2026-06-01T14:00:00Z', '00000000-0000-4000-8000-000000000001', '2026-11-10T14:00:00Z'),
 ('00000000-0000-4000-8000-000000000022', 'Quebec Test Logistics Client', 'Quebec Test Billing', 'QL', 'Quebec Logistics',
  'Test Recruiter Manager', 'Test Sales', 'Test Bookkeeper', 'CAD', 'QC', 'Quentin Quebec', 'quentin.quebec@example.test', '+15555550122',
  '2 Test Avenue', 'Montreal', 'QC', 'H2Y 1A1', 'Direct Deposit', 'Net 15', 'Biweekly - 2 week hold', '75000',
  false, '2026-06-15T14:00:00Z', '00000000-0000-4000-8000-000000000001', '2026-06-15T14:00:00Z', '00000000-0000-4000-8000-000000000001', '2026-11-12T14:00:00Z'),
 ('00000000-0000-4000-8000-000000000023', 'Pacific Test Warehousing Client', 'Pacific Test Billing', 'PW', 'Pacific Warehousing',
  'Test Recruiter Manager', 'Test Sales', 'Test Bookkeeper', 'CAD', 'BC', 'Paige Pacific', 'paige.pacific@example.test', '+15555550123',
  '3 Test Road', 'Vancouver', 'BC', 'V6B 1A1', 'e-Transfer', 'Net 30', 'Weekly - 2 week hold', '40000',
  false, '2026-07-01T14:00:00Z', '00000000-0000-4000-8000-000000000001', '2026-07-01T14:00:00Z', '00000000-0000-4000-8000-000000000001', '2026-11-05T14:00:00Z'),
 ('00000000-0000-4000-8000-000000000024', 'Prairie Test Foods Client', 'Prairie Test Billing', 'PF', 'Prairie Foods',
  'Test Recruiter Manager', 'Test Sales', 'Test Bookkeeper', 'USD', 'AB', 'Pat Prairie', 'pat.prairie@example.test', '+15555550124',
  '4 Test Lane', 'Calgary', 'AB', 'T2P 1A1', 'Cheque', 'Net 45', 'Weekly - 1 week hold', '20000',
  false, '2026-08-01T14:00:00Z', '00000000-0000-4000-8000-000000000001', '2026-08-01T14:00:00Z', '00000000-0000-4000-8000-000000000001', '2026-09-01T14:00:00Z');

-- Positions ------------------------------------------------------------------------------------------

INSERT INTO public.positions (id, client, title, position_code, start_date, end_date, client_name, description,
  street_address, city, province, postal_code, employment_term, employment_type, position_category, experience,
  payrate_type, number_of_positions, regular_pay_rate, premium_pay_rate, markup, bill_rate, overtime_enabled, overtime_hours,
  overtime_pay_rate, overtime_bill_rate, preferred_payment_method, terms, notes, is_draft, is_subcategory,
  subcategory_position, created_at, created_by_user_id, updated_at, updated_by_user_id)
VALUES
 ('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000021', 'Warehouse Associate', 'NW001', '2026-09-01', '2027-03-31', 'Northwind Test Staffing Client',
  'Pick and pack. Synthetic position.', '1 Test Street', 'Toronto', 'ON', 'M5V 0A1', 'Temporary', 'Full-time', 'Warehouse', 'None',
  'Hourly', 3, '20', NULL, '75', '35', false, NULL, NULL, NULL, 'Direct Deposit', 'Net 30', '', false, false, NULL,
  '2026-08-20T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-08-20T14:00:00Z', '00000000-0000-4000-8000-000000000003'),
 ('00000000-0000-4000-8000-000000000032', '00000000-0000-4000-8000-000000000021', 'Forklift Operator', 'NW002', '2026-09-15', NULL, 'Northwind Test Staffing Client',
  'Overtime after 40 hours. Synthetic position.', '1 Test Street', 'Toronto', 'ON', 'M5V 0A1', 'Temporary', 'Full-time', 'Warehouse', '1 year',
  'Hourly', 2, '20', NULL, '75', '35', true, '40', '30', '52.5', 'Direct Deposit', 'Net 30', '', false, false, NULL,
  '2026-09-01T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-09-01T14:00:00Z', '00000000-0000-4000-8000-000000000003'),
 ('00000000-0000-4000-8000-000000000033', '00000000-0000-4000-8000-000000000021', 'Warehouse Associate (training portion)', 'NW003', '2026-09-01', '2027-03-31', 'Northwind Test Staffing Client',
  'Invoicing-only subcategory position. Synthetic.', '1 Test Street', 'Toronto', 'ON', 'M5V 0A1', 'Temporary', 'Full-time', 'Warehouse', 'None',
  'Hourly', 1, '18', NULL, '75', '31.5', false, NULL, NULL, NULL, 'Direct Deposit', 'Net 30', '', false, true, 'Training',
  '2026-08-20T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-08-20T14:00:00Z', '00000000-0000-4000-8000-000000000003'),
 ('00000000-0000-4000-8000-000000000034', '00000000-0000-4000-8000-000000000022', 'Driver Helper', 'QL001', '2026-10-01', '2027-02-28', 'Quebec Test Logistics Client',
  'Premium pay rate on top of the regular rate. Synthetic.', '2 Test Avenue', 'Montreal', 'QC', 'H2Y 1A1', 'Temporary', 'Full-time', 'Logistics', 'None',
  'Hourly', 2, '20', '2.5', '70', '35', false, NULL, NULL, NULL, 'Direct Deposit', 'Net 15', '', false, false, NULL,
  '2026-09-20T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-09-20T14:00:00Z', '00000000-0000-4000-8000-000000000003'),
 ('00000000-0000-4000-8000-000000000035', '00000000-0000-4000-8000-000000000023', 'Loader', 'PW001', '2026-10-01', NULL, 'Pacific Test Warehousing Client',
  'Synthetic position.', '3 Test Road', 'Vancouver', 'BC', 'V6B 1A1', 'Temporary', 'Part-time', 'Warehouse', 'None',
  'Hourly', 4, '20', NULL, '75', '35', false, NULL, NULL, NULL, 'e-Transfer', 'Net 30', '', false, false, NULL,
  '2026-09-25T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-09-25T14:00:00Z', '00000000-0000-4000-8000-000000000003'),
 ('00000000-0000-4000-8000-000000000036', '00000000-0000-4000-8000-000000000024', 'Line Cook Helper', 'PF001', '2026-08-15', '2026-10-31', 'Prairie Test Foods Client',
  'Ended position. Synthetic.', '4 Test Lane', 'Calgary', 'AB', 'T2P 1A1', 'Temporary', 'Full-time', 'Food', 'None',
  'Hourly', 1, '20', NULL, '75', '35', false, NULL, NULL, NULL, 'Direct Deposit', 'Net 45', '', false, false, NULL,
  '2026-08-05T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-08-05T14:00:00Z', '00000000-0000-4000-8000-000000000003');

-- Jobseeker profiles ---------------------------------------------------------------------------------

INSERT INTO public.jobseeker_profiles (id, user_id, first_name, last_name, dob, email, mobile, employee_id,
  street, city, province, postal_code, work_preference, experience, availability, weekend_availability, payrate_type,
  pay_rate, bill_rate, payment_method, hst_gst, cash_deduction, sin_payroll_hours_cap, verification_status,
  documents, bio, created_at, created_by_user_id, updated_at, updated_by_user_id, last_activity_at)
VALUES
 ('00000000-0000-4000-8000-000000000041', '00000000-0000-4000-8000-000000000011', 'Sam', 'Sinclair', '1990-01-15', 'jobseeker.sin@example.test', '+15555550111', 'E-0011',
  '11 Test Crescent', 'Toronto', 'ON', 'M4B 1B3', 'Full-time', '3 years', 'Weekdays', false, 'Hourly',
  '20', '35', 'SIN-Direct Deposit', NULL, NULL, NULL, 'verified',
  '[{"documentType":"ID","documentPath":"00000000-0000-4000-8000-000000000011/id-document.pdf","fileName":"id-document.pdf"}]'::jsonb,
  'Warehouse experience. Synthetic profile.', '2026-07-10T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-07-10T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-11-08T14:00:00Z'),
 ('00000000-0000-4000-8000-000000000042', '00000000-0000-4000-8000-000000000012', 'Casey', 'Cashman', '1988-05-20', 'jobseeker.cash@example.test', '+15555550112', 'E-0012',
  '12 Test Crescent', 'Toronto', 'ON', 'M4B 1B4', 'Full-time', '1 year', 'Weekdays', true, 'Hourly',
  '20', '35', 'Cash', NULL, '10', NULL, 'verified',
  '[{"documentType":"ID","documentPath":"00000000-0000-4000-8000-000000000012/id-document.pdf","fileName":"id-document.pdf"}]'::jsonb,
  'Pays by cash with a 10 percent deduction. Synthetic profile.', '2026-07-12T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-07-12T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-11-08T14:00:00Z'),
 ('00000000-0000-4000-8000-000000000043', '00000000-0000-4000-8000-000000000013', 'Hana', 'Hybrid', '1992-09-09', 'jobseeker.hybrid@example.test', '+15555550113', 'E-0013',
  '13 Test Crescent', 'Toronto', 'ON', 'M4B 1B5', 'Full-time', '2 years', 'Any', true, 'Hourly',
  '20', '35', 'SIN and cash', NULL, '10', 20, 'verified',
  '[]'::jsonb, 'First 20 regular hours by SIN, the rest in cash. Synthetic profile.', '2026-07-15T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-07-15T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-11-08T14:00:00Z'),
 ('00000000-0000-4000-8000-000000000044', '00000000-0000-4000-8000-000000000014', 'Corey', 'Corporate', '1985-03-30', 'jobseeker.corp@example.test', '+15555550114', 'E-0014',
  '14 Test Crescent', 'Montreal', 'QC', 'H2Y 1C1', 'Full-time', '5 years', 'Any', false, 'Hourly',
  '20', '35', 'Corporation-Direct Deposit', '13%', NULL, NULL, 'verified',
  '[]'::jsonb, 'Invoices through a corporation, HST added. Synthetic profile.', '2026-07-20T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-07-20T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-11-08T14:00:00Z'),
 ('00000000-0000-4000-8000-000000000045', '00000000-0000-4000-8000-000000000015', 'Ely', 'Etransfer', '1995-12-01', 'jobseeker.hybrid.et@example.test', '+15555550115', 'E-0015',
  '15 Test Crescent', 'Vancouver', 'BC', 'V6B 1C1', 'Part-time', 'None', 'Weekends', true, 'Hourly',
  '20', '35', 'SIN and e-Transfer', NULL, '5', 30, 'pending',
  '[]'::jsonb, 'Hybrid SIN and e-Transfer, not yet verified. Synthetic profile.', '2026-09-01T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-09-01T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-10-01T14:00:00Z');

-- Assignments ----------------------------------------------------------------------------------------

INSERT INTO public.position_candidate_assignments (id, position_id, candidate_id, start_date, end_date, status,
  created_at, created_by_user_id, updated_at, updated_by_user_id)
VALUES
 ('00000000-0000-4000-8000-000000000071', '00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000011', '2026-09-01', '2027-03-31', 'active', '2026-08-25T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-08-25T14:00:00Z', '00000000-0000-4000-8000-000000000003'),
 ('00000000-0000-4000-8000-000000000072', '00000000-0000-4000-8000-000000000032', '00000000-0000-4000-8000-000000000011', '2026-09-15', NULL, 'active', '2026-09-10T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-09-10T14:00:00Z', '00000000-0000-4000-8000-000000000003'),
 ('00000000-0000-4000-8000-000000000073', '00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000012', '2026-09-01', '2027-03-31', 'active', '2026-08-25T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-08-25T14:00:00Z', '00000000-0000-4000-8000-000000000003'),
 ('00000000-0000-4000-8000-000000000074', '00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000013', '2026-09-01', '2027-03-31', 'active', '2026-08-25T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-08-25T14:00:00Z', '00000000-0000-4000-8000-000000000003'),
 ('00000000-0000-4000-8000-000000000075', '00000000-0000-4000-8000-000000000034', '00000000-0000-4000-8000-000000000014', '2026-10-01', '2027-02-28', 'active', '2026-09-25T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-09-25T14:00:00Z', '00000000-0000-4000-8000-000000000003'),
 ('00000000-0000-4000-8000-000000000076', '00000000-0000-4000-8000-000000000035', '00000000-0000-4000-8000-000000000015', '2026-10-01', NULL, 'active', '2026-09-28T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-09-28T14:00:00Z', '00000000-0000-4000-8000-000000000003'),
 ('00000000-0000-4000-8000-000000000077', '00000000-0000-4000-8000-000000000036', '00000000-0000-4000-8000-000000000011', '2026-08-15', '2026-10-31', 'completed', '2026-08-10T14:00:00Z', '00000000-0000-4000-8000-000000000003', '2026-11-01T14:00:00Z', '00000000-0000-4000-8000-000000000003');

-- Timesheets -----------------------------------------------------------------------------------------
-- Weeks run Sunday to Saturday. Pay and bill are the numbers the browser computes and sends (see
-- tests/unit/hybridPayrollSplit.test.ts for the same cases worked out).

INSERT INTO public.timesheets (id, jobseeker_profile_id, jobseeker_user_id, position_id, week_start_date, week_end_date,
  daily_hours, total_regular_hours, total_overtime_hours, regular_pay_rate, overtime_pay_rate, regular_bill_rate,
  overtime_bill_rate, total_jobseeker_pay, total_client_bill, overtime_enabled, premium_pay_rate, bonus_amount,
  deduction_amount, tax_amount, pay_split_segment, line_payment_method, invoice_number, email_sent, notes,
  created_at, created_by_user_id, updated_at, updated_by_user_id)
VALUES
 -- SIN direct deposit, 40 h: pay 800, bill 1400
 ('00000000-0000-4000-8000-000000000051', '00000000-0000-4000-8000-000000000041', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000031', '2026-11-01', '2026-11-07',
  '[{"date":"2026-11-02","hours":8},{"date":"2026-11-03","hours":8},{"date":"2026-11-04","hours":8},{"date":"2026-11-05","hours":8},{"date":"2026-11-06","hours":8}]'::jsonb,
  40, 0, 20, 20, 35, 35, 800, 1400, false, 0, 0, 0, 0, 'single', NULL, '900001', true, NULL,
  '2026-11-09T14:00:00Z', '00000000-0000-4000-8000-000000000004', '2026-11-09T14:00:00Z', '00000000-0000-4000-8000-000000000004'),
 -- Overtime, 50 h: 40 regular + 10 overtime: pay 40x20 + 10x30 = 1100, bill 40x35 + 10x52.50 = 1925
 ('00000000-0000-4000-8000-000000000052', '00000000-0000-4000-8000-000000000041', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000032', '2026-11-08', '2026-11-14',
  '[{"date":"2026-11-09","hours":10},{"date":"2026-11-10","hours":10},{"date":"2026-11-11","hours":10},{"date":"2026-11-12","hours":10},{"date":"2026-11-13","hours":10}]'::jsonb,
  40, 10, 20, 30, 35, 52.5, 1100, 1925, true, 0, 0, 0, 0, 'single', NULL, NULL, false, NULL,
  '2026-11-16T14:00:00Z', '00000000-0000-4000-8000-000000000004', '2026-11-16T14:00:00Z', '00000000-0000-4000-8000-000000000004'),
 -- Cash, 10% deduction: 40 h x 20 = 800, less 80 = 720, bill 1400
 ('00000000-0000-4000-8000-000000000053', '00000000-0000-4000-8000-000000000042', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000031', '2026-11-01', '2026-11-07',
  '[{"date":"2026-11-02","hours":8},{"date":"2026-11-03","hours":8},{"date":"2026-11-04","hours":8},{"date":"2026-11-05","hours":8},{"date":"2026-11-06","hours":8}]'::jsonb,
  40, 0, 20, 20, 35, 35, 720, 1400, false, 0, 0, 0, 0, 'single', NULL, '900001', true, 'Paid in cash',
  '2026-11-09T14:00:00Z', '00000000-0000-4000-8000-000000000004', '2026-11-09T14:00:00Z', '00000000-0000-4000-8000-000000000004'),
 -- Hybrid SIN + cash, cap 20 h, 40 h worked: two rows. SIN row 20 h pay 400 bill 700; cash row 20 h pay 360 (10% off) bill 700
 ('00000000-0000-4000-8000-000000000054', '00000000-0000-4000-8000-000000000043', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000031', '2026-11-01', '2026-11-07',
  '[{"date":"2026-11-02","hours":8},{"date":"2026-11-03","hours":8},{"date":"2026-11-04","hours":4},{"date":"2026-11-05","hours":0},{"date":"2026-11-06","hours":0}]'::jsonb,
  20, 0, 20, 20, 35, 35, 400, 700, false, 0, 0, 0, 0, 'sin', 'SIN-Direct Deposit', '900002', true, NULL,
  '2026-11-09T14:00:00Z', '00000000-0000-4000-8000-000000000004', '2026-11-09T14:00:00Z', '00000000-0000-4000-8000-000000000004'),
 ('00000000-0000-4000-8000-000000000055', '00000000-0000-4000-8000-000000000043', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000031', '2026-11-01', '2026-11-07',
  '[{"date":"2026-11-02","hours":0},{"date":"2026-11-03","hours":0},{"date":"2026-11-04","hours":4},{"date":"2026-11-05","hours":8},{"date":"2026-11-06","hours":8}]'::jsonb,
  20, 0, 20, 20, 35, 35, 360, 700, false, 0, 0, 0, 0, 'cash', 'Cash', '900002', true, NULL,
  '2026-11-09T14:00:00Z', '00000000-0000-4000-8000-000000000004', '2026-11-09T14:00:00Z', '00000000-0000-4000-8000-000000000004'),
 -- Corporation, HST 13%, premium pay 2.5: 40 h x 22.50 = 900, tax 117, pay 1017, bill 1400
 ('00000000-0000-4000-8000-000000000056', '00000000-0000-4000-8000-000000000044', '00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000034', '2026-11-08', '2026-11-14',
  '[{"date":"2026-11-09","hours":8},{"date":"2026-11-10","hours":8},{"date":"2026-11-11","hours":8},{"date":"2026-11-12","hours":8},{"date":"2026-11-13","hours":8}]'::jsonb,
  40, 0, 20, 20, 35, 35, 1017, 1400, false, 2.5, 0, 0, 117, 'single', NULL, '900003', false, NULL,
  '2026-11-16T14:00:00Z', '00000000-0000-4000-8000-000000000004', '2026-11-16T14:00:00Z', '00000000-0000-4000-8000-000000000004'),
 -- Hybrid SIN + e-Transfer with a bonus (SIN row only): cap 30 h, 40 h worked
 ('00000000-0000-4000-8000-000000000057', '00000000-0000-4000-8000-000000000045', '00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000035', '2026-10-25', '2026-10-31',
  '[{"date":"2026-10-26","hours":10},{"date":"2026-10-27","hours":10},{"date":"2026-10-28","hours":10},{"date":"2026-10-29","hours":0},{"date":"2026-10-30","hours":0}]'::jsonb,
  30, 0, 20, 20, 35, 35, 650, 1050, false, 0, 50, 0, 0, 'sin', 'SIN-Direct Deposit', '900004', true, 'Bonus 50',
  '2026-11-02T14:00:00Z', '00000000-0000-4000-8000-000000000004', '2026-11-02T14:00:00Z', '00000000-0000-4000-8000-000000000004'),
 ('00000000-0000-4000-8000-000000000058', '00000000-0000-4000-8000-000000000045', '00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000035', '2026-10-25', '2026-10-31',
  '[{"date":"2026-10-26","hours":0},{"date":"2026-10-27","hours":0},{"date":"2026-10-28","hours":0},{"date":"2026-10-29","hours":10},{"date":"2026-10-30","hours":0}]'::jsonb,
  10, 0, 20, 20, 35, 35, 190, 350, false, 0, 0, 0, 0, 'e_transfer', 'e-Transfer', '900004', true, NULL,
  '2026-11-02T14:00:00Z', '00000000-0000-4000-8000-000000000004', '2026-11-02T14:00:00Z', '00000000-0000-4000-8000-000000000004'),
 -- An older week on the ended Alberta position (outside the 30-day window)
 ('00000000-0000-4000-8000-000000000059', '00000000-0000-4000-8000-000000000041', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000036', '2026-09-20', '2026-09-26',
  '[{"date":"2026-09-21","hours":8},{"date":"2026-09-22","hours":8},{"date":"2026-09-23","hours":8},{"date":"2026-09-24","hours":8},{"date":"2026-09-25","hours":8}]'::jsonb,
  40, 0, 20, 20, 35, 35, 800, 1400, false, 0, 0, 0, 0, 'single', NULL, '900005', true, NULL,
  '2026-09-28T14:00:00Z', '00000000-0000-4000-8000-000000000004', '2026-09-28T14:00:00Z', '00000000-0000-4000-8000-000000000004');

-- Invoices -------------------------------------------------------------------------------------------
-- Tax per province: ON HST 13%, QC GST 5% + QST 9.975%, BC GST 5%, AB zero rated (USD client).

INSERT INTO public.invoices (id, invoice_number, invoice_date, due_date, status, currency, client_id, subtotal, total_tax,
  total_hst, total_gst, total_qst, grand_total, total_hours, email_sent, email_sent_date, invoice_sent_to,
  invoice_data, notes, created_at, created_by_user_id, updated_at, updated_by_user_id)
VALUES
 -- Ontario: 1400 + 1400 + 700 + 700 = 4200, HST 546, total 4746, 120 h
 ('00000000-0000-4000-8000-000000000061', '900001', '2026-11-10', '2026-12-10', 'sent', 'CAD', '00000000-0000-4000-8000-000000000021',
  4200, 546, 546, 0, 0, 4746, 120, true, '2026-11-10T15:00:00Z', 'nora.north@example.test',
  '{"client":{"id":"00000000-0000-4000-8000-000000000021","companyName":"Northwind Test Staffing Client","shortCode":"NW"},
    "timesheetStartDate":"2026-11-01","timesheetEndDate":"2026-11-07",
    "timesheets":[
      {"timesheetId":"00000000-0000-4000-8000-000000000051","jobseekerProfile":{"jobseekerProfileId":"00000000-0000-4000-8000-000000000041"},"position":{"positionId":"00000000-0000-4000-8000-000000000031"},"weekStartDate":"2026-11-01","weekEndDate":"2026-11-07","totalRegularHours":40,"totalOvertimeHours":0,"totalClientBill":1400,"totalJobseekerPay":800,"salesTax":"13.00% [ON]"},
      {"timesheetId":"00000000-0000-4000-8000-000000000053","jobseekerProfile":{"jobseekerProfileId":"00000000-0000-4000-8000-000000000042"},"position":{"positionId":"00000000-0000-4000-8000-000000000031"},"weekStartDate":"2026-11-01","weekEndDate":"2026-11-07","totalRegularHours":40,"totalOvertimeHours":0,"totalClientBill":1400,"totalJobseekerPay":720,"salesTax":"13.00% [ON]"},
      {"timesheetId":"00000000-0000-4000-8000-000000000054","jobseekerProfile":{"jobseekerProfileId":"00000000-0000-4000-8000-000000000043"},"position":{"positionId":"00000000-0000-4000-8000-000000000031"},"weekStartDate":"2026-11-01","weekEndDate":"2026-11-07","totalRegularHours":20,"totalOvertimeHours":0,"totalClientBill":700,"totalJobseekerPay":400,"linePaymentMethod":"SIN-Direct Deposit","salesTax":"13.00% [ON]"},
      {"timesheetId":"00000000-0000-4000-8000-000000000055","jobseekerProfile":{"jobseekerProfileId":"00000000-0000-4000-8000-000000000043"},"position":{"positionId":"00000000-0000-4000-8000-000000000031"},"weekStartDate":"2026-11-01","weekEndDate":"2026-11-07","totalRegularHours":20,"totalOvertimeHours":0,"totalClientBill":700,"totalJobseekerPay":360,"linePaymentMethod":"Cash","salesTax":"13.00% [ON]"}
    ]}'::jsonb,
  'Synthetic invoice, Ontario HST.', '2026-11-10T14:00:00Z', '00000000-0000-4000-8000-000000000004', '2026-11-10T14:00:00Z', '00000000-0000-4000-8000-000000000004'),
 -- Quebec: 1400, GST 70 + QST 139.65 = 209.65, total 1609.65, 40 h
 ('00000000-0000-4000-8000-000000000062', '900003', '2026-11-17', '2026-12-02', 'draft', 'CAD', '00000000-0000-4000-8000-000000000022',
  1400, 209.65, 0, 70, 139.65, 1609.65, 40, false, NULL, NULL,
  '{"client":{"id":"00000000-0000-4000-8000-000000000022","companyName":"Quebec Test Logistics Client","shortCode":"QL"},
    "timesheetStartDate":"2026-11-08","timesheetEndDate":"2026-11-14",
    "timesheets":[
      {"timesheetId":"00000000-0000-4000-8000-000000000056","jobseekerProfile":{"jobseekerProfileId":"00000000-0000-4000-8000-000000000044"},"position":{"positionId":"00000000-0000-4000-8000-000000000034"},"weekStartDate":"2026-11-08","weekEndDate":"2026-11-14","totalRegularHours":40,"totalOvertimeHours":0,"totalClientBill":1400,"totalJobseekerPay":1017,"salesTax":"14.975% [QC]"}
    ]}'::jsonb,
  'Synthetic invoice, Quebec GST and QST.', '2026-11-17T14:00:00Z', '00000000-0000-4000-8000-000000000004', '2026-11-17T14:00:00Z', '00000000-0000-4000-8000-000000000004'),
 -- British Columbia: 1050 + 350 = 1400, GST 5% = 70, total 1470, 40 h
 ('00000000-0000-4000-8000-000000000063', '900004', '2026-11-02', '2026-12-02', 'paid', 'CAD', '00000000-0000-4000-8000-000000000023',
  1400, 70, 0, 70, 0, 1470, 40, true, '2026-11-02T15:00:00Z', 'paige.pacific@example.test',
  '{"client":{"id":"00000000-0000-4000-8000-000000000023","companyName":"Pacific Test Warehousing Client","shortCode":"PW"},
    "timesheetStartDate":"2026-10-25","timesheetEndDate":"2026-10-31",
    "timesheets":[
      {"timesheetId":"00000000-0000-4000-8000-000000000057","jobseekerProfile":{"jobseekerProfileId":"00000000-0000-4000-8000-000000000045"},"position":{"positionId":"00000000-0000-4000-8000-000000000035"},"weekStartDate":"2026-10-25","weekEndDate":"2026-10-31","totalRegularHours":30,"totalOvertimeHours":0,"totalClientBill":1050,"totalJobseekerPay":650,"linePaymentMethod":"SIN-Direct Deposit","salesTax":"5.00% [BC]"},
      {"timesheetId":"00000000-0000-4000-8000-000000000058","jobseekerProfile":{"jobseekerProfileId":"00000000-0000-4000-8000-000000000045"},"position":{"positionId":"00000000-0000-4000-8000-000000000035"},"weekStartDate":"2026-10-25","weekEndDate":"2026-10-31","totalRegularHours":10,"totalOvertimeHours":0,"totalClientBill":350,"totalJobseekerPay":190,"linePaymentMethod":"e-Transfer","salesTax":"5.00% [BC]"}
    ]}'::jsonb,
  'Synthetic invoice, British Columbia GST.', '2026-11-02T14:00:00Z', '00000000-0000-4000-8000-000000000004', '2026-11-02T14:00:00Z', '00000000-0000-4000-8000-000000000004'),
 -- Alberta, zero rated, USD: 1400, no tax, 40 h
 ('00000000-0000-4000-8000-000000000064', '900005', '2026-09-28', '2026-11-12', 'overdue', 'USD', '00000000-0000-4000-8000-000000000024',
  1400, 0, 0, 0, 0, 1400, 40, true, '2026-09-28T15:00:00Z', 'pat.prairie@example.test',
  '{"client":{"id":"00000000-0000-4000-8000-000000000024","companyName":"Prairie Test Foods Client","shortCode":"PF"},
    "timesheetStartDate":"2026-09-20","timesheetEndDate":"2026-09-26",
    "timesheets":[
      {"timesheetId":"00000000-0000-4000-8000-000000000059","jobseekerProfile":{"jobseekerProfileId":"00000000-0000-4000-8000-000000000041"},"position":{"positionId":"00000000-0000-4000-8000-000000000036"},"weekStartDate":"2026-09-20","weekEndDate":"2026-09-26","totalRegularHours":40,"totalOvertimeHours":0,"totalClientBill":1400,"totalJobseekerPay":800,"salesTax":"0.00% [ZERO RATED]"}
    ]}'::jsonb,
  'Synthetic invoice, zero rated, USD.', '2026-09-28T14:00:00Z', '00000000-0000-4000-8000-000000000004', '2026-09-28T14:00:00Z', '00000000-0000-4000-8000-000000000004'),
 -- Ontario again, written with every field the reports read (names, position title, bill rate, discount) and one
 -- deduction line (a negative bill rate), so the deduction and sales reports are not empty or all "N/A".
 -- Lines: 1925 + (-50) = 1875, HST 13% = 243.75, total 2118.75, 50 h. (The discount on the first line is read by the
 -- sales report only; like the other invoices these totals are the sum of the bill amounts.)
 ('00000000-0000-4000-8000-000000000065', '900006', '2026-11-12', '2026-12-12', 'draft', 'CAD', '00000000-0000-4000-8000-000000000021',
  1875, 243.75, 243.75, 0, 0, 2118.75, 50, false, NULL, NULL,
  '{"client":{"id":"00000000-0000-4000-8000-000000000021","companyName":"Northwind Test Staffing Client","shortCode":"NW","accountingPerson":"Test Bookkeeper","contactPersonName1":"Nora North"},
    "timesheetStartDate":"2026-11-08","timesheetEndDate":"2026-11-14",
    "timesheets":[
      {"timesheetId":"00000000-0000-4000-8000-000000000052","jobseekerProfile":{"jobseekerProfileId":"00000000-0000-4000-8000-000000000041","employeeId":"E-0011","firstName":"Sam","lastName":"Sinclair"},"position":{"positionId":"00000000-0000-4000-8000-000000000032","title":"Forklift Operator","positionNumber":"NW002","positionCategory":"Warehouse"},"weekStartDate":"2026-11-08","weekEndDate":"2026-11-14","totalRegularHours":40,"totalOvertimeHours":10,"regularBillRate":35,"totalClientBill":1925,"totalJobseekerPay":1100,"discount":25,"description":"Forklift week","salesTax":"13.00% [ON]"},
      {"timesheetId":"00000000-0000-4000-8000-000000000052","jobseekerProfile":{"jobseekerProfileId":"00000000-0000-4000-8000-000000000041","employeeId":"E-0011","firstName":"Sam","lastName":"Sinclair"},"position":{"positionId":"00000000-0000-4000-8000-000000000032","title":"Forklift Operator","positionNumber":"NW002","positionCategory":"Warehouse"},"weekStartDate":"2026-11-08","weekEndDate":"2026-11-14","totalRegularHours":0,"totalOvertimeHours":0,"regularBillRate":-50,"totalClientBill":-50,"totalJobseekerPay":0,"description":"Equipment deduction","salesTax":"13.00% [ON]"}
    ]}'::jsonb,
  'Synthetic invoice with a deduction line.', '2026-11-12T14:00:00Z', '00000000-0000-4000-8000-000000000004', '2026-11-12T14:00:00Z', '00000000-0000-4000-8000-000000000004');

-- Drafts and consent ---------------------------------------------------------------------------------

INSERT INTO public.consent_documents (id, file_name, file_path, uploaded_by, created_at)
VALUES ('00000000-0000-4000-8000-000000000081', 'test-consent.pdf', 'originals/test-consent.pdf',
        '00000000-0000-4000-8000-000000000003', '2026-10-01T14:00:00Z');

-- Activity feed: one row mentioning a jobseeker. Only staff may read the feed (033).
INSERT INTO public.recent_activities (id, created_at, actor_id, actor_name, actor_type, action_type, action_verb,
  primary_entity_type, primary_entity_id, primary_entity_name, display_message, category, priority)
SELECT '00000000-0000-4000-8000-000000000091', '2026-11-16T14:00:00Z', '00000000-0000-4000-8000-000000000003',
  'Test Recruiter', 'recruiter', 'assign_jobseeker', 'assigned', 'jobseeker', '00000000-0000-4000-8000-000000000011',
  'Sam Sinclair', 'Test Recruiter assigned Sam Sinclair to a position', c.code, 'normal'
FROM public.activity_categories c ORDER BY c.code LIMIT 1;

-- Portal settings the server reads for messages (who a support ticket notifies, sender addresses). Synthetic,
-- so a ticket created in a test produces an email the outbound guard records. Other settings keep their defaults.
INSERT INTO public.portal_settings (key, value, updated_by_name) VALUES
  ('portal.name', 'Test Portal', 'Test seed'),
  ('email.noReplyFrom', 'no-reply@example.test', 'Test seed'),
  ('email.assignmentFrom', 'assignments@example.test', 'Test seed'),
  ('email.defaultFrom', 'no-reply@example.test', 'Test seed'),
  ('email.supportNotifyTo', 'support@example.test', 'Test seed'),
  ('company.name', 'Test Staffing Inc.', 'Test seed'),
  ('legal.companyName', 'Test Staffing Inc.', 'Test seed'),
  ('legal.contactEmail', 'privacy@example.test', 'Test seed')
ON CONFLICT (key) DO NOTHING;

-- Last activity ---------------------------------------------------------------------------------------
-- The inactivity triggers (014) set last_activity_at to the time of the insert whenever a timesheet, position or
-- profile row is written, which overwrote the dates above with "the day the seed ran". Put the intended dates back,
-- with triggers off for this statement only, so the reports' "inactive" flags (client: 30 days, jobseeker: 60 days,
-- counted from the fixed clock of 17 November 2026) have both answers: Prairie Foods (77 days) and Ely (93 days)
-- are inactive, everyone else is not.
SET LOCAL session_replication_role = replica;
UPDATE public.clients c SET last_activity_at = v.at::timestamptz
FROM (VALUES
  ('00000000-0000-4000-8000-000000000021', '2026-11-10T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000022', '2026-11-12T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000023', '2026-11-05T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000024', '2026-09-01T14:00:00Z')) AS v(id, at)
WHERE c.id = v.id::uuid;
UPDATE public.jobseeker_profiles p SET last_activity_at = v.at::timestamptz
FROM (VALUES
  ('00000000-0000-4000-8000-000000000041', '2026-11-08T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000042', '2026-11-08T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000043', '2026-11-08T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000044', '2026-11-08T14:00:00Z'),
  ('00000000-0000-4000-8000-000000000045', '2026-08-15T14:00:00Z')) AS v(id, at)
WHERE p.id = v.id::uuid;
SET LOCAL session_replication_role = origin;
