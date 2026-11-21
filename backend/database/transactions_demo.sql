-- =====================================================================
--  TRANSACTION DEMONSTRATION (BEGIN / COMMIT / ROLLBACK)
--  Scenario: a vendor orders 10 Apples-LARGE and 8 Grapes-LARGE.
--  Only 25 Grapes-LARGE exist, so first we sell 3 (OK), then we try 30 (fails)
--  and the WHOLE transaction is rolled back - nothing is saved.
--  Run each block in MySQL Workbench / CLI and watch the stock numbers.
-- =====================================================================
USE batloung_farm;

-- Stock before
SELECT fruit_id, packaging_size, available_quantity FROM stock WHERE packaging_size='LARGE' AND fruit_id IN (1,5);

-- ---------- A) FAILING sale -> ROLLBACK ----------
BEGIN;
  INSERT INTO sales (invoice_number, vendor_id, due_date, payment_method, payment_status, total_amount)
  VALUES ('INV-DEMO-FAIL', 1, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'CASH', 'UNPAID', 2200);
  SET @sale := LAST_INSERT_ID();

  -- item 1 succeeds: 10 large apples
  INSERT INTO sales_details (sale_id, fruit_id, packaging_size, quantity, unit_price) VALUES (@sale,1,'LARGE',10,220);
  UPDATE stock SET available_quantity = available_quantity - 10 WHERE fruit_id=1 AND packaging_size='LARGE';

  -- item 2 FAILS: 30 large grapes but only 25 exist -> CHECK constraint (available_quantity >= 0) raises an error
  UPDATE stock SET available_quantity = available_quantity - 30 WHERE fruit_id=5 AND packaging_size='LARGE';
-- The last statement errors out, so we undo everything:
ROLLBACK;

-- Stock after ROLLBACK = identical to "before"; no INV-DEMO-FAIL sale exists
SELECT fruit_id, packaging_size, available_quantity FROM stock WHERE packaging_size='LARGE' AND fruit_id IN (1,5);
SELECT COUNT(*) AS demo_sales_saved FROM sales WHERE invoice_number='INV-DEMO-FAIL';   -- 0

-- ---------- B) SUCCESSFUL sale -> COMMIT ----------
BEGIN;
  INSERT INTO sales (invoice_number, vendor_id, due_date, payment_method, payment_status, total_amount, amount_paid)
  VALUES ('INV-DEMO-OK', 1, CURDATE(), 'CASH', 'PAID', 220, 220);
  SET @sale := LAST_INSERT_ID();
  INSERT INTO sales_details (sale_id, fruit_id, packaging_size, quantity, unit_price) VALUES (@sale,1,'LARGE',1,220);
  UPDATE stock SET available_quantity = available_quantity - 1 WHERE fruit_id=1 AND packaging_size='LARGE';
COMMIT;

-- Clean the demo sale up (restores stock) so the sample data stays tidy
UPDATE stock SET available_quantity = available_quantity + 1 WHERE fruit_id=1 AND packaging_size='LARGE';
DELETE FROM sales WHERE invoice_number='INV-DEMO-OK';
