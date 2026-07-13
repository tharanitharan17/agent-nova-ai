import { db, Goal, Task } from './db.js';
import { generateText } from './gemini.js';
import {
  buildMemoryContext,
  getUserProfileContext,
  extractMemoriesFromChat,
  consolidateMemoriesIfNeeded,
  evolveUserProfile,
  incrementSessionStats,
} from './agent-memory.js';
import {
  decomposeGoal,
  runReasoningChain,
  generatePlan,
  predictMetrics,
  reflectOnTaskCompletion,
  dynamicReplan,
  applyReplan,
  generateCoachingMessage,
  detectChatIntent,
} from './agent-intelligence.js';

/**
 * Autonomous Agent Orchestrator
 *
 * Coordinates a multi-phase cognitive pipeline:
 *   Decompose → Plan → Reason → Predict → Coach → Remember
 *   On task completion: Reflect → Replan → Predict → Coach
 *   On chat: Intent detect → Respond → Extract memory → Replan if needed
 */
export class AgentOrchestrator {
  private activeLoops: Set<string> = new Set();

  public async initializeGoal(goalTitle: string): Promise<Goal> {
    db.clear();
    const goal = db.addGoal(goalTitle);
    const goalId = goal.id;

    incrementSessionStats();
    this.runAutonomousCycle(goalId, goalTitle);

    return goal;
  }

