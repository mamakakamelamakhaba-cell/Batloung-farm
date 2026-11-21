-- =====================================================================
--  SAMPLE DATA - fully consistent across every table
--  Dates are RELATIVE to today so alerts (near-expiry, overdue) always show.
--  Run after schema.sql:   mysql -u root -p batloung_farm < database/seed.sql
-- =====================================================================
USE batloung_farm;
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE expenses; TRUNCATE TABLE sales_returns; TRUNCATE TABLE payments;
TRUNCATE TABLE sale_batch_allocations; TRUNCATE TABLE stock_movements; TRUNCATE TABLE stock_batches;
TRUNCATE TABLE stock; TRUNCATE TABLE sales_details; TRUNCATE TABLE sales;
TRUNCATE TABLE purchase_details; TRUNCATE TABLE purchases; TRUNCATE TABLE fruit_prices;
TRUNCATE TABLE vendors; TRUNCATE TABLE fruits; TRUNCATE TABLE suppliers;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------- Suppliers (one per province) ----------
INSERT INTO suppliers (supplier_id, business_name, contact_person, phone, province, address) VALUES
(1,'Highveld Orchards (Pty) Ltd','Johan van Wyk','+27 11 555 0101','Gauteng','12 Farm Road, Johannesburg South'),
(2,'Free State Fruit Growers','Nomsa Dlamini','+27 51 555 0102','Free State','Plot 7, Bloemfontein Agri Park'),
(3,'Zululand Fresh Produce','Sipho Mkhize','+27 31 555 0103','KwaZulu-Natal','45 Harbour Rd, Durban North'),
(4,'Kei Valley Farms','Thandi Ngcobo','+27 43 555 0104','Eastern Cape','Kei Mouth Rd, East London'),
(5,'Cape Winelands Fruit Co','Pieter Botha','+27 21 555 0105','Western Cape','Paarl Fruit Hub, Paarl'),
(6,'Limpopo Mango Estate','Rirhandzu Maluleke','+27 15 555 0106','Limpopo','Tzaneen Estate Road, Tzaneen'),
(7,'Lowveld Citrus Packers','Andile Nkosi','+27 13 555 0107','Mpumalanga','Nelspruit Citrus Rd, Mbombela'),
(8,'Rustenburg Fresh Traders','Kgosi Molefe','+27 14 555 0108','North West','88 Market St, Rustenburg');

-- ---------- Fruits & packaging-specific selling prices ----------
INSERT INTO fruits (fruit_id, fruit_name, description, status, shelf_life_days) VALUES
(1,'Apples','Crisp red and green apples',        'AVAILABLE',21),
(2,'Bananas','Sweet ripe bananas',               'AVAILABLE',7),
(3,'Oranges','Juicy Valencia oranges',           'AVAILABLE',14),
(4,'Mangoes','Sun-ripened Limpopo mangoes',      'AVAILABLE',8),
(5,'Grapes','Seedless table grapes',             'AVAILABLE',10);

INSERT INTO fruit_prices (fruit_id, packaging_size, selling_price) VALUES
(1,'SMALL',90),(1,'MEDIUM',150),(1,'LARGE',220),
(2,'SMALL',60),(2,'MEDIUM',100),(2,'LARGE',150),
(3,'SMALL',70),(3,'MEDIUM',120),(3,'LARGE',180),
(4,'SMALL',100),(4,'MEDIUM',170),(4,'LARGE',250),
(5,'SMALL',120),(5,'MEDIUM',200),(5,'LARGE',300);

