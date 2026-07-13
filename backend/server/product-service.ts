import crypto from 'crypto';
import { Type } from '@google/genai';
import { db, type Goal, type Task } from './db.js';
import { calculateAnalytics } from './analytics.js';
import type { DailyCheckIn, GeneratedPlan, GoalInput, Milestone, PlanRevision, ProductData, ProgressEntry } from './domain.js';
import { generateJSON, generateText, isGeminiConfigured } from './gemini.js';
import { AI_COACHING_SYSTEM_PROMPT, PLAN_GENERATION_SYSTEM_PROMPT } from './prompts.js';

type ExtendedData = ReturnType<typeof db.getData> & ProductData;

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const dateOnly = (value = new Date()) => value.toISOString().slice(0, 10);

function data(): ExtendedData {
  const store = db.getData() as ExtendedData;
  store.milestones ??= [];
  store.weekly_plans ??= [];
  store.progress_entries ??= [];
  store.plan_revisions ??= [];
  store.daily_check_ins ??= [];
  return store;
}

export function validateGoalInput(value: unknown): GoalInput {
  if (!value || typeof value !== 'object') throw new Error('Goal details are required.');
  const input = value as Record<string, unknown>;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const targetDate = typeof input.targetDate === 'string' ? input.targetDate : '';
  const dailyMinutes = Number(input.dailyMinutes);
  const experienceLevel = input.experienceLevel;
  const workingDays = Array.isArray(input.workingDays) ? input.workingDays.filter(day => typeof day === 'string') as string[] : [];
  const motivation = typeof input.motivation === 'string' ? input.motivation.trim() : '';
  const obstacles = typeof input.obstacles === 'string' ? input.obstacles.trim() : '';

  if (title.length < 5 || title.length > 140) throw new Error('Goal title must be between 5 and 140 characters.');
  if (description.length < 20 || description.length > 2000) throw new Error('Describe your goal in at least 20 characters.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || new Date(targetDate) <= new Date()) throw new Error('Choose a future target date.');
  if (!Number.isFinite(dailyMinutes) || dailyMinutes < 15 || dailyMinutes > 720) throw new Error('Daily available time must be between 15 and 720 minutes.');
  if (!['beginner', 'intermediate', 'advanced'].includes(String(experienceLevel))) throw new Error('Choose an experience level.');
  if (!workingDays.length) throw new Error('Choose at least one preferred working day.');
  if (motivation.length < 5) throw new Error('Tell NOVA why this goal matters to you.');

  return { title, description, targetDate, dailyMinutes, experienceLevel: experienceLevel as GoalInput['experienceLevel'], workingDays, motivation, obstacles };
}

const planSchema = {
  type: Type.OBJECT,
  properties: {
    goalSummary: { type: Type.STRING },
    category: { type: Type.STRING },
    difficulty: { type: Type.STRING, enum: ['beginner', 'intermediate', 'advanced'] },
    targetDate: { type: Type.STRING },
    estimatedDurationDays: { type: Type.NUMBER },
    weeklyCommitmentHours: { type: Type.NUMBER },
    successCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
    obstacles: { type: Type.ARRAY, items: { type: Type.STRING } },
    strategy: { type: Type.STRING },
    milestones: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      title: { type: Type.STRING }, description: { type: Type.STRING }, targetDate: { type: Type.STRING },
      successCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
    }, required: ['title', 'description', 'targetDate', 'successCriteria'] } },
    weeklyPlan: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      weekNumber: { type: Type.NUMBER }, focus: { type: Type.STRING }, outcomes: { type: Type.ARRAY, items: { type: Type.STRING } },
    }, required: ['weekNumber', 'focus', 'outcomes'] } },
    tasks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      title: { type: Type.STRING }, description: { type: Type.STRING }, scheduledDate: { type: Type.STRING },
      estimatedMinutes: { type: Type.NUMBER }, priority: { type: Type.STRING, enum: ['low', 'medium', 'high', 'critical'] },
      status: { type: Type.STRING, enum: ['pending'] }, milestone: { type: Type.STRING },
      dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
    }, required: ['title', 'description', 'scheduledDate', 'estimatedMinutes', 'priority', 'status', 'milestone', 'dependencies'] } },
    risks: { type: Type.ARRAY, items: { type: Type.STRING } },
    recoveryPlan: { type: Type.STRING },
    motivationMessage: { type: Type.STRING },
    initialSuccessProbability: { type: Type.NUMBER },
  },
  required: ['goalSummary', 'category', 'difficulty', 'targetDate', 'estimatedDurationDays', 'weeklyCommitmentHours', 'successCriteria', 'obstacles', 'strategy', 'milestones', 'weeklyPlan', 'tasks', 'risks', 'recoveryPlan', 'motivationMessage', 'initialSuccessProbability'],
};

