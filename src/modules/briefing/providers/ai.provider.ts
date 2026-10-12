import type { IBriefingPromptInput } from '../types/briefing.type';

// Small seam so tests and the failure demo never call a real model. Returns raw JSON:
// BriefingService validates it, so every provider gets the same schema check.
export abstract class AiProvider {
  abstract readonly model: string;
  abstract generate(input: IBriefingPromptInput): Promise<unknown>;
}
