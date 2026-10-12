import { z } from 'zod';
import { AttendanceStatus } from '../types/event.type';

const attendanceSchema = z.enum(AttendanceStatus).describe('attended | absent | not_recorded');

export const eventResponseSchema = z.strictObject({
  id: z.string().describe('Always E101'),
  title: z.string(),
  venue: z.string(),
  status: z.string(),
  attendanceVersion: z.number().int().describe('Increases by 1 on every attendance save that changes a status'),
  members: z.array(z.strictObject({ id: z.string(), name: z.string(), attendance: attendanceSchema })),
  counts: z
    .strictObject({
      registered: z.number().int(),
      attended: z.number().int(),
      absent: z.number().int(),
      notRecorded: z.number().int().describe('Not the same as absent'),
    })
    .describe('Computed in code from the saved member records'),
});
export type EventResponseDto = z.infer<typeof eventResponseSchema>;

export const updateAttendanceSchema = z.strictObject({
  updates: z
    .array(z.strictObject({ memberId: z.string().min(1), status: attendanceSchema }))
    .min(1)
    .refine((items) => new Set(items.map((i) => i.memberId)).size === items.length, {
      message: 'Duplicate memberId',
    })
    .describe('Members to update; others keep their status'),
});
export type UpdateAttendanceDto = z.infer<typeof updateAttendanceSchema>;
