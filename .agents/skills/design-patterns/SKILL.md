---
name: design-patterns
description: Kiến trúc NestJS + MongoDB của server-blackfrost — layering, DTO Zod, response envelope, lỗi. Dùng khi thêm module, endpoint, schema hoặc review code.
---

# Design Patterns

Lệch khỏi file này phải ghi lý do trong task.

## Cấu trúc

```
src/
  main.ts, app.module.ts
  core/                 # dùng chung, không chứa nghiệp vụ
    interceptors/       # TransformInterceptor (response envelope)
    exceptions/         # AllExceptionsFilter
    shared/             # validation.pipe, objectIdSchema, paginationQuerySchema
    types/              # interface + enum dùng chung: <name>.type.ts
    utils/
  schemas/              # Mongoose schema: <name>.schema.ts
  modules/<feature>/
    <feature>.module.ts
    controllers/<feature>.controller.ts
    services/<feature>.service.ts
    dtos/<feature>.dto.ts
    types/<feature>.type.ts
```

Không có `models/`, `entities/`, `interfaces/`, `enums/`: schema ở `schemas/`, interface + enum gộp trong `types/`. Module mẫu: `modules/health`.

## Thứ tự method trong controller

GET → POST → PUT → DELETE (PATCH sau PUT). Cùng method: route tĩnh trước route có param, danh sách trước chi tiết.

## Layer

| Layer | Được làm | Không được làm |
| --- | --- | --- |
| Controller | Route, gọi **một** method service, Swagger `@ApiTags` | Query DB, nghiệp vụ, try/catch nuốt lỗi |
| Service | Nghiệp vụ, `@InjectModel` query Mongoose, ném exception Nest | Đọc `req`/`res`, format response |
| DTO | Zod schema trong `dtos/<feature>.dto.ts` + `type XxxDto = z.infer<...>` | Logic, class-validator/class-transformer |
| Schema | `@Schema({ timestamps: true })`, `@Prop`, index, export `XxxDocument` | Method nghiệp vụ |

Service gọi service module khác qua DI (module export), không inject Model của module khác.

`@Prop` kiểu ObjectId viết `type: MongooseSchema.Types.ObjectId` (`import { Schema as MongooseSchema } from 'mongoose'`), không `type: Types.ObjectId`.

## Validate: Zod v4 (Standard Schema của Nest v12)

- Pipe toàn cục đăng ký bằng `APP_PIPE` trong `AppModule` (`core/shared/validation.pipe.ts`, message tiếng Anh mặc định của Zod).
- Gắn schema vào param: `@Body({ schema })`, `@Query({ schema })`, `@Param('id', { schema: objectIdSchema })`; lỗi trả 400.
- Dùng `z.strictObject(...)` (field lạ → 400). Mô tả field bằng `.describe()`; Swagger tự sinh từ schema, không viết `@ApiProperty`.
- Response: `@ApiOkResponse({ standardSchema: xxxSchema })`.

## Response và lỗi

- Controller trả thẳng kết quả; `TransformInterceptor` bọc thành `{ data }`.
- Lỗi dùng exception Nest, không tự chế `{ success: false }`. `AllExceptionsFilter` trả `{ statusCode, message, code? }`, không lộ stack. Cần client phân biệt lỗi: `throw new ConflictException('message', { errorCode: 'XXX_REASON' })` (option `errorCode` của Nest v12), đặt tên `<MODULE>_<LÝ_DO>`.
- Không có auth/phân quyền/multi-tenant trong project này: không thêm guard, `schoolId`, `@Public()`.

## Swagger

UI `/api-docs`, JSON `/api-docs-json` là nguồn chuẩn cho kiểu dữ liệu của `../web-blackfrost`. Đổi DTO/enum phải kiểm Swagger cập nhật và ghi thay đổi trong task.

## Checklist review

- [ ] Đúng layer; controller không có nghiệp vụ; thứ tự method GET → POST → PUT → DELETE.
- [ ] DTO là Zod `z.strictObject`, gắn qua `{ schema }`; không class-validator.
- [ ] Schema trong `schemas/`; interface + enum trong `types/`.
- [ ] Lỗi dùng exception Nest; client cần phân biệt thì có `errorCode`.
- [ ] Có test đi kèm (unit `*.spec.ts` cạnh service, e2e cho endpoint mới).
- [ ] Không package mới chưa duyệt, không `any`/`@ts-ignore`.
- [ ] `yarn lint` + `yarn test` pass; chỉ có `yarn.lock` (Yarn v1).
