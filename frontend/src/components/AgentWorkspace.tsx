import React, { useEffect, useState } from 'react';
import type { AppState, Task, TodayFocus } from '../types';
import { fetchToday } from '../lib/api';
import { Target, CalendarDays, Clock3, CheckCircle2, SkipForward, CalendarClock, StickyNote, Flame, TrendingUp, ShieldAlert, Activity, Loader2, Sparkles, AlertTriangle, ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface Props {
  state: AppState;
  isLoading: boolean;
  onCompleteTask: (taskId: string, note?: string) => Promise<void>;
  onSkipTask: (taskId: string, reason: string) => Promise<void>;
  onRescheduleTask: (taskId: string, date: string) => Promise<void>;
  onAddNote: (taskId: string, note: string) => Promise<void>;
  onCheckIn: (value: object) => Promise<void>;
}

const today = () => new Date().toISOString().slice(0, 10);
const priorityStyle: Record<string, string> = {
  critical: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
  high: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  medium: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  low: 'text-slate-300 bg-slate-500/10 border-slate-500/20',
};

export default function AgentWorkspace({ state, isLoading, onCompleteTask, onSkipTask, onRescheduleTask, onAddNote, onCheckIn }: Props) {
  const goal = state.activeGoal;
  const [actionTask, setActionTask] = useState<Task | null>(null);
  const [action, setAction] = useState<'skip' | 'reschedule' | 'note' | null>(null);
  const [actionValue, setActionValue] = useState('');
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkIn, setCheckIn] = useState({ availableMinutes: goal?.daily_available_minutes || 60, energy: 3, motivation: 3, blockers: '', availabilityChanged: false });

  // Today's Focus state
  const [todayData, setTodayData] = useState<TodayFocus | null>(null);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayError, setTodayError] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  // Fetch today's data on mount and after actions
  const loadToday = async () => {
    try {
      setTodayLoading(true);
      setTodayError('');
      const data = await fetchToday();
      setTodayData(data);
    } catch (err) {
      setTodayError((err as Error).message);
    } finally {
      setTodayLoading(false);
    }
  };

  useEffect(() => {
    if (goal) loadToday();
  }, [goal?.id]);

  // Wrap task actions to also refresh today data
  const handleComplete = async (taskId: string, note?: string) => {
    await onCompleteTask(taskId, note);
    loadToday();
  };
  const handleSkip = async (taskId: string, reason: string) => {
    await onSkipTask(taskId, reason);
    loadToday();
  };
  const handleReschedule = async (taskId: string, date: string) => {
    await onRescheduleTask(taskId, date);
    loadToday();
  };

  if (!goal || !state.analytics) return null;
  const analytics = state.analytics;
  const daysRemaining = Math.max(0, Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / 86_400_000));

  // Fallback: use AppState tasks if today API hasn't loaded yet
  const todayTasks = todayData?.todayTasks ?? state.tasks.filter(task => task.scheduled_date === today() && task.status === 'todo');
  const overdueTasks = todayData?.overdueTasks ?? state.tasks.filter(task => task.status === 'todo' && task.scheduled_date !== undefined && task.scheduled_date < today());
  const completedToday = todayData?.completedToday ?? state.tasks.filter(task => task.status === 'completed' && task.completed_at?.slice(0, 10) === today());
  const recommendation = todayData?.recommendation || '';
  const estimatedMinutes = todayData?.estimatedMinutes ?? [...todayTasks, ...overdueTasks].reduce((s, t) => s + (t.estimated_minutes || 0), 0);
  const completionPct = todayData?.completionPercentage ?? (todayTasks.length + overdueTasks.length + completedToday.length > 0 ? Math.round(completedToday.length / (todayTasks.length + overdueTasks.length + completedToday.length) * 100) : 0);

  const upcoming = state.tasks.filter(task => task.status === 'todo' && task.scheduled_date && task.scheduled_date > today()).sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || '')).slice(0, 5);

  const openAction = (task: Task, type: typeof action) => { setActionTask(task); setAction(type); setActionValue(type === 'reschedule' ? task.scheduled_date || today() : ''); };
  const submitAction = async () => {
    if (!actionTask || !action) return;
    if (action === 'skip') await handleSkip(actionTask.id, actionValue);
    if (action === 'reschedule') await handleReschedule(actionTask.id, actionValue);
    if (action === 'note') await onAddNote(actionTask.id, actionValue);
    setActionTask(null); setAction(null); setActionValue('');
  };

  const TaskCard = ({ task, isOverdue }: { task: Task; isOverdue?: boolean }) => (
    <div className={`p-4 border rounded-xl space-y-3 ${isOverdue ? 'bg-rose-950/20 border-rose-500/30' : 'bg-slate-950/35 border-slate-800/70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`text-[9px] uppercase font-mono border rounded px-1.5 py-0.5 ${priorityStyle[task.priority || 'low']}`}>{task.priority || 'normal'}</span>
            <span className="text-[10px] text-slate-500 flex items-center gap-1"><Clock3 className="w-3 h-3" />{task.estimated_minutes || 0} min</span>
            {isOverdue && <span className="text-[9px] uppercase font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-1.5 py-0.5 flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" />overdue</span>}
          </div>
          <h3 className="text-sm font-semibold text-slate-100">{task.title}</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{task.description}</p>
        </div>
        <button aria-label={`Complete ${task.title}`} disabled={isLoading} onClick={() => handleComplete(task.id)} className="shrink-0 p-2 rounded-lg border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"><CheckCircle2 className="w-4 h-4" /></button>
      </div>
      {task.dependencies?.length ? <p className="text-[10px] text-slate-500">Depends on: {task.dependencies.join(', ')}</p> : null}
      {task.progress_note && <p className="text-xs text-indigo-300 bg-indigo-500/5 rounded-lg px-3 py-2">Note: {task.progress_note}</p>}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800/50">
        <button onClick={() => openAction(task, 'skip')} className="text-[10px] text-slate-400 hover:text-rose-300 flex items-center gap-1"><SkipForward className="w-3 h-3" />Skip</button>
        <button onClick={() => openAction(task, 'reschedule')} className="text-[10px] text-slate-400 hover:text-cyan-300 flex items-center gap-1"><CalendarClock className="w-3 h-3" />Reschedule</button>
        <button onClick={() => openAction(task, 'note')} className="text-[10px] text-slate-400 hover:text-indigo-300 flex items-center gap-1"><StickyNote className="w-3 h-3" />Progress note</button>
      </div>
    </div>
  );

  const CompletedCard = ({ task }: { task: Task }) => (
    <div className="p-3 bg-emerald-950/15 border border-emerald-500/15 rounded-xl flex items-center gap-3">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-emerald-200 line-through opacity-75">{task.title}</p>
        <p className="text-[10px] text-emerald-400/60 mt-0.5">{task.estimated_minutes || 0} min · completed</p>
      </div>
    </div>
  );

  const metrics = [
    ['Progress', `${analytics.overallProgress}%`, TrendingUp, 'text-cyan-400'],
    ['Success probability', `${analytics.successProbability}%`, Target, 'text-emerald-400'],
    ['Current streak', `${analytics.currentStreak} days`, Flame, 'text-amber-400'],
    ['Burnout risk', `${analytics.burnoutRisk}%`, ShieldAlert, 'text-rose-400'],
  ] as const;

  const hasTodayContent = todayTasks.length > 0 || overdueTasks.length > 0 || completedToday.length > 0;
  const hasPendingTasks = state.tasks.some(t => t.status === 'todo');

  return (
    <div className="space-y-6 pb-8">
      {/* ── Active Goal Hero ─────────────────────────────────────────────── */}
      <section className="p-5 sm:p-6 bg-gradient-to-br from-slate-900/60 to-slate-950/40 border border-slate-800/70 rounded-2xl">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-400 mb-2"><Target className="w-4 h-4" />Active Goal</div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">{goal.title}</h1>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">{goal.description}</p>
            <div className="flex flex-wrap gap-3 mt-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Target {new Date(goal.target_date + 'T12:00:00').toLocaleDateString()}</span>
              <span>{daysRemaining} days remaining</span><span className="capitalize">{goal.status}</span>
            </div>
          </div>
          <button onClick={() => setShowCheckIn(value => !value)} className="px-4 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs">Daily check-in</button>
        </div>
        <div className="mt-5 h-2 bg-slate-950 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all" style={{ width: `${analytics.overallProgress}%` }} /></div>
      </section>

      {/* ── Daily Check-in ────────────────────────────────────────────────── */}
      {showCheckIn && <section className="p-5 bg-slate-900/35 border border-cyan-500/20 rounded-2xl">
        <h2 className="font-semibold text-white">Daily check-in</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <label className="text-xs text-slate-400">Time today (minutes)<input type="number" min="0" max="720" value={checkIn.availableMinutes} onChange={e => setCheckIn({ ...checkIn, availableMinutes: Number(e.target.value) })} className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2" /></label>
          <label className="text-xs text-slate-400">Energy: {checkIn.energy}/5<input type="range" min="1" max="5" value={checkIn.energy} onChange={e => setCheckIn({ ...checkIn, energy: Number(e.target.value) })} className="mt-3 w-full" /></label>
          <label className="text-xs text-slate-400">Motivation: {checkIn.motivation}/5<input type="range" min="1" max="5" value={checkIn.motivation} onChange={e => setCheckIn({ ...checkIn, motivation: Number(e.target.value) })} className="mt-3 w-full" /></label>
          <label className="text-xs text-slate-400">Blockers<input value={checkIn.blockers} onChange={e => setCheckIn({ ...checkIn, blockers: e.target.value })} className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2" /></label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={checkIn.availabilityChanged} onChange={e => setCheckIn({ ...checkIn, availabilityChanged: e.target.checked })} />My usual availability changed</label>
        <button disabled={isLoading} onClick={async () => { await onCheckIn(checkIn); setShowCheckIn(false); loadToday(); }} className="mt-4 px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-xs font-semibold">Save check-in</button>
      </section>}

      {/* ── Metrics Grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{metrics.map(([label, value, Icon, color]) => <div key={label} className="p-4 bg-slate-900/25 border border-slate-800/60 rounded-xl"><Icon className={`w-4 h-4 ${color}`} /><p className="text-[10px] uppercase tracking-wider text-slate-500 mt-3">{label}</p><p className="text-xl font-mono font-bold text-white mt-1">{value}</p></div>)}</div>

      {/* ── TODAY'S FOCUS + UPCOMING ──────────────────────────────────────── */}
      <div className="grid xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 p-5 bg-slate-900/20 border border-slate-800/50 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-bold text-white flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" />Today's Focus</h2>
              {todayData?.todayMission && <p className="text-xs text-slate-400 mt-1">{todayData.todayMission}</p>}
            </div>
            {(isLoading || todayLoading) && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
          </div>

          {/* Loading skeleton */}
          {todayLoading && !todayData && (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-28 bg-slate-950/40 border border-slate-800/40 rounded-xl animate-pulse" />)}
            </div>
          )}

          {/* Error state */}
          {todayError && !todayLoading && (
            <div className="border border-rose-500/20 bg-rose-950/15 rounded-xl p-4 text-xs text-rose-300">
              <p>Could not load today's data: {todayError}</p>
              <button onClick={loadToday} className="mt-2 text-cyan-400 hover:underline">Retry</button>
            </div>
          )}

          {/* Content */}
          {!todayLoading && !todayError && (
            <div className="space-y-4">
              {/* AI Recommendation Banner */}
              {recommendation && hasTodayContent && (
                <div className="flex items-start gap-3 p-3.5 bg-gradient-to-r from-indigo-950/30 to-cyan-950/20 border border-indigo-500/20 rounded-xl">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-indigo-200 leading-relaxed">{recommendation}</p>
                </div>
              )}

              {/* Today's Progress Bar */}
              {hasTodayContent && (
                <div className="flex items-center gap-3 px-1">
                  <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500" style={{ width: `${completionPct}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {completionPct}% · {completedToday.length}/{completedToday.length + todayTasks.length + overdueTasks.length} done
                    {estimatedMinutes > 0 && ` · ~${estimatedMinutes} min left`}
                  </span>
                </div>
              )}

              {/* Overdue Tasks */}
              {overdueTasks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <h3 className="text-[10px] uppercase tracking-widest font-mono text-rose-400">Overdue · Catch up first</h3>
                  </div>
                  <div className="space-y-3">
                    {overdueTasks.map(task => <div key={task.id}><TaskCard task={task} isOverdue /></div>)}
                  </div>
                </div>
              )}

              {/* Today's Pending Tasks */}
              {todayTasks.length > 0 && (
                <div className="space-y-2">
                  {overdueTasks.length > 0 && (
                    <h3 className="text-[10px] uppercase tracking-widest font-mono text-cyan-400 flex items-center gap-2"><CalendarDays className="w-3.5 h-3.5" />Scheduled today</h3>
                  )}
                  <div className="space-y-3">
                    {todayTasks.map(task => <div key={task.id}><TaskCard task={task} /></div>)}
                  </div>
                </div>
              )}

              {/* Completed Today (collapsible) */}
              {completedToday.length > 0 && (
                <div className="space-y-2">
                  <button onClick={() => setShowCompleted(!showCompleted)} className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-mono text-emerald-400 hover:text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completed today · {completedToday.length}
                    {showCompleted ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {showCompleted && (
                    <div className="space-y-2">
                      {completedToday.map(task => <div key={task.id}><CompletedCard task={task} /></div>)}
                    </div>
                  )}
                </div>
              )}

              {/* Empty state: has pending tasks but none for today */}
              {!hasTodayContent && hasPendingTasks && (
                <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center space-y-3">
                  <p className="text-sm text-slate-400">No tasks scheduled for today.</p>
                  <p className="text-xs text-slate-500">NOVA has automatically promoted the next priority task. Refresh to see updates.</p>
                  <button onClick={loadToday} className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs rounded-lg hover:bg-cyan-500/20">Refresh Today's Plan</button>
                </div>
              )}

              {/* Empty state: absolutely no tasks at all */}
              {!hasTodayContent && !hasPendingTasks && (
                <div className="border border-dashed border-cyan-500/20 bg-cyan-950/10 rounded-xl p-8 text-center space-y-3">
                  <Sparkles className="w-8 h-8 text-cyan-400 mx-auto" />
                  <p className="text-sm text-slate-300 font-medium">Generate Today's Plan</p>
                  <p className="text-xs text-slate-500">Ask the AI Coach to create tasks for today, or review your goal roadmap.</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Upcoming Tasks Sidebar ──────────────────────────────────────── */}
        <section className="p-5 bg-slate-900/20 border border-slate-800/50 rounded-2xl">
          <h2 className="font-display font-bold text-white">Upcoming Tasks</h2>
          <div className="space-y-3 mt-4">{upcoming.length ? upcoming.map(task => <div key={task.id} className="border-b border-slate-800/50 pb-3"><p className="text-xs font-medium text-slate-200">{task.title}</p><p className="text-[10px] text-slate-500 mt-1">{task.scheduled_date} · {task.estimated_minutes} min</p></div>) : <p className="text-xs text-slate-500">No upcoming tasks.</p>}</div>
        </section>
      </div>

      {/* ── Goal Roadmap + Activity Timeline ──────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="p-5 bg-slate-900/20 border border-slate-800/50 rounded-2xl">
          <h2 className="font-display font-bold text-white">Goal Roadmap</h2>
          <div className="space-y-4 mt-4">{state.milestones.map(milestone => {
            const tasks = state.tasks.filter(task => task.milestone_id === milestone.id);
            const complete = tasks.filter(task => task.status === 'completed').length;
            const percent = tasks.length ? Math.round(complete / tasks.length * 100) : 0;
            return <div key={milestone.id}><div className="flex justify-between gap-3 text-xs"><span className="text-slate-200">{milestone.title}</span><span className="text-slate-500">{percent}% · {milestone.target_date}</span></div><div className="h-1.5 bg-slate-950 rounded-full mt-2"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percent}%` }} /></div></div>;
          })}</div>
        </section>
        <section className="p-5 bg-slate-900/20 border border-slate-800/50 rounded-2xl">
          <h2 className="font-display font-bold text-white flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400" />Activity Timeline</h2>
          <div className="space-y-3 mt-4 max-h-72 overflow-y-auto">{state.progressEntries.length ? state.progressEntries.map(entry => <div key={entry.id} className="pl-3 border-l border-slate-700"><p className="text-xs text-slate-300">{entry.note}</p><p className="text-[9px] text-slate-600 mt-1">{new Date(entry.created_at).toLocaleString()}</p></div>) : <p className="text-xs text-slate-500">No activity recorded yet.</p>}</div>
        </section>
      </div>

      {/* ── Action Modal ──────────────────────────────────────────────────── */}
      {actionTask && action && <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-md bg-[#0e111a] border border-slate-800 rounded-2xl p-5"><h3 className="font-bold text-white capitalize">{action} task</h3><p className="text-xs text-slate-400 mt-1">{actionTask.title}</p>{action === 'reschedule' ? <input aria-label="New task date" type="date" min={today()} value={actionValue} onChange={e => setActionValue(e.target.value)} className="mt-4 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2" /> : <textarea aria-label={action === 'skip' ? 'Skip reason' : 'Progress note'} value={actionValue} onChange={e => setActionValue(e.target.value)} placeholder={action === 'skip' ? 'Why are you skipping this task?' : 'Add a useful progress note...'} className="mt-4 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2" rows={3} />}<div className="flex justify-end gap-2 mt-4"><button onClick={() => setActionTask(null)} className="px-4 py-2 text-xs text-slate-400">Cancel</button><button disabled={!actionValue || isLoading} onClick={submitAction} className="px-4 py-2 text-xs bg-cyan-500 text-slate-950 font-semibold rounded-lg disabled:opacity-50">Save change</button></div></div></div>}
    </div>
  );
}
