require('dotenv').config();
const express = require('express');
const { pool } = require('./db');
const { producer, consumer } = require('./kafka');
const { startPostingConsumer } = require('./handlers/post');

const app = express();
const PORT = process.env.PORT || 3003;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'posting-service' });
});

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('[posting-service] Connected to posting_db');

    await producer.connect();
    console.log('[posting-service] Kafka producer connected');

    await startPostingConsumer();
    console.log('[posting-service] Posting consumer started');

    app.listen(PORT, () => {
      console.log(`[posting-service] Running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[posting-service] Startup failed:', err.message);
    process.exit(1);
  }
}

start();
