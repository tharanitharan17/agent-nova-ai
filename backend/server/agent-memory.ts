import { db, Memory, UserProfile } from './db.js';
import { generateJSON } from './gemini.js';
import { Type } from '@google/genai';

export const GLOBAL_GOAL_ID = '__global__';

/**
 * Retrieves and ranks memories by relevance to the current context.
 * Combines goal-scoped and cross-session global memories.
 */
export function buildMemoryContext(goalId: string, contextHint?: string): string {
  const goalMemories = db.getMemories(goalId);
  const globalMemories = db.getMemories(GLOBAL_GOAL_ID);
  const allMemories = [...globalMemories, ...goalMemories];

  const ranked = allMemories
    .sort((a, b) => (b.importance ?? 5) - (a.importance ?? 5))
    .slice(0, 20);

  if (ranked.length === 0) return 'No prior memories recorded.';

  const sections = [
    globalMemories.length > 0
      ? `Cross-Session User Profile Memories:\n${globalMemories.map(m => `- [${m.category}|importance:${m.importance ?? 5}] ${m.content}`).join('\n')}`
      : '',
    goalMemories.length > 0
      ? `Goal-Specific Memories:\n${goalMemories.map(m => `- [${m.category}|importance:${m.importance ?? 5}] ${m.content}`).join('\n')}`
      : '',
  ].filter(Boolean);

  return contextHint
    ? `${sections.join('\n\n')}\n\nContext focus: ${contextHint}`
    : sections.join('\n\n');
}

export function getUserProfileContext(): string {
  const profile = db.getUserProfile();
  if (!profile.total_sessions && profile.learning_style === 'unknown') {
    return 'New user — no established profile yet.';
  }

  return [
    `Learning style: ${profile.learning_style}`,
    `Strengths: ${profile.strengths.join(', ') || 'unknown'}`,
    `Challenges: ${profile.challenges.join(', ') || 'unknown'}`,
    `Motivation triggers: ${profile.motivation_triggers.join(', ') || 'unknown'}`,
    `Communication preference: ${profile.communication_preference}`,
    `Total sessions: ${profile.total_sessions}, Tasks completed (lifetime): ${profile.total_tasks_completed}`,
  ].join('\n');
}

/**
 * Extracts multiple insights from a conversation turn and stores them with importance scores.
 */
export async function extractMemoriesFromChat(
  goalId: string,
  userMsg: string,
  novaReply: string
): Promise<void> {
  const existingMemories = db.getMemories(goalId).slice(-5).map(m => m.content);

  const prompt = `Review this conversation fragment:
User: "${userMsg}"
Nova: "${novaReply}"

Existing recent memories (avoid duplicates):
${existingMemories.map(m => `- ${m}`).join('\n') || 'None'}

Extract ALL significant insights. Look for:
- User preferences, learning style signals, schedule constraints
- Struggles, frustrations, or emotional states
- Breakthroughs, skills demonstrated, or background knowledge
- Coaching style preferences (direct vs gentle, detail vs summary)
- Cross-session facts about the user (career, experience level, motivations)

Return up to 3 distinct memories. Mark cross-session facts (career, learning style, persistent preferences) as isGlobal=true.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      memories: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            category: { type: Type.STRING, description: "user_pref, agent_insight, learned_skill, or milestone_reached" },
            importance: { type: Type.NUMBER, description: "1-10, higher = more critical to remember" },
            isGlobal: { type: Type.BOOLEAN, description: "True if this persists across all future goals" },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['content', 'category', 'importance', 'isGlobal'],
        },
      },
    },
    required: ['memories'],
  };

  const result = await generateJSON<{ memories: Array<{ content: string; category: string; importance: number; isGlobal: boolean; tags?: string[] }> }>(
    prompt,
    'You are MemoryAgent, an expert at extracting durable knowledge from coaching conversations. Be precise and user-centric.',
    schema
  );

  for (const mem of result.memories ?? []) {
    if (!mem.content?.trim()) continue;
    const targetGoalId = mem.isGlobal ? GLOBAL_GOAL_ID : goalId;
    db.addMemory(
      targetGoalId,
      mem.content,
      mem.category as Memory['category'],
      mem.importance ?? 5,
      mem.tags
    );
  }
}

/**
 * Consolidates redundant memories into a compressed summary when count exceeds threshold.
 */
export async function consolidateMemoriesIfNeeded(goalId: string): Promise<void> {
  const memories = db.getMemories(goalId);
  if (memories.length < 25) return;

  const oldest = memories.slice(0, memories.length - 15);
  const prompt = `These ${oldest.length} coaching memories contain overlapping information:
${oldest.map(m => `- [${m.category}] ${m.content}`).join('\n')}

Consolidate into 3-5 high-density summary memories that preserve all critical user facts.
Discard trivial or redundant details.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      summaries: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            category: { type: Type.STRING },
            importance: { type: Type.NUMBER },
          },
          required: ['content', 'category', 'importance'],
        },
      },
    },
    required: ['summaries'],
  };

  try {
    const result = await generateJSON<{ summaries: Array<{ content: string; category: string; importance: number }> }>(
      prompt,
      'You are MemoryAgent performing memory consolidation. Preserve user-specific facts.',
      schema
    );

    for (const id of oldest.map(m => m.id)) {
      db.removeMemory(id);
    }

    for (const s of result.summaries ?? []) {
      db.addMemory(goalId, s.content, s.category as Memory['category'], s.importance ?? 7);
    }
  } catch (e) {
    console.error('Memory consolidation failed:', e);
  }
}

/**
 * Updates the persistent user profile based on interaction patterns.
 */
export async function evolveUserProfile(
  goalId: string,
  interactionContext: string
): Promise<void> {
  const profile = db.getUserProfile();
  const memories = buildMemoryContext(goalId);

  const prompt = `Based on this user interaction context and memories, update the user coaching profile.

Current profile:
${JSON.stringify(profile, null, 2)}

Interaction context:
${interactionContext}

Memories:
${memories}

Infer learning style, strengths, challenges, motivation triggers, and communication preference.
Only update fields where you have evidence. Keep existing values if no new signal.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      learning_style: { type: Type.STRING, description: "visual, auditory, kinesthetic, reading, mixed, or unknown" },
      strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
      challenges: { type: Type.ARRAY, items: { type: Type.STRING } },
      motivation_triggers: { type: Type.ARRAY, items: { type: Type.STRING } },
      communication_preference: { type: Type.STRING, description: "direct, gentle, analytical, motivational, or balanced" },
    },
    required: ['learning_style', 'strengths', 'challenges', 'motivation_triggers', 'communication_preference'],
  };

  try {
    const updated = await generateJSON<Partial<UserProfile>>(
      prompt,
      'You are a user modeling agent. Build an accurate coaching profile from behavioral signals.',
      schema
    );

    db.updateUserProfile({
      ...updated,
      total_sessions: profile.total_sessions,
      last_active: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Profile evolution failed:', e);
  }
}

export function incrementSessionStats(tasksCompleted = 0): void {
  const profile = db.getUserProfile();
  db.updateUserProfile({
    total_sessions: profile.total_sessions + 1,
    total_tasks_completed: profile.total_tasks_completed + tasksCompleted,
    last_active: new Date().toISOString(),
  });
}
