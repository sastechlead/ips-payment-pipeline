# IPS Payment Pipeline – Microservices

> Mini IPS-style event-driven transaction pipeline
> Stack: Node.js (Express) · Apache Kafka · PostgreSQL · React

---

## Architecture

```
[Client / React UI]
        │
        ▼
  POST /api/tx/initiate
        │
  [A1 – Intake API] ──► ips.tx.received
                                │
                    [A2 – Validation] ──► ips.tx.validated ──► [A3 – Posting] ──► ips.tx.completed
                                    └──► ips.tx.rejected                     └──► ips.tx.failed
                                                │                                       │
                                                └───────────[A4 – Notification]─────────┘

  [React UI] ◄── read-only ──► [A5 – Query Service] ◄── reads all 4 DBs
```

### Database Isolation (Full Microservice)

| Service | Database | Tables |
|---|---|---|
| A1 – Intake API | `intake_db` | `transactions` |
| A2 – Validation | `validation_db` | `txn_events` |
| A3 – Posting/Ledger | `posting_db` | `wallet_accounts`, `ledger_entries` |
| A4 – Notification | `notification_db` | `notifications` |
| A5 – Query Service | none (read-only across all 4) | — |

> No service reads or writes another service's database. Only Kafka events cross service boundaries.

---

## Folder Structure

```
ips-pipeline/
├── docker-compose.yml
├── db/
│   ├── 00-create-databases.sql
│   ├── 01-intake.sql
│   ├── 02-validation.sql
│   ├── 03-posting.sql
│   └── 04-notification.sql
├── services/
│   ├── intake-api/          (port 3001)
│   ├── validation-service/  (port 3002)
│   ├── posting-service/     (port 3003)
│   ├── notification-service/(port 3004)
│   └── query-service/       (port 3005)
├── react-ui/                (port 3000)
└── README.md
```

---

## Kafka Topics

| Topic | Producer | Consumer |
|---|---|---|
| `ips.tx.received` | A1 Intake API | A2 Validation + A1 (status update) |
| `ips.tx.validated` | A2 Validation | A3 Posting |
| `ips.tx.rejected` | A2 Validation | A4 Notification + A1 (status update) |
| `ips.tx.completed` | A3 Posting | A4 Notification + A1 (status update) |
| `ips.tx.failed` | A3 Posting | A4 Notification + A1 (status update) |

---

## Transaction Status Flow

```
RECEIVED → VALIDATED → COMPLETED
         ↘ REJECTED
                    ↘ FAILED
```

### Status Reason Codes

| Code | Meaning |
|---|---|
| `AMOUNT_INVALID` | Amount is 0 or negative |
| `LIMIT_EXCEEDED` | Amount exceeds 5000 |
| `SELF_TRANSFER` | payerId equals payeeId |
| `INVALID_TYPE` | Type is not P2P or P2M |
| `INSUFFICIENT_FUNDS` | Payer balance too low |
| `SYSTEM_ERROR` | Unexpected processing error |

---

## Setup & Running

### Prerequisites
- Docker & Docker Compose installed
- Ports 3000–3005, 9092 available

### Step 1 — Copy environment files
```bash
cp services/intake-api/.env.example          services/intake-api/.env
cp services/validation-service/.env.example  services/validation-service/.env
cp services/posting-service/.env.example     services/posting-service/.env
cp services/notification-service/.env.example services/notification-service/.env
cp services/query-service/.env.example       services/query-service/.env
```

> .env files are only needed for running services locally without Docker. Docker uses environment variables defined in docker-compose.yml directly.

### Step 2 — Start everything
```bash
cd ips-pipeline
docker-compose up --build
```

> Kafka topics are created automatically by the `kafka-init` container on every startup. No manual steps needed.

---

### Stop everything
```bash
docker-compose down
```

### Reset (wipe DB data)
```bash
docker-compose down -v
```

### Live Event Flow (actual log output)

When a valid transaction is submitted, this is what you see across service logs in real time:

```
intake-api            | [intake-api] Transaction initiated: a3e49729-0e01-4607-8d25-086175e11fd1
validation-service    | [validation-service] Validating txn: a3e49729-0e01-4607-8d25-086175e11fd1
validation-service    | [validation-service] txn a3e49729-0e01-4607-8d25-086175e11fd1 → VALIDATED
posting-service       | [posting-service] Posting txn: a3e49729-0e01-4607-8d25-086175e11fd1 | ACC001 → ACC002 | amount: 500
intake-api            | [intake-api] Status update: txn=a3e49729-0e01-4607-8d25-086175e11fd1 → VALIDATED
posting-service       | [posting-service] txn a3e49729-0e01-4607-8d25-086175e11fd1 → COMPLETED
intake-api            | [intake-api] Status update: txn=a3e49729-0e01-4607-8d25-086175e11fd1 → COMPLETED
notification-service  | [notification-service] Creating notification for txn a3e49729-0e01-4607-8d25-086175e11fd1 → COMPLETED
notification-service  | [notification-service] Notification saved for txn a3e49729-0e01-4607-8d25-086175e11fd1
```

