import React, { useState } from 'react';
import { Bot, Send, User, Loader2, Sparkles } from 'lucide-react';
import type { AppState } from '../types';

interface Props { state: AppState; onSendMessage: (message: string) => Promise<void>; isLoading: boolean }

const prompts = ['What should I do today?', 'I missed yesterday’s task', 'Make the plan easier', 'I have less time this week', 'Explain my next task', 'Replan my goal'];

export default function AIChat({ state, onSendMessage, isLoading }: Props) {
  const [message, setMessage] = useState('');
  const send = async (value = message) => {
    const clean = value.trim();
    if (!clean || isLoading) return;
    setMessage('');
    await onSendMessage(clean);
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col bg-slate-900/20 border border-slate-800/60 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-slate-800/60">
        <h1 className="font-display font-bold text-white flex items-center gap-2"><Bot className="w-5 h-5 text-cyan-400" />AI Coach</h1>
        <p className="text-xs text-slate-400 mt-1">Contextual guidance for {state.activeGoal?.title}. NOVA uses your plan, progress, availability, memory, and recent conversations.</p>
        <div className="flex flex-wrap gap-2 mt-4">{prompts.map(prompt => <button key={prompt} onClick={() => send(prompt)} disabled={isLoading} className="text-[10px] px-3 py-1.5 rounded-full border border-slate-800 text-slate-400 hover:border-cyan-500/30 hover:text-cyan-300">{prompt}</button>)}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[360px]">
        {!state.chatHistory.length && <div className="h-full grid place-items-center text-center text-slate-500"><div><Sparkles className="w-7 h-7 mx-auto text-cyan-500/50" /><p className="text-sm mt-3">Ask NOVA for a specific next action or plan adjustment.</p></div></div>}
        {state.chatHistory.map(item => <div key={item.id} className={`flex gap-3 ${item.role === 'user' ? 'justify-end' : ''}`}>{item.role === 'assistant' && <div className="w-7 h-7 rounded-lg bg-cyan-500/10 grid place-items-center shrink-0"><Bot className="w-4 h-4 text-cyan-400" /></div>}<div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${item.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-950/60 border border-slate-800 text-slate-300'}`}>{item.content}</div>{item.role === 'user' && <div className="w-7 h-7 rounded-lg bg-indigo-500/10 grid place-items-center shrink-0"><User className="w-4 h-4 text-indigo-400" /></div>}</div>)}
        {isLoading && <div className="flex items-center gap-2 text-xs text-cyan-400"><Loader2 className="w-4 h-4 animate-spin" />NOVA is reasoning with your current plan...</div>}
      </div>
      <form onSubmit={e => { e.preventDefault(); send(); }} className="p-4 border-t border-slate-800/60 flex gap-3">
        <label className="sr-only" htmlFor="coach-message">Message NOVA</label>
        <input id="coach-message" value={message} onChange={e => setMessage(e.target.value)} placeholder="Ask for guidance or explain what changed..." className="flex-1 min-w-0 bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan-500/50" />
        <button aria-label="Send message" disabled={!message.trim() || isLoading} className="w-12 rounded-xl bg-cyan-500 text-slate-950 grid place-items-center disabled:opacity-50"><Send className="w-4 h-4" /></button>
      </form>
    </div>
  );
}

