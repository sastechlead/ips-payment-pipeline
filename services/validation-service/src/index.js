require('dotenv').config();
const express = require('express');
const { pool } = require('./db');
const { producer, consumer } = require('./kafka');
const { startValidationConsumer } = require('./handlers/validate');

const app = express();
const PORT = process.env.PORT || 3002;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'validation-service' });
});

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('[validation-service] Connected to validation_db');

    await producer.connect();
    console.log('[validation-service] Kafka producer connected');

    await startValidationConsumer();
    console.log('[validation-service] Validation consumer started');

    app.listen(PORT, () => {
      console.log(`[validation-service] Running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[validation-service] Startup failed:', err.message);
    process.exit(1);
  }
}

start();