Each service processes independently, communicating only through Kafka events — no direct service-to-service calls.

---

### Verify all services are up
```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
```
All should return `{"status":"ok","service":"..."}`.

---

## Demo Script

### Test 1 — Successful P2P Transaction (COMPLETED)

**Step 1: Initiate transaction**
```bash
curl -X POST http://localhost:3001/api/tx/initiate \
  -H "Content-Type: application/json" \
  -d '{"type":"P2P","payerId":"ACC001","payeeId":"ACC002","amount":500,"channel":"APP"}'
```
Expected response:
```json
{"txnId":"<uuid>","status":"RECEIVED"}
```

**Step 2: Copy the txnId and check final status (wait ~2 seconds)**
```bash
curl http://localhost:3005/api/tx/<txnId>
```
Expected: `"status":"COMPLETED"`

**Step 3: Verify wallet balances**
```bash
docker exec -it postgres psql -U ipsuser -d posting_db \
  -c "SELECT account_id, balance FROM wallet_accounts;"
```
Expected: ACC001 = 9500.00, ACC002 = 5500.00

**Step 4: Verify ledger entries**
```bash
docker exec -it postgres psql -U ipsuser -d posting_db \
  -c "SELECT * FROM ledger_entries ORDER BY created_at DESC LIMIT 2;"
```
Expected: 2 rows — DR for ACC001, CR for ACC002

**Step 5: Verify event timeline**
```bash
curl http://localhost:3005/api/tx/<txnId>/events
```
Expected: `[{"event_type":"VALIDATED",...}]`

**Step 6: Verify notification**
```bash
docker exec -it postgres psql -U ipsuser -d notification_db \
  -c "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 1;"
```
Expected: message contains "COMPLETED successfully"

---

### Test 2 — Self-Transfer (REJECTED)

```bash
curl -X POST http://localhost:3001/api/tx/initiate \
  -H "Content-Type: application/json" \
  -d '{"type":"P2P","payerId":"ACC001","payeeId":"ACC001","amount":100,"channel":"APP"}'
```
Expected response: `{"txnId":"<uuid>","status":"RECEIVED"}`

**Check status after ~2 seconds:**
```bash
curl http://localhost:3005/api/tx/<txnId>
```
Expected: `"status":"REJECTED"`, `"reason_code":"SELF_TRANSFER"`

---

### Test 3 — Insufficient Funds (FAILED)

```bash
curl -X POST http://localhost:3001/api/tx/initiate \
  -H "Content-Type: application/json" \
  -d '{"type":"P2P","payerId":"ACC003","payeeId":"ACC001","amount":500,"channel":"APP"}'
```
ACC003 has balance 100, amount is 500 → posting will fail.

**Check status after ~2 seconds:**
```bash
curl http://localhost:3005/api/tx/<txnId>
```
Expected: `"status":"FAILED"`, `"reason_code":"INSUFFICIENT_FUNDS"`

---

### Test 4 — Amount Limit Exceeded (REJECTED)

```bash
curl -X POST http://localhost:3001/api/tx/initiate \
  -H "Content-Type: application/json" \
  -d '{"type":"P2P","payerId":"ACC001","payeeId":"ACC002","amount":9999,"channel":"USSD"}'
```
Expected: `"status":"REJECTED"`, `"reason_code":"LIMIT_EXCEEDED"`

---

### Test 5 — React UI Walkthrough

1. Open **http://localhost:3000**
2. All transactions appear in the list
3. Filter by `COMPLETED` → only successful transactions shown
4. Filter by date range → narrow results
5. Click any row → detail page opens
6. On COMPLETED detail: see Ledger Entries (DR/CR) + Event Timeline + Notification
7. On REJECTED detail: see reason code + Event Timeline + Notification

---

## Test Accounts (pre-seeded)

| Account | Balance | Use for |
|---|---|---|
| `ACC001` | 10,000 | Successful transactions (payer) |
| `ACC002` | 5,000 | Successful transactions (payer/payee) |
| `ACC003` | 100 | Insufficient funds test |

---

## API Reference

### A1 – Intake API (port 3001)

#### POST /api/tx/initiate
Initiates a new payment transaction.

**Request body:**
```json
{
  "type":     "P2P",
  "payerId":  "ACC001",
  "payeeId":  "ACC002",
  "amount":   500,
  "channel":  "APP"
}
```

**Response (201):**
```json
{
  "txnId":  "uuid-here",
  "status": "RECEIVED"
}
```

**Validation rules (input only — deep validation is done by A2):**
- All fields required
- `type`: must be `P2P` or `P2M`
- `channel`: must be `APP` or `USSD`
- `amount`: must be a positive number