function fallbackPlan(input: GoalInput): GeneratedPlan {
  const working = new Set(input.workingDays.map(day => day.toLowerCase()));
  const dates: string[] = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  while (dates.length < 6) {
    cursor.setDate(cursor.getDate() + 1);
    if (working.has(cursor.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase())) dates.push(dateOnly(cursor));
  }
  const milestones = [
    { title: 'Foundation', description: `Build the core knowledge needed for ${input.title}.`, targetDate: dates[1], successCriteria: ['Complete the fundamentals', 'Practice the core skill'] },
    { title: 'Applied Practice', description: 'Apply the core skills in focused exercises and a small project.', targetDate: dates[3], successCriteria: ['Complete practical exercises', 'Document learning'] },
    { title: 'Portfolio Progress', description: 'Create evidence of progress and review the next iteration.', targetDate: dates[5], successCriteria: ['Finish a tangible deliverable', 'Review and replan'] },
  ];
  const taskTitles = ['Define success criteria', 'Learn the key foundation', 'Practice with a focused exercise', 'Build a small applied project', 'Review progress and blockers', 'Plan the next week'];
  return {
    goalSummary: input.description, category: 'Personal Development', difficulty: input.experienceLevel, targetDate: input.targetDate,
    estimatedDurationDays: Math.max(1, Math.ceil((new Date(input.targetDate).getTime() - Date.now()) / 86_400_000)),
    weeklyCommitmentHours: Math.round((input.dailyMinutes * input.workingDays.length / 60) * 10) / 10,
    successCriteria: ['Maintain the planned schedule', 'Complete practical work each week', 'Review progress weekly'], obstacles: input.obstacles ? [input.obstacles] : [],
    strategy: 'Build foundations first, practice consistently, and review progress each week.', milestones,
    weeklyPlan: milestones.map((milestone, index) => ({ weekNumber: index + 1, focus: milestone.title, outcomes: milestone.successCriteria })),
    tasks: taskTitles.map((title, index) => ({ title, description: `A focused ${input.dailyMinutes}-minute session for ${input.title}.`, scheduledDate: dates[index], estimatedMinutes: input.dailyMinutes, priority: index < 2 ? 'high' : 'medium', status: 'pending' as const, milestone: milestones[Math.min(2, Math.floor(index / 2))].title, dependencies: index ? [taskTitles[index - 1]] : [] })),
    risks: ['Inconsistent time availability', 'Trying to cover too much at once'], recoveryPlan: 'Resume with the next available session and reduce scope for one week if needed.', motivationMessage: input.motivation, initialSuccessProbability: 65,
  };
}

