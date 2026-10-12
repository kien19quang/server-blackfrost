import { AttendanceStatus as A } from '../types/event.type';
import { countAttendance } from './event.service';

describe('countAttendance', () => {
  it('counts not_recorded separately from absent', () => {
    const members = [A.Attended, A.Absent, A.NotRecorded, A.Absent].map((attendance) => ({ attendance }));
    expect(countAttendance(members)).toEqual({ registered: 4, attended: 1, absent: 2, notRecorded: 1 });
  });

  it('handles an empty roster', () => {
    expect(countAttendance([])).toEqual({ registered: 0, attended: 0, absent: 0, notRecorded: 0 });
  });
});
