const { consumer, producer } = require('../kafka');
const { pool } = require('../db');

async function postTransaction(txnId, payerId, payeeId, amount) {
  // Get a dedicated client from the pool for the atomic transaction
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock payer row to prevent race conditions (pessimistic locking)
    const { rows } = await client.query(
      `SELECT balance FROM wallet_accounts WHERE account_id = $1 FOR UPDATE`,
      [payerId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, reasonCode: 'SYSTEM_ERROR', reasonText: `Payer account ${payerId} not found` };
    }

    const payerBalance = parseFloat(rows[0].balance);

    if (payerBalance < amount) {
      await client.query('ROLLBACK');
      return {
        success: false,
        reasonCode: 'INSUFFICIENT_FUNDS',
        reasonText: `Payer balance ${payerBalance} is less than transaction amount ${amount}`,
      };
    }

    // Debit payer
    await client.query(
      `UPDATE wallet_accounts SET balance = balance - $1, updated_at = NOW() WHERE account_id = $2`,
      [amount, payerId]
    );

    // Credit payee
    await client.query(
      `UPDATE wallet_accounts SET balance = balance + $1, updated_at = NOW() WHERE account_id = $2`,
      [amount, payeeId]
    );

    // Create ledger entry — DR (debit) for payer
    await client.query(
      `INSERT INTO ledger_entries (txn_id, account_id, dr_cr, amount, created_at)
       VALUES ($1, $2, 'DR', $3, NOW())`,
      [txnId, payerId, amount]
    );

    // Create ledger entry — CR (credit) for payee
    await client.query(
      `INSERT INTO ledger_entries (txn_id, account_id, dr_cr, amount, created_at)
       VALUES ($1, $2, 'CR', $3, NOW())`,
      [txnId, payeeId, amount]
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[posting-service] DB transaction error for txn ${txnId}: ${err.message}`);
    return { success: false, reasonCode: 'SYSTEM_ERROR', reasonText: err.message };
  } finally {
    // Always release client back to pool
    client.release();
  }
}

async function startPostingConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topics: ['ips.tx.validated'], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      let payload;

      // Parse message — skip if malformed
      try {
        payload = JSON.parse(message.value.toString());
      } catch (err) {
        console.error('[posting-service] Failed to parse message:', err.message);
        return;
      }

      const { txnId, payerId, payeeId, amount } = payload;
      console.log(`[posting-service] Posting txn: ${txnId} | ${payerId} → ${payeeId} | amount: ${amount}`);

      const result = await postTransaction(txnId, payerId, payeeId, parseFloat(amount));

      if (result.success) {
        try {
          await producer.send({
            topic: 'ips.tx.completed',
            messages: [{
              key: txnId,
              value: JSON.stringify({ txnId }),
            }],
          });
          console.log(`[posting-service] txn ${txnId} → COMPLETED`);
        } catch (err) {
          // Log and continue — do not crash consumer loop
          console.error(`[posting-service] Failed to publish completed event for txn ${txnId}: ${err.message}`);
        }
      } else {
        try {
          await producer.send({
            topic: 'ips.tx.failed',
            messages: [{
              key: txnId,
              value: JSON.stringify({
                txnId,
                reasonCode: result.reasonCode,
                reasonText: result.reasonText,
              }),
            }],
          });
          console.log(`[posting-service] txn ${txnId} → FAILED (${result.reasonCode})`);
        } catch (err) {
          // Log and continue — do not crash consumer loop
          console.error(`[posting-service] Failed to publish failed event for txn ${txnId}: ${err.message}`);
        }
      }
    },
  });
}

module.exports = { startPostingConsumer };
