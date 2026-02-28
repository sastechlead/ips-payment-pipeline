\connect posting_db

CREATE TABLE wallet_accounts (
  account_id  VARCHAR(50)   PRIMARY KEY,
  balance     NUMERIC(15,2) NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE ledger_entries (
  id          SERIAL        PRIMARY KEY,
  txn_id      VARCHAR(36)   NOT NULL,
  account_id  VARCHAR(50)   NOT NULL,
  dr_cr       VARCHAR(2)    NOT NULL CHECK (dr_cr IN ('DR', 'CR')),
  amount      NUMERIC(15,2) NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_txn_id ON ledger_entries(txn_id);
CREATE INDEX idx_ledger_account_id ON ledger_entries(account_id);

-- Seed test accounts
-- ACC001: healthy balance for successful transactions
-- ACC002: healthy balance for successful transactions
-- ACC003: low balance to test INSUFFICIENT_FUNDS failure
INSERT INTO wallet_accounts (account_id, balance) VALUES
  ('ACC001', 10000.00),
  ('ACC002',  5000.00),
  ('ACC003',   100.00);
