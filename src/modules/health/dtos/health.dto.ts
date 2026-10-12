import { z } from 'zod';

export const healthSchema = z.strictObject({
  status: z.literal('ok'),
  database: z.enum(['up', 'down']),
});
export type HealthDto = z.infer<typeof healthSchema>;
