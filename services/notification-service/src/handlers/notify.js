const { consumer } = require('../kafka');
const { pool } = require('../db');

const NOTIFICATION_TOPICS = [
  'ips.tx.completed',
  'ips.tx.failed',
  'ips.tx.rejected',
];

const TOPIC_STATUS_MAP = {
  'ips.tx.completed': 'COMPLETED',
  'ips.tx.failed':    'FAILED',
  'ips.tx.rejected':  'REJECTED',
};

function buildMessage(status, txnId, reasonCode) {
  if (status === 'COMPLETED') {
    return `Transaction ${txnId} COMPLETED successfully.`;
  }
  return `Transaction ${txnId} ${status}: ${reasonCode || 'SYSTEM_ERROR'}.`;
}

async function startNotificationConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topics: NOTIFICATION_TOPICS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      let payload;

      // Parse message — skip if malformed
      try {
        payload = JSON.parse(message.value.toString());
      } catch (err) {
        console.error('[notification-service] Failed to parse message:', err.message);
        return;
      }

      const { txnId, payerId, reasonCode } = payload;
      const status = TOPIC_STATUS_MAP[topic];
      const notificationMessage = buildMessage(status, txnId, reasonCode);

      console.log(`[notification-service] Creating notification for txn ${txnId} → ${status}`);

      try {
        // ON CONFLICT DO NOTHING ensures idempotency
        // UNIQUE(txn_id, status) prevents duplicate notifications
        await pool.query(
          `INSERT INTO notifications (txn_id, user_id, message, status, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (txn_id, status) DO NOTHING`,
          [txnId, payerId || 'UNKNOWN', notificationMessage, status]
        );

        console.log(`[notification-service] Notification saved for txn ${txnId}`);
      } catch (err) {
        // Log and continue — do not crash consumer loop
        console.error(`[notification-service] Failed to save notification for txn ${txnId}: ${err.message}`);
      }
    },
  });
}

module.exports = { startNotificationConsumer };
