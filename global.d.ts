// Types for process.env (values in .env, see .env.example). Every value is a string; optional ones have defaults in code.
declare namespace NodeJS {
  export interface ProcessEnv {
    PORT?: string;
    MONGODB_URI: string;
    CORS_ORIGIN?: string;

    // AI briefing
    AI_PROVIDER?: 'openai' | 'mock' | 'fail';
    AI_API_KEY?: string;
    AI_MODEL?: string;
    AI_BASE_URL?: string;

    // Failure demo
    SIMULATE_SAVE_FAILURE?: 'true' | 'false';
  }
}
