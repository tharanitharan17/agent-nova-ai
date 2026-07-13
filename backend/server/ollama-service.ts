import os from 'os';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OllamaStatus {
  running: boolean;
  endpoint: string;
  models: string[];
  error?: string;
}

export interface ModelBenchmarkResult {
  modelName: string;
  provider: 'ollama';
  timestamp: string;
  metrics: {
    avgResponseTimeMs: number;
    totalTokensGenerated: number;
    peakMemoryMB: number;
    cpuUsagePercent: number;
    success: boolean;
    errorMessage?: string;
  };
  quality: {
    goalAnalysis: number;
    roadmapQuality: number;
    reasoningQuality: number;
    contextRetention: number;
    taskGeneration: number;
    overall: number;
  };
  responses: Record<string, { text: string; timeMs: number; tokens: number }>;
}

export interface ModelComparison {
  deepseek?: ModelBenchmarkResult;
  qwen?: ModelBenchmarkResult;
  timestamp: string;
  summary: {
    fastest: string;
    bestQuality: string;
    lowestMemory: string;
    recommendation: string;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT?.trim() || 'http://localhost:11434';
const DEEPSEEK_MODEL = 'deepseek-r1:8b';
// Qwen3 is preferred; Qwen2.5 is a supported local fallback when the Qwen3
// registry artifact is unavailable on the host.
const QWEN_MODEL = process.env.QWEN_MODEL?.trim() || 'qwen2.5:3b';

const TEST_GOAL = 'I want to become a Data Scientist in 6 months starting from zero programming experience.';

const BENCHMARK_PROMPTS: Record<string, { prompt: string; system: string }> = {
  goalAnalysis: {
    prompt: `Summarize this goal in one paragraph: "${TEST_GOAL}"`,
    system: 'Be concise. Give at most three bullet points and one conclusion.',
  },
  roadmap: {
    prompt: `Give three first-week actions for: "${TEST_GOAL}"`,
    system: 'Return at most three concise bullets.',
  },
  taskGeneration: {
    prompt: `Generate exactly 5 specific daily tasks for someone starting Week 1 of: "${TEST_GOAL}". Each task should have a title, description, estimated duration in minutes, and priority level.`,
    system: 'You are a task planning expert. Generate concrete, actionable daily tasks. Be specific and practical.',
  },
  reasoning: {
    prompt: `Using chain-of-thought reasoning, evaluate whether this goal is realistic and what the biggest challenges will be: "${TEST_GOAL}". Think step by step.`,
    system: 'You are a strategic reasoning expert. Use explicit chain-of-thought reasoning. Show your thinking process step by step.',
  },
  context: {
    prompt: `The user previously told you: "I have no programming experience but I'm very motivated. I can dedicate 2 hours per day. I prefer hands-on projects over theory." Based on this context, what should be their very first step toward: "${TEST_GOAL}"?`,
    system: 'You are a context-aware coach. Reference the user\'s specific context (experience level, time availability, learning preference) in your response.',
  },
};

// ─── Ollama API Helpers ──────────────────────────────────────────────────────

async function ollamaFetch(path: string, options?: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const timeoutMs = options?.timeoutMs || 30_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${OLLAMA_ENDPOINT}${path}`, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function checkOllamaHealth(): Promise<OllamaStatus> {
  try {
    const res = await ollamaFetch('/api/tags', { timeoutMs: 5_000 });
    if (!res.ok) return { running: false, endpoint: OLLAMA_ENDPOINT, models: [], error: `HTTP ${res.status}` };
    const data = await res.json() as { models?: Array<{ name: string }> };
    const models = (data.models || []).map(m => m.name);
    return { running: true, endpoint: OLLAMA_ENDPOINT, models };
  } catch (err) {
    return { running: false, endpoint: OLLAMA_ENDPOINT, models: [], error: (err as Error).message };
  }
}

export async function pullModel(modelName: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[Ollama] Pulling model: ${modelName}...`);
    const res = await ollamaFetch('/api/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: false }),
      timeoutMs: 600_000, // 10 min for large model pulls
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Pull failed: ${text}` };
    }
    console.log(`[Ollama] Model ${modelName} pulled successfully.`);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function ensureModelsAvailable(): Promise<{ deepseek: boolean; qwen: boolean; pulled: string[] }> {
  const status = await checkOllamaHealth();
  if (!status.running) throw new Error('Ollama is not running. Start it with: ollama serve');

  const pulled: string[] = [];
  let deepseekReady = status.models.some(m => m.startsWith('deepseek-r1'));
  let qwenReady = status.models.some(m => m.startsWith('qwen3') || m.startsWith('qwen2.5'));

  if (!deepseekReady) {
    const result = await pullModel(DEEPSEEK_MODEL);
    deepseekReady = result.success;
    if (result.success) pulled.push(DEEPSEEK_MODEL);
  }
  if (!qwenReady) {
    const result = await pullModel(QWEN_MODEL);
    qwenReady = result.success;
    if (result.success) pulled.push(QWEN_MODEL);
  }

  return { deepseek: deepseekReady, qwen: qwenReady, pulled };
}

async function chatWithModel(model: string, system: string, prompt: string): Promise<{ text: string; timeMs: number }> {
  const start = Date.now();
  const res = await ollamaFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      stream: false,
      options: { temperature: 0.1, num_predict: 96 },
    }),
    timeoutMs: 15_000,
  });
  if (!res.ok) throw new Error(`Ollama chat error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { message?: { content?: string } };
  return { text: data.message?.content || '', timeMs: Date.now() - start };
}

function scoreQuality(responses: Record<string, { text: string; timeMs: number; tokens: number }>): ModelBenchmarkResult['quality'] {
  const score = (key: string, keywords: string[], lengthFactor: number): number => {
    const r = responses[key];
    if (!r || !r.text) return 1;
    const text = r.text.toLowerCase();
    const keywordScore = keywords.filter(k => text.includes(k)).length / keywords.length;
    const lengthScore = Math.min(1, r.text.length / lengthFactor);
    return Math.min(10, Math.max(1, Math.round((keywordScore * 6 + lengthScore * 4) + 1)));
  };

  const goalAnalysis = score('goalAnalysis', ['milestone', 'risk', 'feasib', 'timeline', 'skill', 'data science', 'python', 'statistic'], 800);
  const roadmapQuality = score('roadmap', ['week', 'topic', 'hour', 'resource', 'learn', 'python', 'project', 'data'], 1000);
  const reasoningQuality = score('reasoning', ['step', 'because', 'therefore', 'challenge', 'however', 'consider', 'realistic', 'think'], 600);
  const contextRetention = score('context', ['no programming', 'no experience', 'beginner', '2 hour', 'hands-on', 'project', 'practical', 'motivated'], 400);
  const taskGeneration = score('taskGeneration', ['task', 'minute', 'description', 'priority', 'install', 'practice', 'exercise', 'daily'], 600);
  const overall = Math.round((goalAnalysis + roadmapQuality + reasoningQuality + contextRetention + taskGeneration) / 5);

  return { goalAnalysis, roadmapQuality, reasoningQuality, contextRetention, taskGeneration, overall };
}

export async function benchmarkModel(modelName: string): Promise<ModelBenchmarkResult> {
  console.log(`[Benchmark] Starting benchmark for ${modelName}...`);
  const responses: Record<string, { text: string; timeMs: number; tokens: number }> = {};
  const memBefore = process.memoryUsage().heapUsed;
  let totalTime = 0;
  let totalTokens = 0;
  let success = true;
  let errorMessage: string | undefined;

  try {
    for (const [key, { prompt, system }] of Object.entries(BENCHMARK_PROMPTS)) {
      console.log(`[Benchmark] ${modelName} → ${key}...`);
      const result = await chatWithModel(modelName, system, prompt);
      const tokens = Math.ceil(result.text.length / 4);
      responses[key] = { text: result.text, timeMs: result.timeMs, tokens };
      totalTime += result.timeMs;
      totalTokens += tokens;
      console.log(`[Benchmark] ${key}: ${result.timeMs}ms, ~${tokens} tokens`);
    }
  } catch (err) {
    success = false;
    errorMessage = (err as Error).message;
    console.error(`[Benchmark] ${modelName} failed: ${errorMessage}`);
  }

  const memAfter = process.memoryUsage().heapUsed;
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  return {
    modelName,
    provider: 'ollama',
    timestamp: new Date().toISOString(),
    metrics: {
      avgResponseTimeMs: Object.keys(responses).length > 0 ? Math.round(totalTime / Object.keys(responses).length) : 0,
      totalTokensGenerated: totalTokens,
      peakMemoryMB: Math.round((memAfter - memBefore) / 1024 / 1024),
      cpuUsagePercent: Math.round((loadAvg[0] / cpus.length) * 100),
      success,
      errorMessage,
    },
    quality: scoreQuality(responses),
    responses,
  };
}

export async function runModelComparison(): Promise<ModelComparison> {
  console.log('[Benchmark] Running DeepSeek vs Qwen comparison (sequential)...');
  let deepseek: ModelBenchmarkResult | undefined;
  let qwen: ModelBenchmarkResult | undefined;

  // Run sequentially to avoid exhausting RAM on a single machine
  try { deepseek = await benchmarkModel(DEEPSEEK_MODEL); } catch (e) { console.error('[Benchmark] DeepSeek failed:', e); }
  try { qwen = await benchmarkModel(QWEN_MODEL); } catch (e) { console.error('[Benchmark] Qwen failed:', e); }

  const summary = { fastest: 'N/A', bestQuality: 'N/A', lowestMemory: 'N/A', recommendation: 'Run both benchmarks to see comparison.' };

  if (deepseek?.metrics.success && qwen?.metrics.success) {
    summary.fastest = deepseek.metrics.avgResponseTimeMs <= qwen.metrics.avgResponseTimeMs ? 'DeepSeek-R1' : 'Qwen 2.5';
    summary.bestQuality = deepseek.quality.overall >= qwen.quality.overall ? 'DeepSeek-R1' : 'Qwen 2.5';
    summary.lowestMemory = deepseek.metrics.peakMemoryMB <= qwen.metrics.peakMemoryMB ? 'DeepSeek-R1' : 'Qwen 2.5';
    summary.recommendation = summary.bestQuality === summary.fastest
      ? `${summary.bestQuality} leads in both speed and quality — recommended for production.`
      : `${summary.bestQuality} has better quality; ${summary.fastest} is faster. Choose based on your priority.`;
  } else if (deepseek?.metrics.success) {
    summary.fastest = summary.bestQuality = summary.lowestMemory = 'DeepSeek-R1';
    summary.recommendation = 'Only DeepSeek completed successfully. Ensure Qwen model is available.';
  } else if (qwen?.metrics.success) {
    summary.fastest = summary.bestQuality = summary.lowestMemory = 'Qwen 2.5';
    summary.recommendation = 'Only Qwen completed successfully. Ensure DeepSeek model is available.';
  }

  const comparison = { deepseek, qwen, timestamp: new Date().toISOString(), summary };
  const outputDirectory = path.basename(process.cwd()).toLowerCase() === 'backend' ? path.resolve(process.cwd(), '..') : process.cwd();
  await writeFile(path.join(outputDirectory, 'benchmark-report.md'), generateBenchmarkReport(comparison), 'utf8');
  return comparison;
}

export function generateBenchmarkReport(comparison: ModelComparison): string {
  const fmt = (v: number | undefined) => v !== undefined ? String(v) : '—';
  const d = comparison.deepseek;
  const q = comparison.qwen;

  let md = `# GoalPilot AI — Model Benchmark Report\n\n`;
  md += `**Test Goal:** "${TEST_GOAL}"\n`;
  md += `**Date:** ${comparison.timestamp}\n\n`;
  md += `## Performance Metrics\n\n`;
  md += `| Metric | DeepSeek-R1 | Qwen 2.5 |\n|---|---|---|\n`;
  md += `| Avg Response Time | ${fmt(d?.metrics.avgResponseTimeMs)} ms | ${fmt(q?.metrics.avgResponseTimeMs)} ms |\n`;
  md += `| Total Tokens | ${fmt(d?.metrics.totalTokensGenerated)} | ${fmt(q?.metrics.totalTokensGenerated)} |\n`;
  md += `| Peak Memory | ${fmt(d?.metrics.peakMemoryMB)} MB | ${fmt(q?.metrics.peakMemoryMB)} MB |\n`;
  md += `| CPU Usage | ${fmt(d?.metrics.cpuUsagePercent)}% | ${fmt(q?.metrics.cpuUsagePercent)}% |\n`;
  md += `| Status | ${d?.metrics.success ? '✅ Pass' : '❌ Fail'} | ${q?.metrics.success ? '✅ Pass' : '❌ Fail'} |\n\n`;
  md += `## Quality Scores (1-10)\n\n`;
  md += `| Category | DeepSeek-R1 | Qwen 2.5 |\n|---|---|---|\n`;
  md += `| Goal Analysis | ${fmt(d?.quality.goalAnalysis)} | ${fmt(q?.quality.goalAnalysis)} |\n`;
  md += `| Roadmap Quality | ${fmt(d?.quality.roadmapQuality)} | ${fmt(q?.quality.roadmapQuality)} |\n`;
  md += `| Reasoning | ${fmt(d?.quality.reasoningQuality)} | ${fmt(q?.quality.reasoningQuality)} |\n`;
  md += `| Context Retention | ${fmt(d?.quality.contextRetention)} | ${fmt(q?.quality.contextRetention)} |\n`;
  md += `| Task Generation | ${fmt(d?.quality.taskGeneration)} | ${fmt(q?.quality.taskGeneration)} |\n`;
  md += `| **Overall** | **${fmt(d?.quality.overall)}** | **${fmt(q?.quality.overall)}** |\n\n`;
  md += `## Summary\n\n`;
  md += `- **Fastest:** ${comparison.summary.fastest}\n`;
  md += `- **Best Quality:** ${comparison.summary.bestQuality}\n`;
  md += `- **Lowest Memory:** ${comparison.summary.lowestMemory}\n`;
  md += `- **Recommendation:** ${comparison.summary.recommendation}\n`;
  return md;
}