**Sample curl:**
```bash
curl -X POST http://localhost:3001/api/tx/initiate \
  -H "Content-Type: application/json" \
  -d '{"type":"P2P","payerId":"ACC001","payeeId":"ACC002","amount":500,"channel":"APP"}'
```

#### GET /health
```bash
curl http://localhost:3001/health
# {"status":"ok","service":"intake-api"}
```

### A2 – Validation Service (port 3002)

Kafka-only service. No transaction REST API — only a `/health` endpoint.

**Consumes:** `ips.tx.received`
**Produces:** `ips.tx.validated` or `ips.tx.rejected`

**Validation rules (in order):**

| Rule | Fail reason code |
|---|---|
| `amount > 0` | `AMOUNT_INVALID` |
| `amount <= 5000` (configurable via `MAX_AMOUNT_LIMIT`) | `LIMIT_EXCEEDED` |
| `payerId !== payeeId` | `SELF_TRANSFER` |
| `type in [P2P, P2M]` | `INVALID_TYPE` |

**Every processed transaction is recorded in `txn_events` (event timeline).**

#### GET /health
```bash
curl http://localhost:3002/health
# {"status":"ok","service":"validation-service"}
```

---

### A3 – Posting/Ledger Service (port 3003)

Kafka-only service. Performs atomic wallet posting — no partial updates ever.

**Consumes:** `ips.tx.validated`
**Produces:** `ips.tx.completed` or `ips.tx.failed`

**Posting logic (single DB transaction):**
1. `SELECT balance FROM wallet_accounts WHERE account_id = payerId FOR UPDATE` (pessimistic lock)
2. If balance < amount → ROLLBACK → publish `ips.tx.failed` with `INSUFFICIENT_FUNDS`
3. If balance >= amount:
   - `UPDATE` payer balance (debit)
   - `UPDATE` payee balance (credit)
   - `INSERT` ledger entry: DR payer
   - `INSERT` ledger entry: CR payee
   - `COMMIT` → publish `ips.tx.completed`

**On any DB error → ROLLBACK → publish `ips.tx.failed` with `SYSTEM_ERROR`**

#### GET /health
```bash
curl http://localhost:3003/health
# {"status":"ok","service":"posting-service"}
```

---

### A4 – Notification Service (port 3004)

Kafka-only service. End of the pipeline — consumes final outcomes and stores notification records.

**Consumes:** `ips.tx.completed`, `ips.tx.failed`, `ips.tx.rejected`
**Produces:** nothing (end of pipeline)

**Notification messages:**
- COMPLETED: `"Transaction {txnId} COMPLETED successfully."`
- FAILED: `"Transaction {txnId} FAILED: {reasonCode}."`
- REJECTED: `"Transaction {txnId} REJECTED: {reasonCode}."`

**Idempotency:** `ON CONFLICT (txn_id, status) DO NOTHING` — safe against Kafka duplicate delivery.

#### GET /health
```bash
curl http://localhost:3004/health
# {"status":"ok","service":"notification-service"}
```

---

### A5 – Query Service / BFF (port 3005)

Read-only aggregator for the React UI. No Kafka. Reads all 4 databases.

#### GET /api/tx
List transactions with filters and pagination.

| Query param | Type | Description |
|---|---|---|
| `status` | string | Filter by status (RECEIVED, VALIDATED, etc.) |
| `from` | date | Filter by requested_at >= from |
| `to` | date | Filter by requested_at <= to |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20) |

```bash
curl "http://localhost:3005/api/tx?status=COMPLETED&page=1"
curl "http://localhost:3005/api/tx?from=2026-01-01&to=2026-12-31"
```

#### GET /api/tx/:txnId
Transaction detail — combines data from all 4 databases.

```bash
curl http://localhost:3005/api/tx/{txnId}
```

Returns: `{ transaction, ledgerEntries, notifications }`

#### GET /api/tx/:txnId/events
Event timeline for a transaction.

```bash
curl http://localhost:3005/api/tx/{txnId}/events
```

Returns: `{ events: [ { event_type, payload_json, created_at }, ... ] }`

#### GET /health
```bash
curl http://localhost:3005/health
# {"status":"ok","service":"query-service"}
```

---

## React UI (port 3000)

Open in browser: **http://localhost:3000**

### Transaction List page (`/`)
- Filter by status, date from/to
- Click any row to open detail view
- Pagination (20 per page)

### Transaction Detail page (`/tx/:txnId`)
- Full transaction fields
- Event Timeline (ordered list with payload)
- Ledger Entries (DR/CR) — shown only for COMPLETED
- Notifications — shown for all final outcomes

---

## Health Checks

| Service | URL |
|---|---|
| Intake API | http://localhost:3001/health |
| Validation | http://localhost:3002/health |
| Posting | http://localhost:3003/health |
| Notification | http://localhost:3004/health |
| Query Service | http://localhost:3005/health |
