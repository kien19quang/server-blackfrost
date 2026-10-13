import type { AttendanceStatus, IAttendanceCounts } from '../../events/types/event.type';

export enum ThemeKind {
  Fact = 'fact',
  Opinion = 'opinion',
  Suggestion = 'suggestion',
}

export interface IBriefingItem {
  text: string;
  feedbackIds: string[];
}

export interface IBriefingTheme extends IBriefingItem {
  kind: ThemeKind;
}

// What the model returns (after Zod validation) and what a coordinator edit contains.
export interface IBriefingContent {
  overview: string;
  themes: IBriefingTheme[];
  conflicts: IBriefingItem[];
  followUps: IBriefingItem[];
}

// Persisted shape: `unverifiedFeedbackIds` is computed on read, never stored.
export interface IStoredBriefing extends IBriefingContent {
  attendanceSnapshot: IAttendanceCounts;
  // Each member's status at generation time; stale compares against it. Internal, not returned by the API.
  // Missing on briefings saved before it existed: those fall back to attendanceVersion.
  rosterSnapshot?: Record<string, AttendanceStatus>;
  model: string;
  generatedAt: Date;
  attendanceVersion: number;
  editedByHuman: boolean;
  updatedAt: Date;
}

export interface IBriefingPromptInput {
  eventName: string;
  venue: string;
  members: { memberId: string; name: string; attendance: string }[];
  counts: IAttendanceCounts;
  feedback: { feedbackId: string; text: string }[];
}
