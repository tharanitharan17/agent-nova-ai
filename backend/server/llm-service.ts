import '../load-env.js';
import { AsyncLocalStorage } from 'node:async_hooks';

// ─── LLM Service Interface ─────────────────────────────────────────────────────

export interface LLMService {
  generateJSON<T>(
    prompt: string,
    systemInstruction: string,
    schema: unknown,
    options?: { temperature?: number }
  ): Promise<T>;
  
  generateText(
    prompt: string,
    systemInstruction: string,
    options?: { temperature?: number }
  ): Promise<string>;
  
  analyzeGoal(goalTitle: string, goalId: string): Promise<any>;
  createRoadmap(goalTitle: string, subGoals: any[], reasoningAdjustments: string[], goalId: string): Promise<any>;
  generateDailyTasks(goalTitle: string, subGoals: any[], reasoningAdjustments: string[], goalId: string): Promise<any>;
}

export class LLMConfigurationError extends Error {}
export class LLMResponseError extends Error {}

// ─── Provider Factory ─────────────────────────────────────────────────────────

export async function createLLMService(modelOverride?: string): Promise<LLMService> {
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase() || 'gemini';
  const model = modelOverride || process.env.LLM_MODEL?.trim();
  
  console.log(`[LLM Service] Initializing provider: ${provider}${model ? ` with model: ${model}` : ''}`);
  
  switch (provider) {
    case 'ollama':
      return new OllamaLLMService(model || 'deepseek-r1:8b');
    case 'gemini':
      // Import Gemini implementation dynamically to avoid circular dependencies
      const { GeminiLLMService } = await import('./gemini-provider.js');
      return new GeminiLLMService(model);
    default:
      throw new LLMConfigurationError(`Unsupported LLM_PROVIDER "${provider}". Use "ollama" or "gemini".`);
  }
}

// ─── Ollama Implementation ────────────────────────────────────────────────────

class OllamaLLMService implements LLMService {
  private endpoint: string;
  private model: string;
  private timeout: number;
  
  constructor(model: string) {
    this.endpoint = (process.env.OLLAMA_ENDPOINT?.trim() || 'http://localhost:11434').replace(/\/$/, '');
    this.model = model;
    // Local models are slower — allow generous time for generation.
    this.timeout = 120_000;
  }
  
  private errorMessage(error: unknown): string {
    const messages: string[] = [];
    let current: unknown = error;
    while (current && typeof current === 'object') {
      const message = current instanceof Error ? current.message : '';
      if (message) messages.push(message);
      current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined;
    }
    return messages.join(' | ') || 'Unknown Ollama error';
  }