-- ---------- Vendors (with credit limits) ----------
INSERT INTO vendors (vendor_id, vendor_name, phone_number, location, registration_date, credit_limit) VALUES
(1,'Mpho Fresh Stall','+266 5801 1001','Maseru Central Market',DATE_SUB(CURDATE(), INTERVAL 200 DAY),5000),
(2,'Lerato Fruit Corner','+266 5801 1002','Roma Main Street',DATE_SUB(CURDATE(), INTERVAL 180 DAY),5000),
(3,'Thabo & Sons Retailers','+266 5801 1003','Maseru Industrial Area',DATE_SUB(CURDATE(), INTERVAL 150 DAY),10000),
(4,'Palesa Street Vendor','+266 5801 1004','Mafeteng Bus Rank',DATE_SUB(CURDATE(), INTERVAL 120 DAY),2000),
(5,'Ntsane Mini Market','+266 5801 1005','Teyateyaneng Town',DATE_SUB(CURDATE(), INTERVAL 90 DAY),6000),
(6,'Karabo Fruit Cart','+266 5801 1006','Maputsoe Border Road',DATE_SUB(CURDATE(), INTERVAL 60 DAY),4000),
(7,'Retselisitsoe Grocers','+266 5801 1007','Mohales Hoek Centre',DATE_SUB(CURDATE(), INTERVAL 30 DAY),3000),
(8,'Lineo Roadside Stall','+266 5801 1008','Morija Junction',DATE_SUB(CURDATE(), INTERVAL 10 DAY),1500);

-- ---------- Purchases ----------
INSERT INTO purchases (purchase_id, supplier_id, purchase_date, expected_delivery_date, delivery_date, total_amount, notes) VALUES
(1,2,DATE_SUB(CURDATE(), INTERVAL 30 DAY),DATE_SUB(CURDATE(), INTERVAL 30 DAY),DATE_SUB(CURDATE(), INTERVAL 30 DAY), 7600,'Early-season apples and oranges'),
(2,1,DATE_SUB(CURDATE(), INTERVAL 10 DAY),DATE_SUB(CURDATE(), INTERVAL 10 DAY),DATE_SUB(CURDATE(), INTERVAL 10 DAY),23000,'Apple delivery'),
(3,3,DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_SUB(CURDATE(), INTERVAL 6 DAY), DATE_SUB(CURDATE(), INTERVAL 5 DAY),16900,'Bananas - delivered one day late'),
(4,5,DATE_SUB(CURDATE(), INTERVAL 6 DAY), DATE_SUB(CURDATE(), INTERVAL 6 DAY), DATE_SUB(CURDATE(), INTERVAL 6 DAY),34250,'Oranges and grapes'),
(5,6,DATE_SUB(CURDATE(), INTERVAL 3 DAY), DATE_SUB(CURDATE(), INTERVAL 4 DAY), DATE_SUB(CURDATE(), INTERVAL 3 DAY),17300,'Mangoes - 5 boxes rejected');

INSERT INTO purchase_details (purchase_detail_id, purchase_id, fruit_id, packaging_size, quantity, unit_cost, quantity_ordered, quantity_delivered, quantity_rejected, rejection_reason, expiry_date) VALUES
(1,1,1,'LARGE', 30,140, 30, 30,0,NULL,DATE_SUB(CURDATE(), INTERVAL 9 DAY)),
(2,1,3,'MEDIUM',40, 85, 40, 40,0,NULL,DATE_SUB(CURDATE(), INTERVAL 16 DAY)),
(3,2,1,'SMALL', 100, 60,100,100,0,NULL,DATE_ADD(CURDATE(), INTERVAL 11 DAY)),
(4,2,1,'MEDIUM', 80,100, 80, 80,0,NULL,DATE_ADD(CURDATE(), INTERVAL 11 DAY)),
(5,2,1,'LARGE',  60,150, 60, 60,0,NULL,DATE_ADD(CURDATE(), INTERVAL 11 DAY)),
(6,3,2,'SMALL', 110, 40,120,115,5,'Bruised on arrival',DATE_ADD(CURDATE(), INTERVAL 2 DAY)),
(7,3,2,'MEDIUM',100, 65,100,100,0,NULL,DATE_ADD(CURDATE(), INTERVAL 2 DAY)),
(8,3,2,'LARGE',  60,100, 60, 60,0,NULL,DATE_ADD(CURDATE(), INTERVAL 2 DAY)),
(9,4,3,'SMALL',  90, 45, 90, 90,0,NULL,DATE_ADD(CURDATE(), INTERVAL 8 DAY)),
(10,4,3,'MEDIUM',70, 80, 70, 70,0,NULL,DATE_ADD(CURDATE(), INTERVAL 8 DAY)),
(11,4,3,'LARGE', 40,120, 40, 40,0,NULL,DATE_ADD(CURDATE(), INTERVAL 8 DAY)),
(12,4,5,'MEDIUM',60,130, 60, 60,0,NULL,DATE_ADD(CURDATE(), INTERVAL 4 DAY)),
(13,4,5,'LARGE', 40,200, 40, 40,0,NULL,DATE_ADD(CURDATE(), INTERVAL 4 DAY)),
(14,4,5,'SMALL', 50, 80, 50, 50,0,NULL,DATE_ADD(CURDATE(), INTERVAL 4 DAY)),
(15,5,4,'SMALL', 80, 65, 80, 80,0,NULL,DATE_ADD(CURDATE(), INTERVAL 5 DAY)),
(16,5,4,'MEDIUM',50,110, 60, 55,5,'Overripe fruit rejected',DATE_ADD(CURDATE(), INTERVAL 5 DAY)),
(17,5,4,'LARGE', 40,165, 40, 40,0,NULL,DATE_ADD(CURDATE(), INTERVAL 5 DAY));

