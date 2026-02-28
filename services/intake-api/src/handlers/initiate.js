const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const { producer } = require('../kafka');

const ALLOWED_TYPES = ['P2P', 'P2M'];
const ALLOWED_CHANNELS = ['APP', 'USSD'];

async function initiateTransaction(req, res) {
  const { type, payerId, payeeId, amount, channel } = req.body;

  // Validate required fields
  if (!type || !payerId || !payeeId || !amount || !channel) {
    return res.status(400).json({
      error: 'Missing required fields: type, payerId, payeeId, amount, channel',
    });
  }

  if (!ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${ALLOWED_TYPES.join(', ')}` });
  }

  if (!ALLOWED_CHANNELS.includes(channel)) {
    return res.status(400).json({ error: `channel must be one of: ${ALLOWED_CHANNELS.join(', ')}` });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const txnId = uuidv4();
  const requestedAt = new Date();

  try {
    // Persist to intake_db — status starts as RECEIVED
    await pool.query(
      `INSERT INTO transactions (txn_id, type, payer_id, payee_id, amount, channel, status, requested_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'RECEIVED', $7, $7)`,
      [txnId, type, payerId, payeeId, amount, channel, requestedAt]
    );

    // Publish event to Kafka
    await producer.send({
      topic: 'ips.tx.received',
      messages: [
        {
          key: txnId,
          value: JSON.stringify({
            txnId,
            type,
            payerId,
            payeeId,
            amount,
            channel,
            requestedAt: requestedAt.toISOString(),
          }),
        },
      ],
    });

    console.log(`[intake-api] Transaction initiated: ${txnId}`);
    return res.status(201).json({ txnId, status: 'RECEIVED' });
  } catch (err) {
    console.error(`[intake-api] Failed to initiate transaction: ${err.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { initiateTransaction };
