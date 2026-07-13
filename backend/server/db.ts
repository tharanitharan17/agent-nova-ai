import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface Goal {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  created_at: string;
  target_date: string;
  daily_available_minutes?: number;
  experience_level?: 'beginner' | 'intermediate' | 'advanced';
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
  priority?: 'low' | 'medium' | 'high' | 'critical';
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

export interface Memory {
  id: string;
  goal_id: string;
  user_id?: string;
  content: string;
  category: 'user_pref' | 'agent_insight' | 'learned_skill' | 'milestone_reached';
  created_at: string;
  importance?: number;
  tags?: string[];
}

export interface ChatMessage {
  id: string;
  goal_id: string;
  user_id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
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

export interface UserProfile {
  learning_style: string;
  strengths: string[];
  challenges: string[];
  motivation_triggers: string[];
  communication_preference: string;
  total_sessions: number;
  total_tasks_completed: number;
  last_active: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface SubGoalRecord {
  title: string;
  description: string;
  priority: number;
  estimated_weeks: number;
  prerequisites: string[];
  status: 'pending' | 'in_progress' | 'completed';
}

export interface AgentPlan {
  goal_id: string;
  sub_goals: SubGoalRecord[];
  reasoning_chain: string[];
  critical_path: string[];
  dependencies: Record<string, string[]>;
  master_strategy: string;
  plan_version: number;
  updated_at: string;
}

export interface ReflectionRecord {
  id: string;
  goal_id: string;
  task_id: string;
  task_title: string;
  lessons_learned: string[];
  skill_gained: string;
  velocity_assessment: string;
  emotional_signal: string;
  replan_triggers: string[];
  created_at: string;
}

export interface DatabaseSchema {
  users: User[];
  goals: Goal[];
  tasks: Task[];
  memories: Memory[];
  chat_history: ChatMessage[];
  agent_logs: AgentLog[];
  current_mission: string;
  agent_status: 'idle' | 'analyzing' | 'planning' | 'reasoning' | 'deciding' | 'reflecting' | 'coaching';
  user_profile: UserProfile;
  agent_plans: AgentPlan[];
  reflections: ReflectionRecord[];
}

const DB_FILE = path.resolve(process.env.DB_FILE?.trim() || path.join(process.cwd(), 'db.json'));

const DEFAULT_USER_PROFILE: UserProfile = {
  learning_style: 'unknown',
  strengths: [],
  challenges: [],
  motivation_triggers: [],
  communication_preference: 'balanced',
  total_sessions: 0,
  total_tasks_completed: 0,
  last_active: new Date().toISOString(),
};

const DEFAULT_DB: DatabaseSchema = {
  users: [],
  goals: [],
  tasks: [],
  memories: [],
  chat_history: [],
  agent_logs: [],
  current_mission: 'Waiting for your first goal to begin...',
  agent_status: 'idle',
  user_profile: { ...DEFAULT_USER_PROFILE },
  agent_plans: [],
  reflections: [],
};

export class Database {
  private data: DatabaseSchema = { ...DEFAULT_DB };

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        this.data = {
          ...DEFAULT_DB,
          ...parsed,
          user_profile: { ...DEFAULT_USER_PROFILE, ...parsed.user_profile },
          agent_plans: parsed.agent_plans ?? [],
          reflections: parsed.reflections ?? [],
          users: parsed.users ?? [],
        };
      } else {
        this.data = { ...DEFAULT_DB };
        this.save();
      }
    } catch (error) {
      console.error('Error loading database:', error);
      this.data = { ...DEFAULT_DB };
    }
  }

  public save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }

  public getData(): DatabaseSchema {
    return this.data;
  }

  /** Clears goal-scoped data but preserves cross-session user profile and global memories. */
  public clear() {
    const globalMemories = this.data.memories.filter(m => m.goal_id === '__global__');
    const userProfile = this.data.user_profile;

    this.data = {
      users: this.data.users,
      goals: [],
      tasks: [],
      memories: globalMemories,
      chat_history: [],
      agent_logs: [],
      current_mission: 'Waiting for your first goal to begin...',
      agent_status: 'idle',
      user_profile: userProfile,
      agent_plans: [],
      reflections: [],
    };
    this.save();
  }


  // Authentication users
  public findUserByEmail(email: string): User | undefined {
    return this.data.users.find(user => user.email === email.trim().toLowerCase());
  }

  public findUserById(id: string): User | undefined {
    return this.data.users.find(user => user.id === id);
  }

  public addUser(name: string, email: string, passwordHash: string): User {
    const user: User = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      created_at: new Date().toISOString(),
    };
    this.data.users.push(user);
    this.save();
    return user;
  }
  // Goal operations
  public getGoals(): Goal[] {
    return this.data.goals;
  }

  public addGoal(title: string): Goal {
    const goal: Goal = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      status: 'active',
      created_at: new Date().toISOString(),
      target_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      success_probability: 65,
      consistency: 80,
      completion_rate: 0,
      burnout_risk: 15,
    };
    this.data.goals.push(goal);
    this.save();
    return goal;
  }

  public updateGoalMetrics(goalId: string, metrics: Partial<Pick<Goal, 'success_probability' | 'consistency' | 'completion_rate' | 'burnout_risk'>>) {
    const goal = this.data.goals.find(g => g.id === goalId);
    if (goal) {
      Object.assign(goal, metrics);
      this.save();
    }
  }

  // Task operations
  public getTasks(goalId?: string): Task[] {
    if (goalId) {
      return this.data.tasks.filter(t => t.goal_id === goalId);
    }
    return this.data.tasks;
  }

  public addTask(task: Omit<Task, 'id' | 'created_at'>): Task {
    const newTask: Task = {
      ...task,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
    };
    this.data.tasks.push(newTask);
    this.save();
    return newTask;
  }

  public updateTaskStatus(taskId: string, status: Task['status']): Task | null {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      if (status === 'completed') {
        task.completed_at = new Date().toISOString();
      } else {
        delete task.completed_at;
      }
      this.save();
      return task;
    }
    return null;
  }

  public updateTaskTimeFrame(taskId: string, timeFrame: Task['time_frame']): Task | null {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (task) {
      task.time_frame = timeFrame;
      this.save();
      return task;
    }
    return null;
  }

  public removeTask(taskId: string): boolean {
    const idx = this.data.tasks.findIndex(t => t.id === taskId);
    if (idx >= 0) {
      this.data.tasks.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public clearTasks(goalId: string) {
    this.data.tasks = this.data.tasks.filter(t => t.goal_id !== goalId);
    this.save();
  }

  // Memory operations
  public getMemories(goalId?: string): Memory[] {
    if (goalId) {
      return this.data.memories.filter(m => m.goal_id === goalId);
    }
    return this.data.memories;
  }

  public addMemory(
    goal_id: string,
    content: string,
    category: Memory['category'],
    importance = 5,
    tags?: string[]
  ): Memory {
    const memory: Memory = {
      id: Math.random().toString(36).substr(2, 9),
      goal_id,
      content,
      category,
      importance,
      tags,
      created_at: new Date().toISOString(),
    };
    this.data.memories.push(memory);
    this.save();
    return memory;
  }

  public removeMemory(memoryId: string): boolean {
    const idx = this.data.memories.findIndex(m => m.id === memoryId);
    if (idx >= 0) {
      this.data.memories.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // Chat History
  public getChatHistory(goalId?: string): ChatMessage[] {
    if (goalId) {
      return this.data.chat_history.filter(c => c.goal_id === goalId);
    }
    return this.data.chat_history;
  }

  public addChatMessage(goal_id: string, role: 'user' | 'assistant', content: string): ChatMessage {
    const message: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      goal_id,
      role,
      content,
      created_at: new Date().toISOString(),
    };
    this.data.chat_history.push(message);
    this.save();
    return message;
  }

  // Agent Logs
  public getAgentLogs(goalId?: string): AgentLog[] {
    if (goalId) {
      return this.data.agent_logs.filter(l => l.goal_id === goalId);
    }
    return this.data.agent_logs;
  }

  public addAgentLog(log: Omit<AgentLog, 'id' | 'created_at'>): AgentLog {
    const newLog: AgentLog = {
      ...log,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
    };
    this.data.agent_logs.push(newLog);
    this.save();
    return newLog;
  }

  public setAgentStatus(status: DatabaseSchema['agent_status']) {
    this.data.agent_status = status;
    this.save();
  }

  public setCurrentMission(mission: string) {
    this.data.current_mission = mission;
    this.save();
  }

  // User Profile
  public getUserProfile(): UserProfile {
    return this.data.user_profile;
  }

  public updateUserProfile(updates: Partial<UserProfile>) {
    this.data.user_profile = { ...this.data.user_profile, ...updates };
    this.save();
  }

  // Agent Plans
  public getAgentPlan(goalId: string): AgentPlan | undefined {
    return this.data.agent_plans.find(p => p.goal_id === goalId);
  }

  public setAgentPlan(plan: AgentPlan) {
    const idx = this.data.agent_plans.findIndex(p => p.goal_id === plan.goal_id);
    if (idx >= 0) {
      this.data.agent_plans[idx] = plan;
    } else {
      this.data.agent_plans.push(plan);
    }
    this.save();
  }

  // Reflections
  public getReflections(goalId?: string): ReflectionRecord[] {
    if (goalId) {
      return this.data.reflections.filter(r => r.goal_id === goalId);
    }
    return this.data.reflections;
  }

  public addReflection(reflection: Omit<ReflectionRecord, 'id' | 'created_at'>): ReflectionRecord {
    const record: ReflectionRecord = {
      ...reflection,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
    };
    this.data.reflections.push(record);
    this.save();
    return record;
  }
}

export const db = new Database();




