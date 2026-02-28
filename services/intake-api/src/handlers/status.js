const { consumer } = require('../kafka');
const { pool } = require('../db');

// Topics to subscribe — all result events that change transaction status
const STATUS_TOPICS = [
  'ips.tx.validated',
  'ips.tx.rejected',
  'ips.tx.completed',
  'ips.tx.failed',
];

const TOPIC_STATUS_MAP = {
  'ips.tx.validated': 'VALIDATED',
  'ips.tx.rejected':  'REJECTED',
  'ips.tx.completed': 'COMPLETED',
  'ips.tx.failed':    'FAILED',
};

async function startStatusConsumer() {
  await consumer.connect();

  await consumer.subscribe({ topics: STATUS_TOPICS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      let payload;

      // Parse message — skip if malformed
      try {
        payload = JSON.parse(message.value.toString());
      } catch (err) {
        console.error(`[intake-api] Failed to parse message from ${topic}: ${err.message}`);
        return;
      }

      const { txnId, reasonCode, reasonText } = payload;
      const newStatus = TOPIC_STATUS_MAP[topic];

      console.log(`[intake-api] Status update: txn=${txnId} → ${newStatus}`);

      try {
        await pool.query(
          `UPDATE transactions
           SET status = $1, reason_code = $2, reason_text = $3, updated_at = NOW()
           WHERE txn_id = $4`,
          [newStatus, reasonCode || null, reasonText || null, txnId]
        );
      } catch (err) {
        // Log and continue — do not crash the consumer loop (per requirement)
        console.error(`[intake-api] Failed to update status for txn ${txnId}: ${err.message}`);
      }
    },
  });
}

module.exports = { startStatusConsumer };
