import React from 'react';
import { Compass, CheckCircle2, CalendarDays, Clock3 } from 'lucide-react';
import type { AppState } from '../types';

interface Props { state: AppState; onCompleteTask: (taskId: string, title: string) => void; isLoading: boolean }

export default function RoadmapTimeline({ state, onCompleteTask, isLoading }: Props) {
  return <div className="space-y-6"><div><h1 className="text-2xl font-display font-bold text-white flex items-center gap-2"><Compass className="w-5 h-5 text-indigo-400" />Goal Roadmap</h1><p className="text-sm text-slate-400 mt-2">Milestones, dependencies, due dates, and measurable tasks generated for your active goal.</p></div><div className="relative border-l border-slate-800 ml-3 pl-7 space-y-8">{state.milestones.map((milestone, index) => {
    const tasks = state.tasks.filter(task => task.milestone_id === milestone.id);
    const complete = tasks.filter(task => task.status === 'completed').length;
    return <section key={milestone.id} className="relative"><div className="absolute -left-[38px] top-0 w-5 h-5 rounded-full bg-slate-950 border border-indigo-500 grid place-items-center text-[9px] text-indigo-300">{index + 1}</div><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2"><div><h2 className="font-bold text-slate-100">{milestone.title}</h2><p className="text-xs text-slate-400 mt-1">{milestone.description}</p></div><span className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0"><CalendarDays className="w-3 h-3" />{milestone.target_date}</span></div><p className="text-[10px] text-cyan-400 mt-2">{complete}/{tasks.length} tasks complete</p><div className="grid md:grid-cols-2 gap-3 mt-4">{tasks.map(task => <div key={task.id} className={`p-4 border rounded-xl ${task.status === 'completed' ? 'border-emerald-500/15 bg-emerald-500/5 opacity-70' : task.status === 'skipped' ? 'border-rose-500/15 bg-rose-500/5' : 'border-slate-800 bg-slate-900/20'}`}><div className="flex items-start justify-between gap-3"><div><h3 className={`text-sm font-semibold ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-200'}`}>{task.title}</h3><p className="text-xs text-slate-500 mt-1">{task.description}</p></div>{task.status === 'todo' && <button aria-label={`Complete ${task.title}`} disabled={isLoading} onClick={() => onCompleteTask(task.id, task.title)} className="text-emerald-400"><CheckCircle2 className="w-4 h-4" /></button>}</div><div className="flex gap-3 mt-3 text-[10px] text-slate-500"><span>{task.scheduled_date}</span><span className="flex items-center gap-1"><Clock3 className="w-3 h-3" />{task.estimated_minutes} min</span><span className="uppercase">{task.priority}</span></div></div>)}</div></section>;
  })}</div></div>;
}

