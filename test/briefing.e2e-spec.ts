import request from 'supertest';
import { AiProvider } from '../src/modules/briefing/providers/ai.provider';
import { FailProvider } from '../src/modules/briefing/providers/fail.provider';
import { MockProvider } from '../src/modules/briefing/providers/mock.provider';
import { BriefingService } from '../src/modules/briefing/services/briefing.service';
import { SeedService } from '../src/modules/events/services/seed.service';
import { createTestApp, type ITestApp } from './utils/test-app';

interface IItem {
  text: string;
  feedbackIds: string[];
  unverifiedFeedbackIds: string[];
}
interface IBriefing {
  overview: string;
  attendanceSnapshot: { registered: number; attended: number; absent: number; notRecorded: number };
  themes: (IItem & { kind: string })[];
  conflicts: IItem[];
  followUps: IItem[];
  model: string;
  generatedAt: string;
  attendanceVersion: number;
  editedByHuman: boolean;
}
interface IState {
  current: IBriefing | null;
  draft: IBriefing | null;
  stale: boolean;
  attendanceVersion: number;
}
const data = (r: request.Response) => (r.body as { data: IState }).data;
const code = (r: request.Response) => (r.body as { code?: string }).code;

// Returns whatever the test sets in `next`; an Error is thrown like a provider failure.
class ScriptedProvider extends AiProvider {
  readonly model = 'scripted';
  next: unknown = {};
  generate(): Promise<unknown> {
    return this.next instanceof Error ? Promise.reject(this.next) : Promise.resolve(this.next);
  }
}
const content = (overview: string, feedbackIds: string[] = ['F01']) => ({
  overview,
  themes: [{ text: 'Theme', kind: 'opinion', feedbackIds }],
  conflicts: [{ text: 'Conflict', feedbackIds }],
  followUps: [],
});

