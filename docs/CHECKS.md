# Checks — end-to-end demo run

Manual end-to-end run of the demo script against the API contract (BOT-380 `contract` document).

- **Date:** 2026-10-12
- **Stack:** server-blackfrost `main` @ `9d43a8f` on :3301 (MongoDB Atlas from `.env`), web-blackfrost `main` @ `57d57ae` on :3300 (`yarn dev`).
- **Real model:** `AI_PROVIDER=openai`, `AI_MODEL=gpt-5.4-mini`. The key lives only in the server `.env`.
- **Driver:** a Playwright script (Chromium) clicks through the web UI. Each step is cross-checked with `fetch` calls to the API, and a screenshot is saved in [`docs/checks/`](checks/).
- **Provider column:** `real` means the check called the real model, `mock (fail)` means `AI_PROVIDER=fail`, and `n/a` means no model call.

## Automated suites (same commit)

| Repo | Command | Result |
| --- | --- | --- |
| server | `yarn lint` | pass (ESLint + Prettier) |
| server | `yarn typecheck` | pass |
| server | `yarn test` | 2 suites, 7 tests passed |
| server | `yarn test:e2e` | 3 suites, 40 tests passed (`mongodb-memory-server`, provider `mock`/`fail`) |
| web | `yarn lint`, `yarn typecheck` | pass |
| web | `yarn test` | 6 files, 35 tests passed |

The e2e and unit suites never call the real model. Only the manual steps below marked `real` do.

## Demo script

Baseline: `yarn reset` before step 1 gives M01 attended, M02 absent, M03 not_recorded, M04 absent, so counts are 4 / 1 / 2 / 1 and `attendanceVersion` is 0.

| # | Check | Provider | Expected | Actual | Result | Screenshot |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Change Bea (M02) absent → attended in the UI, then Save | n/a | Counts are recomputed in code. not_recorded is not counted as absent. Version +1 | UI and API show 4 registered / 2 attended / 1 absent / 1 not recorded, `attendanceVersion` 0 → 1. The "unsaved changes" banner appears before Save and clears after it | PASS | `01a`, `01b`, `01c` |
| 1b | No-op `PUT /events/E101/attendance` (status already set) | n/a | 200, version unchanged | 200, version stays at 2 | PASS | — |
| 1c | `PUT` with valid M01 plus unknown M99 | n/a | 400 `ATTENDANCE_MEMBER_NOT_FOUND`, nothing written | 400 with that code. M01 is still `attended` and the version is unchanged | PASS | — |
| 1d | `PUT` with `updates: []` or `status: 'present'` | n/a | 400 | 400 for both. **The message is in Vietnamese**, see finding F-1 | PASS* | — |
| 1e | `GET /events/E999` | n/a | 404 `EVENT_NOT_FOUND` | 404 `EVENT_NOT_FOUND` | PASS | — |
| 2 | Generate from the empty state | **real** | Becomes current. Every item cites feedback IDs. F01/F02 and F03/F04 are conflicts, not consensus. `attendanceSnapshot` comes from code | Current is set with `model=gpt-5.4-mini`. 5 themes, 2 conflicts (`[F03,F04]`, `[F01,F02]`) and 4 follow-ups, each with ≥1 ID. `unverifiedFeedbackIds` is empty everywhere. `attendanceSnapshot` = 4/2/1/1 and matches the event. No statement claims agreement on start time or directions | PASS | `02` |
| 3a | Hover / focus / click a feedback ID tag | n/a | The original feedback is shown | QA run: a note modal opened with the text. After the UI change (popover instead of modal) re-checked by hand on 12/10: the popover shows `Feedback F01` and the verbatim text | PASS | `03a` (modal, before the change) |
| 3b | Edit overview in the Edit modal, then Save | n/a | `editedByHuman=true`. `model`, `generatedAt` and `attendanceVersion` are kept | `editedByHuman=true`. `model`, `generatedAt` and `attendanceVersion` (1) are unchanged, and `updatedAt` moved. The "Edited by you" tag appears | PASS | `03b`, `03c` |
| 3c | `PUT /briefing` with feedbackId `X1` / blank item text | n/a | 400 | 400 `feedbackId must look like F01` / 400 `text must not be empty` | PASS | — |
| 3d | `PUT /briefing` citing `F99` (well-formed, does not exist) | n/a | Accepted, flagged unverified, not openable as evidence | 200 with `unverifiedFeedbackIds: ["F99"]`. UI shows a red `F99 · unverified` tag, and it opens no note (no modal before, no popover now) | PASS | `07a0` |
| 4 | Browser refresh, then **server restart** (process killed and started again) | n/a | Attendance and the edited briefing persist | After refresh and after restart, the "QA EDIT:" overview, Edited tag, Bea = attended and counts 4/2/1/1 are all still there | PASS | `04a`, `04b`, `04c` |
| 5 | Change Drew (M04) → attended in the UI | n/a | `stale=true`, the menu shows ⚠ and the Briefing page warns | Menu reads `Briefing ⚠ (stale)` and a warning banner appears on Briefing. API: current v1, event v2, `stale=true` | PASS | `05a`, `05b` |
| 5b | Flip Drew back to absent | n/a | No longer stale: the roster matches the snapshot again | Covered by e2e `is not stale once attendance is changed back…` and `is stale when two members swap statuses…` (swap keeps counts but is stale). Not re-run manually | PASS (e2e) | — |
| 6a | Generate while current exists (stale, human-edited) | **real** | Result is written to the draft only, and current is byte-identical | Draft is shown next to current, with an info banner warning that Replace will overwrite the edits. Current JSON is identical before and after | PASS | `06a` |
| 6b | Discard | n/a | Draft removed, current unchanged | `draft=null`, current is identical | PASS | `06b` |
| 6c | `DELETE /briefing/draft` / `POST /briefing/draft/replace` with no draft | n/a | 409 `BRIEFING_NO_DRAFT` | 409 `BRIEFING_NO_DRAFT` for both | PASS | — |
| 6d | Generate again, then Replace | **real** | Draft becomes current with `editedByHuman=false`, draft cleared, no longer stale | Current `generatedAt` equals the draft's, `editedByHuman=false`, `draft=null`, `stale=false` (v4 = v4). Conflicts are `[F01,F02]` and `[F03,F04]` | PASS | `06c`, `06d` |
| 7a | Server restarted with `AI_PROVIDER=fail`, then click Generate | **mock (fail)** | 502 `BRIEFING_GENERATION_FAILED`, clear UI error, current and draft untouched | 502 with that code and message "Could not generate the briefing. Your current briefing is unchanged." Red banner in the UI. `GET /briefing` is identical before and after | PASS | `07a` |
| 7b | Server restarted with `SIMULATE_SAVE_FAILURE=true`: save attendance, save a briefing edit, Generate | n/a (generate is rejected **before** the model call) | 503 `SAVE_FAILED_SIMULATED` on **every** write endpoint, clear UI error, no data lost | All 6 writes return 503 `SAVE_FAILED_SIMULATED`: attendance change, attendance no-op, generate, replace, discard and briefing PUT. The UI shows red banners, the attendance selection stays selected and the edit-modal text is kept. Event and briefing JSON are identical before and after | PASS | `07b1`, `07b2`, `07b3` |
| 8 | `yarn reset` | n/a | Back to seed | Members are attended/absent/not_recorded/absent, counts 4/1/2/1, version 0, `current=null, draft=null`, 8 feedback notes. UI shows the seed counts and "No briefing yet" | PASS | `08a`, `08b` |