  public async runAutonomousCycle(goalId: string, goalTitle: string) {
    if (this.activeLoops.has(goalId)) return;
    this.activeLoops.add(goalId);

    try {
      console.log(`[Orchestrator] Starting autonomous cycle for: "${goalTitle}"`);

      // ── Phase 1: Goal Decomposition ──────────────────────────────────────
      db.setAgentStatus('analyzing');
      db.setCurrentMission('Decomposing goal into hierarchical sub-goals...');

      const decomposition = await decomposeGoal(goalTitle, goalId);

      db.addAgentLog({
        goal_id: goalId,
        agent_name: 'GoalAnalysisAgent',
        status: 'completed',
        thought: `Decomposed "${goalTitle}" into ${decomposition.subGoals.length} sub-goals. Strategy: ${decomposition.masterStrategy.slice(0, 120)}...`,
        decision: `Mapped ${decomposition.estimatedMonths}-month path with ${decomposition.subGoals.map(s => s.title).join(', ')}.`,
        confidence: 93,
      });

      db.addMemory(
        goalId,
        `Goal decomposed: "${goalTitle}" → ${decomposition.subGoals.length} phases over ~${decomposition.estimatedMonths} months. Strategy: ${decomposition.masterStrategy}`,
        'agent_insight',
        8
      );

      // ── Phase 2: Initial Planning ──────────────────────────────────────────
      db.setAgentStatus('planning');
      db.setCurrentMission('Generating dependency-aware task roadmap...');

      const plan = await generatePlan(goalTitle, decomposition.subGoals, [], goalId);

      db.addAgentLog({
        goal_id: goalId,
        agent_name: 'PlanningAgent',
        status: 'completed',
        thought: `Generated ${plan.tasks.length} tasks with dependency mapping across ${decomposition.subGoals.length} sub-goal phases.`,
        decision: `Roadmap spans today → milestone buckets with personalized difficulty.`,
        confidence: 88,
      });

      // ── Phase 3: Multi-Step Reasoning ──────────────────────────────────────
      db.setAgentStatus('reasoning');
      db.setCurrentMission('Running chain-of-thought plan validation...');

      const reasoning = await runReasoningChain(
        goalTitle,
        decomposition.subGoals,
        plan.tasks.map(t => ({ title: t.title, timeFrame: t.timeFrame, difficulty: t.difficulty })),
        goalId
      );

      db.addAgentLog({
        goal_id: goalId,
        agent_name: 'ReasoningAgent',
        status: 'completed',
        thought: reasoning.reasoningSteps[reasoning.reasoningSteps.length - 1] ?? 'Plan validated.',
        decision: `Critical path: ${reasoning.criticalPath.slice(0, 3).join(' → ')}. Confidence: ${reasoning.planConfidence}%. Adjustments: ${reasoning.adjustments.length}.`,
        confidence: reasoning.planConfidence,
      });

      for (const step of reasoning.reasoningSteps) {
        db.addMemory(goalId, `Reasoning: ${step}`, 'agent_insight', 6);
      }

      if (reasoning.potentialObstacles.length > 0) {
        db.addMemory(
          goalId,
          `Plan risks: ${reasoning.potentialObstacles.join('; ')}`,
          'agent_insight',
          7
        );
      }

      // Apply reasoning adjustments if any — regenerate plan with adjustments
      let finalTasks = plan.tasks;
      if (reasoning.adjustments.length > 0) {
        db.setCurrentMission('Applying reasoning adjustments to roadmap...');
        const adjustedPlan = await generatePlan(goalTitle, decomposition.subGoals, reasoning.adjustments, goalId);
        finalTasks = adjustedPlan.tasks;
      }

      // Persist plan and tasks
      db.setAgentPlan({
        goal_id: goalId,
        sub_goals: decomposition.subGoals.map(s => ({
          title: s.title,
          description: s.description,
          priority: s.priority,
          estimated_weeks: s.estimatedWeeks,
          prerequisites: s.prerequisites,
          status: 'pending' as const,
        })),
        reasoning_chain: reasoning.reasoningSteps,
        critical_path: reasoning.criticalPath,
        dependencies: Object.fromEntries(
          finalTasks.filter(t => t.dependsOn?.length > 0).map(t => [t.title, t.dependsOn])
        ),
        master_strategy: decomposition.masterStrategy,
        plan_version: 1,
        updated_at: new Date().toISOString(),
      });

      db.clearTasks(goalId);
      for (const t of finalTasks) {
        db.addTask({
          goal_id: goalId,
          title: t.title,
          description: t.description,
          time_frame: t.timeFrame as Task['time_frame'],
          status: 'todo',
          resource_links: t.resourceLinks,
          difficulty: t.difficulty as Task['difficulty'],
        });
      }

      // ── Phase 4: Trajectory Prediction ─────────────────────────────────────
      db.setAgentStatus('deciding');
      db.setCurrentMission('Projecting success trajectory with user profile signals...');

      const tasks = db.getTasks(goalId);
      const prediction = await predictMetrics(goalTitle, tasks, undefined, true);

      db.updateGoalMetrics(goalId, {
        success_probability: prediction.successProbability,
        burnout_risk: prediction.burnoutRisk,
        consistency: prediction.consistencyMetric,
        completion_rate: 0,
      });

      db.addAgentLog({
        goal_id: goalId,
        agent_name: 'PredictionAgent',
        status: 'completed',
        thought: prediction.rationale,
        decision: `Baseline: Success ${prediction.successProbability}%, Burnout ${prediction.burnoutRisk}%, Consistency ${prediction.consistencyMetric}%.`,
        confidence: 85,
      });

      // ── Phase 5: Personalized Coaching Kickoff ─────────────────────────────
      db.setAgentStatus('coaching');
      db.setCurrentMission('Crafting personalized coaching kickoff...');

      const focusTask = finalTasks.find(t => t.timeFrame === 'today')?.title;
      const welcomeMessage = await generateCoachingMessage({
        type: 'kickoff',
        goalTitle,
        metrics: {
          success: prediction.successProbability,
          burnout: prediction.burnoutRisk,
          consistency: prediction.consistencyMetric,
          completion: 0,
        },
        focusTask,
        goalId,
      });

      db.addAgentLog({
        goal_id: goalId,
        agent_name: 'CoachAgent',
        status: 'completed',
        thought: `Personalized kickoff using ${getUserProfileContext().split('\n').length} profile signals and ${db.getMemories(goalId).length} memories.`,
        decision: `Delivered coaching message focused on "${focusTask || 'first steps'}".`,
        confidence: 91,
      });

      db.addChatMessage(goalId, 'assistant', welcomeMessage);

      // ── Phase 6: Memory Indexing ───────────────────────────────────────────
      db.addMemory(
        goalId,
        `Workspace initialized for "${goalTitle}". ${finalTasks.length} tasks mapped. Ready for execution.`,
        'milestone_reached',
        9
      );

      db.addAgentLog({
        goal_id: goalId,
        agent_name: 'MemoryAgent',
        status: 'completed',
        thought: `Indexed ${decomposition.subGoals.length} sub-goals, ${reasoning.reasoningSteps.length} reasoning steps, and plan v1 into cognitive graph.`,
        decision: `Cross-session profile preserved. Global memories: ${db.getMemories('__global__').length}.`,
        confidence: 97,
      });

      // Evolve user profile from initialization context
      await evolveUserProfile(goalId, `User initialized goal: "${goalTitle}". Sub-goals: ${decomposition.subGoals.map(s => s.title).join(', ')}.`);

      db.setAgentStatus('idle');
      db.setCurrentMission(`Ready. Execute: "${focusTask || finalTasks[0]?.title || 'First steps'}"`);

    } catch (error) {
      console.error('[Orchestrator] Autonomous cycle failure:', error);
      db.setAgentStatus('idle');
      db.setCurrentMission('Autonomous cycle encountered an error. Ready for instructions.');
      db.addAgentLog({
        goal_id: goalId,
        agent_name: 'Orchestrator',
        status: 'failed',
        thought: `Critical error: ${(error as Error).message}`,
        decision: 'Aborted cycle, reverted to idle.',
        confidence: 0,
      });
    } finally {
      this.activeLoops.delete(goalId);
    }
  }

