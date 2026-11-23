// Provider-neutral LLM configuration: any OpenAI-compatible endpoint, defaulting to local Ollama.
export const DEFAULTS = {
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3.1',
  apiKey: 'ollama',
};

export function loadConfig(env = process.env, overrides = {}) {
  return {
    baseUrl: (overrides.baseUrl ?? env.CODETOUR_BASE_URL ?? DEFAULTS.baseUrl).replace(/\/+$/, ''),
    model: overrides.model ?? env.CODETOUR_MODEL ?? DEFAULTS.model,
    apiKey: overrides.apiKey ?? env.CODETOUR_API_KEY ?? DEFAULTS.apiKey,
  };
}
