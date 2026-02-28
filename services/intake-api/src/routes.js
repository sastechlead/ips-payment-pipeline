const express = require('express');
const { initiateTransaction } = require('./handlers/initiate');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'intake-api' });
});

// Initiate a new transaction
router.post('/api/tx/initiate', initiateTransaction);

module.exports = router;
