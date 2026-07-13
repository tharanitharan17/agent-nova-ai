import { db, Task, Goal } from './db.js';
import { generateJSON, generateText } from './gemini.js';
import { Type } from '@google/genai';
import { buildMemoryContext, getUserProfileContext } from './agent-memory.js';

// ─── Goal Decomposition ───────────────────────────────────────────────────────

export interface SubGoal {
  title: string;
  description: string;
  priority: number;
  estimatedWeeks: number;
  prerequisites: string[];
}

export async function decomposeGoal(
  goalTitle: string,
  goalId: string
): Promise<{ subGoals: SubGoal[]; masterStrategy: string; estimatedMonths: number }> {
  const memoryContext = buildMemoryContext(goalId);
  const profileContext = getUserProfileContext();

  const prompt = `Decompose this high-level goal into a hierarchical structure.

Goal: "${goalTitle}"

User profile:
${profileContext}

Known context:
${memoryContext}

Create 4-6 sub-goals that form a logical progression from foundation to mastery.
Each sub-goal should have clear prerequisites and realistic time estimates.
Also provide a master strategy explaining the overall approach.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      subGoals: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            priority: { type: Type.NUMBER, description: '1 = highest priority' },
            estimatedWeeks: { type: Type.NUMBER },
            prerequisites: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['title', 'description', 'priority', 'estimatedWeeks', 'prerequisites'],
        },
      },
      masterStrategy: { type: Type.STRING },
      estimatedMonths: { type: Type.NUMBER },
    },
    required: ['subGoals', 'masterStrategy', 'estimatedMonths'],
  };

  return generateJSON(
    prompt,
    'You are GoalDecompositionAgent. Break ambitious goals into structured, dependency-aware sub-goals using first-principles thinking.',
    schema
  );
}

// ─── Multi-Step Reasoning ─────────────────────────────────────────────────────

export async function runReasoningChain(
  goalTitle: string,
  subGoals: SubGoal[],
  proposedTasks: Array<{ title: string; timeFrame: string; difficulty: string }>,
  goalId: string
): Promise<{
  reasoningSteps: string[];
  criticalPath: string[];
  potentialObstacles: string[];
  planConfidence: number;
  adjustments: string[];
}> {
  const memoryContext = buildMemoryContext(goalId);

  const prompt = `Perform multi-step reasoning to validate and refine this learning plan.

Goal: "${goalTitle}"

Sub-goals:
${subGoals.map(s => `- [P${s.priority}] ${s.title}: ${s.description}`).join('\n')}

Proposed tasks:
${proposedTasks.map(t => `- [${t.timeFrame}] ${t.title} (${t.difficulty})`).join('\n')}

User context:
${memoryContext}

Think step-by-step:
1. Validate sub-goal ordering and dependencies
2. Check task sequencing for cognitive load balance
3. Identify gaps or redundancies in the curriculum
4. Assess alignment with user's known strengths/challenges
5. Determine the critical path and bottlenecks
6. Recommend specific adjustments

Provide your reasoning as explicit steps, then conclusions.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      reasoningSteps: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Explicit reasoning steps (5-7 steps)',
      },
      criticalPath: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Ordered list of task titles forming the critical path',
      },
      potentialObstacles: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      planConfidence: { type: Type.NUMBER, description: '0-100 confidence in this plan' },
      adjustments: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Specific recommended plan adjustments',
      },
    },
    required: ['reasoningSteps', 'criticalPath', 'potentialObstacles', 'planConfidence', 'adjustments'],
  };

  return generateJSON(
    prompt,
    'You are ReasoningAgent. Use chain-of-thought reasoning to validate learning plans. Be rigorous and user-aware.',
    schema
  );
}

// ─── Enhanced Planning ────────────────────────────────────────────────────────