describe('Briefing (e2e)', () => {
  let t: ITestApp;
  const scripted = new ScriptedProvider();
  const http = () => request(t.app.getHttpServer());
  const generate = () => http().post('/briefing/generate');
  const attend = () =>
    http()
      .put('/events/E101/attendance')
      .send({ members: [{ memberId: 'M03', attendance: 'attended' }] })
      .expect(200);

  beforeAll(async () => {
    t = await createTestApp({}, (b) => b.overrideProvider(AiProvider).useValue(scripted));
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    delete process.env.SIMULATE_SAVE_FAILURE;
    scripted.next = content('first');
    await t.app.get(BriefingService).reset();
    await t.app.get(SeedService).reset();
  });

  it('GET /briefing is empty before the first generate', async () => {
    const res = await http().get('/briefing').expect(200);
    expect(data(res)).toEqual({ current: null, draft: null, stale: false, attendanceVersion: 0 });
  });

  it('first generate writes current with code-computed snapshot and model name', async () => {
    const res = await generate().expect(201);
    const { current, draft, stale } = data(res);
    expect(draft).toBeNull();
    expect(stale).toBe(false);
    expect(current).toMatchObject({
      overview: 'first',
      model: 'scripted',
      attendanceVersion: 0,
      editedByHuman: false,
      attendanceSnapshot: { registered: 4, attended: 1, absent: 2, notRecorded: 1 },
    });
    expect(current?.themes[0]).toMatchObject({ kind: 'opinion', feedbackIds: ['F01'], unverifiedFeedbackIds: [] });
    expect(data(await http().get('/briefing')).current?.overview).toBe('first');
  });

  it('flags invented feedback IDs (F09) as unverified but keeps verified ones', async () => {
    scripted.next = content('x', ['F01', 'F09']);
    const { current } = data(await generate().expect(201));
    expect(current?.themes[0].feedbackIds).toEqual(['F01', 'F09']);
    expect(current?.themes[0].unverifiedFeedbackIds).toEqual(['F09']);
    expect(current?.conflicts[0].unverifiedFeedbackIds).toEqual(['F09']);
  });

  it.each([
    ['provider error', new Error('boom')],
    ['JSON with the wrong shape', { overview: 'x', themes: 'nope' }],
    ['unknown theme kind', { ...content('x'), themes: [{ text: 't', kind: 'plan', feedbackIds: [] }] }],
    ['empty overview', content('')],
  ])('generate returns 502 on %s and keeps the existing briefing', async (_name, next) => {
    await generate().expect(201);
    scripted.next = next;
    const res = await generate().expect(502);
    expect(code(res)).toBe('BRIEFING_GENERATION_FAILED');
    const state = data(await http().get('/briefing'));
    expect(state.current?.overview).toBe('first');
    expect(state.draft).toBeNull();
  });

  it('is stale after attendance changes, and generate then goes to the draft only', async () => {
    await generate().expect(201);
    await attend();
    expect(data(await http().get('/briefing'))).toMatchObject({ stale: true, attendanceVersion: 1 });

    scripted.next = content('second');
    const res = data(await generate().expect(201));
    expect(res.current?.overview).toBe('first');
    expect(res.current?.attendanceVersion).toBe(0);
    expect(res.draft).toMatchObject({
      overview: 'second',
      attendanceVersion: 1,
      attendanceSnapshot: { attended: 2, notRecorded: 0 },
    });
    expect(res.stale).toBe(true);
  });

  it('generating again overwrites the draft, never current', async () => {
    await generate().expect(201);
    scripted.next = content('d1');
    await generate().expect(201);
    scripted.next = content('d2');
    const res = data(await generate().expect(201));
    expect(res.current?.overview).toBe('first');
    expect(res.draft?.overview).toBe('d2');
  });

  it('a failed generate keeps the previous draft', async () => {
    await generate().expect(201);
    scripted.next = content('d1');
    await generate().expect(201);
    scripted.next = new Error('boom');
    await generate().expect(502);
    expect(data(await http().get('/briefing')).draft?.overview).toBe('d1');
  });

  it('draft/replace makes the draft current (not human-edited) and clears it', async () => {
    await generate().expect(201);
    await http().put('/briefing').send(content('edited')).expect(200);
    await attend();
    scripted.next = content('second');
    await generate().expect(201);
    const res = data(await http().post('/briefing/draft/replace').expect(201));
    expect(res.current).toMatchObject({ overview: 'second', editedByHuman: false, attendanceVersion: 1 });
    expect(res.draft).toBeNull();
    expect(res.stale).toBe(false);
  });

  it('draft/replace and DELETE draft return 409 BRIEFING_NO_DRAFT without a draft', async () => {
    await generate().expect(201);
    expect(code(await http().post('/briefing/draft/replace').expect(409))).toBe('BRIEFING_NO_DRAFT');
    expect(code(await http().delete('/briefing/draft').expect(409))).toBe('BRIEFING_NO_DRAFT');
  });

  it('DELETE draft discards it and leaves current alone', async () => {
    await generate().expect(201);
    scripted.next = content('second');
    await generate().expect(201);
    const res = data(await http().delete('/briefing/draft').expect(200));
    expect(res.draft).toBeNull();
    expect(res.current?.overview).toBe('first');
  });

  it('PUT saves the coordinator edit: editedByHuman, keeps metadata, flags unknown IDs, leaves draft', async () => {
    const before = data(await generate().expect(201)).current!;
    scripted.next = content('second');
    await generate().expect(201);
    const res = data(
      await http()
        .put('/briefing')
        .send({
          overview: 'My edit',
          themes: [{ text: 'Mine', feedbackIds: ['F02', 'F09'] }],
          conflicts: [],
          followUps: [{ text: 'Ask Bea', feedbackIds: [] }],
        })
        .expect(200),
    );
    expect(res.current).toMatchObject({
      overview: 'My edit',
      editedByHuman: true,
      model: before.model,
      generatedAt: before.generatedAt,
      attendanceVersion: before.attendanceVersion,
    });
    expect(res.current?.themes).toEqual([
      { text: 'Mine', kind: 'fact', feedbackIds: ['F02', 'F09'], unverifiedFeedbackIds: ['F09'] },
    ]);
    expect(res.draft?.overview).toBe('second');
  });

  it('PUT returns 404 BRIEFING_NOT_FOUND before any briefing exists', async () => {
    const res = await http().put('/briefing').send(content('x')).expect(404);
    expect(code(res)).toBe('BRIEFING_NOT_FOUND');
  });

  it.each([
    ['empty text', { ...content('x'), themes: [{ text: '  ', feedbackIds: [] }] }],
    ['bad feedback id format', { ...content('x'), conflicts: [{ text: 'c', feedbackIds: ['X1'] }] }],
    ['empty overview', content('')],
    ['missing field', { overview: 'x', themes: [], conflicts: [] }],
    ['extra field', { ...content('x'), foo: 1 }],
  ])('PUT rejects %s with 400 and saves nothing', async (_name, body) => {
    await generate().expect(201);
    await http().put('/briefing').send(body).expect(400);
    expect(data(await http().get('/briefing')).current?.overview).toBe('first');
  });

  it('SIMULATE_SAVE_FAILURE returns 503 on every write endpoint and writes nothing', async () => {
    await generate().expect(201);
    scripted.next = content('second');
    await generate().expect(201);
    process.env.SIMULATE_SAVE_FAILURE = 'true';
    const calls = [
      () => generate(),
      () => http().post('/briefing/draft/replace'),
      () => http().delete('/briefing/draft'),
      () => http().put('/briefing').send(content('edited')),
    ];
    for (const call of calls) expect(code(await call().expect(503))).toBe('SAVE_FAILED_SIMULATED');
    delete process.env.SIMULATE_SAVE_FAILURE;
    const state = data(await http().get('/briefing'));
    expect(state.current).toMatchObject({ overview: 'first', editedByHuman: false });
    expect(state.draft?.overview).toBe('second');
  });
});

describe('Briefing with AI_PROVIDER=fail / mock (e2e)', () => {
  afterEach(() => {
    delete process.env.SIMULATE_SAVE_FAILURE;
  });

  it('FailProvider makes generate return 502 and creates nothing', async () => {
    const t = await createTestApp({}, (b) => b.overrideProvider(AiProvider).useValue(new FailProvider()));
    const http = () => request(t.app.getHttpServer());
    expect(code(await http().post('/briefing/generate').expect(502))).toBe('BRIEFING_GENERATION_FAILED');
    expect(data(await http().get('/briefing')).current).toBeNull();
    await t.close();
  });

  it('MockProvider output passes the same validation and cites only real feedback', async () => {
    const t = await createTestApp({}, (b) => b.overrideProvider(AiProvider).useValue(new MockProvider()));
    const res = await request(t.app.getHttpServer()).post('/briefing/generate').expect(201);
    const { current } = data(res);
    expect(current?.model).toBe('mock');
    const items = [...current!.themes, ...current!.conflicts, ...current!.followUps];
    expect(items.every((i) => i.unverifiedFeedbackIds.length === 0)).toBe(true);
    await t.close();
  });
});
