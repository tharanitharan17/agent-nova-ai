import React from 'react';
import { CheckCircle2, Clock3, AlertTriangle, Flame, BarChart3, Target, ShieldAlert, RefreshCcw } from 'lucide-react';
import type { AppState } from '../types';

export default function AnalyticsView({ state }: { state: AppState }) {
  const a = state.analytics;
  if (!a) return <div className="text-slate-500">Analytics become available after a plan is created.</div>;
  const cards = [
    ['Completed tasks', a.completedTasks, CheckCircle2, 'text-emerald-400'],
    ['Pending tasks', a.pendingTasks, Clock3, 'text-cyan-400'],
    ['Overdue tasks', a.overdueTasks, AlertTriangle, 'text-rose-400'],
    ['Current streak', `${a.currentStreak} days`, Flame, 'text-amber-400'],
    ['Weekly completion', `${a.weeklyCompletionRate}%`, BarChart3, 'text-indigo-400'],
    ['Consistency index', `${a.consistencyIndex}%`, RefreshCcw, 'text-purple-400'],
    ['Success probability', `${a.successProbability}%`, Target, 'text-emerald-400'],
    ['Burnout risk', `${a.burnoutRisk}%`, ShieldAlert, 'text-rose-400'],
  ] as const;
  return <div className="space-y-6"><div><h1 className="text-2xl font-display font-bold text-white">Progress Analytics</h1><p className="text-sm text-slate-400 mt-2">Calculated from saved tasks, due dates, streak, recent completion, remaining capacity, and plan revisions—never random values.</p></div><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">{cards.map(([label, value, Icon, color]) => <div key={label} className="p-5 bg-slate-900/25 border border-slate-800/60 rounded-2xl"><Icon className={`w-5 h-5 ${color}`} /><p className="text-xs text-slate-500 mt-5">{label}</p><p className="text-2xl font-mono font-bold text-white mt-1">{value}</p></div>)}</div><section className="p-5 bg-slate-900/20 border border-slate-800/60 rounded-2xl"><h2 className="font-bold text-white">Plan adaptation history</h2><div className="space-y-3 mt-4">{state.planRevisions.length ? state.planRevisions.map(revision => <div key={revision.id} className="border-l-2 border-indigo-500/50 pl-3"><p className="text-sm text-slate-300">{revision.explanation}</p><p className="text-[10px] text-slate-600 mt-1">{new Date(revision.created_at).toLocaleString()}</p></div>) : <p className="text-sm text-slate-500">No plan revisions yet.</p>}</div></section></div>;
}

