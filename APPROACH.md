# How I Approached This Task

## Time Constraint
Completed within a very short turnaround time — planned, built,
tested, and documented end-to-end under a tight deadline.

---

## My Planning Method

### Step 1 — Read the document completely
Before writing a single line of code, I read the entire requirements
document twice. I noted:
- What is explicitly required vs optional
- What is in scope vs out of scope
- What the acceptance criteria are per service
- What the deliverables are

### Step 2 — Design first, code second
I create a full implementation plan before touching any code:
- Defined folder structure upfront
- Decided database ownership per service (strict isolation)
- Mapped all Kafka topics and their producers/consumers
- Identified the Query Service (BFF) need early —
  because 5 separate DBs means the UI cannot query directly
- Decided coding order based on dependencies
  (infrastructure first, UI last)

### Step 3 — Identify risks early
Before coding I flagged potential blockers:
- Port conflicts (postgres 5432 already in use on host)
- Kafka topic pre-creation needed before consumers start
- React UI needs a dedicated aggregator service (A5)
- Atomic DB transaction needs dedicated client, not pool

Identifying these early meant zero surprises during execution.

### Step 4 — Execute phase by phase
Strict phase-based execution:
  Phase 1 → Infrastructure (Docker + DB schemas)
  Phase 2 → A1 Intake API
  Phase 3 → A2 Validation
  Phase 4 → A3 Posting (most complex — done when fresh)
  Phase 5 → A4 Notification (simplest — done last)
  Phase 6 → A5 Query Service (BFF)
  Phase 7 → React UI (all APIs ready before UI starts)
  Phase 8 → README + smoke test

Each phase was tested before moving to the next.
No phase was skipped or rushed.

### Step 5 — Test as you go
- Phase 1: verified all 4 databases and tables created
- Phase 2: verified POST /api/tx/initiate and DB insert
- Phases 3–5: verified end-to-end Kafka flow with live logs
- Phase 7: verified React UI list, filters, detail, timeline

---

## Key Technical Decisions

| Decision | Reason |
|---|---|
| Separate DB per service | True microservice isolation — no shared state |
| Query Service (BFF) | UI needs aggregated data; services cannot cross DB boundaries |
| A1 consumes result events | A1 owns transactions table — only it updates status |
| FOR UPDATE lock in A3 | Prevents race condition on concurrent transactions |
| ON CONFLICT DO NOTHING | Handles Kafka at-least-once delivery idempotently |
| CommonJS over ES Modules | Stability with kafkajs + pg under time constraint |
| Express over NestJS | Faster to scaffold under deadline |

---

## Known Trade-offs (Honest Assessment)

| Gap | Production Fix |
|---|---|
| Kafka topic names hardcoded | Externalize to environment variables |
| No authentication on APIs | Add JWT on intake-api |
| No Kafka ACLs | Add mTLS + ACLs per service |
| No unit tests | Add Jest tests for validation + posting logic |
| Topics pre-created manually | Add Kafka init container in docker-compose |
| Single Kafka broker | Add replication for HA |

---

## What I Would Do With More Time
1. Unit tests for validateTransaction() and postTransaction()
2. OpenAPI/Swagger on each service
3. Kafka topic names as environment variables
4. JWT authentication on intake-api
5. Kafka topic initializer container in docker-compose
6. ES Modules across all services
