import { GoogleGenAI, Type } from '@google/genai';
import { LLMService, LLMConfigurationError, LLMResponseError } from './llm-service.js';

// ─── Gemini Provider Implementation ───────────────────────────────────────────

export class GeminiLLMService implements LLMService {
  private client: GoogleGenAI;
  private model: string;
  
  constructor(model?: string) {
    const apiKey = this.getGeminiApiKey();
    if (!apiKey) {
      throw new LLMConfigurationError('Gemini is not configured. Add GEMINI_API_KEY to the server .env file.');
    }
    
    this.client = new GoogleGenAI({ apiKey });
    this.model = model || process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite';
  }
  
  private getGeminiApiKey(): string | undefined {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key || key === 'MY_GEMINI_API_KEY') return undefined;
    return key;
  }
  
  private safeError(error: unknown): Error {
    const message = error instanceof Error ? error.message : 'Unknown Gemini error';
    console.error('[Gemini]', message.replace(this.getGeminiApiKey() || '', '[redacted]'));
    
    if (/429|rate limit|resource exhausted/i.test(message)) {
      return new LLMResponseError('Gemini is temporarily rate limited. Please try again shortly.');
    }
    if (/timeout|deadline/i.test(message)) {
      return new LLMResponseError('Gemini took too long to respond. Please try again.');
    }
    if (/api key|permission|unauthenticated|403/i.test(message)) {
      return new LLMConfigurationError('Gemini authentication failed. Check GEMINI_API_KEY in the server environment.');
    }
    
    return new LLMResponseError('Gemini could not generate a response. Please try again.');
  }
  
  private async withTimeout<T>(operation: Promise<T>, timeoutMs = 60_000): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<T>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Gemini request timeout')), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.withTimeout(operation());
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : '';
        if (!/429|rate limit|resource exhausted|503|temporar/i.test(message) || attempt === 1) break;
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    throw this.safeError(lastError);
  }
  
  async generateJSON<T>(
    prompt: string,
    systemInstruction: string,
    schema: unknown,
    options: { temperature?: number } = {}
  ): Promise<T> {
    return this.withRetry(async () => {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: options.temperature ?? 0.4,
        },
      });
      
      const text = response.text?.trim();
      if (!text) throw new LLMResponseError('Gemini returned an empty response.');
      
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new LLMResponseError('Gemini returned invalid JSON. No data was saved.');
      }
    });
  }
  
  async generateText(
    prompt: string,
    systemInstruction: string,
    options: { temperature?: number } = {}
  ): Promise<string> {
    return this.withRetry(async () => {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: { systemInstruction, temperature: options.temperature ?? 0.5 },
      });
      
      const text = response.text?.trim();
      if (!text) throw new LLMResponseError('Gemini returned an empty response.');
      return text;
    });
  }
  
  // Agent-specific methods (delegated to generateJSON/generateText)
  async analyzeGoal(goalTitle: string, goalId: string): Promise<any> {
    throw new Error('analyzeGoal should be called through agent-intelligence module');
  }
  
  async createRoadmap(goalTitle: string, subGoals: any[], reasoningAdjustments: string[], goalId: string): Promise<any> {
    throw new Error('createRoadmap should be called through agent-intelligence module');
  }
  
  async generateDailyTasks(goalTitle: string, subGoals: any[], reasoningAdjustments: string[], goalId: string): Promise<any> {
    throw new Error('generateDailyTasks should be called through agent-intelligence module');
  }
}
