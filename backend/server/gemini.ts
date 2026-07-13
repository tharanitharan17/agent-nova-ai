import '../load-env.js';
import { llmService, LLMConfigurationError, LLMResponseError } from './llm-service.js';

function getGeminiApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return undefined;
  return key;
}

export const DEFAULT_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite';

export function isGeminiConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

export class GeminiConfigurationError extends LLMConfigurationError {}
export class GeminiResponseError extends LLMResponseError {}
export function parseStructuredResponse<T>(text: string): T {
  try { return JSON.parse(text) as T; }
  catch { throw new GeminiResponseError('Gemini returned invalid JSON. No data was saved.'); }
}

// ─── Export LLM service functions for backward compatibility ─────────────────

export async function generateJSON<T>(
  prompt: string,
  systemInstruction: string,
  schema: unknown,
  options: { temperature?: number } = {}
): Promise<T> {
  const service = await llmService();
  return service.generateJSON<T>(prompt, systemInstruction, schema, options);
}

export async function generateText(
  prompt: string,
  systemInstruction: string,
  options: { temperature?: number } = {}
): Promise<string> {
  const service = await llmService();
  return service.generateText(prompt, systemInstruction, options);
}

if (!isGeminiConfigured() && process.env.LLM_PROVIDER !== 'ollama') {
  console.warn('Gemini is not configured. Add GEMINI_API_KEY to nova/.env for AI features, or set LLM_PROVIDER=ollama to use Ollama.');
}






