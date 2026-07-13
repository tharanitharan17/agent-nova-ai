import { db, type Task } from './db.js';
import type { TodayDashboard, Milestone } from './domain.js';
import { generateText, isGeminiConfigured } from './gemini.js';

const dateOnly = (value = new Date()) => value.toISOString().slice(0, 10);

/**
 * Auto-schedule: when no tasks are scheduled for today, promote the highest-priority
 * pending task (overdue first, then next upcoming) to today's date — respecting
 * the user's daily_available_minutes cap.
 */
function autoScheduleTodayTasks(userId: string, goalId: string): void {
  const store = db.getData() as ReturnType<typeof db.getData> & { milestones?: Milestone[] };
  const today = dateOnly();
  const goal = store.goals.find(g => g.id === goalId && g.user_id === userId);
  if (!goal) return;

  const userTasks = store.tasks.filter(t => t.goal_id === goalId && t.user_id === userId);
  const todayPending = userTasks.filter(t => t.scheduled_date === today && t.status === 'todo');

  // Already have today tasks — nothing to do
  if (todayPending.length > 0) return;

  const dailyCap = goal.daily_available_minutes || 60;
  const todayCompletedMinutes = userTasks
    .filter(t => t.status === 'completed' && t.completed_at?.slice(0, 10) === today)
    .reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
  let remainingMinutes = Math.max(0, dailyCap - todayCompletedMinutes);

  if (remainingMinutes < 10) return; // not enough time left

  // Priority ordering: critical > high > medium > low
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  // First: promote overdue tasks (past scheduled_date, still todo)
  const overdue = userTasks
    .filter(t => t.status === 'todo' && t.scheduled_date && t.scheduled_date < today)
    .sort((a, b) => (priorityOrder[a.priority || 'low'] ?? 3) - (priorityOrder[b.priority || 'low'] ?? 3));

  for (const task of overdue) {
    if ((task.estimated_minutes || 0) <= remainingMinutes) {
      task.scheduled_date = today;
      remainingMinutes -= task.estimated_minutes || 0;
      if (remainingMinutes < 10) break;
    }
  }

  // If still no today tasks, promote next upcoming
  const nowTodayCount = userTasks.filter(t => t.scheduled_date === today && t.status === 'todo').length;
  if (nowTodayCount === 0) {
    const upcoming = userTasks
      .filter(t => t.status === 'todo' && t.scheduled_date && t.scheduled_date > today)
      .sort((a, b) => {
        const pDiff = (priorityOrder[a.priority || 'low'] ?? 3) - (priorityOrder[b.priority || 'low'] ?? 3);
        if (pDiff !== 0) return pDiff;
        return (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
      });

    for (const task of upcoming) {
      if ((task.estimated_minutes || 0) <= remainingMinutes) {
        task.scheduled_date = today;
        remainingMinutes -= task.estimated_minutes || 0;
        break; // Only pull one upcoming task per auto-schedule
      }
    }
  }

  db.save();
}

/**
 * Build a deterministic recommendation string based on current task state.
 * Used as fallback when Gemini is unavailable or as the instant response.
 */
function buildDeterministicRecommendation(
  todayTasks: Task[],
  overdueTasks: Task[],
  completedToday: Task[],
  milestones: Milestone[],
): string {
  if (overdueTasks.length > 0) {
    const top = overdueTasks[0];
    return `You missed "${top.title}". Finish it today before starting new work.`;
  }
  if (todayTasks.length > 0) {
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...todayTasks].sort(
      (a, b) => (priorityOrder[a.priority || 'low'] ?? 3) - (priorityOrder[b.priority || 'low'] ?? 3),
    );
    const top = sorted[0];
    const milestone = milestones.find(m => m.id === top.milestone_id);
    const unlocks = milestone ? ` because it unlocks "${milestone.title}"` : '';
    return `Start with "${top.title}"${unlocks}. Estimated: ${top.estimated_minutes || 0} minutes.`;
  }
  if (completedToday.length > 0) {
    return `Great progress! You completed ${completedToday.length} task${completedToday.length > 1 ? 's' : ''} today. Rest or review upcoming work.`;
  }
  return 'No tasks are scheduled yet. Create a goal to get your personalized plan.';
}

/**
 * Optionally enhance the recommendation with Gemini for a more contextual message.
 * Falls back to deterministic recommendation on failure.
 */
