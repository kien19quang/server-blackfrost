import { aiBriefingSchema } from './modules/briefing/dtos/briefing.dto';
import { OpenAiProvider } from './modules/briefing/providers/openai.provider';
import { countAttendance } from './modules/events/services/event.service';
import { SEED_EVENT, SEED_FEEDBACK } from './modules/events/services/seed.service';

// `yarn check:ai`: one real model call on the seed data (needs AI_MODEL + a key in .env, no DB).
// Prints the schema-validated briefing and any feedback IDs the model invented.
async function main() {
  const model = process.env.AI_MODEL || 'gpt-5.4-mini';
  const provider = new OpenAiProvider(process.env.AI_API_KEY || undefined, model);
  const raw = await provider.generate({
    eventName: SEED_EVENT.name,
    venue: SEED_EVENT.venue,
    members: SEED_EVENT.members,
    counts: countAttendance(SEED_EVENT.members),
    feedback: SEED_FEEDBACK,
  });
  const briefing = aiBriefingSchema.parse(raw);
  const known = new Set(SEED_FEEDBACK.map((f) => f.feedbackId));
  const cited = [...briefing.themes, ...briefing.conflicts, ...briefing.followUps].flatMap((i) => i.feedbackIds);
  const unverified = cited.filter((id) => !known.has(id));
  process.stdout.write(`${JSON.stringify({ model, briefing, unverified }, null, 2)}\n`);
}
main().catch((error: unknown) => {
  process.stderr.write(`check:ai failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