  public async handleTaskCompletion(goalId: string, taskId: string, completedTaskTitle: string) {
    if (this.activeLoops.has(goalId)) return;
    this.activeLoops.add(goalId);

    try {
      console.log(`[Orchestrator] Task completed: "${completedTaskTitle}" — running reflection → replan pipeline`);

      const goal = db.getGoals().find(g => g.id === goalId);
      const goalTitle = goal?.title ?? 'Unknown goal';
      const allTasks = db.getTasks(goalId);
      const completedTask = allTasks.find(t => t.id === taskId);
      const completionRate = Math.round(
        (allTasks.filter(t => t.status === 'completed').length / allTasks.length) * 100
      );

      // ── Phase 1: Deep Reflection ───────────────────────────────────────────
      db.setAgentStatus('reflecting');
      db.setCurrentMission(`Deep reflection on "${completedTaskTitle}"...`);

      const reflection = await reflectOnTaskCompletion(
        goalTitle,
        completedTaskTitle,
        completedTask?.difficulty ?? 'medium',
        allTasks,
        goalId
      );

      db.addReflection({
        goal_id: goalId,
        task_id: taskId,
        task_title: completedTaskTitle,
        lessons_learned: reflection.lessonsLearned,
        skill_gained: reflection.skillGained,
        velocity_assessment: reflection.velocityAssessment,
        emotional_signal: reflection.emotionalSignal,
        replan_triggers: reflection.replanTriggers,
      });

      db.addAgentLog({
        goal_id: goalId,
        agent_name: 'ReflectionAgent',
        status: 'completed',
        thought: reflection.reflection,
        decision: `Skill gained: "${reflection.skillGained}". Velocity: ${reflection.velocityAssessment}. Sub-goal: ${reflection.subGoalProgress}.`,
        confidence: 95,
      });

      db.addMemory(
        goalId,
        `Completed "${completedTaskTitle}" — gained: ${reflection.skillGained}. Lessons: ${reflection.lessonsLearned.join('; ')}`,
        'learned_skill',
        7
      );

      for (const lesson of reflection.lessonsLearned) {
        db.addMemory(goalId, `Lesson: ${lesson}`, 'agent_insight', 6);
      }

      incrementSessionStats(1);

      // ── Phase 2: Dynamic Replanning ────────────────────────────────────────
      db.setAgentStatus('planning');
      db.setCurrentMission('Evaluating roadmap for dynamic adjustments...');

      const replanReason = reflection.replanTriggers.length > 0
        ? reflection.replanTriggers.join('; ')
        : `Task "${completedTaskTitle}" completed. Velocity: ${reflection.velocityAssessment}.`;

      const replan = await dynamicReplan(goalTitle, goalId, replanReason);

      if (replan.shouldReplan) {
        applyReplan(goalId, replan);
        db.addAgentLog({
          goal_id: goalId,
          agent_name: 'ReplanningAgent',
          status: 'completed',
          thought: replan.replanSummary,
          decision: `Replan v${(db.getAgentPlan(goalId)?.plan_version ?? 1)}: ${replan.taskUpdates.length} updates, ${replan.newTasks.length} new tasks, ${replan.removedTaskTitles.length} removed.`,
          confidence: 88,
        });
        db.addMemory(goalId, `Roadmap adapted: ${replan.replanSummary}`, 'agent_insight', 7);
      } else {
        // Fallback: promote next week task to today if no today tasks remain
        const todayIncomplete = allTasks.filter(t => t.time_frame === 'today' && t.status !== 'completed');
        if (todayIncomplete.length === 0) {
          const nextWeekTask = db.getTasks(goalId).find(t => t.time_frame === 'week' && t.status === 'todo');
          if (nextWeekTask) {
            db.updateTaskTimeFrame(nextWeekTask.id, 'today');
          }
        }
        db.addAgentLog({
          goal_id: goalId,
          agent_name: 'ReplanningAgent',
          status: 'completed',
          thought: 'Plan validated — no structural changes needed. Promoted next priority task if applicable.',
          decision: replan.replanSummary || 'Maintained current roadmap trajectory.',
          confidence: 90,
        });
      }

      // ── Phase 3: Updated Prediction ────────────────────────────────────────
      db.setAgentStatus('deciding');
      db.setCurrentMission('Recalculating trajectory with reflection data...');

      const updatedTasks = db.getTasks(goalId);
      const prediction = await predictMetrics(goalTitle, updatedTasks, goal, false);

      db.updateGoalMetrics(goalId, {
        success_probability: prediction.successProbability,
        burnout_risk: prediction.burnoutRisk,
        consistency: prediction.consistencyMetric,
        completion_rate: completionRate,
      });

      db.addAgentLog({
        goal_id: goalId,
        agent_name: 'PredictionAgent',
        status: 'completed',
        thought: prediction.rationale,
        decision: `Updated: Success ${prediction.successProbability}%, Burnout ${prediction.burnoutRisk}%, Consistency ${prediction.consistencyMetric}%.`,
        confidence: 89,
      });

      // ── Phase 4: Personalized Celebration Coaching ─────────────────────────
      db.setAgentStatus('coaching');
      db.setCurrentMission('Crafting personalized progress coaching...');

      const nextTask = updatedTasks.find(t => t.status === 'todo');
      const coachingResponse = await generateCoachingMessage({
        type: 'task_complete',
        goalTitle,
        metrics: {
          success: prediction.successProbability,
          burnout: prediction.burnoutRisk,
          consistency: prediction.consistencyMetric,
          completion: completionRate,
        },
        completedTask: completedTaskTitle,
        reflection: reflection.reflection,
        nextTask: nextTask?.title,
        goalId,
      });

      db.addAgentLog({
        goal_id: goalId,
        agent_name: 'CoachAgent',
        status: 'completed',
        thought: `Celebration tailored to ${reflection.emotionalSignal} emotional signal and ${reflection.velocityAssessment} velocity.`,
        decision: `Redirected focus to "${nextTask?.title || 'final milestone'}".`,
        confidence: 94,
      });

      db.addChatMessage(goalId, 'assistant', coachingResponse);

      await evolveUserProfile(goalId, `Completed task "${completedTaskTitle}". Skill: ${reflection.skillGained}. Velocity: ${reflection.velocityAssessment}.`);
      await consolidateMemoriesIfNeeded(goalId);

      db.setAgentStatus('idle');
      db.setCurrentMission(nextTask ? `Focusing on: "${nextTask.title}"` : 'All tasks completed! Excellent work.');

    } catch (error) {
      console.error('[Orchestrator] Task completion pipeline failure:', error);
      db.setAgentStatus('idle');
    } finally {
      this.activeLoops.delete(goalId);
    }
  }

