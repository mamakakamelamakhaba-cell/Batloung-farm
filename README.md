# 🍊 Batloung Farm - Fresh Produce Distribution Management System

A web-based system for **Batloung Farm (Maseru, Lesotho)** that replaces notebooks and spreadsheets.
The administrator manages suppliers, fruits, vendors, purchases, sales and stock - with every box counted
**separately for small, medium and large packaging**.

**Stack:** **React 18 (Vite)** front-end, Node.js + Express.js REST API, MySQL 8 (`mysql2`), PDFKit for invoices.

---

## 1. What is included

### Everything in the assignment brief
| Brief requirement | Where it is |
|---|---|
| 8 tables (Suppliers, Fruits, Vendors, Purchases, Purchase details, Sales, Sales details, Stock) | `backend/database/schema.sql` |
| Separate S/M/L stock; separate price per size | `stock` (one row per fruit **and** size), `fruit_prices` |
| PK / FK / NOT NULL / UNIQUE / CHECK / referential integrity | `backend/database/schema.sql` |
| Realistic sample data in all tables | `backend/database/seed.sql` |
| Folders for config, routes, controllers, models, middleware | `backend/config/`, `backend/src/routes`, `backend/src/controllers`, `backend/src/models`, `backend/src/middleware` |
| mysql2 + `.env` (no hard-coded passwords) | `backend/config/db.js`, `.env` |
| async/await + try/catch, app never crashes if MySQL is down | `backend/src/utils/helpers.js` (`asyncHandler`), `backend/src/middleware/errorHandler.js`, `backend/server.js` (retry loop) |
| Supplier CRUD (delete blocked if purchases exist) | `/api/suppliers` |
| Fruit register/list/update, stock per size, low stock | `/api/fruits`, `/api/stock`, `/api/stock/low` |
| Vendor register/list/search (name or phone)/update | `/api/vendors` |
| Purchase: many items, auto total, stock increased | `POST /api/purchases` |
| Sale: many items, auto total, stock reduced, reject if not enough stock (whole sale cancelled) | `POST /api/sales` |
| HTTP codes 200 / 201 / 400 / 404 / 500 (+ 401, 409, 503) | `backend/src/middleware/errorHandler.js` |
| Sales calculation, stock logic, no negative stock | `backend/src/models/saleModel.js`, `stockModel.js`, `CHECK (available_quantity >= 0)` |
| 4 required SQL reports | `backend/database/reports.sql` and `/api/reports/*` |
| Transactions with BEGIN / COMMIT / ROLLBACK + demo of a failing item | `backend/config/db.js` (`withTransaction`), `backend/database/transactions_demo.sql`, `npm run demo:transactions` |
| Cash / Mobile money / Credit; PAID / PARTIALLY_PAID / UNPAID; outstanding balance | `backend/src/models/paymentModel.js`, `saleModel.js` |

