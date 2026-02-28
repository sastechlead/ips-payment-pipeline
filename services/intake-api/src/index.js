require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');
const { producer } = require('./kafka');
const { startStatusConsumer } = require('./handlers/status');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(routes);

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('[intake-api] Connected to intake_db');

    await producer.connect();
    console.log('[intake-api] Kafka producer connected');

    await startStatusConsumer();
    console.log('[intake-api] Status consumer started');

    app.listen(PORT, () => {
      console.log(`[intake-api] Running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[intake-api] Startup failed:', err.message);
    process.exit(1);
  }
}

start();
