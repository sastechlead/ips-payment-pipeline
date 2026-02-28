const { consumer, producer } = require('../kafka');
const { pool } = require('../db');

const ALLOWED_TYPES = ['P2P', 'P2M'];

function validateTransaction(payload) {
  const { type, payerId, payeeId, amount } = payload;
  const maxLimit = parseFloat(process.env.MAX_AMOUNT_LIMIT || '5000');

  if (!amount || amount <= 0) {
    return { valid: false, reasonCode: 'AMOUNT_INVALID', reasonText: 'Amount must be greater than 0' };
  }

  if (amount > maxLimit) {
    return { valid: false, reasonCode: 'LIMIT_EXCEEDED', reasonText: `Amount exceeds maximum limit of ${maxLimit}` };
  }

  if (payerId === payeeId) {
    return { valid: false, reasonCode: 'SELF_TRANSFER', reasonText: 'Payer and payee cannot be the same account' };
  }

  if (!ALLOWED_TYPES.includes(type)) {
    return { valid: false, reasonCode: 'INVALID_TYPE', reasonText: `Transaction type must be one of: ${ALLOWED_TYPES.join(', ')}` };
  }

  return { valid: true };
}

async function saveEvent(txnId, eventType, payloadJson) {
  await pool.query(
    `INSERT INTO txn_events (txn_id, event_type, payload_json, created_at)
     VALUES ($1, $2, $3, NOW())`,
    [txnId, eventType, JSON.stringify(payloadJson)]
  );
}

async function startValidationConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topics: ['ips.tx.received'], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      let payload;

      // Parse message — skip if malformed
      try {
        payload = JSON.parse(message.value.toString());
      } catch (err) {
        console.error('[validation-service] Failed to parse message:', err.message);
        return;
      }

      const { txnId, type, payerId, payeeId, amount, channel, requestedAt } = payload;
      console.log(`[validation-service] Validating txn: ${txnId}`);

      const result = validateTransaction(payload);

      if (result.valid) {
        try {
          // Save VALIDATED event to timeline
          await saveEvent(txnId, 'VALIDATED', { txnId, type, payerId, payeeId, amount, channel });

          // Publish to next stage
          await producer.send({
            topic: 'ips.tx.validated',
            messages: [{
              key: txnId,
              value: JSON.stringify({ txnId, type, payerId, payeeId, amount, channel, requestedAt }),
            }],
          });

          console.log(`[validation-service] txn ${txnId} → VALIDATED`);
        } catch (err) {
          // Log and continue — do not crash consumer loop
          console.error(`[validation-service] Failed to process valid txn ${txnId}: ${err.message}`);
        }
      } else {
        try {
          // Save REJECTED event to timeline
          await saveEvent(txnId, 'REJECTED', {
            txnId,
            reasonCode: result.reasonCode,
            reasonText: result.reasonText,
          });

          // Publish rejection
          await producer.send({
            topic: 'ips.tx.rejected',
            messages: [{
              key: txnId,
              value: JSON.stringify({
                txnId,
                reasonCode: result.reasonCode,
                reasonText: result.reasonText,
              }),
            }],
          });

          console.log(`[validation-service] txn ${txnId} → REJECTED (${result.reasonCode})`);
        } catch (err) {
          // Log and continue — do not crash consumer loop
          console.error(`[validation-service] Failed to process rejected txn ${txnId}: ${err.message}`);
        }
      }
    },
  });
}

module.exports = { startValidationConsumer };
