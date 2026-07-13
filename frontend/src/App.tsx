import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Bot, Brain, Compass, TrendingUp, Cpu, Menu, X, LogOut } from 'lucide-react';
import type { AppState, GoalFormData } from './types';
import {
  addProgressNote, clearSession, completeTask, createGoal, dailyCheckIn, fetchCurrentUser,
  fetchDashboard, getToken, rescheduleTask, sendChatMessage, skipTask, type AuthUser,
  getSelectedModel, setSelectedModel,
} from './lib/api';
import AuthPage from './components/AuthPage';
import LandingPage from './components/LandingPage';
import AgentWorkspace from './components/AgentWorkspace';
import AIChat from './components/AIChat';
import MemoryBank from './components/MemoryBank';
import RoadmapTimeline from './components/RoadmapTimeline';
import AnalyticsView from './components/AnalyticsView';
import ModelCompareDashboard from './components/ModelCompareDashboard';

const emptyState: AppState = {
  activeGoal: null, goals: [], tasks: [], milestones: [], memories: [], chatHistory: [],
  progressEntries: [], planRevisions: [], checkIns: [], analytics: null,
  currentMission: 'Create your first meaningful goal.', agentStatus: 'idle',
};

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<AppState>(emptyState);
  const [appStatus, setAppStatus] = useState<'loading' | 'unauthenticated' | 'ready' | 'error'>('loading');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'memory' | 'roadmap' | 'analytics' | 'models'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedModel, setModel] = useState(getSelectedModel());
  const goalRequestInFlight = useRef(false);
  const actionInFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const bootstrap = async () => {
      if (!getToken()) {
        setAppStatus('unauthenticated');
        return;
      }
      try {
        const [session, dashboard] = await Promise.all([fetchCurrentUser(), fetchDashboard()]);
        if (controller.signal.aborted) return;
        setState(dashboard);
        setUser(session.user);
        setAppStatus('ready');
      } catch (requestError) {
        if (controller.signal.aborted) return;
        clearSession();
        setUser(null);
        setError((requestError as Error).message);
        setAppStatus('unauthenticated');
      }
    };
    bootstrap();

    const unauthorized = () => {
      clearSession();
      setUser(null);
      setState(emptyState);
      setAppStatus('unauthenticated');
    };
    window.addEventListener('nova:unauthorized', unauthorized);
    return () => {
      controller.abort();
      window.removeEventListener('nova:unauthorized', unauthorized);
    };
  }, []);

  const handleAuthenticated = async (authenticated: AuthUser) => {
    setAppStatus('loading');
    setError('');
    try {
      const dashboard = await fetchDashboard();
      setState(dashboard);
      setUser(authenticated);
      setAppStatus('ready');
    } catch (requestError) {
      clearSession();
      setUser(null);
      setError((requestError as Error).message);
      setAppStatus('unauthenticated');
    }
  };
  const run = async (operation: () => Promise<AppState>, success: string) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setIsLoading(true); setError(''); setNotice('');
    try { setState(await operation()); setNotice(success); }
    catch (requestError) { setError((requestError as Error).message); }
    finally { actionInFlight.current = false; setIsLoading(false); }
  };

  const logout = () => { clearSession(); setUser(null); setState(emptyState); setAppStatus('unauthenticated'); };
  const chooseModel = (model: string) => {
    if (model === 'compare') { setModel('compare'); setActiveTab('models'); return; }
    const valid = model as 'deepseek-r1:8b' | 'qwen2.5:3b';
    setSelectedModel(valid); setModel(valid); setNotice(`${model.startsWith('deepseek') ? 'DeepSeek' : 'Qwen'} selected for new AI requests.`);
  };

  if (appStatus === 'loading') return <div className="min-h-screen bg-[#090b11] grid place-items-center text-cyan-400 font-mono text-sm">Initializing secure session...</div>;
  if (appStatus === 'unauthenticated' || !user) return <AuthPage onAuthenticated={handleAuthenticated} />;
  if (!state.activeGoal) return <LandingPage onLogout={logout} isLoading={isLoading} error={error} onStart={async goal => {
    if (goalRequestInFlight.current) return;
    goalRequestInFlight.current = true;
    setIsLoading(true); setError('');
    try {
      setState(await createGoal(goal));
      setActiveTab('dashboard');
      setNotice('Your personalized plan is ready.');
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      goalRequestInFlight.current = false;
      setIsLoading(false);
    }
  }} />;

  const navItems = [
    ['dashboard', 'Agent Workspace', Cpu], ['chat', 'AI Chat Coach', Bot], ['memory', 'Memory Bank', Brain],
    ['roadmap', 'Goal Roadmap', Compass], ['analytics', 'Progress Analytics', TrendingUp], ['models', 'Ollama Models', Brain],
  ] as const;

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex overflow-hidden">
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#0a0d15] border-r border-slate-800/60 flex flex-col transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 py-5 border-b border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 grid place-items-center"><Sparkles className="w-3.5 h-3.5" /></div><span className="font-display font-bold text-sm tracking-wide">NOVA COPILOT</span></div>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 border-b border-slate-800/50">
          <p className="text-[9px] uppercase tracking-widest text-slate-500">Active goal</p>
          <p className="text-xs font-semibold text-slate-200 truncate mt-1">{state.activeGoal.title}</p>
          <p className="text-[10px] text-cyan-400 mt-1">{state.analytics?.overallProgress || 0}% complete</p>
        </div>
        <nav className="p-3 space-y-1 flex-1">
          {navItems.map(([id, label, Icon]) => <button key={id} onClick={() => { setActiveTab(id); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm border ${activeTab === id ? 'bg-cyan-500/10 border-cyan-500/15 text-cyan-300' : 'border-transparent text-slate-400 hover:bg-slate-900'}`}><Icon className="w-4 h-4" />{label}</button>)}
        </nav>
        <div className="p-4 border-t border-slate-800/60"><button onClick={logout} className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-white py-2"><LogOut className="w-3.5 h-3.5" />Logout {user.name}</button></div>
      </aside>

      {sidebarOpen && <button aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden" />}
      <div className="flex-1 min-w-0 h-screen overflow-hidden flex flex-col">
        <header className="px-4 sm:px-6 py-4 border-b border-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3"><button className="lg:hidden" onClick={() => setSidebarOpen(true)}><Menu className="w-5 h-5" /></button><h2 className="font-display font-bold">{navItems.find(item => item[0] === activeTab)?.[1]}</h2></div>
          <div className="flex items-center gap-2">
            <select aria-label="AI model" value={selectedModel} onChange={event => chooseModel(event.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-300 outline-none">
              <option value="deepseek-r1:8b">DeepSeek</option>
              <option value="qwen2.5:3b">Qwen 2.5</option>
              <option value="compare">Compare Both</option>
            </select>
            <div className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">● NOVA connected</div>
          </div>
        </header>
        {(notice || error) && <div role={error ? 'alert' : 'status'} className={`mx-4 sm:mx-6 mt-4 px-4 py-3 rounded-xl text-xs border ${error ? 'text-rose-300 bg-rose-500/10 border-rose-500/20' : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'}`}>{error || notice}</div>}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === 'dashboard' && <AgentWorkspace state={state} isLoading={isLoading}
            onCompleteTask={(id, note) => run(() => completeTask(id, note), 'Task completed. Progress and predictions updated.')}
            onSkipTask={(id, reason) => run(() => skipTask(id, reason), 'Task skipped. NOVA reviewed and adapted the schedule.')}
            onRescheduleTask={(id, date) => run(() => rescheduleTask(id, date), 'Task rescheduled and revision recorded.')}
            onAddNote={(id, note) => run(() => addProgressNote(id, note), 'Progress note saved to memory.')}
            onCheckIn={value => run(() => dailyCheckIn(value), 'Daily check-in saved and today’s recommendation updated.')} />}
          {activeTab === 'chat' && <AIChat state={state} isLoading={isLoading} onSendMessage={async message => {
            setIsLoading(true); setError('');
            try { const result = await sendChatMessage(message); setState(result.dashboard); }
            catch (requestError) { setError((requestError as Error).message); }
            finally { setIsLoading(false); }
          }} />}
          {activeTab === 'memory' && <MemoryBank state={state} />}
          {activeTab === 'roadmap' && <RoadmapTimeline state={state} onCompleteTask={(id) => run(() => completeTask(id), 'Task completed.')} isLoading={isLoading} />}
          {activeTab === 'analytics' && <AnalyticsView state={state} />}
          {activeTab === 'models' && <ModelCompareDashboard />}
        </main>
      </div>
    </div>
  );
}


