export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Goal {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  created_at: string;
  target_date: string;
  daily_available_minutes?: number;
  experience_level?: ExperienceLevel;
  working_days?: string[];
  motivation?: string;
  known_obstacles?: string;
  category?: string;
  difficulty?: string;
  goal_summary?: string;
  strategy?: string;
  success_criteria?: string[];
  risks?: string[];
  recovery_plan?: string;
  motivation_message?: string;
  success_probability: number;
  consistency: number;
  completion_rate: number;
  burnout_risk: number;
}

export interface Task {
  id: string;
  goal_id: string;
  user_id?: string;
  milestone_id?: string;
  title: string;
  description: string;
  scheduled_date?: string;
  estimated_minutes?: number;
  priority?: TaskPriority;
  dependencies?: string[];
  progress_note?: string;
  skip_reason?: string;
  time_frame: 'today' | 'week' | 'month' | 'milestone';
  status: 'todo' | 'in_progress' | 'completed' | 'skipped';
  resource_links: string[];
  created_at: string;
  completed_at?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  description: string;
  target_date: string;
  success_criteria: string[];
  status: 'pending' | 'in_progress' | 'completed';
}

export interface Memory {
  id: string;
  goal_id: string;
  content: string;
  category: 'user_pref' | 'agent_insight' | 'learned_skill' | 'milestone_reached';
  created_at: string;
  importance?: number;
  tags?: string[];
}

export interface ChatMessage {
  id: string;
  goal_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ProgressEntry {
  id: string;
  goal_id: string;
  task_id?: string;
  type: string;
  note: string;
  created_at: string;
}

export interface PlanRevision {
  id: string;
  goal_id: string;
  reason: string;
  explanation: string;
  changes: string[];
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

export interface AgentLog {
  id: string;
  goal_id: string;
  agent_name: string;
  status: 'running' | 'completed' | 'failed';
  thought: string;
  decision: string;
  confidence: number;
  created_at: string;
}

export interface GoalFormData {
  title: string;
  description: string;
  targetDate: string;
  dailyMinutes: number;
  experienceLevel: ExperienceLevel;
  workingDays: string[];
  motivation: string;
  obstacles: string;
}

export interface AppState {
  activeGoal: Goal | null;
  goals: Goal[];
  tasks: Task[];
  milestones: Milestone[];
  memories: Memory[];
  chatHistory: ChatMessage[];
  progressEntries: ProgressEntry[];
  planRevisions: PlanRevision[];
  checkIns: Array<{ id: string; date: string; energy: number; motivation: number; recommendation: string }>;
  weeklyPlan?: Array<{ weekNumber: number; focus: string; outcomes: string[] }>;
  analytics: DashboardAnalytics | null;
  currentMission: string;
  agentStatus: string;
  agent_logs?: AgentLog[];
}

export interface TodayFocus {
  todayMission: string;
  todayTasks: Task[];
  overdueTasks: Task[];
  completedToday: Task[];
  recommendation: string;
  estimatedMinutes: number;
  completionPercentage: number;
}

