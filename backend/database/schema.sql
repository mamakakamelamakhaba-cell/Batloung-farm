-- =====================================================================
--  BATLOUNG FARM - FRESH PRODUCE DISTRIBUTION MANAGEMENT SYSTEM
--  PART A : MySQL 8.0+ database design
--  Run:  mysql -u root -p < database/schema.sql
-- =====================================================================
CREATE DATABASE IF NOT EXISTS batloung_farm
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE batloung_farm;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS expenses, sales_returns, payments, sale_batch_allocations, stock_movements,
  stock_batches, stock, sales_details, sales, purchase_details, purchases, fruit_prices,
  vendors, fruits, suppliers, admins;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Administrator accounts (the default admin is created by the app at start-up)
-- ---------------------------------------------------------------------
CREATE TABLE admins (
  admin_id      INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(100) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 1. SUPPLIERS
-- ---------------------------------------------------------------------
CREATE TABLE suppliers (
  supplier_id    INT AUTO_INCREMENT PRIMARY KEY,
  business_name  VARCHAR(150) NOT NULL UNIQUE,
  contact_person VARCHAR(100) NOT NULL,
  phone          VARCHAR(20)  NOT NULL,
  province       ENUM('Gauteng','Free State','KwaZulu-Natal','Western Cape','Eastern Cape',
                      'Limpopo','Mpumalanga','North West') NOT NULL,
  address        VARCHAR(255) NOT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_supplier_phone CHECK (CHAR_LENGTH(phone) >= 7)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. FRUITS
-- ---------------------------------------------------------------------
CREATE TABLE fruits (
  fruit_id        INT AUTO_INCREMENT PRIMARY KEY,
  fruit_name      VARCHAR(60) NOT NULL UNIQUE,
  description     VARCHAR(255),
  status          ENUM('AVAILABLE','UNAVAILABLE') NOT NULL DEFAULT 'AVAILABLE',
  shelf_life_days INT NOT NULL DEFAULT 7,          -- used to calculate batch expiry dates
  CONSTRAINT chk_shelf_life CHECK (shelf_life_days > 0)
) ENGINE=InnoDB;

-- Each packaging size has its OWN selling price
CREATE TABLE fruit_prices (
  price_id       INT AUTO_INCREMENT PRIMARY KEY,
  fruit_id       INT NOT NULL,
  packaging_size ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
  selling_price  DECIMAL(10,2) NOT NULL,
  UNIQUE KEY uq_price (fruit_id, packaging_size),
  CONSTRAINT chk_selling_price CHECK (selling_price > 0),
  CONSTRAINT fk_price_fruit FOREIGN KEY (fruit_id) REFERENCES fruits(fruit_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. VENDORS
-- ---------------------------------------------------------------------
CREATE TABLE vendors (
  vendor_id         INT AUTO_INCREMENT PRIMARY KEY,
  vendor_name       VARCHAR(120) NOT NULL,
  phone_number      VARCHAR(20)  NOT NULL UNIQUE,
  location          VARCHAR(150) NOT NULL,
  registration_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  credit_limit      DECIMAL(12,2) NOT NULL DEFAULT 0,   -- max unpaid balance allowed
  CONSTRAINT chk_credit_limit CHECK (credit_limit >= 0),
  CONSTRAINT chk_vendor_phone CHECK (CHAR_LENGTH(phone_number) >= 7),
  INDEX idx_vendor_name (vendor_name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. PURCHASES (stock bought from suppliers)
-- ---------------------------------------------------------------------
CREATE TABLE purchases (
  purchase_id            INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id            INT NOT NULL,
  purchase_date          DATE NOT NULL,
  expected_delivery_date DATE NULL,
  delivery_date          DATE NULL,
  total_amount           DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes                  VARCHAR(255),
  created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_purchase_total CHECK (total_amount >= 0),
  CONSTRAINT fk_purchase_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
  INDEX idx_purchase_date (purchase_date)
) ENGINE=InnoDB;

-- 5. PURCHASE DETAILS (with delivery verification columns)
CREATE TABLE purchase_details (
  purchase_detail_id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id        INT NOT NULL,
  fruit_id           INT NOT NULL,
  packaging_size     ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
  quantity           INT NOT NULL,            -- boxes ACCEPTED (these go into stock)
  unit_cost          DECIMAL(10,2) NOT NULL,
  quantity_ordered   INT NOT NULL,
  quantity_delivered INT NOT NULL,
  quantity_rejected  INT NOT NULL DEFAULT 0,
  rejection_reason   VARCHAR(255),
  expiry_date        DATE NULL,
  CONSTRAINT chk_pd_qty CHECK (quantity >= 0),
  CONSTRAINT chk_pd_cost CHECK (unit_cost > 0),
  CONSTRAINT chk_pd_delivery CHECK (quantity_delivered = quantity + quantity_rejected AND quantity_rejected >= 0),
  CONSTRAINT fk_pd_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(purchase_id) ON DELETE CASCADE,
  CONSTRAINT fk_pd_fruit FOREIGN KEY (fruit_id) REFERENCES fruits(fruit_id),
  INDEX idx_pd_fruit (fruit_id, packaging_size)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. SALES
-- ---------------------------------------------------------------------
CREATE TABLE sales (
  sale_id         INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number  VARCHAR(30) NOT NULL UNIQUE,
  vendor_id       INT NOT NULL,
  sale_date       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_date        DATE NOT NULL,
  payment_method  ENUM('CASH','MOBILE_MONEY','CREDIT') NOT NULL DEFAULT 'CASH',
  payment_status  ENUM('PAID','PARTIALLY_PAID','UNPAID') NOT NULL DEFAULT 'UNPAID',
  total_amount    DECIMAL(12,2) NOT NULL,
  amount_paid     DECIMAL(12,2) NOT NULL DEFAULT 0,   -- payments minus refunds paid out
  returned_amount DECIMAL(12,2) NOT NULL DEFAULT 0,   -- value of goods returned
  notes           VARCHAR(255),
  CONSTRAINT chk_sale_total CHECK (total_amount > 0),
  CONSTRAINT chk_sale_paid CHECK (amount_paid >= 0),
  CONSTRAINT fk_sale_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
  INDEX idx_sale_date (sale_date),
  INDEX idx_sale_status (payment_status)
) ENGINE=InnoDB;

-- 7. SALES DETAILS
CREATE TABLE sales_details (
  sales_detail_id   INT AUTO_INCREMENT PRIMARY KEY,
  sale_id           INT NOT NULL,
  fruit_id          INT NOT NULL,
  packaging_size    ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
  quantity          INT NOT NULL,
  unit_price        DECIMAL(10,2) NOT NULL,
  unit_cost         DECIMAL(10,2) NOT NULL DEFAULT 0,  -- average FIFO cost (for profit tracking)
  returned_quantity INT NOT NULL DEFAULT 0,
  CONSTRAINT chk_sd_qty CHECK (quantity > 0),
  CONSTRAINT chk_sd_price CHECK (unit_price > 0),
  CONSTRAINT chk_sd_returned CHECK (returned_quantity >= 0 AND returned_quantity <= quantity),
  CONSTRAINT fk_sd_sale FOREIGN KEY (sale_id) REFERENCES sales(sale_id) ON DELETE CASCADE,
  CONSTRAINT fk_sd_fruit FOREIGN KEY (fruit_id) REFERENCES fruits(fruit_id),
  INDEX idx_sd_fruit (fruit_id, packaging_size)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. STOCK  (one row per fruit AND packaging size -> separate S / M / L balances)
-- ---------------------------------------------------------------------
CREATE TABLE stock (
  stock_id           INT AUTO_INCREMENT PRIMARY KEY,
  fruit_id           INT NOT NULL,
  packaging_size     ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
  available_quantity INT NOT NULL DEFAULT 0,
  minimum_quantity   INT NOT NULL DEFAULT 10,          -- low-stock threshold
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_stock (fruit_id, packaging_size),
  CONSTRAINT chk_stock_nonneg CHECK (available_quantity >= 0),   -- prevents negative stock
  CONSTRAINT chk_stock_min CHECK (minimum_quantity >= 0),
  CONSTRAINT fk_stock_fruit FOREIGN KEY (fruit_id) REFERENCES fruits(fruit_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- EXTRA TABLES FOR THE ENHANCEMENTS
-- ---------------------------------------------------------------------
-- Batches: every delivery creates a batch with its own cost and expiry (FIFO + spoilage)
CREATE TABLE stock_batches (
  batch_id           INT AUTO_INCREMENT PRIMARY KEY,
  fruit_id           INT NOT NULL,
  packaging_size     ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
  purchase_detail_id INT NULL,
  received_date      DATE NOT NULL,
  expiry_date        DATE NULL,
  quantity_received  INT NOT NULL,
  quantity_remaining INT NOT NULL,
  unit_cost          DECIMAL(10,2) NOT NULL DEFAULT 0,
  source             ENUM('PURCHASE','ADJUSTMENT','OPENING') NOT NULL DEFAULT 'PURCHASE',
  CONSTRAINT chk_batch_qty CHECK (quantity_received > 0 AND quantity_remaining >= 0
                                  AND quantity_remaining <= quantity_received),
  CONSTRAINT fk_batch_fruit FOREIGN KEY (fruit_id) REFERENCES fruits(fruit_id),
  CONSTRAINT fk_batch_pd FOREIGN KEY (purchase_detail_id) REFERENCES purchase_details(purchase_detail_id) ON DELETE SET NULL,
  INDEX idx_batch_fifo (fruit_id, packaging_size, received_date),
  INDEX idx_batch_expiry (expiry_date)
) ENGINE=InnoDB;

-- Which batches supplied each sold line (exact FIFO cost + restoring returns)
CREATE TABLE sale_batch_allocations (
  allocation_id     INT AUTO_INCREMENT PRIMARY KEY,
  sales_detail_id   INT NOT NULL,
  batch_id          INT NOT NULL,
  quantity          INT NOT NULL,
  returned_quantity INT NOT NULL DEFAULT 0,
  restocked_quantity INT NOT NULL DEFAULT 0,
  CONSTRAINT chk_alloc CHECK (quantity > 0 AND returned_quantity <= quantity AND restocked_quantity <= returned_quantity),
  CONSTRAINT fk_alloc_sd FOREIGN KEY (sales_detail_id) REFERENCES sales_details(sales_detail_id) ON DELETE CASCADE,
  CONSTRAINT fk_alloc_batch FOREIGN KEY (batch_id) REFERENCES stock_batches(batch_id)
) ENGINE=InnoDB;

-- Complete stock movement history
CREATE TABLE stock_movements (
  movement_id    INT AUTO_INCREMENT PRIMARY KEY,
  fruit_id       INT NOT NULL,
  packaging_size ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
  movement_type  ENUM('PURCHASE','SALE','ADJUSTMENT','DAMAGED','SPOILED','RETURN','CORRECTION') NOT NULL,
  quantity       INT NOT NULL,                  -- signed: +30 received, -10 sold
  balance_after  INT NOT NULL DEFAULT 0,
  batch_id       INT NULL,
  reference_type VARCHAR(30),
  reference_id   INT,
  reason         VARCHAR(255),
  created_by     VARCHAR(50),
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_move_qty CHECK (quantity <> 0),
  CONSTRAINT fk_move_fruit FOREIGN KEY (fruit_id) REFERENCES fruits(fruit_id),
  INDEX idx_move_lookup (fruit_id, packaging_size, created_at),
  INDEX idx_move_type (movement_type)
) ENGINE=InnoDB;

-- Multiple payments per sale (also used for refunds paid out to vendors)
CREATE TABLE payments (
  payment_id       INT AUTO_INCREMENT PRIMARY KEY,
  sale_id          INT NOT NULL,
  vendor_id        INT NOT NULL,
  amount           DECIMAL(12,2) NOT NULL,
  payment_type     ENUM('PAYMENT','REFUND') NOT NULL DEFAULT 'PAYMENT',
  payment_method   ENUM('CASH','MOBILE_MONEY') NOT NULL,
  reference_number VARCHAR(60),
  payment_date     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes            VARCHAR(255),
  CONSTRAINT chk_pay_amount CHECK (amount > 0),
  CONSTRAINT fk_pay_sale FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
  CONSTRAINT fk_pay_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
  INDEX idx_pay_date (payment_date)
) ENGINE=InnoDB;

-- Vendor returns / refunds
CREATE TABLE sales_returns (
  return_id          INT AUTO_INCREMENT PRIMARY KEY,
  sale_id            INT NOT NULL,
  sales_detail_id    INT NOT NULL,
  quantity           INT NOT NULL,
  reason             VARCHAR(255) NOT NULL,
  restocked_quantity INT NOT NULL DEFAULT 0,      -- how many went back to available stock
  refund_value       DECIMAL(12,2) NOT NULL,
  credit_adjustment  DECIMAL(12,2) NOT NULL DEFAULT 0,  -- deducted from the vendor's balance
  cash_refund        DECIMAL(12,2) NOT NULL DEFAULT 0,  -- paid back to the vendor
  return_date        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_by       VARCHAR(50),
  CONSTRAINT chk_ret_qty CHECK (quantity > 0 AND restocked_quantity <= quantity),
  CONSTRAINT fk_ret_sale FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
  CONSTRAINT fk_ret_detail FOREIGN KEY (sales_detail_id) REFERENCES sales_details(sales_detail_id)
) ENGINE=InnoDB;

-- Operating expenses
CREATE TABLE expenses (
  expense_id   INT AUTO_INCREMENT PRIMARY KEY,
  category     ENUM('TRANSPORT','FUEL','PACKAGING','STORAGE','EMPLOYEE','OTHER') NOT NULL,
  description  VARCHAR(255) NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_expense_amount CHECK (amount > 0),
  INDEX idx_expense_date (expense_date)
) ENGINE=InnoDB;
