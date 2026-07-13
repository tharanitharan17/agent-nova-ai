import './load-env.js';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import { db } from './server/db.js';
import { createToken, hashPassword, publicUser, requireAuth, verifyPassword, type AuthenticatedRequest } from './server/auth.js';
import { isGeminiConfigured } from './server/gemini.js';
import { withLLMModel } from './server/llm-service.js';
import {
  addProgressNote, coachChat, completeTaskAction, createGoalAndPlan, getDashboard,
  rescheduleTaskAction, runDailyCheckIn, setGoalStatus, skipTaskAction, updateAvailability,
} from './server/product-service.js';
import { getTodayDashboardAsync } from './server/today-service.js';
import { checkOllamaHealth, ensureModelsAvailable, benchmarkModel, runModelComparison, generateBenchmarkReport } from './server/ollama-service.js';

const asyncRoute = (handler: (req: AuthenticatedRequest, res: Response) => Promise<unknown> | unknown) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const model = req.header('x-llm-model');
    return withLLMModel(model, () => Promise.resolve(handler(req, res))).catch(next);
  };

export function createApp() {
  const app = express();
  const goalGenerationInFlight = new Set<string>();

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const requestId = req.header('x-request-id') || crypto.randomUUID();
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
    const startedAt = Date.now();
    res.on('finish', () => console.info(`[HTTP] id=${requestId} method=${req.method} path=${req.originalUrl} status=${res.statusCode} durationMs=${Date.now() - startedAt}`));
    next();
  });

  const configuredOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? configuredOrigins
    : Array.from(new Set([...configuredOrigins, 'http://localhost:5173', 'http://127.0.0.1:5173']));
  if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    console.warn('[CORS] FRONTEND_URL is not configured; browser cross-origin requests will be rejected.');
  }
  app.use(cors({
    origin(origin, callback) {
      // Requests without an Origin header include health checks and server-to-server calls.
      if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true);
      const error = new Error('Origin is not allowed by CORS.') as Error & { status?: number };
      error.status = 403;
      return callback(error);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-LLM-Model', 'X-Request-Id'],
    maxAge: 86_400,
  }));
  
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    const llmProvider = process.env.LLM_PROVIDER?.trim().toLowerCase() || 'gemini';
    const llmModel = process.env.LLM_MODEL?.trim() || (llmProvider === 'ollama' ? 'deepseek-r1:8b' : process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite');
    const configured = isGeminiConfigured();
    const ollama = llmProvider === 'ollama' ? await checkOllamaHealth() : undefined;
    const aiConfigured = llmProvider === 'ollama' ? Boolean(ollama?.running && ollama.models.includes(llmModel)) : configured;
    res.json({
      status: 'ok',
      llmProvider,
      llmModel,
      aiConfigured,
      ollama: ollama ? { running: ollama.running, models: ollama.models } : undefined,
      geminiConfigured: configured,
      message: aiConfigured
        ? `Server ready. ${llmProvider === 'ollama' ? `Ollama model ${llmModel} is available.` : 'Gemini API key loaded.'}`
        : `Server running. Configure ${llmProvider === 'ollama' ? `Ollama model ${llmModel}` : 'GEMINI_API_KEY'} for AI features.`,
    });
  });

  app.get('/api/diagnostics', asyncRoute(async (_req, res) => {
    const ollama = await checkOllamaHealth();
    const loaded = ollama.running
      ? await fetch(`${process.env.OLLAMA_ENDPOINT || 'http://localhost:11434'}/api/ps`)
        .then(async response => (response.ok ? await response.json() : { models: [] }) as { models?: Array<{ name?: string }> })
        .catch(() => ({ models: [] } as { models?: Array<{ name?: string }> }))
      : { models: [] } as { models?: Array<{ name?: string }> };
    res.json({
      ollamaReachable: ollama.running,
      installedModels: ollama.models,
      loadedModels: (loaded.models || []).map((model: { name?: string }) => model.name),
      selectedModel: process.env.LLM_MODEL || 'deepseek-r1:8b',
      currentTimeoutMs: 60_000,
      lastRequestDurationMs: null,
      lastError: null,
      averageInferenceTimeMs: null,
    });
  }));

  app.post('/api/auth/signup', (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (name.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return res.status(400).json({ error: 'Password must be at least 8 characters and include a letter and number.' });
    if (db.findUserByEmail(email)) return res.status(409).json({ error: 'An account with this email already exists.' });
    const user = db.addUser(name, email, hashPassword(password));
    return res.status(201).json({ token: createToken(user), user: publicUser(user) });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const user = db.findUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Invalid email or password.' });
    return res.json({ token: createToken(user), user: publicUser(user) });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => res.json({ user: publicUser(req.user!) }));
  app.use('/api', requireAuth);

  app.get('/api/dashboard', (req: AuthenticatedRequest, res) => res.json(getDashboard(req.user!.id)));
  app.get('/api/state', (req: AuthenticatedRequest, res) => res.json(getDashboard(req.user!.id)));
  app.get('/api/goals/active', (req: AuthenticatedRequest, res) => res.json({ goal: getDashboard(req.user!.id).activeGoal }));
  app.get('/api/today', asyncRoute(async (req, res) => res.json(await getTodayDashboardAsync(req.user!.id))));

  app.post('/api/goals', asyncRoute(async (req, res) => {
    const userId = req.user!.id;
    const requestStartedAt = Date.now();
    const bodySize = Buffer.byteLength(JSON.stringify(req.body || {}));
    console.info(`[TRACE] request_received route=/api/goals userId=${userId} bodyBytes=${bodySize} at=${new Date().toISOString()}`);
    if (goalGenerationInFlight.has(userId)) {
      return res.status(409).json({ error: 'A plan is already being generated for this account.' });
    }
    goalGenerationInFlight.add(userId);
    try {
      const dashboard = await createGoalAndPlan(userId, req.body);
      console.info(`[TRACE] response_returned route=/api/goals userId=${userId} responseBytes=${Buffer.byteLength(JSON.stringify(dashboard))} durationMs=${Date.now() - requestStartedAt}`);
      return res.status(201).json(dashboard);
    } finally {
      goalGenerationInFlight.delete(userId);
    }
  }));

  app.get('/api/milestones', (req: AuthenticatedRequest, res) => {
    const dashboard = getDashboard(req.user!.id);
    res.json({ milestones: dashboard.milestones, tasks: dashboard.tasks });
  });

  app.post('/api/tasks/:taskId/complete', (req: AuthenticatedRequest, res) => res.json(completeTaskAction(req.user!.id, req.params.taskId, req.body.note)));
  app.post('/api/tasks/:taskId/skip', (req: AuthenticatedRequest, res) => res.json(skipTaskAction(req.user!.id, req.params.taskId, req.body.reason)));
  app.post('/api/tasks/:taskId/reschedule', (req: AuthenticatedRequest, res) => res.json(rescheduleTaskAction(req.user!.id, req.params.taskId, req.body.scheduledDate, req.body.reason)));
  app.post('/api/tasks/:taskId/notes', (req: AuthenticatedRequest, res) => res.json(addProgressNote(req.user!.id, req.params.taskId, req.body.note)));

  app.post('/api/check-ins', (req: AuthenticatedRequest, res) => res.status(201).json(runDailyCheckIn(req.user!.id, req.body)));
  app.post('/api/availability', (req: AuthenticatedRequest, res) => res.json(updateAvailability(req.user!.id, Number(req.body.dailyMinutes), req.body.workingDays)));
  app.post('/api/goals/status', (req: AuthenticatedRequest, res) => {
    if (!['active', 'paused', 'completed'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid goal status.' });
    return res.json(setGoalStatus(req.user!.id, req.body.status));
  });
  app.post('/api/goals/replan', (req: AuthenticatedRequest, res) => {
    const dashboard = getDashboard(req.user!.id);
    if (!dashboard.activeGoal) return res.status(404).json({ error: 'No active goal.' });
    return res.json(updateAvailability(req.user!.id, dashboard.activeGoal.daily_available_minutes || 60, dashboard.activeGoal.working_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']));
  });

  app.post('/api/chat', asyncRoute(async (req, res) => res.json(await coachChat(req.user!.id, req.body.message))));

  app.post('/api/clear', (req: AuthenticatedRequest, res) => {
    const dashboard = getDashboard(req.user!.id);
    if (dashboard.activeGoal) setGoalStatus(req.user!.id, 'completed');
    return res.json({ success: true });
  });

  // ─── Ollama Management & Benchmark Endpoints ─────────────────────────────
  app.get('/api/ollama/status', asyncRoute(async (_req, res) => {
    const status = await checkOllamaHealth();
    res.json(status);
  }));

  app.post('/api/ollama/setup', asyncRoute(async (_req, res) => {
    const result = await ensureModelsAvailable();
    res.json(result);
  }));

  const runBenchmark = async (req: AuthenticatedRequest, res: Response, requestedModel: unknown) => {
    const modelMap: Record<string, string> = { deepseek: 'deepseek-r1:8b', qwen: process.env.QWEN_MODEL?.trim() || 'qwen2.5:3b' };
    const modelName = modelMap[typeof requestedModel === 'string' ? requestedModel : 'deepseek'];
    if (!modelName) return res.status(400).json({ error: 'Invalid model. Use: deepseek or qwen' });
    const result = await benchmarkModel(modelName);
    return res.json(result);
  };

  // The parameterized route is used by the UI; the base route is retained for API clients.
  app.post('/api/ollama/benchmark', asyncRoute(async (req, res) => runBenchmark(req, res, req.body?.model ?? req.query.model)));
  app.post('/api/ollama/benchmark/:model', asyncRoute(async (req, res) => runBenchmark(req, res, req.params.model)));

  app.post('/api/ollama/compare', asyncRoute(async (_req, res) => {
    const comparison = await runModelComparison();
    res.json(comparison);
  }));

  app.get('/api/ollama/report', asyncRoute(async (_req, res) => {
    const comparison = await runModelComparison();
    const markdown = generateBenchmarkReport(comparison);
    res.json({ markdown, comparison });
  }));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    const status = error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status
      : error instanceof SyntaxError && 'body' in error ? 400
      : /not found/i.test(message) ? 404
      : /required|invalid|choose|must|cannot|provide|between|future|create a goal|no active goal|empty/i.test(message) ? 400
      : /Gemini|Ollama|rate limit|configured|timeout/i.test(message) ? 503 : 500;
    console.error(`[API] Request failed status=${status}:`, error);
    res.status(status).json({ error: status === 500 ? 'NOVA could not complete the request.' : message });
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const port = Number(process.env.PORT) || 3000;
  
  // In production, serve static files from frontend dist
  if (process.env.NODE_ENV === 'production') {
    const projectRoot = path.basename(process.cwd()).toLowerCase() === 'backend'
      ? path.resolve(process.cwd(), '..')
      : process.cwd();
    const distPath = path.join(projectRoot, 'frontend', 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  
  const server = app.listen(port, '0.0.0.0', () => console.log(`GoalPilot AI Backend listening on port ${port}`));
  const shutdown = (signal: string) => {
    console.info(`[Server] ${signal} received; closing HTTP connections.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch(error => {
  console.error('NOVA failed to start:', error);
  process.exitCode = 1;
});
