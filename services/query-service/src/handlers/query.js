const { intakePool, validationPool, postingPool, notificationPool } = require('../db');

// GET /api/tx?status=&from=&to=&page=1&limit=20
async function listTransactions(req, res) {
  try {
    const { status, from, to, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`requested_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`requested_at <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching rows for pagination
    const countResult = await intakePool.query(
      `SELECT COUNT(*) FROM transactions ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Fetch paginated results
    const dataParams = [...params, parseInt(limit), offset];
    const dataResult = await intakePool.query(
      `SELECT txn_id, type, payer_id, payee_id, amount, channel, status, reason_code, requested_at, updated_at
       FROM transactions ${whereClause}
       ORDER BY requested_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    return res.json({
      data: dataResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('[query-service] listTransactions error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch transactions' });
  }
}

// GET /api/tx/:txnId
async function getTransaction(req, res) {
  try {
    const { txnId } = req.params;

    // Fetch transaction from intake_db
    const txnResult = await intakePool.query(
      `SELECT * FROM transactions WHERE txn_id = $1`,
      [txnId]
    );

    if (txnResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Fetch ledger entries from posting_db
    const ledgerResult = await postingPool.query(
      `SELECT * FROM ledger_entries WHERE txn_id = $1 ORDER BY created_at ASC`,
      [txnId]
    );

    // Fetch notifications from notification_db
    const notifResult = await notificationPool.query(
      `SELECT * FROM notifications WHERE txn_id = $1 ORDER BY created_at ASC`,
      [txnId]
    );

    return res.json({
      transaction: txnResult.rows[0],
      ledgerEntries: ledgerResult.rows,
      notifications: notifResult.rows,
    });
  } catch (err) {
    console.error('[query-service] getTransaction error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch transaction' });
  }
}

// GET /api/tx/:txnId/events
async function getTransactionEvents(req, res) {
  try {
    const { txnId } = req.params;

    const result = await validationPool.query(
      `SELECT id, txn_id, event_type, payload_json, created_at
       FROM txn_events
       WHERE txn_id = $1
       ORDER BY created_at ASC`,
      [txnId]
    );

    return res.json({ events: result.rows });
  } catch (err) {
    console.error('[query-service] getTransactionEvents error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
}

module.exports = { listTransactions, getTransaction, getTransactionEvents };