-- ---------- Stock rows: one per fruit AND packaging size ----------
INSERT INTO stock (stock_id, fruit_id, packaging_size, available_quantity, minimum_quantity) VALUES
(1,1,'SMALL',0,20),(2,1,'MEDIUM',0,20),(3,1,'LARGE',0,25),
(4,2,'SMALL',0,15),(5,2,'MEDIUM',0,20),(6,2,'LARGE',0,45),
(7,3,'SMALL',0,20),(8,3,'MEDIUM',0,20),(9,3,'LARGE',0,40),
(10,4,'SMALL',0,20),(11,4,'MEDIUM',0,20),(12,4,'LARGE',0,60),
(13,5,'SMALL',0,20),(14,5,'MEDIUM',0,20),(15,5,'LARGE',0,20);

-- ---------- Batches (batch_id = purchase_detail_id) ----------
INSERT INTO stock_batches (batch_id, fruit_id, packaging_size, purchase_detail_id, received_date, expiry_date, quantity_received, quantity_remaining, unit_cost, source)
SELECT pd.purchase_detail_id, pd.fruit_id, pd.packaging_size, pd.purchase_detail_id, p.delivery_date, pd.expiry_date,
       pd.quantity, pd.quantity, pd.unit_cost, 'PURCHASE'
FROM purchase_details pd JOIN purchases p ON p.purchase_id = pd.purchase_id ORDER BY pd.purchase_detail_id;

-- ---------- Sales ----------
INSERT INTO sales (sale_id, invoice_number, vendor_id, sale_date, due_date, payment_method, payment_status, total_amount, amount_paid, returned_amount, notes) VALUES
(1,'INV-2026-00001',1,DATE_SUB(NOW(), INTERVAL 25 DAY),DATE_SUB(CURDATE(), INTERVAL 11 DAY),'CASH',         'PAID',          8000, 8000,  0,NULL),
(2,'INV-2026-00002',2,DATE_SUB(NOW(), INTERVAL 8 DAY), DATE_ADD(CURDATE(), INTERVAL 6 DAY), 'MOBILE_MONEY', 'PARTIALLY_PAID',10300, 8000,  0,'Balance to be paid next week'),
(3,'INV-2026-00003',3,DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_ADD(CURDATE(), INTERVAL 10 DAY),'CREDIT',       'UNPAID',        8800,    0,200,NULL),
(4,'INV-2026-00004',4,DATE_SUB(NOW(), INTERVAL 20 DAY),DATE_SUB(CURDATE(), INTERVAL 6 DAY), 'CREDIT',       'UNPAID',         600,    0,  0,'Overdue - follow up'),
(5,'INV-2026-00005',5,DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_ADD(CURDATE(), INTERVAL 12 DAY),'CASH',         'PARTIALLY_PAID',10100, 5000,  0,NULL),
(6,'INV-2026-00006',6,DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 13 DAY),'MOBILE_MONEY', 'PAID',         10500,10000,500,NULL);

