\connect validation_db

CREATE TABLE txn_events (
  id           SERIAL       PRIMARY KEY,
  txn_id       VARCHAR(36)  NOT NULL,
  event_type   VARCHAR(50)  NOT NULL,
  payload_json JSONB,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_txn_events_txn_id ON txn_events(txn_id);
CREATE INDEX idx_txn_events_created_at ON txn_events(created_at);
