# server-blackfrost

API NestJS v12 (CommonJS) + MongoDB (Mongoose 8) cho **BlackFrost Event Desk** (take-home): một sự kiện seed sẵn `E101`, điểm danh, feedback chỉ đọc `F01`–`F08`, bản briefing do model AI thật sinh từ backend, trích dẫn feedback ID được validate, người dùng sửa được, đánh dấu stale khi điểm danh đổi, tạo lại không bao giờ âm thầm ghi đè chỉnh sửa của người. Một coordinator, **không có auth, không multi-tenant**. Hiện mới là skeleton: chỉ có `GET /health`.

Chạy app: Node ≥ 22.12. **Chạy test/lint/dev: Node ≥ 24.9** (Jest chỉ load được package ESM của Nest v12 trên Node ≥ 24.9).

## Quy định bắt buộc

Đọc trực tiếp `SKILL.md` trong `.agents/skills/` (repo-relative) trước khi code:

- `coding-style` — reuse, không abstraction thừa, đặt tên, không thêm package khi chưa hỏi.
- `design-patterns` — layering, DTO Zod, response envelope, lỗi.

## Cấu trúc repo

- Repo git độc lập, không monorepo. Web là repo riêng `../web-blackfrost`; **không import code xuyên repo**. Kiểu dữ liệu API ở web tự khai báo, khớp DTO của server (Swagger là nguồn chuẩn).
- Task chạm nhiều repo → commit riêng cho từng repo, ghi liên kết chéo.
- Chạy lệnh (install, lint, test, git) bên trong repo này.

## Lệnh

| Lệnh | Việc |
| --- | --- |
| `yarn install` | Cài package (chỉ Yarn 1.22.22, chỉ commit `yarn.lock`) |
| `yarn start:dev` | Chạy dev, watch (cần `.env`, MongoDB đang chạy) |
| `yarn lint` | ESLint (type-checked) + `prettier --check` |
| `yarn format` | Prettier ghi đè `src/`, `test/` |
| `yarn typecheck` | `tsc --noEmit` cho `src/` + `test/` |
| `yarn test` | Unit test Jest (`src/**/*.spec.ts`) |
| `yarn test:e2e` | E2E Jest + supertest + `mongodb-memory-server` (`test/*.e2e-spec.ts`) |
| `yarn build` | `nest build` → `dist/` |
| `yarn ci` | lint → typecheck → test → test:e2e → build (giống `.github/workflows/ci.yml`) |

Lần đầu chạy e2e, `mongodb-memory-server` tải binary MongoDB (~77MB) vào `~/.cache/mongodb-binaries`.

- Swagger UI: `/api-docs`; JSON: `/api-docs-json`.
- `GET /health`: `{ data: { status: 'ok', database: 'up' | 'down' } }`.
- Docker: `docker build -t server-blackfrost .` (image Node 22, cổng 3301).

## Env

Xem `.env.example`; copy thành `.env` (không commit).

| Biến | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `PORT` | không (mặc định `3301`) | Cổng HTTP |
| `MONGODB_URI` | có | Chuỗi kết nối MongoDB, gồm tên DB. Không cần replica set |
| `CORS_ORIGIN` | không | Origin web được gọi API, ngăn cách bằng dấu phẩy (`http://localhost:3300`) |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | chưa dùng | Dành cho briefing AI. **API key chỉ nằm ở `.env` của server**; provider mock chỉ dùng cho dev/test lỗi |

## MongoDB local

```bash
mkdir -p /tmp/blackfrost-mongo
/usr/local/mongodb/bin/mongod --dbpath /tmp/blackfrost-mongo --port 27017 --wiredTigerCacheSizeGB 0.25
```

Hoặc Docker: `docker run -d --name blackfrost-mongo -p 27017:27017 mongo:8`. Tắt mongod/app khi xong.

## Test — làm tính năng phải có test case

Tính năng/bug fix **chưa xong** nếu chưa có test đi kèm, viết cùng commit: `*.spec.ts` cạnh service có nghiệp vụ; e2e (`test/*.e2e-spec.ts`) cho mỗi endpoint mới: happy path, validate DTO lỗi (400), các nhánh lỗi nghiệp vụ.

- Bug fix: viết test tái hiện lỗi trước (fail), sửa xong test pass.
- Không `skip`/`only`, không xóa hay nới assertion để test xanh, không mock thứ đang được test.
- **Giới hạn worker:** Jest `maxWorkers: 2` (trong `package.json`), e2e `--runInBand`. Không chạy `--watch` trong lượt chạy agent; khi sửa chỉ chạy file liên quan, chạy cả bộ trước khi báo xong.
- **Chạy test ở foreground**, đợi kết quả trong cùng lượt; không chạy nền rồi kết thúc lượt. E2e lâu thì đặt timeout dài.
- **RAM:** mongod chạy `--wiredTigerCacheSizeGB 0.25`; Node với `NODE_OPTIONS=--max-old-space-size=1536`. Mỗi lượt tối đa 1 stack riêng; trước khi dựng kiểm `memory_pressure | tail -1` (dưới 25% free thì chờ). Hết lượt tắt mọi tiến trình mình bật (mongod, app), xoá thư mục tạm.
- Báo hoàn thành phải dán kết quả `yarn lint` + `yarn test` (số test pass/fail).

## Ngôn ngữ

Code, tên biến, commit: tiếng Anh. Text hiển thị cho người dùng và message lỗi của API: **tiếng Anh** (project này). Trao đổi/comment nội bộ: tiếng Việt hoặc Anh đều được.

## Git

- Làm trên nhánh `feat/…`/`fix/…`, merge vào `main` local khi xong. **Không `git push`, không tạo PR, không đổi remote.**
- Task chỉ xong khi commit đã vào `main` local.

## Kiểm chứng và bảo mật

- Không tuyên bố "chạy được" nếu chưa chạy; ghi rõ cái gì chưa kiểm.
- Không ghi secret/token vào code, log, comment hay commit. `.env` bị gitignore.
