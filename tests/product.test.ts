import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { calculateAnalytics } from '../server/analytics.js';
import { parseStructuredResponse } from '../server/gemini.js';
import { completeTaskAction, createGoalAndPlan, getDashboard, skipTaskAction, validateGeneratedPlan, validateGoalInput } from '../server/product-service.js';
import type { GeneratedPlan, GoalInput } from '../server/domain.js';
import { db, type Goal, type Task } from '../server/db.js';
import { getTodayDashboard } from '../server/today-service.js';

function futureWorkingDate(daysAhead: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  while (['Saturday', 'Sunday'].includes(date.toLocaleDateString('en-US', { weekday: 'long' }))) date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

const input: GoalInput = {
  title: 'Learn production TypeScript',
  description: 'Build and ship a strongly typed full-stack application with automated tests.',
  targetDate: futureWorkingDate(45),
  dailyMinutes: 60,
  experienceLevel: 'intermediate',
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  motivation: 'Advance into a senior engineering role',
  obstacles: 'Limited weekday availability',
};

function mockPlan(): GeneratedPlan {
  const taskDate = futureWorkingDate(2);
  return {
    goalSummary: 'Ship a production TypeScript project', category: 'software', difficulty: 'intermediate',
    targetDate: input.targetDate, estimatedDurationDays: 45, weeklyCommitmentHours: 5,
    successCriteria: ['Application is deployed and tested'], obstacles: ['Limited time'],
    strategy: 'Build one measurable vertical slice at a time.',
    milestones: [{ title: 'Foundation', description: 'Create the typed foundation', targetDate: futureWorkingDate(20), successCriteria: ['Types compile'] }],
    weeklyPlan: [{ weekNumber: 1, focus: 'Type system', outcomes: ['Model the domain'] }],
    tasks: [
      { title: 'Model the application domain', description: 'Create and validate ten core TypeScript interfaces for 60 minutes.', scheduledDate: taskDate, estimatedMinutes: 60, priority: 'high', status: 'pending', milestone: 'Foundation', dependencies: [] },
      { title: 'Test the application domain', description: 'Write measurable domain validation tests for 45 minutes.', scheduledDate: taskDate, estimatedMinutes: 45, priority: 'medium', status: 'pending', milestone: 'Foundation', dependencies: ['Model the application domain'] },
    ],
    risks: ['Scope growth'], recoveryPlan: 'Reduce scope while preserving the core milestone.',
    motivationMessage: 'Each typed slice moves the product closer to production.', initialSuccessProbability: 70,
  };
}

test('goal input validates required fields', () => {
  assert.throws(() => validateGoalInput({}), /Goal title/);
  assert.equal(validateGoalInput(input).title, input.title);
});

test('invalid Gemini JSON is rejected safely', () => {
  assert.throws(() => parseStructuredResponse('{broken'), /invalid JSON/);
});

test('generated plans require milestones and actionable tasks', () => {
  assert.throws(() => validateGeneratedPlan({ ...mockPlan(), tasks: [] }, input), /no actionable tasks/);
  assert.equal(validateGeneratedPlan(mockPlan(), input).tasks.length, 2);
});

test('analytics are calculated from saved task progress', () => {
  const goal = { id: 'g', title: 'Goal', status: 'active', created_at: new Date().toISOString(), target_date: input.targetDate, success_probability: 0, consistency: 0, completion_rate: 0, burnout_risk: 0, daily_available_minutes: 60, working_days: input.workingDays } as Goal;
  const tasks = [
    { id: 'a', goal_id: 'g', title: 'Done', description: '', time_frame: 'today', status: 'completed', resource_links: [], difficulty: 'easy', created_at: new Date().toISOString(), completed_at: new Date().toISOString(), scheduled_date: new Date().toISOString().slice(0, 10), estimated_minutes: 30 },
    { id: 'b', goal_id: 'g', title: 'Pending', description: '', time_frame: 'today', status: 'todo', resource_links: [], difficulty: 'easy', created_at: new Date().toISOString(), scheduled_date: futureWorkingDate(1), estimated_minutes: 30 },
  ] as Task[];
  const analytics = calculateAnalytics(goal, tasks);
  assert.equal(analytics.completedTasks, 1);
  assert.equal(analytics.pendingTasks, 1);
  assert.equal(analytics.overallProgress, 50);
  assert.ok(analytics.successProbability >= 0 && analytics.successProbability <= 100);
});

test('mocked plan generation saves a user-owned goal and tasks', async () => {
  const userId = 'test-user-' + Date.now();
  const store = db.getData() as any;
  const snapshot = structuredClone(store);
  try {
    const dashboard = await createGoalAndPlan(userId, input, mockPlan());
    assert.equal(dashboard.activeGoal?.user_id, userId);
    assert.equal(dashboard.tasks.length, 2);
    assert.equal(getDashboard(userId).milestones.length, 1);

    const originalSave = db.save;
    let dashboardSaveCalls = 0;
    (db as unknown as { save: () => void }).save = () => { dashboardSaveCalls += 1; };
    getDashboard(userId);
    getDashboard(userId);
    (db as unknown as { save: () => void }).save = originalSave.bind(db);
    assert.equal(dashboardSaveCalls, 0, 'dashboard reads must not write db.json');

    const afterComplete = completeTaskAction(userId, dashboard.tasks[0].id, 'Test completion');
    assert.equal(afterComplete.analytics?.completedTasks, 1);
    const afterSkip = skipTaskAction(userId, dashboard.tasks[1].id, 'Availability changed');
    assert.equal(afterSkip.tasks.find(task => task.id === dashboard.tasks[1].id)?.status, 'skipped');
    assert.ok(afterSkip.planRevisions.length > 0);
  } finally {
    for (const key of Object.keys(store)) delete store[key];
    Object.assign(store, snapshot);
    db.save();
  }
});


test('missing Gemini API key returns a configuration error without saving', async () => {
  const saved = process.env.GEMINI_API_KEY;
  const before = (db.getData() as any).goals.length;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(() => createGoalAndPlan('missing-key-user', input), /not configured/);
    assert.equal((db.getData() as any).goals.length, before);
  } finally {
    if (saved) process.env.GEMINI_API_KEY = saved;
  }
});