INSERT INTO sales_details (sales_detail_id, sale_id, fruit_id, packaging_size, quantity, unit_price, unit_cost, returned_quantity) VALUES
(1,1,1,'LARGE', 20,220,140,0),(2,1,3,'MEDIUM',30,120, 85,0),
(3,2,1,'SMALL', 40, 90, 60,0),(4,2,1,'MEDIUM',30,150,100,0),(5,2,1,'LARGE',10,220,150,0),
(6,3,2,'SMALL', 30, 60, 40,0),(7,3,2,'MEDIUM',40,100, 65,2),(8,3,2,'LARGE',20,150,100,0),
(9,4,3,'MEDIUM', 5,120, 85,0),
(10,5,3,'SMALL',25, 70, 45,0),(11,5,3,'LARGE',10,180,120,0),(12,5,5,'MEDIUM',20,200,130,0),(13,5,4,'MEDIUM',15,170,110,0),
(14,6,4,'SMALL',30,100, 65,0),(15,6,4,'LARGE',12,250,165,2),(16,6,5,'LARGE',15,300,200,0);

-- FIFO allocations (which batch supplied each sold line)
INSERT INTO sale_batch_allocations (sales_detail_id, batch_id, quantity, returned_quantity, restocked_quantity) VALUES
(1,1,20,0,0),(2,2,30,0,0),(3,3,40,0,0),(4,4,30,0,0),(5,5,10,0,0),
(6,6,30,0,0),(7,7,40,2,2),(8,8,20,0,0),(9,2,5,0,0),
(10,9,25,0,0),(11,11,10,0,0),(12,12,20,0,0),(13,16,15,0,0),
(14,15,30,0,0),(15,17,12,2,0),(16,13,15,0,0);

-- Batch balances after sales, spoilage, damage, correction and return
UPDATE stock_batches SET quantity_remaining = CASE batch_id
  WHEN 1 THEN 10  WHEN 2 THEN 0   WHEN 3 THEN 60 WHEN 4 THEN 49 WHEN 5 THEN 50
  WHEN 6 THEN 77  WHEN 7 THEN 62  WHEN 8 THEN 40 WHEN 9 THEN 65 WHEN 10 THEN 70
  WHEN 11 THEN 30 WHEN 12 THEN 40 WHEN 13 THEN 25 WHEN 14 THEN 50
  WHEN 15 THEN 50 WHEN 16 THEN 35 WHEN 17 THEN 28 END;

-- Stock = sum of batch balances (keeps both tables in step)
UPDATE stock st SET available_quantity = (
  SELECT COALESCE(SUM(b.quantity_remaining),0) FROM stock_batches b
  WHERE b.fruit_id = st.fruit_id AND b.packaging_size = st.packaging_size);

-- ---------- Payments (several payments per sale) ----------
INSERT INTO payments (sale_id, vendor_id, amount, payment_type, payment_method, reference_number, payment_date, notes) VALUES
(1,1, 8000,'PAYMENT','CASH',        NULL,       DATE_SUB(NOW(), INTERVAL 25 DAY),'Paid in full at delivery'),
(2,2, 6000,'PAYMENT','MOBILE_MONEY','MM-88213', DATE_SUB(NOW(), INTERVAL 8 DAY), 'First payment'),
(2,2, 2000,'PAYMENT','CASH',        NULL,       DATE_SUB(NOW(), INTERVAL 4 DAY), 'Second payment'),
(5,5, 5000,'PAYMENT','CASH',        NULL,       DATE_SUB(NOW(), INTERVAL 2 DAY), 'Deposit'),
(6,6,10500,'PAYMENT','MOBILE_MONEY','MM-90412', DATE_SUB(NOW(), INTERVAL 1 DAY), 'Paid in full'),
(6,6,  500,'REFUND', 'MOBILE_MONEY','MM-REF-17',NOW(),                           'Refund for damaged mangoes');

-- ---------- Returns ----------
INSERT INTO sales_returns (sale_id, sales_detail_id, quantity, reason, restocked_quantity, refund_value, credit_adjustment, cash_refund, return_date, processed_by) VALUES
(3,7,2,'Wrong item delivered - fruit in good condition',2,200,200,  0,DATE_SUB(NOW(), INTERVAL 3 DAY),'admin'),
(6,15,2,'Damaged on arrival',                           0,500,  0,500,NOW(),'admin');