### Every improvement you asked for
| # | Improvement | How it works |
|---|---|---|
| 1.1 | Low-stock alerts | Each stock row has a `minimum_quantity`. Status = **NORMAL / LOW / CRITICAL** (critical = at or below half the minimum). Shown on the dashboard. |
| 1.2 | Stock movement history | Table `stock_movements`: purchases, sales, adjustments, damaged, spoiled, returns, corrections, with a running balance. |
| 1.3 | Expiry, spoilage, FIFO | Every delivery is a **batch** (`stock_batches`) with received + expiry date. Sales use the **oldest batch first** and never sell expired boxes. Near-expiry and expired alerts; one click writes expired stock off as SPOILED. |
| 2.1 | Vendor credit limits | `vendors.credit_limit`. A sale that would push the unpaid balance over the limit is rejected (400 `CREDIT_LIMIT_EXCEEDED`). |
| 2.2 | Vendor profile | `/vendors/:id/profile`: details, totals, purchase + payment history, favourite fruits. |
| 2.3 | Invoices / receipts | Automatic invoice number, on-screen invoice, **PDF download**, print. |
| 2.4 | Returns & refunds | Linked to the original sale, with reason, restock decision, refund split into balance credit + cash refund. |
| 2.5 | Vendor statements | Previous balance, new purchases, payments, returns, current balance - printable. |
| 3.1 | Supplier performance | Deliveries, late deliveries, damaged deliveries, rejected boxes, average cost, rating. |
| 3.3 | Purchase cost tracking | Previous vs current cost per fruit and size (SQL `LAG()` window function). |
| 3.4 | Delivery verification | Ordered / delivered / accepted / rejected per line. Only accepted boxes enter stock and are charged. |
| 4.1 | Profit tracking | Gross profit = revenue - FIFO cost of goods sold, by fruit, packaging size, fruit+size, sale or date range. |
| 4.2 | Expenses | Transport, fuel, packaging, storage, employee, other. |
| 4.3 | Multiple payments per sale | Table `payments`; each payment recorded separately. |
| 4.4 | Payment reminders | Outstanding and overdue vendors, last payment date, ready-to-send SMS text. |
| 5.1 | Dashboard | Sales today/month, purchases, stock value, vendors, outstanding, low-stock, top fruits, recent activity. |
| 5.2 | Date-range reports | Today / this week / this month / previous month / year / custom on every report. |
| 5.3 | Sales trends | Daily / weekly / monthly line chart with highest and lowest periods. |
| 5.4 | Fruit demand | FAST / STEADY / SLOW, days of stock left, purchasing suggestion. |
| 6.3 | Search, filter, pagination | Suppliers (name, province), vendors (name/phone), sales (invoice, status, date), purchases (supplier, date), stock (fruit, size, status), all lists paged. |

---

