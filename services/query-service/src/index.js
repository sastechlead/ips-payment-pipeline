require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { intakePool, validationPool, postingPool, notificationPool } = require('./db');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());
app.use(routes);

async function start() {
  try {
    // Verify all 4 DB connections on startup
    await intakePool.query('SELECT 1');
    console.log('[query-service] Connected to intake_db');

    await validationPool.query('SELECT 1');
    console.log('[query-service] Connected to validation_db');

    await postingPool.query('SELECT 1');
    console.log('[query-service] Connected to posting_db');

    await notificationPool.query('SELECT 1');
    console.log('[query-service] Connected to notification_db');

    app.listen(PORT, () => {
      console.log(`[query-service] Running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[query-service] Startup failed:', err.message);
    process.exit(1);
  }
}

start();