async function generatePlanWithinDeadline(prompt: string): Promise<GeneratedPlan> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      generateJSON<GeneratedPlan>(prompt, PLAN_GENERATION_SYSTEM_PROMPT, planSchema, { temperature: 0.35 }),
      new Promise<GeneratedPlan>((_resolve, reject) => {
        // Full JSON roadmaps can take minutes on local CPU models. Keep the
        // interactive plan creation path responsive and use the validated
        // deterministic planner when the model has not responded promptly.
        timer = setTimeout(() => reject(new Error('Plan generation timeout — using smart fallback planner')), 60_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function validateGeneratedPlan(plan: GeneratedPlan, input: GoalInput): GeneratedPlan {
  if (!plan || typeof plan !== 'object') throw new Error('Gemini returned an invalid plan.');
  if (!Array.isArray(plan.milestones) || !plan.milestones.length) throw new Error('Generated plan contains no milestones.');
  if (!Array.isArray(plan.tasks) || !plan.tasks.length) throw new Error('Generated plan contains no actionable tasks.');
  const allowedDays = new Set(input.workingDays.map(day => day.toLowerCase()));
  const validTasks = plan.tasks.filter(task =>
    task.title?.trim() && task.description?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(task.scheduledDate) &&
    task.estimatedMinutes > 0 && task.estimatedMinutes <= input.dailyMinutes &&
    new Date(task.scheduledDate) <= new Date(input.targetDate) &&
    allowedDays.has(new Date(task.scheduledDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase())
  );
  if (!validTasks.length) throw new Error('Generated tasks do not fit the selected schedule and availability.');
  return { ...plan, targetDate: input.targetDate, tasks: validTasks, initialSuccessProbability: Math.max(0, Math.min(100, Number(plan.initialSuccessProbability) || 50)) };
}

function addProgress(entry: Omit<ProgressEntry, 'id' | 'created_at'>) {
  data().progress_entries!.push({ ...entry, id: id(), created_at: now() });
}

export async function createGoalAndPlan(userId: string, rawInput: unknown, generatedOverride?: GeneratedPlan) {
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase() || 'gemini';
  if (!generatedOverride && provider !== 'ollama' && !isGeminiConfigured()) throw new Error('Gemini is not configured. Add GEMINI_API_KEY to the server .env file.');
  const input = validateGoalInput(rawInput);
  const startedAt = Date.now();
  console.info(`[Plan] Generation started userId=${userId} provider=${provider} title=${JSON.stringify(input.title)}`);
  const prompt = `Create a complete personalized execution plan from this user-provided goal. Today is ${dateOnly()}.
Goal input:
${JSON.stringify(input, null, 2)}
Use ISO dates. Schedule tasks only on preferred working days. No task may exceed ${input.dailyMinutes} minutes. Include enough concrete tasks for a useful plan without overloading any day.`;
  console.info(`[Plan] Prompt built userId=${userId} promptChars=${prompt.length} estimatedTokens=${Math.ceil(prompt.length / 4)} durationMs=${Date.now() - startedAt}`);
  // Try the AI model first, fall back to the deterministic planner on timeout
  let generatedResponse: GeneratedPlan;
  if (generatedOverride) {
    generatedResponse = generatedOverride;
  } else {
    try {
      generatedResponse = await generatePlanWithinDeadline(prompt);
      console.info(`[Plan] AI plan generated userId=${userId} durationMs=${Date.now() - startedAt}`);
    } catch (err) {
      console.warn(`[Plan] AI generation failed, using fallback planner: ${(err as Error).message}`);
      generatedResponse = fallbackPlan(input);
    }
  }
  console.info(`[Plan] Planner response ready userId=${userId} responseChars=${JSON.stringify(generatedResponse).length} durationMs=${Date.now() - startedAt}`);
  const generated = validateGeneratedPlan(generatedResponse, input);
  const store = data();

  for (const goal of store.goals) {
    if (goal.user_id === userId && goal.status === 'active') goal.status = 'paused';
  }

  const goalId = id();
  const goal: Goal = {
    id: goalId, user_id: userId, title: input.title, description: input.description,
    status: 'active', created_at: now(), target_date: input.targetDate,
    daily_available_minutes: input.dailyMinutes, experience_level: input.experienceLevel,
    working_days: input.workingDays, motivation: input.motivation, known_obstacles: input.obstacles,
    category: generated.category, difficulty: generated.difficulty, goal_summary: generated.goalSummary,
    strategy: generated.strategy, success_criteria: generated.successCriteria, risks: generated.risks,
    recovery_plan: generated.recoveryPlan, motivation_message: generated.motivationMessage,
    success_probability: 0, consistency: 0, completion_rate: 0, burnout_risk: 0,
  };
  store.goals.push(goal);

  const milestones: Milestone[] = generated.milestones.map(item => ({
    id: id(), goal_id: goalId, user_id: userId, title: item.title, description: item.description,
    target_date: item.targetDate, success_criteria: item.successCriteria, status: 'pending', created_at: now(),
  }));
  store.milestones!.push(...milestones);
  store.weekly_plans!.push(...generated.weeklyPlan.map(week => ({ ...week, goal_id: goalId, user_id: userId })));

  const milestoneMap = new Map(milestones.map(item => [item.title.toLowerCase(), item.id]));
  const tasks: Task[] = generated.tasks.map(item => ({
    id: id(), goal_id: goalId, user_id: userId, milestone_id: milestoneMap.get(item.milestone.toLowerCase()),
    title: item.title, description: item.description, scheduled_date: item.scheduledDate,
    estimated_minutes: Math.round(item.estimatedMinutes), priority: item.priority,
    dependencies: item.dependencies, time_frame: item.scheduledDate === dateOnly() ? 'today' : 'week',
    status: 'todo', resource_links: [], created_at: now(), difficulty: item.priority === 'critical' ? 'hard' : item.priority === 'high' ? 'medium' : 'easy',
  }));
  store.tasks.push(...tasks);

  addProgress({ goal_id: goalId, user_id: userId, type: 'goal_created', note: `Goal created: ${input.title}` });
  addProgress({ goal_id: goalId, user_id: userId, type: 'plan_generated', note: `NOVA generated ${milestones.length} milestones and ${tasks.length} tasks.` });
  store.memories.push({
    id: id(), goal_id: goalId, user_id: userId, content: `Available ${input.dailyMinutes} minutes on ${input.workingDays.join(', ')}. Motivation: ${input.motivation}. Obstacles: ${input.obstacles || 'None stated'}.`,
    category: 'user_pref', importance: 9, tags: ['availability', 'motivation', 'obstacles'], created_at: now(),
  });

  const metrics = calculateAnalytics(goal, tasks);
  Object.assign(goal, { success_probability: Math.round((metrics.successProbability + generated.initialSuccessProbability) / 2), consistency: metrics.consistencyIndex, completion_rate: metrics.overallProgress, burnout_risk: metrics.burnoutRisk });
  store.current_mission = tasks.find(task => task.scheduled_date >= dateOnly())?.title || 'Review your new roadmap.';
  store.agent_status = 'idle';
  db.save();
  console.info(`[Plan] Generation completed userId=${userId} milestones=${milestones.length} tasks=${tasks.length} durationMs=${Date.now() - startedAt}`);
  return getDashboard(userId);
}

export function getDashboard(userId: string) {
  const store = data();
  const goals = store.goals.filter(goal => goal.user_id === userId);
  const activeGoal = goals.find(goal => goal.status === 'active');
  if (!activeGoal) return { activeGoal: null, goals, tasks: [], milestones: [], memories: [], chatHistory: [], progressEntries: [], planRevisions: [], checkIns: [], analytics: null, currentMission: 'Create your first meaningful goal.', agentStatus: store.agent_status };
  const tasks = store.tasks.filter(task => task.goal_id === activeGoal.id && task.user_id === userId);
  const milestones = store.milestones!.filter(item => item.goal_id === activeGoal.id && item.user_id === userId);
  const revisions = store.plan_revisions!.filter(item => item.goal_id === activeGoal.id && item.user_id === userId);
  const analytics = calculateAnalytics(activeGoal, tasks, revisions);
  Object.assign(activeGoal, { success_probability: analytics.successProbability, consistency: analytics.consistencyIndex, completion_rate: analytics.overallProgress, burnout_risk: analytics.burnoutRisk });
  return {
    activeGoal, goals, tasks, milestones, analytics,
    memories: store.memories.filter(memory => memory.goal_id === activeGoal.id && (!memory.user_id || memory.user_id === userId)),
    chatHistory: store.chat_history.filter(message => message.goal_id === activeGoal.id && (!message.user_id || message.user_id === userId)),
    progressEntries: store.progress_entries!.filter(entry => entry.goal_id === activeGoal.id && entry.user_id === userId).slice(-50).reverse(),
    planRevisions: revisions.slice(-20).reverse(),
    checkIns: store.daily_check_ins!.filter(check => check.goal_id === activeGoal.id && check.user_id === userId).slice(-14).reverse(),
    weeklyPlan: store.weekly_plans!.filter(week => week.goal_id === activeGoal.id && week.user_id === userId),
    currentMission: store.current_mission,
    agentStatus: store.agent_status,
  };
}

function ownedTask(userId: string, taskId: string) {
  const task = data().tasks.find(item => item.id === taskId && item.user_id === userId);
  if (!task) throw new Error('Task not found.');
  return task;
}

export function completeTaskAction(userId: string, taskId: string, note?: string) {
  const task = ownedTask(userId, taskId);
  task.status = 'completed';
  task.completed_at = now();
  if (note?.trim()) task.progress_note = note.trim();
  addProgress({ goal_id: task.goal_id, user_id: userId, task_id: task.id, type: 'task_completed', note: note?.trim() || `Completed: ${task.title}` });
  updateMilestonesAndMetrics(task.goal_id, userId);
  db.save();
  return getDashboard(userId);
}

export function skipTaskAction(userId: string, taskId: string, reason: string) {
  if (!reason?.trim()) throw new Error('A reason is required when skipping a task.');
  const task = ownedTask(userId, taskId);
  task.status = 'skipped';
  task.skip_reason = reason.trim();
  addProgress({ goal_id: task.goal_id, user_id: userId, task_id: task.id, type: 'task_skipped', note: `Skipped "${task.title}": ${reason.trim()}` });
  const explanation = reassignPendingWork(task.goal_id, userId, `Task skipped: ${task.title}`);
  addProgress({ goal_id: task.goal_id, user_id: userId, type: 'plan_revised', note: explanation });
  updateMilestonesAndMetrics(task.goal_id, userId);
  db.save();
  return getDashboard(userId);
}

export function rescheduleTaskAction(userId: string, taskId: string, scheduledDate: string, reason = 'User requested a new date.') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) || new Date(scheduledDate) < new Date(dateOnly())) throw new Error('Choose today or a future date.');
  const task = ownedTask(userId, taskId);
  const previous = task.scheduled_date;
  task.scheduled_date = scheduledDate;
  addProgress({ goal_id: task.goal_id, user_id: userId, task_id: task.id, type: 'task_rescheduled', note: `Rescheduled "${task.title}" from ${previous} to ${scheduledDate}. ${reason}` });
  data().plan_revisions!.push({ id: id(), goal_id: task.goal_id, user_id: userId, reason, explanation: `Moved one task from ${previous} to ${scheduledDate}; completed work was preserved.`, changes: [`${task.title}: ${previous} → ${scheduledDate}`], created_at: now() });
  updateMilestonesAndMetrics(task.goal_id, userId);
  db.save();
  return getDashboard(userId);
}

export function addProgressNote(userId: string, taskId: string, note: string) {
  if (!note?.trim()) throw new Error('Progress note cannot be empty.');
  const task = ownedTask(userId, taskId);
  task.progress_note = note.trim();
  addProgress({ goal_id: task.goal_id, user_id: userId, task_id: task.id, type: 'progress_note', note: note.trim() });
  db.save();
  return getDashboard(userId);
}

function reassignPendingWork(goalId: string, userId: string, reason: string) {
  const store = data();
  const goal = store.goals.find(item => item.id === goalId && item.user_id === userId);
  if (!goal) throw new Error('Goal not found.');
  const tasks = store.tasks.filter(item => item.goal_id === goalId && item.user_id === userId && item.status === 'todo').sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''));
  const allowed = new Set((goal.working_days || []).map(day => day.toLowerCase()));
  const load = new Map<string, number>();
  const changes: string[] = [];
  for (const task of tasks) {
    let cursor = new Date(Math.max(new Date(task.scheduled_date || dateOnly()).getTime(), new Date(dateOnly()).getTime()));
    while (cursor <= new Date(goal.target_date)) {
      const key = dateOnly(cursor);
      const weekday = cursor.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      if (allowed.has(weekday) && (load.get(key) || 0) + (task.estimated_minutes || 0) <= (goal.daily_available_minutes || 60)) {
        if (task.scheduled_date !== key) changes.push(`${task.title}: ${task.scheduled_date} → ${key}`);
        task.scheduled_date = key;
        load.set(key, (load.get(key) || 0) + (task.estimated_minutes || 0));
        break;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  const explanation = changes.length ? `NOVA redistributed ${changes.length} unfinished task(s) within daily capacity after: ${reason}.` : `NOVA reviewed the schedule after: ${reason}. No date changes were necessary.`;
  store.plan_revisions!.push({ id: id(), goal_id: goalId, user_id: userId, reason, explanation, changes, created_at: now() });
  return explanation;
}

export function updateAvailability(userId: string, dailyMinutes: number, workingDays: string[]) {
  const dashboard = getDashboard(userId);
  if (!dashboard.activeGoal) throw new Error('No active goal.');
  if (!Number.isFinite(dailyMinutes) || dailyMinutes < 15 || dailyMinutes > 720 || !workingDays.length) throw new Error('Provide valid availability and at least one working day.');
  dashboard.activeGoal.daily_available_minutes = dailyMinutes;
  dashboard.activeGoal.working_days = workingDays;
  const explanation = reassignPendingWork(dashboard.activeGoal.id, userId, 'Availability changed');
  addProgress({ goal_id: dashboard.activeGoal.id, user_id: userId, type: 'plan_revised', note: explanation });
  updateMilestonesAndMetrics(dashboard.activeGoal.id, userId);
  db.save();
  return getDashboard(userId);
}

export function runDailyCheckIn(userId: string, value: unknown) {
  const dashboard = getDashboard(userId);
  if (!dashboard.activeGoal) throw new Error('No active goal.');
  const input = value as Record<string, unknown>;
  const availableMinutes = Number(input.availableMinutes);
  const energy = Number(input.energy);
  const motivation = Number(input.motivation);
  const blockers = typeof input.blockers === 'string' ? input.blockers.trim() : '';
  const availabilityChanged = Boolean(input.availabilityChanged);
  if (availableMinutes < 0 || availableMinutes > 720 || energy < 1 || energy > 5 || motivation < 1 || motivation > 5) throw new Error('Check-in values are invalid.');
  const todayTasks = dashboard.tasks.filter(task => task.scheduled_date === dateOnly() && task.status === 'todo');
  const recommendation = energy <= 2
    ? `Protect momentum: complete the shortest high-priority task, then recover. Available time: ${availableMinutes} minutes.`
    : todayTasks.length ? `Start with "${todayTasks.sort((a, b) => (b.priority || '').localeCompare(a.priority || ''))[0].title}".` : 'Use today for review or recovery; no task is scheduled.';
  const check: DailyCheckIn = { id: id(), goal_id: dashboard.activeGoal.id, user_id: userId, date: dateOnly(), available_minutes: availableMinutes, energy, motivation, blockers, availability_changed: availabilityChanged, recommendation, created_at: now() };
  data().daily_check_ins!.push(check);
  addProgress({ goal_id: dashboard.activeGoal.id, user_id: userId, type: 'check_in', note: `Daily check-in: energy ${energy}/5, motivation ${motivation}/5. ${recommendation}` });
  if (availabilityChanged && availableMinutes >= 15) {
    dashboard.activeGoal.daily_available_minutes = availableMinutes;
    reassignPendingWork(dashboard.activeGoal.id, userId, 'Daily check-in availability changed');
  }
  db.save();
  return getDashboard(userId);
}

export function setGoalStatus(userId: string, status: 'active' | 'paused' | 'completed') {
  const dashboard = getDashboard(userId);
  if (!dashboard.activeGoal) throw new Error('No active goal.');
  dashboard.activeGoal.status = status;
  addProgress({ goal_id: dashboard.activeGoal.id, user_id: userId, type: 'goal_status', note: `Goal marked ${status}.` });
  db.save();
  return getDashboard(userId);
}

function updateMilestonesAndMetrics(goalId: string, userId: string) {
  const store = data();
  const goal = store.goals.find(item => item.id === goalId && item.user_id === userId);
  if (!goal) return;
  const tasks = store.tasks.filter(item => item.goal_id === goalId && item.user_id === userId);
  for (const milestone of store.milestones!.filter(item => item.goal_id === goalId && item.user_id === userId)) {
    const milestoneTasks = tasks.filter(task => task.milestone_id === milestone.id);
    const complete = milestoneTasks.length > 0 && milestoneTasks.every(task => task.status === 'completed');
    const started = milestoneTasks.some(task => task.status === 'completed');
    milestone.status = complete ? 'completed' : started ? 'in_progress' : 'pending';
  }
  const metrics = calculateAnalytics(goal, tasks, store.plan_revisions!.filter(item => item.goal_id === goalId));
  Object.assign(goal, { completion_rate: metrics.overallProgress, consistency: metrics.consistencyIndex, success_probability: metrics.successProbability, burnout_risk: metrics.burnoutRisk });
  store.current_mission = tasks.find(task => task.status === 'todo' && task.scheduled_date >= dateOnly())?.title || 'Review progress and choose the next meaningful action.';
}

export async function coachChat(userId: string, message: string) {
  if (!message?.trim() || message.trim().length > 2000) throw new Error('Message must be between 1 and 2000 characters.');
  const dashboard = getDashboard(userId);
  if (!dashboard.activeGoal) throw new Error('Create a goal before chatting with NOVA.');
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase() || 'gemini';
  if (provider !== 'ollama' && !isGeminiConfigured()) throw new Error('Gemini is not configured. Add GEMINI_API_KEY to the server .env file.');
  const store = data();
  store.chat_history.push({ id: id(), goal_id: dashboard.activeGoal.id, user_id: userId, role: 'user', content: message.trim(), created_at: now() });
  const prompt = `Current goal: ${JSON.stringify(dashboard.activeGoal)}
Milestones: ${JSON.stringify(dashboard.milestones)}
Today's tasks: ${JSON.stringify(dashboard.tasks.filter(task => task.scheduled_date === dateOnly()))}
Completed tasks: ${JSON.stringify(dashboard.tasks.filter(task => task.status === 'completed').slice(-10))}
Missed tasks: ${JSON.stringify(dashboard.tasks.filter(task => task.status === 'skipped').slice(-10))}
Analytics: ${JSON.stringify(dashboard.analytics)}
Memory: ${JSON.stringify(dashboard.memories.slice(-15))}
Progress: ${JSON.stringify(dashboard.progressEntries.slice(0, 15))}
Previous chat: ${JSON.stringify(dashboard.chatHistory.slice(-10))}
User message: ${message.trim()}`;
  const response = await generateText(prompt, AI_COACHING_SYSTEM_PROMPT, { temperature: 0.45 });
  store.chat_history.push({ id: id(), goal_id: dashboard.activeGoal.id, user_id: userId, role: 'assistant', content: response, created_at: now() });
  db.save();
  return { response, dashboard: getDashboard(userId) };
}