  public async handleUserChat(goalId: string, message: string): Promise<string> {
    db.setAgentStatus('coaching');
    db.setCurrentMission('Analyzing intent and formulating contextual response...');

    try {
      const goal = db.getGoals().find(g => g.id === goalId);
      const tasks = db.getTasks(goalId);
      const plan = db.getAgentPlan(goalId);
      const reflections = db.getReflections(goalId).slice(-3);
      const logs = db.getAgentLogs(goalId).slice(-5);
      const history = db.getChatHistory(goalId).slice(-10);

      db.addChatMessage(goalId, 'user', message);

      // Detect intent for autonomous replanning triggers
      const intent = await detectChatIntent(message, goalId);

      const systemPrompt = `You are "Nova", an autonomous AI agent — elite executive coach, curriculum architect, and strategic advisor.
You operate with full awareness of the user's history, profile, and progress across sessions.

Goal: "${goal?.title || 'Unknown'}"
Metrics — Success: ${goal?.success_probability ?? 65}%, Burnout: ${goal?.burnout_risk ?? 15}%, Consistency: ${goal?.consistency ?? 80}%, Progress: ${goal?.completion_rate ?? 0}%

Master Strategy: ${plan?.master_strategy || 'Progressive skill building'}
Sub-goals: ${plan?.sub_goals.map(s => `[${s.status}] ${s.title}`).join(', ') || 'Not set'}
Critical Path: ${plan?.critical_path.slice(0, 5).join(' → ') || 'Not set'}

Roadmap:
${tasks.map(t => `- [${t.status.toUpperCase()}] ${t.title} (${t.time_frame}, ${t.difficulty})`).join('\n')}

Recent Reflections:
${reflections.map(r => `- ${r.task_title}: ${r.skill_gained} (${r.velocity_assessment})`).join('\n') || 'None yet'}

User Profile:
${getUserProfileContext()}

Long-Term Memory:
${buildMemoryContext(goalId)}

Agent Cognitive State:
${logs.map(l => `- [${l.agent_name}] ${l.thought}`).join('\n')}

Detected Intent: ${intent.intent} | Emotional tone: ${intent.emotionalTone} | Urgency: ${intent.urgency}

Rules:
1. Speak as Nova: authoritative, deeply supportive, futuristic, articulate, concise.
2. Reference specific memories and past interactions to show continuity across sessions.
3. If the user is struggling (${intent.intent === 'struggle' ? 'DETECTED NOW' : 'watch for signals'}), acknowledge empathetically and explain you're adapting the plan.
4. Personalize to their learning style and communication preference from the profile.
5. Never mention databases, APIs, or internal architecture. Maintain the unified agent illusion.
6. If asked about the plan, explain the reasoning behind task ordering using the critical path.`;

      const prompt = `Conversation history:
${history.map(h => `${h.role === 'user' ? 'User' : 'Nova'}: ${h.content}`).join('\n')}
User: ${message}

Nova:`;

      const responseText = await generateText(prompt, systemPrompt);
      db.addChatMessage(goalId, 'assistant', responseText);

      // Background cognitive updates
      extractMemoriesFromChat(goalId, message, responseText).catch(e =>
        console.error('[MemoryAgent] Extraction error:', e)
      );

      if (intent.requiresReplan) {
        db.setCurrentMission('Autonomously adapting roadmap based on user feedback...');
        const replan = await dynamicReplan(
          goal?.title ?? 'Goal',
          goalId,
          `User chat trigger: "${message}" (intent: ${intent.intent}, tone: ${intent.emotionalTone})`
        );
        if (replan.shouldReplan) {
          applyReplan(goalId, replan);
          db.addAgentLog({
            goal_id: goalId,
            agent_name: 'ReplanningAgent',
            status: 'completed',
            thought: `Chat-triggered replan: ${replan.replanSummary}`,
            decision: `Adapted plan based on user ${intent.intent} signal.`,
            confidence: 87,
          });
        }
      }

      evolveUserProfile(goalId, `Chat: "${message}" → Intent: ${intent.intent}, Tone: ${intent.emotionalTone}`).catch(e =>
        console.error('[ProfileAgent] Evolution error:', e)
      );

      consolidateMemoriesIfNeeded(goalId).catch(e =>
        console.error('[MemoryAgent] Consolidation error:', e)
      );

      db.setAgentStatus('idle');
      const nextTask = tasks.find(t => t.status === 'todo');
      db.setCurrentMission(nextTask ? `Focusing on: "${nextTask.title}"` : 'Awaiting next steps.');

      return responseText;
    } catch (error) {
      console.error('[Orchestrator] Chat error:', error);
      db.setAgentStatus('idle');
      return 'I apologize — my cognitive processors are recalibrating. Could you repeat that?';
    }
  }
}

export const orchestrator = new AgentOrchestrator();
