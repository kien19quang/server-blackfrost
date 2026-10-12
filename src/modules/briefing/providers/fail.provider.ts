import { AiProvider } from './ai.provider';

// AI_PROVIDER=fail: reproduces a generation failure on demand.
export class FailProvider extends AiProvider {
  readonly model = 'fail';

  generate(): Promise<unknown> {
    return Promise.reject(new Error('Simulated provider failure'));
  }
}
