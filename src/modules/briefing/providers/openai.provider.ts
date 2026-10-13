import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { aiBriefingSchema } from '../dtos/briefing.dto';
import type { IBriefingPromptInput } from '../types/briefing.type';
import { AiProvider } from './ai.provider';
import { buildUserPrompt, SYSTEM_PROMPT } from './briefing.prompt';

export class OpenAiProvider extends AiProvider {
  private readonly client: OpenAI;

  constructor(
    apiKey: string | undefined,
    readonly model: string,
    // Any OpenAI-compatible API (OpenRouter, Gemini, Ollama…); undefined = api.openai.com.
    baseURL?: string,
  ) {
    super();
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async generate(input: IBriefingPromptInput): Promise<unknown> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      response_format: zodResponseFormat(aiBriefingSchema, 'briefing'),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(input) },
      ],
    });
    // Not parsed here on purpose: a non-JSON reply must surface as a generation error in the service.
    return JSON.parse(res.choices[0]?.message.content ?? '');
  }
}