export async function generatePlan(
  goalTitle: string,
  subGoals: SubGoal[],
  reasoningAdjustments: string[],
  goalId: string
): Promise<{
  tasks: Array<{
    title: string;
    description: string;
    timeFrame: string;
    difficulty: string;
    resourceLinks: string[];
    dependsOn: string[];
    subGoalRef: string;
  }>;
}> {
  const profileContext = getUserProfileContext();
  const memoryContext = buildMemoryContext(goalId);

  const prompt = `Create an actionable task roadmap for this goal.

Goal: "${goalTitle}"

Sub-goals to cover:
${subGoals.map(s => `- ${s.title}: ${s.description}`).join('\n')}

Reasoning adjustments to apply:
${reasoningAdjustments.length > 0 ? reasoningAdjustments.map(a => `- ${a}`).join('\n') : 'None — proceed with standard plan'}

User profile: ${profileContext}
Context: ${memoryContext}

Generate 8-12 tasks with:
- timeFrame: 'today' (1-2), 'week' (2-3), 'month' (3-4), 'milestone' (2-3)
- dependsOn: titles of prerequisite tasks (empty array if none)
- subGoalRef: which sub-goal this task advances
- Personalized difficulty based on user profile`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      tasks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            timeFrame: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            resourceLinks: { type: Type.ARRAY, items: { type: Type.STRING } },
            dependsOn: { type: Type.ARRAY, items: { type: Type.STRING } },
            subGoalRef: { type: Type.STRING },
          },
          required: ['title', 'description', 'timeFrame', 'difficulty', 'resourceLinks', 'dependsOn', 'subGoalRef'],
        },
      },
    },
    required: ['tasks'],
  };

  return generateJSON(
    prompt,
    'You are PlanningAgent. Create dependency-aware, personalized learning roadmaps.',
    schema
  );
}

// ─── Prediction ───────────────────────────────────────────────────────────────

