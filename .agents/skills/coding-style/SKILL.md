---
name: coding-style
description: Quy tắc code bắt buộc của server-blackfrost. Dùng trước khi viết hoặc sửa bất kỳ dòng code nào.
---

# Coding Style

## Trước khi code

1. Tìm code tương tự trong repo.
2. Đọc implementation hiện tại.
3. Làm theo pattern hiện có. Chưa có thì theo skill `design-patterns`.

## Reuse và abstraction

Ưu tiên: utility → service có sẵn. Không tạo mới nếu đã tồn tại. Không tạo helper, util, base class, interface nếu chỉ dùng một lần.

## Đặt tên

| Loại | Quy ước | Ví dụ |
| --- | --- | --- |
| File | kebab-case + hậu tố vai trò | `event.service.ts`, `event.dto.ts`, `event.schema.ts`, `event.type.ts` |
| Class | PascalCase + hậu tố | `EventService`, `CreateEventDto` |
| Enum / interface | đặt trong `types/<feature>.type.ts` (không `models/`); enum PascalCase, interface `IXxx` | `AttendanceStatus.PRESENT`, `IBriefing` |

Biến/hàm/field camelCase (khớp JSON API và Mongo), hằng số UPPER_SNAKE_CASE, URL kebab-case. Không tự đổi style đặt tên của file đang có.

## Khi sửa code

Sửa trên implementation hiện có; không rewrite khi chỉ sửa một phần; không format lại file ngoài phạm vi.

## Dependency

Không thêm package mới khi chưa hỏi. Cần package mới → dừng, nêu lý do, phiên bản mới nhất (`npm view <pkg> time`), phương án thay thế. Được duyệt thì cài bản mới nhất rồi chạy `yarn audit`. Package `@types/*` đi kèm package đã có thì được cài.

## Tiện ích

Dùng `lodash` (import theo tên: `import { omit } from 'lodash'`); không tự viết lại thứ lodash có sẵn và không bọc lodash bằng helper riêng. Cần xử lý ngày giờ/format dùng chung thì hỏi trước khi thêm thư viện; không rải `toLocaleString`/`Intl` trong service.

## TypeScript

- `strict: true`. Không `any`, không `@ts-ignore`, không `eslint-disable` để vượt lỗi; gặp lỗi kiểu thì sửa kiểu.
- Interface/type dùng trong chữ ký có decorator phải `import type` (TS1272).
- Không để code chết, `console.log` debug, TODO không có task đi kèm.

## Khi không chắc

Tìm trong repo xem đã có implementation tương tự chưa. Vẫn không chắc thì hỏi, không đoán.
