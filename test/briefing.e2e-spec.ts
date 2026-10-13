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
  themes: (IItem & { kind: string })[];
  conflicts: IItem[];
  followUps: IItem[];
  model: string;
  generatedAt: string;
  editedByHuman: boolean;
}
interface IState {
  current: IBriefing | null;
  draft: IBriefing | null;
  stale: boolean;
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
// Merge body that keeps nothing but the chosen overview: tests override the sections they care about.
const pickNone = (overview: 'current' | 'draft') => ({
  overview,
  themes: { current: [], draft: [] },
  conflicts: { current: [], draft: [] },
  followUps: { current: [], draft: [] },
});
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
      .send({ updates: [{ memberId: 'M03', status: 'attended' }] })
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
    expect(data(res)).toEqual({ current: null, draft: null, stale: false });
  });

  it('first generate writes current with the model name', async () => {
    const res = await generate().expect(201);
    const { current, draft, stale } = data(res);
    expect(draft).toBeNull();
    expect(stale).toBe(false);
    expect(current).toMatchObject({
      overview: 'first',
      model: 'scripted',
      editedByHuman: false,
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
    expect(data(await http().get('/briefing'))).toMatchObject({ stale: true });

    scripted.next = content('second');
    const res = data(await generate().expect(201));
    expect(res.current?.overview).toBe('first');
    expect(res.draft?.overview).toBe('second');
    expect(res.stale).toBe(true);
  });

  it('is not stale when an attendance save changes nothing', async () => {
    await generate().expect(201);
    await http()
      .put('/events/E101/attendance')
      .send({ updates: [{ memberId: 'M01', status: 'attended' }] })
      .expect(200);
    expect(data(await http().get('/briefing'))).toMatchObject({ stale: false });
  });

  it('is not stale once attendance is changed back to what the briefing was generated from', async () => {
    const setM03 = (status: string) =>
      http()
        .put('/events/E101/attendance')
        .send({ updates: [{ memberId: 'M03', status }] })
        .expect(200);
    await generate().expect(201);
    await setM03('attended');
    expect(data(await http().get('/briefing')).stale).toBe(true);
    await setM03('not_recorded');
    expect(data(await http().get('/briefing'))).toMatchObject({ stale: false });
  });

  it('is stale when two members swap statuses, even though the counts are unchanged', async () => {
    await generate().expect(201);
    await http()
      .put('/events/E101/attendance')
      .send({
        updates: [
          { memberId: 'M01', status: 'absent' },
          { memberId: 'M02', status: 'attended' },
        ],
      })
      .expect(200);
    const state = data(await http().get('/briefing'));
    expect(state.stale).toBe(true);
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

  it.each([
    ['a reply missing conflicts', { overview: 'x', themes: [], followUps: [] }],
    ['a theme without a kind', { ...content('x'), themes: [{ text: 'T', feedbackIds: ['F01'] }] }],
    ['a non-object reply', 'not json'],
  ])('generate returns 502 on %s and writes nothing', async (_, reply) => {
    scripted.next = reply;
    const res = await generate().expect(502);
    expect(code(res)).toBe('BRIEFING_GENERATION_FAILED');
    expect(data(await http().get('/briefing')).current).toBeNull();
  });

  it('draft/replace makes the draft current (not human-edited) and clears it', async () => {
    await generate().expect(201);
    await http().put('/briefing').send(content('edited')).expect(200);
    await attend();
    scripted.next = content('second');
    await generate().expect(201);
    const res = data(await http().post('/briefing/draft/replace').expect(201));
    expect(res.current).toMatchObject({ overview: 'second', editedByHuman: false });
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

  describe('draft/merge (coordinator picks items from both versions)', () => {
    const two = (overview: string, prefix: string) => ({
      overview,
      themes: [
        { text: `${prefix} theme A`, kind: 'opinion', feedbackIds: ['F01'] },
        { text: `${prefix} theme B`, kind: 'suggestion', feedbackIds: ['F03'] },
      ],
      conflicts: [{ text: `${prefix} conflict`, feedbackIds: ['F03', 'F04'] }],
      followUps: [{ text: `${prefix} follow-up`, feedbackIds: ['F05'] }],
    });
    const withDraft = async () => {
      scripted.next = two('old overview', 'old');
      await generate().expect(201);
      await attend();
      scripted.next = two('new overview', 'new');
      await generate().expect(201);
    };
    const merge = (body: object) => http().post('/briefing/draft/merge').send(body);

    it('keeps picked current items first, then picked draft items, and clears the draft', async () => {
      await withDraft();
      const res = data(
        await merge({
          overview: 'draft',
          themes: { current: [1], draft: [0] },
          conflicts: { current: [], draft: [0] },
          followUps: { current: [0], draft: [] },
        }).expect(201),
      );
      expect(res.draft).toBeNull();
      expect(res.current?.overview).toBe('new overview');
      expect(res.current?.themes.map((i) => i.text)).toEqual(['old theme B', 'new theme A']);
      expect(res.current?.themes.map((i) => i.kind)).toEqual(['suggestion', 'opinion']);
      expect(res.current?.conflicts.map((i) => i.text)).toEqual(['new conflict']);
      expect(res.current?.followUps.map((i) => i.text)).toEqual(['old follow-up']);
      expect(res.current?.editedByHuman).toBe(true);
    });

    it('stays stale when the old (roster-based) overview is kept, and clears when the new one is taken', async () => {
      await withDraft();
      const keptOld = data(await merge({ ...pickNone('current'), overview: 'current' }).expect(201));
      expect(keptOld.stale).toBe(true);

      scripted.next = two('newer overview', 'newer');
      await generate().expect(201);
      const tookNew = data(await merge({ ...pickNone('current'), overview: 'draft' }).expect(201));
      expect(tookNew.stale).toBe(false);
    });

    it('taking the whole draft is not a human edit (same as replace)', async () => {
      await withDraft();
      const res = data(
        await merge({
          overview: 'draft',
          themes: { current: [], draft: [0, 1] },
          conflicts: { current: [], draft: [0] },
          followUps: { current: [], draft: [0] },
        }).expect(201),
      );
      expect(res.current).toMatchObject({ overview: 'new overview', editedByHuman: false });
    });

    it('rejects out-of-range or duplicate indexes with 400 and changes nothing', async () => {
      await withDraft();
      const bad = [
        { ...pickNone('current'), themes: { current: [5], draft: [] } },
        { ...pickNone('current'), themes: { current: [0, 0], draft: [] } },
        { ...pickNone('current'), followUps: { current: [], draft: [-1] } },
      ];
      for (const body of bad) await merge(body).expect(400);
      expect(code(await merge(bad[0]).expect(400))).toBe('BRIEFING_MERGE_INVALID_INDEX');
      const state = data(await http().get('/briefing'));
      expect(state.current?.overview).toBe('old overview');
      expect(state.draft?.overview).toBe('new overview');
    });

    it('rejects a body that sends content instead of picks (400)', async () => {
      await withDraft();
      await merge({ ...pickNone('current'), themes: [{ text: 'injected', feedbackIds: [] }] }).expect(400);
    });

    it('returns 409 BRIEFING_NO_DRAFT without a draft', async () => {
      await generate().expect(201);
      expect(code(await merge(pickNone('current')).expect(409))).toBe('BRIEFING_NO_DRAFT');
    });
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
      () => http().post('/briefing/draft/merge').send(pickNone('current')),
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
