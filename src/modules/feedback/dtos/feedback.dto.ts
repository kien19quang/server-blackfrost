import { z } from 'zod';

export const feedbackListSchema = z.array(z.strictObject({ id: z.string().describe('F01–F08'), text: z.string() }));
export type FeedbackListDto = z.infer<typeof feedbackListSchema>;
