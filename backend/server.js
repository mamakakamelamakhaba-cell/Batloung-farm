/**
 * Batloung Farm Distribution Management System - entry point.
 * The server keeps running even when MySQL is down: it reports 503 for API calls and keeps retrying the connection.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { checkConnection } = require('./config/db');
const routes = require('./src/routes');
const adminModel = require('./src/models/adminModel');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
let dbStatus = { ok: false, error: 'Not checked yet' };

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  const t = Date.now();
  res.on('finish', () => { if (req.originalUrl.startsWith('/api')) console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - t}ms)`); });
  next();
});

app.get('/api/health', async (req, res) => {
  dbStatus = await checkConnection();
  res.status(dbStatus.ok ? 200 : 503).json({ success: dbStatus.ok, server: 'running', database: dbStatus.ok ? 'connected' : `unavailable (${dbStatus.error})` });
});
app.use('/api', routes);
app.use('/api', notFound);
// Serve the built React app (frontend/dist) when it exists. During development use the Vite server on :5173 instead.
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distDir)) app.use(express.static(distDir));
else {
  app.get('/', (req, res) => res.type('html').send('<body style="font-family:sans-serif;padding:40px"><h2>Batloung Farm backend is running</h2><p>The React frontend has not been built yet. Either run <code>npm run dev</code> inside the <b>frontend</b> folder and open <a href="http://localhost:5173">http://localhost:5173</a>, or run <code>npm run build</code> there and refresh this page.</p></body>'));
}
app.use(errorHandler);

// ---- never let a stray error kill the process ----
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason && reason.message ? reason.message : reason));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err.message));

async function connectToDatabase() {
  dbStatus = await checkConnection();
  if (!dbStatus.ok) {
    console.error(`[DB] Cannot connect to MySQL (${dbStatus.error}). The server is still running - retrying in 10 seconds...`);
    setTimeout(connectToDatabase, 10000);
    return;
  }
  console.log('[DB] Connected to MySQL database:', process.env.DB_NAME);
  try {
    await adminModel.ensureDefaultAdmin();
  } catch (err) {
    console.error('[DB] Connected, but could not prepare the admin table. Did you run "npm run db:init"? ->', err.message);
  }
}

app.listen(PORT, () => {
  console.log(`\n  Batloung Farm system running at http://localhost:${PORT}\n`);
  connectToDatabase();
});
