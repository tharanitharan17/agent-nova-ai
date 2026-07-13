import type { DashboardAnalytics, PlanRevision } from './domain.js';
import type { Goal, Task } from './db.js';

const dayKey = (value: string | Date) => new Date(value).toISOString().slice(0, 10);
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function calculateAnalytics(goal: Goal, tasks: Task[], revisions: PlanRevision[] = []): DashboardAnalytics {
  const now = new Date();
  const today = dayKey(now);
  const completed = tasks.filter(task => task.status === 'completed');
  const skipped = tasks.filter(task => task.status === 'skipped');
  const pending = tasks.filter(task => task.status !== 'completed' && task.status !== 'skipped');
  const overdue = pending.filter(task => Boolean(task.scheduled_date && task.scheduled_date < today));
  const total = tasks.length;
  const overallProgress = total ? (completed.length / total) * 100 : 0;

  const recentStart = new Date(now);
  recentStart.setDate(recentStart.getDate() - 6);
  const recentTasks = tasks.filter(task => {
    const date = task.completed_at || task.scheduled_date || task.created_at;
    return new Date(date) >= recentStart && new Date(date) <= now;
  });
  const recentCompleted = recentTasks.filter(task => task.status === 'completed').length;
  const weeklyCompletionRate = recentTasks.length ? (recentCompleted / recentTasks.length) * 100 : 0;

  const completionDays = new Set(completed.map(task => dayKey(task.completed_at || task.created_at)));
  let currentStreak = 0;
  const cursor = new Date(now);
  if (!completionDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (completionDays.has(dayKey(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const consistencyIndex = total
    ? clamp((overallProgress * 0.45) + (weeklyCompletionRate * 0.4) + (Math.min(currentStreak, 7) / 7 * 15) - (overdue.length / total * 25))
    : 0;

  const daysRemaining = Math.max(0, Math.ceil((new Date(goal.target_date).getTime() - now.getTime()) / 86_400_000));
  const scheduledMinutes = pending.reduce((sum, task) => sum + (task.estimated_minutes || 0), 0);
  const capacityMinutes = Math.max(1, daysRemaining * (goal.daily_available_minutes || 60) * ((goal.working_days?.length || 5) / 7));
  const workloadRatio = scheduledMinutes / capacityMinutes;
  const milestoneProgress = overallProgress;

  // Success is derived from actual execution (60%), time/capacity feasibility (25%),
  // milestone/task progress (10%), and revision stability (5%).
  const executionScore = total ? (overallProgress * 0.35) + (weeklyCompletionRate * 0.25) : 35;
  const overduePenalty = total ? (overdue.length / total) * 25 : 0;
  const capacityScore = workloadRatio <= 1 ? 100 : Math.max(0, 100 - ((workloadRatio - 1) * 80));
  const timeScore = daysRemaining > 0 ? 100 : (overallProgress >= 100 ? 100 : 0);
  const revisionPenalty = Math.min(15, revisions.length * 2);
  const successProbability = clamp(executionScore + (capacityScore * 0.15) + (timeScore * 0.1) + (milestoneProgress * 0.1) - overduePenalty - revisionPenalty);

  const dailyLoad = tasks
    .filter(task => task.status !== 'completed' && task.scheduled_date === today)
    .reduce((sum, task) => sum + (task.estimated_minutes || 0), 0);
  const loadRatio = dailyLoad / Math.max(1, goal.daily_available_minutes || 60);
  const missedFrequency = total ? skipped.length / total : 0;
  const overdueRatio = total ? overdue.length / total : 0;
  const highLoadDays = new Set(tasks.filter(task => (task.estimated_minutes || 0) > (goal.daily_available_minutes || 60)).map(task => task.scheduled_date)).size;
  const burnoutRisk = clamp((Math.max(0, loadRatio - 0.8) * 35) + (overdueRatio * 35) + (missedFrequency * 20) + (Math.min(highLoadDays, 5) * 2));

  return {
    completedTasks: completed.length,
    pendingTasks: pending.length,
    overdueTasks: overdue.length,
    currentStreak,
    weeklyCompletionRate: clamp(weeklyCompletionRate),
    consistencyIndex,
    successProbability,
    burnoutRisk,
    overallProgress: clamp(overallProgress),
  };
}

