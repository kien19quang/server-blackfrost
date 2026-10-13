import { z } from 'zod';
import { ThemeKind } from '../types/briefing.type';

const feedbackIdSchema = z.string().regex(/^F\d{2}$/, 'feedbackId must look like F01');
const textSchema = z.string().trim().min(1, 'text must not be empty');
const itemInputSchema = z.strictObject({ text: textSchema, feedbackIds: z.array(feedbackIdSchema) });
const themeInputSchema = itemInputSchema.extend({ kind: z.enum(ThemeKind).default(ThemeKind.Fact) });

// Model output: also the schema sent to the provider as structured output (all fields required).
export const aiBriefingSchema = z.strictObject({
  overview: textSchema,
  themes: z.array(z.strictObject({ ...itemInputSchema.shape, kind: z.enum(ThemeKind) })),
  conflicts: z.array(itemInputSchema),
  followUps: z.array(itemInputSchema),
});

export const updateBriefingSchema = z.strictObject({
  overview: textSchema,
  themes: z.array(themeInputSchema),
  conflicts: z.array(itemInputSchema),
  followUps: z.array(itemInputSchema),
});
export type UpdateBriefingDto = z.infer<typeof updateBriefingSchema>;

// Merge picks items by index from the stored current and draft; no content is sent, so it cannot be edited this way.
const pickSchema = z.strictObject({
  current: z.array(z.number().int().min(0)).describe('Indexes of current items to keep, in order'),
  draft: z.array(z.number().int().min(0)).describe('Indexes of draft items to take, appended after the kept ones'),
});
export const mergeBriefingSchema = z.strictObject({
  overview: z.enum(['current', 'draft']).describe('Overview is one paragraph: keep one of the two'),
  themes: pickSchema,
  conflicts: pickSchema,
  followUps: pickSchema,
});
export type MergeBriefingDto = z.infer<typeof mergeBriefingSchema>;

const itemSchema = z.strictObject({
  text: z.string(),
  feedbackIds: z.array(z.string()),
  unverifiedFeedbackIds: z.array(z.string()).describe('IDs not in F01–F08: not evidence, computed on read'),
});
const briefingSchema = z.strictObject({
  overview: z.string(),
  themes: z.array(itemSchema.extend({ kind: z.enum(ThemeKind) })),
  conflicts: z.array(itemSchema),
  followUps: z.array(itemSchema),
  model: z.string(),
  generatedAt: z.string().describe('ISO date'),
  editedByHuman: z.boolean(),
  updatedAt: z.string().describe('ISO date'),
});

export const briefingStateSchema = z.strictObject({
  current: briefingSchema.nullable(),
  draft: briefingSchema.nullable(),
  stale: z.boolean().describe('attendance of some member differs from the roster current was generated from'),
});
export type BriefingStateDto = z.infer<typeof briefingStateSchema>;
