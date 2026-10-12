import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import request from 'supertest';
import { EventEntity } from '../src/schemas/event.schema';
import { SeedService } from '../src/modules/events/services/seed.service';
import { createTestApp, type ITestApp } from './utils/test-app';

interface IBody {
  data: {
    attendanceVersion: number;
    counts: { registered: number; attended: number; absent: number; notRecorded: number };
    members: { id: string }[];
  } & { id: string; text: string }[];
  code?: string;
}
const b = (r: request.Response) => r.body as IBody;

describe('Events + Feedback (e2e)', () => {
  let t: ITestApp;
  let seed: SeedService;
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await createTestApp();
    seed = t.app.get(SeedService);
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    delete process.env.SIMULATE_SAVE_FAILURE;
    await seed.reset();
  });

  it('GET /events/E101 returns seed data with counts and version', async () => {
    const res = await http().get('/events/E101').expect(200);
    expect(b(res).data).toMatchObject({
      id: 'E101',
      status: 'completed',
      attendanceVersion: 0,
      counts: { registered: 4, attended: 1, absent: 2, notRecorded: 1 },
    });
    expect(b(res).data.members).toHaveLength(4);
  });

  it('GET /events/E999 returns 404', async () => {
    const res = await http().get('/events/E999').expect(404);
    expect(b(res).code).toBe('EVENT_NOT_FOUND');
  });

  it('PUT attendance saves, recomputes counts, bumps version, persists', async () => {
    const res = await http()
      .put('/events/E101/attendance')
      .send({ updates: [{ memberId: 'M03', status: 'attended' }] })
      .expect(200);
    expect(b(res).data.attendanceVersion).toBe(1);
    expect(b(res).data.counts).toEqual({ registered: 4, attended: 2, absent: 2, notRecorded: 0 });
    const again = await http().get('/events/E101').expect(200);
    expect(b(again).data.counts.attended).toBe(2);
  });

  it.each([
    ['unknown member', { updates: [{ memberId: 'M99', status: 'absent' }] }],
    ['bad status', { updates: [{ memberId: 'M01', status: 'late' }] }],
    ['empty list', { updates: [] }],
    [
      'duplicate member',
      {
        updates: [
          { memberId: 'M01', status: 'absent' },
          { memberId: 'M01', status: 'attended' },
        ],
      },
    ],
    ['extra field', { updates: [{ memberId: 'M01', status: 'absent' }], foo: 1 }],
  ])('PUT attendance rejects %s with 400 and saves nothing', async (_name, body) => {
    const bad = await http().put('/events/E101/attendance').send(body).expect(400);
    if (_name === 'unknown member') expect(b(bad).code).toBe('ATTENDANCE_MEMBER_NOT_FOUND');
    const res = await http().get('/events/E101').expect(200);
    expect(b(res).data.attendanceVersion).toBe(0);
  });

  it('PUT attendance returns 503 SAVE_FAILED_SIMULATED when SIMULATE_SAVE_FAILURE=true and saves nothing', async () => {
    process.env.SIMULATE_SAVE_FAILURE = 'true';
    const res = await http()
      .put('/events/E101/attendance')
      .send({ updates: [{ memberId: 'M01', status: 'absent' }] })
      .expect(503);
    expect(b(res).code).toBe('SAVE_FAILED_SIMULATED');
    delete process.env.SIMULATE_SAVE_FAILURE;
    const after = await http().get('/events/E101').expect(200);
    expect(b(after).data.counts.attended).toBe(1);
  });

  it('PUT attendance with no real change keeps the version', async () => {
    const res = await http()
      .put('/events/E101/attendance')
      .send({ updates: [{ memberId: 'M01', status: 'attended' }] })
      .expect(200);
    expect(b(res).data.attendanceVersion).toBe(0);
  });

  it('PUT attendance bumps the version once per request with several changes', async () => {
    const res = await http()
      .put('/events/E101/attendance')
      .send({
        updates: [
          { memberId: 'M01', status: 'attended' },
          { memberId: 'M03', status: 'absent' },
          { memberId: 'M02', status: 'attended' },
        ],
      })
      .expect(200);
    expect(b(res).data.attendanceVersion).toBe(1);
  });

  it('GET /feedback returns F01–F08 in order', async () => {
    const res = await http().get('/feedback').expect(200);
    expect(b(res).data.map((f: { id: string }) => f.id)).toEqual([
      'F01',
      'F02',
      'F03',
      'F04',
      'F05',
      'F06',
      'F07',
      'F08',
    ]);
    expect(b(res).data[7].text).toBe('No extra suggestions from me.');
  });

  it('seed is idempotent: does not overwrite saved attendance', async () => {
    await http()
      .put('/events/E101/attendance')
      .send({ updates: [{ memberId: 'M01', status: 'absent' }] })
      .expect(200);
    await seed.seed();
    await seed.seed();
    const res = await http().get('/events/E101').expect(200);
    expect(b(res).data.attendanceVersion).toBe(1);
    expect(b(res).data.counts.attended).toBe(0);
    const model = t.app.get<Model<EventEntity>>(getModelToken(EventEntity.name));
    expect(await model.countDocuments()).toBe(1);
    expect(b(await http().get('/feedback')).data).toHaveLength(8);
  });

  it('reset restores the seed state', async () => {
    await http()
      .put('/events/E101/attendance')
      .send({ updates: [{ memberId: 'M01', status: 'absent' }] })
      .expect(200);
    await seed.reset();
    const res = await http().get('/events/E101').expect(200);
    expect(b(res).data.attendanceVersion).toBe(0);
    expect(b(res).data.counts).toEqual({ registered: 4, attended: 1, absent: 2, notRecorded: 1 });
  });
});