-- ---------- Stock movement history ----------
INSERT INTO stock_movements (fruit_id, packaging_size, movement_type, quantity, batch_id, reference_type, reference_id, reason, created_by, created_at) VALUES
(1,'LARGE', 'PURCHASE', 30,1,'PURCHASE',1,'Stock received','admin',DATE_SUB(NOW(), INTERVAL 30 DAY)),
(3,'MEDIUM','PURCHASE', 40,2,'PURCHASE',1,'Stock received','admin',DATE_SUB(NOW(), INTERVAL 30 DAY)),
(1,'LARGE', 'SALE',    -20,1,'SALE',1,'Sale INV-2026-00001','admin',DATE_SUB(NOW(), INTERVAL 25 DAY)),
(3,'MEDIUM','SALE',    -30,2,'SALE',1,'Sale INV-2026-00001','admin',DATE_SUB(NOW(), INTERVAL 25 DAY)),
(3,'MEDIUM','SALE',     -5,2,'SALE',4,'Sale INV-2026-00004','admin',DATE_SUB(NOW(), INTERVAL 20 DAY)),
(3,'MEDIUM','SPOILED',  -5,2,'ADJUSTMENT',NULL,'Batch expired - written off','admin',DATE_SUB(NOW(), INTERVAL 15 DAY)),
(1,'SMALL', 'PURCHASE',100,3,'PURCHASE',2,'Stock received','admin',DATE_SUB(NOW(), INTERVAL 10 DAY)),
(1,'MEDIUM','PURCHASE', 80,4,'PURCHASE',2,'Stock received','admin',DATE_SUB(NOW(), INTERVAL 10 DAY)),
(1,'LARGE', 'PURCHASE', 60,5,'PURCHASE',2,'Stock received','admin',DATE_SUB(NOW(), INTERVAL 10 DAY)),
(1,'SMALL', 'SALE',    -40,3,'SALE',2,'Sale INV-2026-00002','admin',DATE_SUB(NOW(), INTERVAL 8 DAY)),
(1,'MEDIUM','SALE',    -30,4,'SALE',2,'Sale INV-2026-00002','admin',DATE_SUB(NOW(), INTERVAL 8 DAY)),
(1,'LARGE', 'SALE',    -10,5,'SALE',2,'Sale INV-2026-00002','admin',DATE_SUB(NOW(), INTERVAL 8 DAY)),
(3,'SMALL', 'PURCHASE', 90,9,'PURCHASE',4,'Stock received','admin',DATE_SUB(NOW(), INTERVAL 6 DAY)),
(3,'MEDIUM','PURCHASE', 70,10,'PURCHASE',4,'Stock received','admin',DATE_SUB(NOW(), INTERVAL 6 DAY)),
(3,'LARGE', 'PURCHASE', 40,11,'PURCHASE',4,'Stock received','admin',DATE_SUB(NOW(), INTERVAL 6 DAY)),
(5,'MEDIUM','PURCHASE', 60,12,'PURCHASE',4,'Stock received','admin',DATE_SUB(NOW(), INTERVAL 6 DAY)),
(5,'LARGE', 'PURCHASE', 40,13,'PURCHASE',4,'Stock received','admin',DATE_SUB(NOW(), INTERVAL 6 DAY)),
(5,'SMALL', 'PURCHASE', 50,14,'PURCHASE',4,'Stock received','admin',DATE_SUB(NOW(), INTERVAL 6 DAY)),
(2,'SMALL', 'PURCHASE',110,6,'PURCHASE',3,'Stock received (5 rejected)','admin',DATE_SUB(NOW(), INTERVAL 5 DAY)),
(2,'MEDIUM','PURCHASE',100,7,'PURCHASE',3,'Stock received','admin',DATE_SUB(NOW(), INTERVAL 5 DAY)),
(2,'LARGE', 'PURCHASE', 60,8,'PURCHASE',3,'Stock received','admin',DATE_SUB(NOW(), INTERVAL 5 DAY)),
(1,'MEDIUM','CORRECTION',-1,4,NULL,NULL,'Stock count correction','admin',DATE_SUB(NOW(), INTERVAL 5 DAY)),
(2,'SMALL', 'SALE',    -30,6,'SALE',3,'Sale INV-2026-00003','admin',DATE_SUB(NOW(), INTERVAL 4 DAY)),
(2,'MEDIUM','SALE',    -40,7,'SALE',3,'Sale INV-2026-00003','admin',DATE_SUB(NOW(), INTERVAL 4 DAY)),
(2,'LARGE', 'SALE',    -20,8,'SALE',3,'Sale INV-2026-00003','admin',DATE_SUB(NOW(), INTERVAL 4 DAY)),
(2,'SMALL', 'DAMAGED',  -3,6,NULL,NULL,'Crushed during offloading','admin',DATE_SUB(NOW(), INTERVAL 3 DAY)),
(2,'MEDIUM','RETURN',    2,7,'RETURN',1,'Vendor return - good condition','admin',DATE_SUB(NOW(), INTERVAL 3 DAY)),
(4,'SMALL', 'PURCHASE', 80,15,'PURCHASE',5,'Stock received','admin',DATE_SUB(NOW(), INTERVAL 3 DAY)),
(4,'MEDIUM','PURCHASE', 50,16,'PURCHASE',5,'Stock received (5 rejected)','admin',DATE_SUB(NOW(), INTERVAL 3 DAY)),
(4,'LARGE', 'PURCHASE', 40,17,'PURCHASE',5,'Stock received','admin',DATE_SUB(NOW(), INTERVAL 3 DAY)),
(3,'SMALL', 'SALE',    -25,9,'SALE',5,'Sale INV-2026-00005','admin',DATE_SUB(NOW(), INTERVAL 2 DAY)),
(3,'LARGE', 'SALE',    -10,11,'SALE',5,'Sale INV-2026-00005','admin',DATE_SUB(NOW(), INTERVAL 2 DAY)),
(5,'MEDIUM','SALE',    -20,12,'SALE',5,'Sale INV-2026-00005','admin',DATE_SUB(NOW(), INTERVAL 2 DAY)),
(4,'MEDIUM','SALE',    -15,16,'SALE',5,'Sale INV-2026-00005','admin',DATE_SUB(NOW(), INTERVAL 2 DAY)),
(4,'SMALL', 'SALE',    -30,15,'SALE',6,'Sale INV-2026-00006','admin',DATE_SUB(NOW(), INTERVAL 1 DAY)),
(4,'LARGE', 'SALE',    -12,17,'SALE',6,'Sale INV-2026-00006','admin',DATE_SUB(NOW(), INTERVAL 1 DAY)),
(5,'LARGE', 'SALE',    -15,13,'SALE',6,'Sale INV-2026-00006','admin',DATE_SUB(NOW(), INTERVAL 1 DAY));

