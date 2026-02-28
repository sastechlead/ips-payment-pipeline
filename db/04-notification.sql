\connect notification_db

CREATE TABLE notifications (
  id          SERIAL        PRIMARY KEY,
  txn_id      VARCHAR(36)   NOT NULL,
  user_id     VARCHAR(50)   NOT NULL,
  message     VARCHAR(500)  NOT NULL,
  status      VARCHAR(20)   NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (txn_id, status)
);

CREATE INDEX idx_notifications_txn_id ON notifications(txn_id);
