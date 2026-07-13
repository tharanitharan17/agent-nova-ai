export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type GoalStatus = 'active' | 'paused' | 'completed' | 'abandoned';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface GoalInput {
  title: string;
  description: string;
  targetDate: string;
  dailyMinutes: number;
  experienceLevel: ExperienceLevel;
  workingDays: string[];
  motivation: string;
  obstacles: string;
}

export interface PlanMilestone {
  title: string;
  description: string;
  targetDate: string;
  successCriteria: string[];
}

export interface PlanWeek {
  weekNumber: number;
  focus: string;
  outcomes: string[];
}

export interface PlanTask {
  title: string;
  description: string;
  scheduledDate: string;
  estimatedMinutes: number;
  priority: TaskPriority;
  status: 'pending';
  milestone: string;
  dependencies: string[];
}

export interface GeneratedPlan {
  goalSummary: string;
  category: string;
  difficulty: ExperienceLevel;
  targetDate: string;
  estimatedDurationDays: number;
  weeklyCommitmentHours: number;
  successCriteria: string[];
  obstacles: string[];
  strategy: string;
  milestones: PlanMilestone[];
  weeklyPlan: PlanWeek[];
  tasks: PlanTask[];
  risks: string[];
  recoveryPlan: string;
  motivationMessage: string;
  initialSuccessProbability: number;
}

export interface Milestone {
  id: string;
  goal_id: string;
  user_id: string;
  title: string;
  description: string;
  target_date: string;
  success_criteria: string[];
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
}

export interface ProgressEntry {
  id: string;
  goal_id: string;
  user_id: string;
  task_id?: string;
  type: 'goal_created' | 'plan_generated' | 'task_completed' | 'task_skipped' | 'task_rescheduled' | 'progress_note' | 'plan_revised' | 'check_in' | 'goal_status';
  note: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface PlanRevision {
  id: string;
  goal_id: string;
  user_id: string;
  reason: string;
  explanation: string;
  changes: string[];
  created_at: string;
}

export interface DailyCheckIn {
  id: string;
  goal_id: string;
  user_id: string;
  date: string;
  available_minutes: number;
  energy: number;
  motivation: number;
  blockers: string;
  availability_changed: boolean;
  recommendation: string;
  created_at: string;
}

export interface DashboardAnalytics {
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  currentStreak: number;
  weeklyCompletionRate: number;
  consistencyIndex: number;
  successProbability: number;
  burnoutRisk: number;
  overallProgress: number;
}

export interface TodayDashboard {
  todayMission: string;
  todayTasks: import('./db.js').Task[];
  overdueTasks: import('./db.js').Task[];
  completedToday: import('./db.js').Task[];
  recommendation: string;
  estimatedMinutes: number;
  completionPercentage: number;
}

export interface ProductData {
  milestones?: Milestone[];
  weekly_plans?: Array<PlanWeek & { goal_id: string; user_id: string }>;
  progress_entries?: ProgressEntry[];
  plan_revisions?: PlanRevision[];
  daily_check_ins?: DailyCheckIn[];
}