  private async withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs?: number): Promise<T> {
    const actualTimeout = timeoutMs || this.timeout;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), actualTimeout);
    try {
      return await operation(controller.signal);
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Ollama request timeout');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  
  private async withRetry<T>(operation: (signal: AbortSignal) => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        return await this.withTimeout(operation);
      } catch (error) {
        lastError = error;
        const message = this.errorMessage(error);
        
        // Don't retry on certain errors
        if (/connection refused|econnrefused/i.test(message)) {
          throw new LLMConfigurationError('Ollama server is not running. Start Ollama with: ollama serve');
        }
        if (/model not found/i.test(message)) {
          throw new LLMConfigurationError(`Model "${this.model}" not found. Pull it with: ollama pull ${this.model}`);
        }
        
        // Retry on temporary errors
        // A timeout is terminal: retrying would exceed the API's 60-second
        // contract and leave the browser waiting without a useful response.
        if (attempt < maxRetries - 1 && (/temporary|503|429/i.test(message))) {
          const delay = 1000 * Math.pow(2, attempt); // Exponential backoff
          console.log(`[Ollama] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw this.safeError(lastError);
  }
  
  private safeError(error: unknown): Error {
    const message = this.errorMessage(error);
    console.error('[Ollama]', message);
    
    if (/connection refused|econnrefused/i.test(message)) {
      return new LLMConfigurationError('Ollama server is not running. Start Ollama with: ollama serve');
    }
    if (/model not found/i.test(message)) {
      return new LLMConfigurationError(`Model "${this.model}" not found. Pull it with: ollama pull ${this.model}`);
    }
    if (/timeout/i.test(message)) {
      return new LLMResponseError('Ollama took too long to respond. Please try again.');
    }
    
    return new LLMResponseError('Ollama could not generate a response. Please try again.');
  }
  
  private async callOllamaAPI(messages: Array<{ role: string; content: string }>, options: { temperature?: number; format?: string } = {}): Promise<string> {
    return this.withRetry(async signal => {
      const startedAt = Date.now();
      console.info(`[Ollama] Request started model=${this.model} format=${options.format || 'text'}`);
      const response = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          think: false,
          options: {
            temperature: options.temperature ?? 0.5,
          },
          format: options.format === 'json' ? 'json' : undefined,
        }),
        signal,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json() as { message?: { content?: string } };
      const content = data.message?.content;
      
      if (!content) {
        throw new LLMResponseError('Ollama returned an empty response.');
      }
      console.info(`[Ollama] Request completed model=${this.model} durationMs=${Date.now() - startedAt}`);
      
      return content;
    });
  }
  
  async generateJSON<T>(
    prompt: string,
    systemInstruction: string,
    schema: unknown,
    options: { temperature?: number } = {}
  ): Promise<T> {
    const schemaGuide = JSON.stringify(schema);
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: `${systemInstruction}\n\nYou must respond with valid JSON only. No markdown or explanations outside the JSON. Follow this response schema exactly:\n${schemaGuide}` },
      { role: 'user', content: prompt },
    ];
    
    const responseText = await this.callOllamaAPI(messages, { ...options, format: 'json' });
    
    try {
      return JSON.parse(responseText) as T;
    } catch (error) {
      console.error('[Ollama] Failed to parse JSON response:', responseText);
      throw new LLMResponseError('Ollama returned invalid JSON. No data was saved.');
    }
  }
  
  async generateText(
    prompt: string,
    systemInstruction: string,
    options: { temperature?: number } = {}
  ): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt },
    ];
    
    return this.callOllamaAPI(messages, options);
  }
  
  // Agent-specific methods (delegated to generateJSON/generateText)
  async analyzeGoal(goalTitle: string, goalId: string): Promise<any> {
    // This will be implemented by the agent-intelligence module
    // These methods are placeholders for future extensibility
    throw new Error('analyzeGoal should be called through agent-intelligence module');
  }
  
  async createRoadmap(goalTitle: string, subGoals: any[], reasoningAdjustments: string[], goalId: string): Promise<any> {
    throw new Error('createRoadmap should be called through agent-intelligence module');
  }
  
  async generateDailyTasks(goalTitle: string, subGoals: any[], reasoningAdjustments: string[], goalId: string): Promise<any> {
    throw new Error('generateDailyTasks should be called through agent-intelligence module');
  }
}

// ─── Export singleton instance ─────────────────────────────────────────────────

const selectedModel = new AsyncLocalStorage<string | undefined>();
const services = new Map<string, Promise<LLMService>>();
const supportedOllamaModels = new Set(['deepseek-r1:8b', 'qwen2.5:3b', 'qwen2.5:7b', 'qwen3:8b']);

export function withLLMModel<T>(model: string | undefined, operation: () => Promise<T>): Promise<T> {
  const normalized = model?.trim().toLowerCase();
  // If no model specified, just run with default
  if (!normalized) return operation();
  // If model specified but unsupported, run with default anyway (don't reject)
  if (!supportedOllamaModels.has(normalized)) {
    console.warn(`[LLM] Unknown model header "${normalized}", using default.`);
    return operation();
  }
  return selectedModel.run(normalized, operation);
}

export const llmService = async (): Promise<LLMService> => {
  const model = selectedModel.getStore() || process.env.LLM_MODEL?.trim();
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase() || 'gemini';
  const key = `${provider}:${model || 'default'}`;
  let service = services.get(key);
  if (!service) {
    service = createLLMService(model);
    services.set(key, service);
  }
  return service;
};
