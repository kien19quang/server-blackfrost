# server-blackfrost

NestJS v12 + MongoDB API for BlackFrost Event Desk. See [AGENTS.md](AGENTS.md) for conventions.

```bash
cp .env.example .env   # needs MongoDB on 127.0.0.1:27017
yarn install
yarn start:dev         # http://localhost:3301/api-docs , GET /health
yarn test              # unit
yarn test:e2e          # e2e (in-memory MongoDB)
```

## Event Desk data, seed and reset

- On startup the app seeds event `E101` (4 members) and feedback `F01`–`F08` **only if missing** (`$setOnInsert`), so restarts never overwrite saved attendance.
- `yarn reset` wipes event + feedback data and re-seeds (needs `MONGODB_URI`). Run it explicitly; it is never triggered automatically.
- `SIMULATE_SAVE_FAILURE=true` makes write endpoints return `503` with `code: EVENT_SAVE_FAILED`.

API (envelope `{ data }`, schemas in Swagger `/api-docs`):

- `GET /events/E101` → event, members, `counts` (computed in code; `notRecorded` ≠ `absent`), `attendanceVersion`.
- `PUT /events/E101/attendance` body `{ members: [{ memberId, attendance }] }` (`attended | absent | not_recorded`); 400 on unknown member/invalid value/duplicates; bumps `attendanceVersion`; returns the updated event.
- `GET /feedback` → `[{ feedbackId, text }]`, read-only.
