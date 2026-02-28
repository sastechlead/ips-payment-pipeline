const { Pool } = require('pg');
require('dotenv').config();

// Each pool connects to its own service's database — read-only by convention
const intakePool = new Pool({ connectionString: process.env.INTAKE_DB_URL });
const validationPool = new Pool({ connectionString: process.env.VALIDATION_DB_URL });
const postingPool = new Pool({ connectionString: process.env.POSTING_DB_URL });
const notificationPool = new Pool({ connectionString: process.env.NOTIFICATION_DB_URL });

intakePool.on('error', (err) => console.error('[query-service] intake_db error:', err.message));
validationPool.on('error', (err) => console.error('[query-service] validation_db error:', err.message));
postingPool.on('error', (err) => console.error('[query-service] posting_db error:', err.message));
notificationPool.on('error', (err) => console.error('[query-service] notification_db error:', err.message));

module.exports = { intakePool, validationPool, postingPool, notificationPool };