async function generateAIRecommendation(
  todayTasks: Task[],
  overdueTasks: Task[],
  completedToday: Task[],
  milestones: Milestone[],
  goalTitle: string,
): Promise<string> {
  const fallback = buildDeterministicRecommendation(todayTasks, overdueTasks, completedToday, milestones);

  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase() || 'gemini';
  if (provider !== 'ollama' && !isGeminiConfigured()) return fallback;

  try {
    const prompt = `You are NOVA, an AI goal coach. Generate ONE short, actionable recommendation sentence (max 40 words) for the user right now.

Goal: "${goalTitle}"
Today's pending tasks: ${JSON.stringify(todayTasks.map(t => ({ title: t.title, priority: t.priority, minutes: t.estimated_minutes })))}
Overdue tasks: ${JSON.stringify(overdueTasks.map(t => ({ title: t.title, priority: t.priority, scheduledDate: t.scheduled_date })))}
Completed today: ${completedToday.length} tasks
Milestones: ${JSON.stringify(milestones.map(m => ({ title: m.title, status: m.status })))}

Rules:
- If overdue tasks exist, tell the user to finish them first
- If today has tasks, recommend starting with the highest priority one and explain why
- If all today's tasks are done, congratulate briefly
- Be specific — mention task names
- No markdown formatting — plain text only`;

    const result = await generateText(prompt, 'You are NOVA, a concise AI goal coach. Return one plain text sentence.', { temperature: 0.3 });
    return result || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Main entry point: returns the complete today dashboard for a user.
 * Automatically schedules tasks if today is empty, generates recommendation.
 */
export function getTodayDashboard(userId: string): TodayDashboard {
  const store = db.getData() as ReturnType<typeof db.getData> & { milestones?: Milestone[] };
  const goals = store.goals.filter(g => g.user_id === userId);
  const activeGoal = goals.find(g => g.status === 'active');

  if (!activeGoal) {
    return {
      todayMission: 'Create your first goal to get started.',
      todayTasks: [],
      overdueTasks: [],
      completedToday: [],
      recommendation: 'No active goal. Create one to get your personalized daily plan.',
      estimatedMinutes: 0,
      completionPercentage: 0,
    };
  }

  // Auto-schedule before computing
  autoScheduleTodayTasks(userId, activeGoal.id);

  const today = dateOnly();
  const userTasks = store.tasks.filter(t => t.goal_id === activeGoal.id && t.user_id === userId);
  const milestones = (store.milestones || []).filter(
    (m: Milestone) => m.goal_id === activeGoal.id && m.user_id === userId,
  );

  const todayTasks = userTasks.filter(t => t.scheduled_date === today && t.status === 'todo');
  const overdueTasks = userTasks.filter(
    t => t.status === 'todo' && t.scheduled_date !== undefined && t.scheduled_date < today,
  );
  const completedToday = userTasks.filter(
    t => t.status === 'completed' && t.completed_at?.slice(0, 10) === today,
  );

  const actionable = todayTasks.length + overdueTasks.length;
  const total = actionable + completedToday.length;
  const completionPercentage = total > 0 ? Math.round((completedToday.length / total) * 100) : 0;
  const estimatedMinutes = [...todayTasks, ...overdueTasks].reduce(
    (sum, t) => sum + (t.estimated_minutes || 0),
    0,
  );

  // Build mission string
  const currentMilestone = milestones.find((m: Milestone) => m.status === 'in_progress' || m.status === 'pending');
  const topTask = todayTasks[0] || overdueTasks[0];
  const todayMission = topTask
    ? `${currentMilestone ? `[${currentMilestone.title}] ` : ''}${topTask.title}`
    : completedToday.length > 0
      ? 'All tasks completed for today!'
      : 'Review your roadmap and plan your next steps.';

  const recommendation = buildDeterministicRecommendation(todayTasks, overdueTasks, completedToday, milestones);

  return {
    todayMission,
    todayTasks,
    overdueTasks,
    completedToday,
    recommendation,
    estimatedMinutes,
    completionPercentage,
  };
}

/**
 * Async version that includes AI-powered recommendation.
 * Use this for the API endpoint where async is acceptable.
 */
export async function getTodayDashboardAsync(userId: string): Promise<TodayDashboard> {
  const dashboard = getTodayDashboard(userId);

  const store = db.getData() as ReturnType<typeof db.getData> & { milestones?: Milestone[] };
  const activeGoal = store.goals.find(g => g.user_id === userId && g.status === 'active');
  if (!activeGoal) return dashboard;

  const milestones = (store.milestones || []).filter(
    (m: Milestone) => m.goal_id === activeGoal.id && m.user_id === userId,
  );

  const aiRecommendation = await generateAIRecommendation(
    dashboard.todayTasks,
    dashboard.overdueTasks,
    dashboard.completedToday,
    milestones,
    activeGoal.title,
  );

  return { ...dashboard, recommendation: aiRecommendation };
}
