require('dotenv').config();
const express = require('express');
const { pool } = require('./db');
const { consumer } = require('./kafka');
const { startNotificationConsumer } = require('./handlers/notify');

const app = express();
const PORT = process.env.PORT || 3004;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('[notification-service] Connected to notification_db');

    await startNotificationConsumer();
    console.log('[notification-service] Notification consumer started');

    app.listen(PORT, () => {
      console.log(`[notification-service] Running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[notification-service] Startup failed:', err.message);
    process.exit(1);
  }
}

start();