## Findings

| ID | Severity | Where | Finding |
| --- | --- | --- | --- |
| F-1 | Low | server `src/core/shared/validation.pipe.ts:5` | `z.config(z.locales.vi())` makes Zod DTO errors Vietnamese, e.g. `updates: Quá nhỏ: mong đợi array có >=1 phần tử`. This repo requires English API error messages. Custom messages (`feedbackId must look like F01`) are English, but built-in Zod messages are not. |
| F-2 | Low | server `src/modules/events/services/seed.service.ts:12` | Seed sets `status: 'ended'`, but the contract and web `types/event.type.ts` say `'completed'`. The web renders a fixed "Completed" label, so nothing is visible, but the API does not match the contract and the web type. |
| F-3 | Info | web briefing `BriefingView.tsx` | antd 6 logs "`List` is deprecated … use `Listy`" on every Briefing render. The Next dev overlay shows it as "1 Issue". No functional impact. **Fixed 12/10:** `List` replaced by `Table` / `Flex` + `Divider`. |
| F-5 | Low (test gap) | server `briefing.service.ts` `callProvider` | No unit or e2e test feeds the service a provider reply that breaks `aiBriefingSchema` (for example, a missing `conflicts` field or a non-JSON string). The 502 path is only tested with `FailProvider`, which throws. The contract requires 502 for "JSON sai schema". |
| F-4 | Info (model quality) | real model output | The first regenerate draft (6a, later discarded) listed `[F05, F06]` as a conflict. Both notes ask for a longer rest, so this is a false conflict, not false consensus. The required F01/F02 and F03/F04 conflicts appeared in all 3 real generations. The output is non-deterministic, and the editable briefing plus the draft/discard flow is the mitigation. |

## Not checked

- Generate while a **draft** already exists and the provider fails: only checked manually with `draft=null`. The e2e case `a failed generate keeps the previous draft` covers it.
- Model returning JSON that breaks the schema: not reproducible with the real model, and **not covered by tests** either (F-5).
- Concurrent requests (for example, editing during a long generate) and `docker build` were not exercised.
