import React, { useState } from 'react';
import { Sparkles, CalendarDays, Clock3, Target, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { GoalFormData } from '../types';

interface Props {
  onStart: (goal: GoalFormData) => Promise<void>;
  isLoading: boolean;
  error?: string;
  onLogout: () => void;
}

const suggestions = [
  'Prepare for a software interview in 60 days', 'Learn Python in 3 months',
  'Lose 5 kg safely', 'Launch an online business',
  'Complete my final-year project', 'Prepare for university exams',
];
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const initialForm: GoalFormData = {
  title: '', description: '', targetDate: '', dailyMinutes: 60,
  experienceLevel: 'beginner', workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  motivation: '', obstacles: '',
};

export default function LandingPage({ onStart, isLoading, error: serverError, onLogout }: Props) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');

  const update = <K extends keyof GoalFormData>(key: K, value: GoalFormData[K]) => {
    setForm(current => ({ ...current, [key]: value }));
    setError('');
  };

  const toggleDay = (day: string) => update('workingDays', form.workingDays.includes(day) ? form.workingDays.filter(item => item !== day) : [...form.workingDays, day]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.title.trim().length < 5) return setError('Enter a clear goal title.');
    if (form.description.trim().length < 20) return setError('Describe the outcome you want in at least 20 characters.');
    if (!form.targetDate || new Date(form.targetDate) <= new Date()) return setError('Choose a future target date.');
    if (!form.workingDays.length) return setError('Choose at least one preferred working day.');
    if (form.motivation.trim().length < 5) return setError('Tell NOVA why this goal matters.');
    await onStart({ ...form, title: form.title.trim(), description: form.description.trim(), motivation: form.motivation.trim(), obstacles: form.obstacles.trim() });
  };

  return (
    <div className="min-h-screen bg-[#090b11] text-slate-100 relative overflow-x-hidden">
      <div className="fixed top-0 left-1/4 w-[520px] h-[520px] bg-indigo-900/10 rounded-full blur-[130px] pointer-events-none" />
      <header className="border-b border-slate-800/40 bg-[#090b11]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center"><Sparkles className="w-4 h-4" /></div>
            <span className="font-display font-bold tracking-wide">NOVA COPILOT</span>
          </div>
          <button onClick={onLogout} className="text-xs text-slate-400 hover:text-white">Logout</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 lg:py-14 relative z-10">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-3 py-1 mb-4"><Target className="w-3.5 h-3.5" />Personalized execution planning</div>
          <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tight text-white">What goal do you want to achieve?</h1>
          <p className="text-slate-400 mt-4 max-w-2xl mx-auto">NOVA will analyze your objective, create a realistic action plan, and adapt it as your progress and circumstances change.</p>
        </motion.div>

        <form onSubmit={submit} noValidate className="max-w-4xl mx-auto bg-slate-900/45 border border-slate-800/80 rounded-2xl backdrop-blur-xl shadow-2xl p-5 sm:p-8 space-y-6">
          <div className="grid md:grid-cols-2 gap-5">
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-200">Goal title *</span>
              <input aria-label="Goal title" value={form.title} onChange={e => update('title', e.target.value)} placeholder="e.g. Prepare for a software interview in 60 days" className="mt-2 w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan-500/60" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-200">Detailed goal description *</span>
              <textarea aria-label="Detailed goal description" value={form.description} onChange={e => update('description', e.target.value)} rows={4} placeholder="Describe the exact outcome, scope, and what success looks like." className="mt-2 w-full resize-y bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan-500/60" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-200 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-cyan-400" />Target completion date *</span>
              <input aria-label="Target completion date" type="date" value={form.targetDate} min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)} onChange={e => update('targetDate', e.target.value)} className="mt-2 w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-200 flex items-center gap-2"><Clock3 className="w-4 h-4 text-indigo-400" />Daily available time *</span>
              <select aria-label="Daily available time" value={form.dailyMinutes} onChange={e => update('dailyMinutes', Number(e.target.value))} className="mt-2 w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none">
                {[30, 45, 60, 90, 120, 180].map(minutes => <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hour${minutes > 60 ? 's' : ''}`}</option>)}
              </select>
            </label>
            <fieldset>
              <legend className="text-sm font-medium text-slate-200">Current experience level *</legend>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {(['beginner', 'intermediate', 'advanced'] as const).map(level => <button type="button" key={level} onClick={() => update('experienceLevel', level)} className={`px-3 py-2.5 rounded-xl border text-xs capitalize ${form.experienceLevel === level ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300' : 'border-slate-800 text-slate-400'}`}>{level}</button>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-medium text-slate-200">Preferred working days *</legend>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {days.map(day => <button type="button" key={day} aria-pressed={form.workingDays.includes(day)} onClick={() => toggleDay(day)} className={`w-10 h-9 rounded-lg border text-xs ${form.workingDays.includes(day) ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-slate-800 text-slate-500'}`}>{day.slice(0, 2)}</button>)}
              </div>
            </fieldset>
            <label className="block">
              <span className="text-sm font-medium text-slate-200">Why does this goal matter? *</span>
              <textarea aria-label="Motivation" value={form.motivation} onChange={e => update('motivation', e.target.value)} rows={3} placeholder="Your motivation or reason for achieving it." className="mt-2 w-full resize-y bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-200">Known limitations or obstacles</span>
              <textarea aria-label="Known limitations or obstacles" value={form.obstacles} onChange={e => update('obstacles', e.target.value)} rows={3} placeholder="Schedule constraints, health, budget, knowledge gaps..." className="mt-2 w-full resize-y bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none" />
            </label>
          </div>

          {(error || serverError) && <div role="alert" className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">{error || serverError}</div>}

          <div>
            <p className="text-xs text-slate-500 mb-2">Try an example goal</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(item => <button type="button" key={item} onClick={() => update('title', item)} className="text-xs px-3 py-1.5 rounded-full border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30">{item}</button>)}
            </div>
          </div>

          <button disabled={isLoading} className="w-full sm:w-auto sm:min-w-56 flex items-center justify-center gap-2 mx-auto bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-semibold px-6 py-3.5 rounded-xl disabled:opacity-60">
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />NOVA is building your plan...</> : <><Sparkles className="w-4 h-4" />Create My Plan</>}
          </button>
        </form>
      </main>
    </div>
  );
}