export async function predictMetrics(
  goalTitle: string,
  tasks: Task[],
  goal: Goal | undefined,
  isInitial: boolean
): Promise<{ successProbability: number; burnoutRisk: number; consistencyMetric: number; rationale: string }> {
  const completed = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const profileContext = getUserProfileContext();

  const prompt = isInitial
    ? `Initial trajectory projection for goal "${goalTitle}" with ${total} planned tasks.
User profile: ${profileContext}
Assess realistic success probability, burnout risk, and consistency score (0-100 each).`
    : `Updated trajectory after progress on "${goalTitle}".
Completion: ${completionRate}% (${completed}/${total} tasks)
Current metrics — Success: ${goal?.success_probability}%, Burnout: ${goal?.burnout_risk}%, Consistency: ${goal?.consistency}%
Remaining tasks: ${tasks.filter(t => t.status !== 'completed').map(t => t.title).join(', ')}
User profile: ${profileContext}
Recalculate metrics based on actual progress patterns.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      successProbability: { type: Type.NUMBER },
      burnoutRisk: { type: Type.NUMBER },
      consistencyMetric: { type: Type.NUMBER },
      rationale: { type: Type.STRING },
    },
    required: ['successProbability', 'burnoutRisk', 'consistencyMetric', 'rationale'],
  };

  return generateJSON(
    prompt,
    'You are PredictionAgent. Model user trajectory using behavioral signals and plan density.',
    schema
  );
}

// ─── Deep Reflection ──────────────────────────────────────────────────────────

export async function reflectOnTaskCompletion(
  goalTitle: string,
  completedTaskTitle: string,
  completedTaskDifficulty: string,
  allTasks: Task[],
  goalId: string
): Promise<{
  reflection: string;
  lessonsLearned: string[];
  skillGained: string;
  velocityAssessment: string;
  emotionalSignal: string;
  replanTriggers: string[];
  subGoalProgress: string;
}> {
  const completed = allTasks.filter(t => t.status === 'completed').length;
  const total = allTasks.length;
  const memoryContext = buildMemoryContext(goalId, completedTaskTitle);
  const recentReflections = db.getReflections(goalId).slice(-3);

  const prompt = `Deep reflection on task completion.

Goal: "${goalTitle}"
Completed task: "${completedTaskTitle}" (${completedTaskDifficulty})
Progress: ${completed} of ${total} tasks (${Math.round((completed / total) * 100)}%)

Recent reflections:
${recentReflections.map(r => `- ${r.task_title}: ${r.skill_gained}`).join('\n') || 'First completion'}

Context:
${memoryContext}

Analyze:
1. What concrete skill/knowledge was gained?
2. What lessons should inform future planning?
3. Is the user's velocity on track, ahead, or behind?
4. Any emotional signals (frustration, excitement, fatigue)?
5. Should the plan be adjusted? Why?
6. Which sub-goal phase does this advance?`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      reflection: { type: Type.STRING, description: 'Narrative reflection (2-3 sentences)' },
      lessonsLearned: { type: Type.ARRAY, items: { type: Type.STRING } },
      skillGained: { type: Type.STRING },
      velocityAssessment: { type: Type.STRING, description: 'on_track, ahead, behind, or stalled' },
      emotionalSignal: { type: Type.STRING },
      replanTriggers: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Reasons to replan, empty if none' },
      subGoalProgress: { type: Type.STRING },
    },
    required: ['reflection', 'lessonsLearned', 'skillGained', 'velocityAssessment', 'emotionalSignal', 'replanTriggers', 'subGoalProgress'],
  };

  return generateJSON(
    prompt,
    'You are ReflectionAgent. Perform deep post-task analysis connecting progress to the larger goal arc.',
    schema
  );
}

// ─── Dynamic Replanning ───────────────────────────────────────────────────────

export async function dynamicReplan(
  goalTitle: string,
  goalId: string,
  replanReason: string
): Promise<{
  shouldReplan: boolean;
  taskUpdates: Array<{ taskTitle: string; action: string; newTimeFrame?: string; reason: string }>;
  newTasks: Array<{ title: string; description: string; timeFrame: string; difficulty: string; resourceLinks: string[] }>;
  removedTaskTitles: string[];
  replanSummary: string;
}> {
  const tasks = db.getTasks(goalId);
  const plan = db.getAgentPlan(goalId);
  const reflections = db.getReflections(goalId).slice(-5);
  const memoryContext = buildMemoryContext(goalId);
  const profileContext = getUserProfileContext();

  const prompt = `Dynamic replanning assessment for goal "${goalTitle}".

Replan trigger: ${replanReason}

Current tasks:
${tasks.map(t => `- [${t.status}] [${t.time_frame}] ${t.title} (${t.difficulty}): ${t.description}`).join('\n')}

Sub-goals: ${plan?.sub_goals.map(s => s.title).join(', ') || 'Not set'}
Critical path: ${plan?.critical_path.join(' → ') || 'Not set'}

Recent reflections:
${reflections.map(r => `- ${r.task_title}: velocity=${r.velocity_assessment}, triggers=${r.replan_triggers.join('; ')}`).join('\n') || 'None'}

User profile: ${profileContext}
Memories: ${memoryContext}

Decide whether to replan. If yes:
- Promote/demote tasks between time frames
- Add new tasks to fill gaps
- Remove tasks that are no longer relevant
- Adjust difficulty based on demonstrated capability

Be conservative — only replan when there's clear evidence of misalignment.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      shouldReplan: { type: Type.BOOLEAN },
      taskUpdates: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            taskTitle: { type: Type.STRING },
            action: { type: Type.STRING, description: 'promote, demote, reprioritize, or modify' },
            newTimeFrame: { type: Type.STRING },
            reason: { type: Type.STRING },
          },
          required: ['taskTitle', 'action', 'reason'],
        },
      },
      newTasks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            timeFrame: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            resourceLinks: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['title', 'description', 'timeFrame', 'difficulty', 'resourceLinks'],
        },
      },
      removedTaskTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
      replanSummary: { type: Type.STRING },
    },
    required: ['shouldReplan', 'taskUpdates', 'newTasks', 'removedTaskTitles', 'replanSummary'],
  };

  return generateJSON(
    prompt,
    'You are ReplanningAgent. Adapt roadmaps based on evidence while minimizing disruption.',
    schema
  );
}

