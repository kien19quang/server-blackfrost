import type { IBriefingPromptInput } from '../types/briefing.type';
import { ThemeKind } from '../types/briefing.type';
import { AiProvider } from './ai.provider';

// Deterministic stand-in for dev/tests: no network, no key.
export class MockProvider extends AiProvider {
  readonly model = 'mock';

  generate({ counts, feedback }: IBriefingPromptInput): Promise<unknown> {
    const ids = new Set(feedback.map((f) => f.feedbackId));
    const only = (...wanted: string[]) => wanted.filter((id) => ids.has(id));
    return Promise.resolve({
      overview: `${counts.attended} of ${counts.registered} attended, ${counts.absent} absent, ${counts.notRecorded} not recorded.`,
      themes: [
        { text: 'Meeting point was hard to find for some.', kind: ThemeKind.Opinion, feedbackIds: only('F01', 'F02') },
        { text: 'A longer rest break was requested.', kind: ThemeKind.Suggestion, feedbackIds: only('F05', 'F06') },
      ],
      conflicts: [{ text: 'Earlier start: one asked, one cannot.', feedbackIds: only('F03', 'F04') }],
      followUps: [{ text: 'Consider whether the final stretch is too long.', feedbackIds: only('F07') }],
    });
  }
}
