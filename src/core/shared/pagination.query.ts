import { z } from 'zod';

// Query strings arrive as text, so numbers are coerced. Feature list queries extend this schema.
export const paginationQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1).describe('Trang, bắt đầu từ 1'),
  limit: z.coerce.number().int().min(1).max(100).default(20).describe('Số bản ghi mỗi trang, tối đa 100'),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