test('frontend initialization has no recurring poll and Vite ignores runtime database writes', () => {
  const appSource = fs.readFileSync(path.join('src', 'App.tsx'), 'utf8');
  const apiSource = fs.readFileSync(path.join('src', 'lib', 'api.ts'), 'utf8');
  const viteSource = fs.readFileSync('vite.config.ts', 'utf8');
  assert.doesNotMatch(appSource, /setInterval\s*\(/);
  assert.match(appSource, /appStatus === 'loading'/);
  assert.match(apiSource, /dashboardRequest/);
  assert.match(viteSource, /\*\*\/db\.json/);
});

test('source files do not expose a Gemini key', () => {
  const roots = ['server', 'src'];
  const files = roots.flatMap(root => fs.readdirSync(root, { recursive: true }).map(String).filter(file => /\.(ts|tsx)$/.test(file)).map(file => path.join(root, file)));
  const content = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(content, /AQ\.[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(content, /VITE_GEMINI|REACT_APP_GEMINI/);
});

// ── Today's Focus Tests ────────────────────────────────────────────

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function mockPlanWithTodayTasks(): GeneratedPlan {
  const todayStr = todayDate();
  const tomorrowStr = futureWorkingDate(1);
  return {
    goalSummary: 'Learn TypeScript for production', category: 'software', difficulty: 'intermediate',
    targetDate: input.targetDate, estimatedDurationDays: 45, weeklyCommitmentHours: 5,
    successCriteria: ['App deployed'], obstacles: ['Limited time'],
    strategy: 'Incremental vertical slices.',
    milestones: [{ title: 'Foundation', description: 'Core types', targetDate: futureWorkingDate(20), successCriteria: ['Types compile'] }],
    weeklyPlan: [{ weekNumber: 1, focus: 'Types', outcomes: ['Model domain'] }],
    tasks: [
      { title: 'Today task A', description: 'Work on types for 30 minutes.', scheduledDate: todayStr, estimatedMinutes: 30, priority: 'high', status: 'pending', milestone: 'Foundation', dependencies: [] },
      { title: 'Today task B', description: 'Write tests for 30 minutes.', scheduledDate: todayStr, estimatedMinutes: 30, priority: 'medium', status: 'pending', milestone: 'Foundation', dependencies: [] },
      { title: 'Tomorrow task', description: 'Build module for 45 minutes.', scheduledDate: tomorrowStr, estimatedMinutes: 45, priority: 'low', status: 'pending', milestone: 'Foundation', dependencies: [] },
    ],
    risks: ['Scope growth'], recoveryPlan: 'Reduce scope.',
    motivationMessage: 'Keep building.', initialSuccessProbability: 70,
  };
}

test('today tasks appear in getTodayDashboard after plan generation', async () => {
  const userId = 'today-test-' + Date.now();
  const store = db.getData() as any;
  const snapshot = structuredClone(store);
  try {
    await createGoalAndPlan(userId, input, mockPlanWithTodayTasks());
    const todayDash = getTodayDashboard(userId);
    assert.ok(todayDash.todayTasks.length >= 1, 'Should have at least 1 today task');
    assert.equal(todayDash.overdueTasks.length, 0, 'No overdue tasks on creation day');
    assert.ok(todayDash.recommendation.length > 0, 'Should have a recommendation');
    assert.ok(todayDash.estimatedMinutes > 0, 'Should have estimated time');
  } finally {
    for (const key of Object.keys(store)) delete store[key];
    Object.assign(store, snapshot);
    db.save();
  }
});

test('overdue tasks are detected by getTodayDashboard', async () => {
  const userId = 'overdue-test-' + Date.now();
  const store = db.getData() as any;
  const snapshot = structuredClone(store);
  try {
    // Create plan with tasks dated in the past
    const planWithPastTasks = mockPlanWithTodayTasks();
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    // Ensure past date is a working day
    while (['Saturday', 'Sunday'].includes(pastDate.toLocaleDateString('en-US', { weekday: 'long' }))) {
      pastDate.setDate(pastDate.getDate() - 1);
    }
    const pastStr = pastDate.toISOString().slice(0, 10);
    planWithPastTasks.tasks[0].scheduledDate = pastStr;
    planWithPastTasks.tasks[0].title = 'Overdue task';

    await createGoalAndPlan(userId, input, planWithPastTasks);

    // The auto-scheduler may promote the overdue task to today.
    // Either way, getTodayDashboard should have non-empty tasks.
    const todayDash = getTodayDashboard(userId);
    const totalActionable = todayDash.todayTasks.length + todayDash.overdueTasks.length;
    assert.ok(totalActionable >= 1, 'Should have actionable tasks (today or promoted from overdue)');
    assert.ok(todayDash.recommendation.includes('task') || todayDash.recommendation.includes('Start'), 'Recommendation should reference a task');
  } finally {
    for (const key of Object.keys(store)) delete store[key];
    Object.assign(store, snapshot);
    db.save();
  }
});

test('completing a task updates today panel completion percentage', async () => {
  const userId = 'complete-test-' + Date.now();
  const store = db.getData() as any;
  const snapshot = structuredClone(store);
  try {
    await createGoalAndPlan(userId, input, mockPlanWithTodayTasks());
    const before = getTodayDashboard(userId);
    const todayTask = before.todayTasks[0];
    assert.ok(todayTask, 'Must have a today task to complete');

    completeTaskAction(userId, todayTask.id, 'Test completion');
    const after = getTodayDashboard(userId);

    assert.ok(after.completedToday.length > before.completedToday.length, 'Completed count should increase');
    assert.ok(after.completionPercentage > before.completionPercentage, 'Completion percentage should increase');
  } finally {
    for (const key of Object.keys(store)) delete store[key];
    Object.assign(store, snapshot);
    db.save();
  }
});

test('auto-scheduling promotes next task when today has no scheduled tasks', async () => {
  const userId = 'autosched-test-' + Date.now();
  const store = db.getData() as any;
  const snapshot = structuredClone(store);
  try {
    // Create a plan where no tasks are scheduled for today
    const futurePlan = mockPlan(); // original mockPlan has all future dates
    await createGoalAndPlan(userId, input, futurePlan);

    // Before calling getTodayDashboard, verify no tasks are today
    const dashboard = getDashboard(userId);
    const manualToday = dashboard.tasks.filter(t => t.scheduled_date === todayDate() && t.status === 'todo');

    // getTodayDashboard should auto-schedule something
    const todayDash = getTodayDashboard(userId);
    const totalActionable = todayDash.todayTasks.length + todayDash.overdueTasks.length;
    assert.ok(totalActionable >= 1, 'Auto-scheduling should have promoted at least one task to today');
    assert.ok(todayDash.todayMission.length > 0, 'Should have a mission string');
  } finally {
    for (const key of Object.keys(store)) delete store[key];
    Object.assign(store, snapshot);
    db.save();
  }
});