## 2. What you need installed
1. **Node.js 18 or newer** - https://nodejs.org (check: `node -v`)
2. **MySQL 8.0 or newer** (MySQL Community Server, XAMPP's MariaDB will **not** work because the system uses CHECK constraints and window functions). Check: `mysql --version`
3. A code editor (VS Code) and optionally Postman / Thunder Client.

---

## 3. Step-by-step: from zero to a running system

### Step 1 - Open the project
Unzip `batloung-farm.zip`. Inside `batloung-farm` there are two folders: **`backend`** (Node.js API, database scripts, `.env`) and **`frontend`** (the React app).

### Step 2 - Install the packages (two folders, two installs)
```bash
cd batloung-farm/backend
npm install          # express, mysql2, dotenv, cors, pdfkit

cd ../frontend
npm install          # react, react-dom, vite
```

### Step 3 - Configure the environment file
A `.env` file already exists in `backend/`. Open it and set **your own MySQL password**:
```
DB_USER=root
DB_PASSWORD=your_mysql_password_here      <- change this
DB_NAME=batloung_farm
```
Also change `JWT_SECRET` to any long random text. **Never share or commit `.env`** (it is already in `.gitignore`). `.env.example` is the safe template to share.

### Step 4 - Create the database, tables and sample data
Pick **one** option:

**Option A (easiest):**
```bash
npm run db:init
```
**Option B (MySQL command line):**
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p batloung_farm < database/seed.sql   # (run from the backend folder)
```
**Option C (MySQL Workbench):** open `backend/database/schema.sql`, run it (lightning icon), then open `seed.sql` and run it.

You can re-run this at any time to reset all data.

### Step 5 - Start the system (choose ONE way)

**Way A - Development (two terminals, hot reload):**
```bash
# terminal 1
cd batloung-farm/backend
npm start                  # API on http://localhost:3000

# terminal 2
cd batloung-farm/frontend
npm run dev                # React app on http://localhost:5173
```
Open **http://localhost:5173**. Vite forwards every `/api` call to the backend automatically.

**Way B - Single server (production style):**
```bash
cd batloung-farm/frontend
npm run build              # creates frontend/dist
cd ../backend
npm start
```
Open **http://localhost:3000** - Express serves the built React app and the API together.

In the backend terminal you should see `[DB] Connected to MySQL database: batloung_farm`. If MySQL is not running the server **stays alive**, prints a clear message and retries every 10 seconds.

### Step 6 - Open the website and log in
You will see the animated orchard home page. Click **Admin login** and sign in:

| Username | Password |
|---|---|
| `admin` | Set in backend/.env |

(Change these in `backend/.env` **before the first start**; the admin account is created from them. To change later, run `npm run db:init` again.)

### Step 7 - Take the tour (a good order for a demonstration)
1. **Dashboard** - alerts for low stock (Mangoes Large is CRITICAL), near-expiry bananas, expired apples, overdue payments, charts.
2. **Fruits & prices** - each fruit shows three different prices and three stock levels. Register a new fruit (status is **Available** or **Unavailable**).
3. **Suppliers** - register one, search by name, filter by province. Try deleting *Highveld Orchards* (blocked: it has purchases). Open the **Performance** tab.
4. **Purchases → Record purchase** - add two fruit lines, enter ordered 100 / delivered 100 / rejected 5. The total uses accepted boxes only. Check **Stock → Movement history** to see `+95`. Open **Cost tracking**.
5. **Vendors** - search by phone, open a **Profile**, press **Statement**.
6. **Sales → New sale** - choose a vendor, add several fruits. The total, stock and credit check update live. Complete it, then download the **PDF invoice**.
7. **Try to break it** - sell more boxes than exist (e.g. 500 Mangoes Large). The whole sale is rejected and stock is unchanged. Try a credit sale larger than the vendor's available credit.
8. **Payments** - add a second payment to a part-paid invoice; look at **Overdue reminders**.
9. **Returns** - open an invoice → **Return items**. Watch the balance and stock change.
10. **Stock → Batches & expiry** - write off expired stock. Record a damaged box under **Record damage / adjustment**.
11. **Expenses**, then **Reports** - profit by fruit, trends, demand analysis, top fruits, top vendor.

### Step 8 - Demonstrate the transactions (for the marker)
```bash
npm run demo:transactions
```
It prints stock before and after: a 3-item sale where the 3rd item has too little stock is **rolled back completely**, a purchase containing a non-existent fruit is rolled back (the valid first item is *not* added), and a valid sale is **committed**.
The same idea in raw SQL is in `backend/database/transactions_demo.sql` (run it block by block in MySQL Workbench).

### Step 9 - Run the SQL reports
```bash
mysql -u root -p batloung_farm < database/reports.sql
```
The four required queries (top 5 fruits, revenue in a date range, top vendor by boxes, stock per fruit and size) come first. Edit the dates in query 2 as needed.

### Step 10 - Test the API (optional)
Open `backend/docs/api-examples.http` in VS Code (REST Client extension), Thunder Client or Postman.
1. Send **Login**, copy the `token`.
2. Add header `Authorization: Bearer <token>` to every other request.
3. To test without tokens, set `AUTH_ENABLED=false` in `.env` and restart (turn it back on afterwards).

---

## 4. Project structure
```
batloung-farm/
├── README.md                      # this guide
├── backend/                       # Node.js + Express + MySQL
│   ├── server.js                  # entry point (keeps running if MySQL is down; serves frontend/dist if built)
│   ├── package.json
│   ├── .env / .env.example        # credentials & settings (never hard-coded)
│   ├── config/db.js               # MySQL pool, paging helper, BEGIN/COMMIT/ROLLBACK helper
│   ├── database/
│   │   ├── schema.sql             # Part A: 8 required tables + enhancement tables
│   │   ├── seed.sql               # consistent sample data
│   │   ├── reports.sql            # Part D: SQL reporting queries
│   │   └── transactions_demo.sql  # Part D: transaction demonstration
│   ├── src/
│   │   ├── routes/index.js        # all URLs
│   │   ├── controllers/           # read request -> validate -> call model -> send response
│   │   ├── models/                # all SQL + business logic + transactions
│   │   ├── middleware/            # auth, validation, error handling
│   │   └── utils/                 # helpers, security, PDF invoice, constants
│   ├── scripts/                   # initDb.js, transactionDemo.js
│   └── docs/api-examples.http
└── frontend/                      # React 18 + Vite
    ├── package.json, vite.config.js, index.html
    └── src/
        ├── main.jsx               # React entry point
        ├── App.jsx                # layout, sidebar, login, page routing
        ├── api.js                 # fetch client for the backend API
        ├── context.jsx            # Toast + Auth providers, hash router hook
        ├── utils.js               # money/date formatting, print helper
        ├── styles.css             # orchard theme + animations
        ├── components/            # ui.jsx (Modal, FormModal, Table, Tabs, charts...), SaleModal, VendorPaymentForm
        └── pages/                 # Home, Dashboard, Suppliers, Fruits, Stock, Vendors, VendorProfile,
                                   # Purchases, Sales, Payments, Returns, Expenses, Reports
```
**React concepts used:** function components, `useState` / `useEffect` / `useMemo` / `useRef` hooks, Context API (auth + toasts), custom hooks (`useAsync`, `useDebounced`, `useHashRoute`), controlled forms, lists with keys, conditional rendering and portals for dialogs.

## 5. Database design
```
suppliers 1──* purchases 1──* purchase_details *──1 fruits 1──* fruit_prices   (price per S/M/L)
                                    │                 │
                                    └──► stock_batches ◄── sale_batch_allocations ◄── sales_details *──1 fruits
fruits 1──* stock (fruit_id + packaging_size UNIQUE = separate S/M/L balances)
vendors 1──* sales 1──* sales_details ;  sales 1──* payments ;  sales 1──* sales_returns
stock_movements (history) ; expenses ; admins
```
* **Stock is per fruit and per packaging size** (`UNIQUE (fruit_id, packaging_size)`), so Apples-Small, Apples-Medium and Apples-Large are tracked independently.
* `stock.available_quantity` always equals the sum of that fruit/size's batch balances; `CHECK (available_quantity >= 0)` is the final safety net against negative stock.
* `sales.amount_paid`, `returned_amount` and `payment_status` are recalculated from the `payments` and `sales_returns` tables after every change, so they cannot drift.

## 6. Business rules to remember
* **Selling prices** come from the price list - the administrator never types a total. Each fruit's three prices must differ.
* **Sale** (one transaction): lock vendor → price each line → total → credit-limit check → FIFO deduction → save lines → save payment → status. Any failure rolls back everything.
* **Payment status**: nothing paid = `UNPAID`; some paid = `PARTIALLY_PAID`; paid ≥ amount due = `PAID`. A `CREDIT` sale starts `UNPAID`.
* **Credit limit**: `outstanding + new unpaid amount ≤ credit_limit`, otherwise rejected.
* **Overdue**: unpaid balance on an invoice whose due date (default sale date + 14 days) has passed.
* **Return refund** = boxes × the invoice unit price. First it **reduces what the vendor still owes**; any remainder (already paid) is **refunded in cash/mobile money**. Boxes return to stock only if marked "good condition" and the batch has not expired.
* **Delivery verification**: `delivered = accepted + rejected`. Only accepted boxes create stock and cost.
* **Gross profit** = revenue (after returns) − cost of goods sold (actual batch cost, FIFO). It is **not** net profit; operating expenses are shown separately.
* **Stock status**: `CRITICAL` if available ≤ ½ × minimum, `LOW` if below minimum, otherwise `NORMAL`.

## 7. API reference (all under `/api`, JSON, `Authorization: Bearer <token>` except login/health)
| Area | Endpoints |
|---|---|
| Auth / system | `POST /auth/login`, `GET /auth/me`, `GET /health`, `GET /meta`, `GET /dashboard` |
| Suppliers | `GET/POST /suppliers` (`?search=&province=&page=&limit=`), `GET/PUT/DELETE /suppliers/:id`, `GET /suppliers/performance`, `GET /suppliers/:id/performance` |
| Fruits | `GET/POST /fruits`, `GET /fruits/available`, `GET/PUT /fruits/:id`, `GET/PUT /fruits/:id/prices` |
| Stock | `GET /stock` (`?fruit_id=&packaging_size=&status=`), `GET /stock/low`, `GET /stock/fruit/:fruitId`, `PUT /stock/minimum`, `GET /stock/movements`, `GET /stock/batches`, `GET /stock/expiry`, `POST /stock/adjustments`, `POST /stock/expired/write-off` |
| Vendors | `GET/POST /vendors` (`?search=` name or phone), `GET /vendors/search?q=`, `GET/PUT /vendors/:id`, `GET /vendors/:id/profile`, `GET /vendors/:id/statement`, `POST /vendors/:id/payments` |
| Purchases | `GET/POST /purchases` (`?supplier_id=&from=&to=`), `GET /purchases/:id`, `GET /purchases/cost-trends` |
| Sales | `GET/POST /sales` (`?search=&payment_status=&vendor_id=&from=&to=`), `GET /sales/:id`, `GET /sales/:id/invoice`, `GET /sales/:id/invoice.pdf`, `GET/POST /sales/:id/payments` |
| Payments | `GET /payments`, `GET /payments/outstanding`, `GET /payments/overdue` |
| Returns | `GET/POST /returns` |
| Expenses | `GET/POST /expenses`, `GET /expenses/summary`, `GET/PUT/DELETE /expenses/:id` |
| Reports | `/reports/top-fruits`, `/revenue`, `/top-vendor`, `/stock-levels`, `/profit?group_by=`, `/sales-trend?granularity=`, `/fruit-demand`, `/overdue-payments`, `/dashboard` |

Date filters accept `?period=today\|week\|month\|last_month\|year` or `?from=YYYY-MM-DD&to=YYYY-MM-DD`.
Lists return `{ success, data, pagination }`. Errors return `{ success:false, status, message, details? }`.

**Status codes:** `200` OK · `201` created · `400` invalid input / not enough stock / credit limit · `401` not logged in · `404` not found · `409` conflict (duplicate, supplier has purchases) · `500` unexpected error · `503` database unavailable.

### Sample request - multi-item purchase
```json
POST /api/purchases
{ "supplier_id": 1, "items": [
  { "fruit_id": 1, "packaging_size": "LARGE", "unit_cost": 150, "quantity_ordered": 100, "quantity_delivered": 100, "quantity_rejected": 5 },
  { "fruit_id": 5, "packaging_size": "SMALL", "unit_cost": 85, "quantity": 40 } ] }
```
### Sample request - multi-item sale
```json
POST /api/sales
{ "vendor_id": 1, "payment_method": "CASH", "items": [
  { "fruit_id": 1, "packaging_size": "MEDIUM", "quantity": 2 },
  { "fruit_id": 5, "packaging_size": "LARGE",  "quantity": 3 } ] }
```
`payment_method`: `CASH`, `MOBILE_MONEY` (optional `amount_paid` for a part payment) or `CREDIT`.
Not enough stock → `400 { "message": "Insufficient stock for Mangoes (LARGE): requested 500, available 28.", "details": { "code": "INSUFFICIENT_STOCK", ... } }` and **nothing is saved**.

## 8. Troubleshooting
| Problem | Fix |
|---|---|
| `Access denied for user` | Wrong `DB_USER` / `DB_PASSWORD` in `.env`. |
| `ECONNREFUSED` / 503 "database unavailable" | MySQL is not running. Start it; the server reconnects automatically. |
| `Unknown database` / `Table doesn't exist` | Run `npm run db:init`. |
| `You have an error in your SQL syntax ... CHECK / OVER` | MySQL older than 8.0.16. Install MySQL 8. |
| Port 3000 in use | Change `PORT` in `.env`. |
| Login fails after changing `.env` password | The admin is created once. Run `npm run db:init` to recreate it. |
| PDF will not open | Allow pop-ups; the PDF opens in a new tab. |
| Google Fonts missing offline | Harmless - fallback fonts are used. |
| `vite: command not found` | Run `npm install` inside the **frontend** folder first. |
| Page loads but every call says "Cannot reach the server" | Start the backend (`npm start` in `backend`). In dev mode open http://localhost:5173, not :3000. |
| http://localhost:3000 shows "frontend has not been built" | Run `npm run build` in `frontend`, or use dev mode (Way A). |

## 9. Marking-scheme checklist
- [x] React front-end (Vite) with components, hooks and API calls to the Express backend
- [x] Database `batloung_farm`, 8 required tables + extra tables, PK/FK, NOT NULL/UNIQUE/CHECK, sample data in every table, separate stock per packaging size
- [x] Node project, folders (config, routes, controllers, models, middleware), mysql2, `.env`, async/await + try/catch, no crash on DB failure
- [x] Supplier, fruit/stock, vendor, purchase and sales APIs, validation and correct status codes
- [x] Automatic totals, stock up/down, no negative stock, 4 SQL reports, transactions with COMMIT/ROLLBACK and a failing-item demonstration
- [x] Cash / mobile money / credit, PAID / PARTIALLY_PAID / UNPAID, outstanding balance per vendor
