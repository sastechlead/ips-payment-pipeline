const express = require('express');
const { listTransactions, getTransaction, getTransactionEvents } = require('./handlers/query');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'query-service' });
});

// Transaction list with filters + pagination
router.get('/api/tx', listTransactions);

// Transaction detail (transaction + ledger + notification)
router.get('/api/tx/:txnId', getTransaction);

// Event timeline for a transaction
router.get('/api/tx/:txnId/events', getTransactionEvents);

module.exports = router;