export function applyReplan(
  goalId: string,
  replan: Awaited<ReturnType<typeof dynamicReplan>>
): void {
  if (!replan.shouldReplan) return;

  const tasks = db.getTasks(goalId);

  for (const title of replan.removedTaskTitles) {
    const task = tasks.find(t => t.title === title && t.status !== 'completed');
    if (task) db.removeTask(task.id);
  }

  for (const update of replan.taskUpdates) {
    const task = tasks.find(t => t.title === update.taskTitle);
    if (!task) continue;

    if (update.newTimeFrame && ['today', 'week', 'month', 'milestone'].includes(update.newTimeFrame)) {
      db.updateTaskTimeFrame(task.id, update.newTimeFrame as Task['time_frame']);
    }
  }

  for (const newTask of replan.newTasks) {
    db.addTask({
      goal_id: goalId,
      title: newTask.title,
      description: newTask.description,
      time_frame: newTask.timeFrame as Task['time_frame'],
      status: 'todo',
      resource_links: newTask.resourceLinks,
      difficulty: newTask.difficulty as Task['difficulty'],
    });
  }

  const plan = db.getAgentPlan(goalId);
  if (plan) {
    db.setAgentPlan({
      ...plan,
      plan_version: plan.plan_version + 1,
      updated_at: new Date().toISOString(),
    });
  }
}

// ─── Personalized Coaching ──────────────────────────────────────────────────────

export async function generateCoachingMessage(
  context: {
    type: 'kickoff' | 'task_complete' | 'check_in';
    goalTitle: string;
    metrics: { success: number; burnout: number; consistency: number; completion: number };
    focusTask?: string;
    completedTask?: string;
    reflection?: string;
    nextTask?: string;
    goalId: string;
  }
): Promise<string> {
  const profileContext = getUserProfileContext();
  const memoryContext = buildMemoryContext(context.goalId);
  const plan = db.getAgentPlan(context.goalId);

  const typeInstructions = {
    kickoff: `Write a kickoff message (120-150 words). Welcome the user, explain the master strategy, highlight today's focus task, and set expectations.`,
    task_complete: `Write a celebration message (90-120 words). Acknowledge the completed task, explain its significance in the learning arc, reference the reflection insight, and redirect to the next task.`,
    check_in: `Write a supportive check-in (80-100 words). Address the user's message with empathy, reference relevant memories, and provide actionable guidance.`,
  };

  const prompt = `${typeInstructions[context.type]}

Goal: "${context.goalTitle}"
Metrics — Success: ${context.metrics.success}%, Burnout: ${context.metrics.burnout}%, Consistency: ${context.metrics.consistency}%, Progress: ${context.metrics.completion}%
${context.focusTask ? `Focus task: "${context.focusTask}"` : ''}
${context.completedTask ? `Completed: "${context.completedTask}"` : ''}
${context.reflection ? `Reflection: ${context.reflection}` : ''}
${context.nextTask ? `Next task: "${context.nextTask}"` : ''}

Master strategy: ${plan?.master_strategy || 'Building foundational skills progressively'}

User profile (personalize tone and examples):
${profileContext}

Relevant memories:
${memoryContext}`;

  return generateText(
    prompt,
    `You are CoachAgent — an elite, personalized mentor. Adapt your tone to the user's communication preference and learning style. Be authoritative yet warm, futuristic, and action-oriented. Never mention internal systems.`
  );
}

// ─── Chat Intent Detection ─────────────────────────────────────────────────────

export async function detectChatIntent(
  message: string,
  goalId: string
): Promise<{ intent: string; requiresReplan: boolean; emotionalTone: string; urgency: string }> {
  const prompt = `Classify this user message in a coaching context:
"${message}"

Determine intent, whether roadmap replanning is needed, emotional tone, and urgency.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      intent: { type: Type.STRING, description: 'question, struggle, feedback, motivation, schedule_change, progress_update, or general' },
      requiresReplan: { type: Type.BOOLEAN },
      emotionalTone: { type: Type.STRING },
      urgency: { type: Type.STRING, description: 'low, medium, or high' },
    },
    required: ['intent', 'requiresReplan', 'emotionalTone', 'urgency'],
  };

  return generateJSON(
    prompt,
    'You are an intent classifier for a coaching AI. Detect when users need plan adjustments.',
    schema
  );
}
