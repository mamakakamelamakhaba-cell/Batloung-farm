-- =====================================================================
--  PART D - SQL REPORTING QUERIES   (mysql -u root -p batloung_farm < database/reports.sql)
-- =====================================================================
USE batloung_farm;

-- 1. The five most frequently sold fruits (boxes sold, net of returns)
SELECT f.fruit_name,
       SUM(sd.quantity - sd.returned_quantity) AS boxes_sold,
       COUNT(DISTINCT sd.sale_id)              AS number_of_sales
FROM sales_details sd
JOIN fruits f ON f.fruit_id = sd.fruit_id
GROUP BY f.fruit_id, f.fruit_name
ORDER BY boxes_sold DESC, number_of_sales DESC
LIMIT 5;

-- 2. Total sales revenue in a date range (change the two dates)
SELECT COUNT(*)                                  AS number_of_sales,
       COALESCE(SUM(total_amount),0)             AS total_sales_revenue,
       COALESCE(SUM(returned_amount),0)          AS returns,
       COALESCE(SUM(total_amount - returned_amount),0) AS net_revenue
FROM sales
WHERE sale_date >= '2026-01-01' AND sale_date < DATE_ADD('2026-12-31', INTERVAL 1 DAY);

-- 3. The vendor who has purchased the highest number of boxes
SELECT v.vendor_id, v.vendor_name, SUM(sd.quantity) AS total_boxes
FROM vendors v
JOIN sales s ON s.vendor_id = v.vendor_id
JOIN sales_details sd ON sd.sale_id = s.sale_id
GROUP BY v.vendor_id, v.vendor_name
ORDER BY total_boxes DESC
LIMIT 1;

-- 4. Current stock level for each fruit and packaging size
SELECT f.fruit_name, s.packaging_size, s.available_quantity, s.minimum_quantity,
       CASE WHEN s.available_quantity <= s.minimum_quantity / 2 THEN 'CRITICAL'
            WHEN s.available_quantity <  s.minimum_quantity     THEN 'LOW'
            ELSE 'NORMAL' END AS stock_status
FROM stock s JOIN fruits f ON f.fruit_id = s.fruit_id
ORDER BY f.fruit_name, FIELD(s.packaging_size,'SMALL','MEDIUM','LARGE');

-- ---------------- Bonus reports used by the enhancements ----------------
-- Gross profit per fruit  (revenue - FIFO cost of goods sold)
SELECT f.fruit_name,
       SUM((sd.quantity - sd.returned_quantity) * sd.unit_price) AS revenue,
       SUM(c.cogs) AS cost_of_goods_sold,
       SUM((sd.quantity - sd.returned_quantity) * sd.unit_price) - SUM(c.cogs) AS gross_profit
FROM sales_details sd
JOIN fruits f ON f.fruit_id = sd.fruit_id
JOIN (SELECT a.sales_detail_id, SUM((a.quantity - a.restocked_quantity) * b.unit_cost) AS cogs
      FROM sale_batch_allocations a JOIN stock_batches b ON b.batch_id = a.batch_id
      GROUP BY a.sales_detail_id) c ON c.sales_detail_id = sd.sales_detail_id
GROUP BY f.fruit_id, f.fruit_name;

-- Outstanding balance per vendor
SELECT v.vendor_name, v.credit_limit,
       SUM(s.total_amount - s.returned_amount - s.amount_paid) AS outstanding,
       v.credit_limit - SUM(s.total_amount - s.returned_amount - s.amount_paid) AS available_credit
FROM vendors v JOIN sales s ON s.vendor_id = v.vendor_id
GROUP BY v.vendor_id, v.vendor_name, v.credit_limit
HAVING outstanding > 0;
