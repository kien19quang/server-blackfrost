import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'ID không hợp lệ')
  .describe('MongoDB ObjectId');
