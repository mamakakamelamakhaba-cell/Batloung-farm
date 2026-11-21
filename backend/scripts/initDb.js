/**
 * Creates the database, all tables and the sample data - no MySQL command line needed.
 *   npm run db:init    -> run schema.sql then seed.sql
 *   npm run db:reset   -> same (schema.sql drops and recreates every table)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, multipleStatements: true
    });
    for (const file of ['schema.sql', 'seed.sql']) {
      console.log(`Running ${file} ...`);
      await conn.query(fs.readFileSync(path.join(__dirname, '..', 'database', file), 'utf8'));
    }
    console.log('\nDatabase batloung_farm is ready with sample data.');
    console.log('Next: npm start  ->  http://localhost:' + (process.env.PORT || 3000));
  } catch (err) {
    console.error('\nDatabase setup failed:', err.code || '', err.message);
    console.error('Check DB_HOST, DB_USER and DB_PASSWORD in your .env file and that MySQL 8.0+ is running.');
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
})();
