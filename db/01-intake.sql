\connect intake_db

CREATE TABLE transactions (
  txn_id       VARCHAR(36)  PRIMARY KEY,
  type         VARCHAR(10)  NOT NULL,
  payer_id     VARCHAR(50)  NOT NULL,
  payee_id     VARCHAR(50)  NOT NULL,
  amount       NUMERIC(15,2) NOT NULL,
  channel      VARCHAR(10)  NOT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'RECEIVED',
  reason_code  VARCHAR(50),
  reason_text  VARCHAR(255),
  requested_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_requested_at ON transactions(requested_at);
