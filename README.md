# server-blackfrost

NestJS v12 + MongoDB API for BlackFrost Event Desk. See [AGENTS.md](AGENTS.md) for conventions.

```bash
cp .env.example .env   # needs MongoDB on 127.0.0.1:27017
yarn install
yarn start:dev         # http://localhost:3301/api-docs
yarn test              # unit
yarn test:e2e          # e2e (in-memory MongoDB)
```

## Event Desk data, seed and reset

- On startup the app seeds event `E101` (4 members) and feedback `F01`–`F08` **only if missing** (`$setOnInsert`), so restarts never overwrite saved attendance.
- `yarn reset` wipes event + feedback data and re-seeds (needs `MONGODB_URI`). Run it explicitly; it is never triggered automatically.
- `SIMULATE_SAVE_FAILURE=true` makes every write endpoint return `503` with `code: SAVE_FAILED_SIMULATED`, before anything is written or the model is called.

API (envelope `{ data }`, errors `{ statusCode, code, message }`, schemas in Swagger `/api-docs`):

- `GET /events/E101` → `id`, `title`, `venue`, `status`, `members [{ id, name, attendance }]`, `counts` (computed in code; `notRecorded` ≠ `absent`). Other IDs → 404 `EVENT_NOT_FOUND`.
- `PUT /events/E101/attendance` body `{ updates: [{ memberId, status }] }` (`attended | absent | not_recorded`). 400 on invalid body, 400 `ATTENDANCE_MEMBER_NOT_FOUND` on an unknown member (nothing written). Writes only if a status actually changed. Returns the updated event.
- `GET /feedback` → `[{ id, text }]`, read-only.

## AI briefing

- `AI_PROVIDER`: `openai` (real model, `AI_MODEL`, key in `AI_API_KEY` or `OPENAI_API_KEY`; `AI_BASE_URL` points it at any OpenAI-compatible API such as OpenRouter), `mock` (deterministic, no network) or `fail` (every generate returns 502 `BRIEFING_GENERATION_FAILED`).
- `GET /briefing` → `{ current, draft, stale }`; each item has `text`, `feedbackIds`, `unverifiedFeedbackIds` (computed on read).
- `POST /briefing/generate`: first time → `current`; afterwards → `draft` only. `POST /briefing/draft/replace` / `DELETE /briefing/draft` apply or discard the whole draft (409 `BRIEFING_NO_DRAFT` without one). `POST /briefing/draft/merge` body `{ overview: 'current'|'draft', themes|conflicts|followUps: { current: number[], draft: number[] } }` builds a new current from the picked items of both stored versions (kept current items first, then draft items) and clears the draft; only indexes are sent, never content (400 `BRIEFING_MERGE_INVALID_INDEX` on a duplicate or out-of-range index). `PUT /briefing` saves the coordinator edit (404 `BRIEFING_NOT_FOUND` before the first generate).
- `yarn check:ai` makes one real model call on the seed data and prints the validated briefing plus any invented feedback IDs.
- `yarn reset` also clears briefings.

Design and trade-offs: [docs/DESIGN.md](docs/DESIGN.md). Demo checks and results: [docs/CHECKS.md](docs/CHECKS.md).