-- Running balance for each movement
UPDATE stock_movements m JOIN (
  SELECT movement_id, SUM(quantity) OVER (PARTITION BY fruit_id, packaging_size ORDER BY created_at, movement_id) AS bal
  FROM stock_movements) x ON x.movement_id = m.movement_id
SET m.balance_after = x.bal;

-- ---------- Expenses ----------
INSERT INTO expenses (category, description, amount, expense_date) VALUES
('TRANSPORT','Hired truck - Free State collection',1800,DATE_SUB(CURDATE(), INTERVAL 30 DAY)),
('PACKAGING','Plastic crates and liners',          1200,DATE_SUB(CURDATE(), INTERVAL 15 DAY)),
('FUEL',     'Diesel for delivery van',             950,DATE_SUB(CURDATE(), INTERVAL 12 DAY)),
('STORAGE',  'Cold room rental',                   2500,DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
('EMPLOYEE', 'Casual loaders wages',               3200,DATE_SUB(CURDATE(), INTERVAL 7 DAY)),
('FUEL',     'Diesel for delivery van',             780,DATE_SUB(CURDATE(), INTERVAL 4 DAY)),
('TRANSPORT','Border transport fee - Limpopo load',1400,DATE_SUB(CURDATE(), INTERVAL 3 DAY)),
('OTHER',    'Phone airtime for orders',            350,DATE_SUB(CURDATE(), INTERVAL 1 DAY));
