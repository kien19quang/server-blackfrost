export const EVENT_ID = 'E101';

export enum AttendanceStatus {
  Attended = 'attended',
  Absent = 'absent',
  NotRecorded = 'not_recorded',
}

export interface IAttendanceCounts {
  registered: number;
  attended: number;
  absent: number;
  notRecorded: number;
}
