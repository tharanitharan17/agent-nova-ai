import React, { useState } from 'react';
import { AppState, Memory } from '../types';
import { Brain, Search, Filter, ShieldAlert, SlidersHorizontal, Trash2, Calendar, Target, Award, Cpu } from 'lucide-react';
import { motion } from 'motion/react';

interface MemoryBankProps {
  state: AppState;
}

export default function MemoryBank({ state }: MemoryBankProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const categories = [
    { value: 'all', label: 'All Clusters' },
    { value: 'user_pref', label: 'User Preferences' },
    { value: 'agent_insight', label: 'Agent Insights' },
    { value: 'learned_skill', label: 'Acquired Skills' },
    { value: 'milestone_reached', label: 'Milestones Reached' }
  ];

  const filteredMemories = state.memories.filter((mem) => {
    const matchesSearch = mem.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === 'all' || mem.category === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const getCategoryStyle = (cat: Memory['category']) => {
    switch(cat) {
      case 'learned_skill': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'agent_insight': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'user_pref': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'milestone_reached': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getCategoryIcon = (cat: Memory['category']) => {
    switch(cat) {
      case 'learned_skill': return <Award className="w-3.5 h-3.5" />;
      case 'agent_insight': return <Cpu className="w-3.5 h-3.5" />;
      case 'user_pref': return <SlidersHorizontal className="w-3.5 h-3.5" />;
      case 'milestone_reached': return <Target className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Page Header */}
      <div className="p-6 bg-slate-900/15 border border-slate-800/40 rounded-2xl backdrop-blur-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-teal-400" />
            <h1 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
              Cognitive Memory Bank
            </h1>
          </div>
          <p className="text-xs text-slate-400 max-w-xl font-light">
            This represents Nova's semantic graph where beliefs, skill levels, preferences, and accomplishments are archived to personalize subsequent reasoning steps.
          </p>
        </div>
        <div className="text-xs font-mono px-3 py-1 bg-slate-950/50 border border-slate-850 text-slate-400 rounded-md">
          Cognitive Graph Nodes: <span className="text-teal-400 font-bold">{state.memories.length}</span>
        </div>
      </div>

      {/* Conceptual vector visualization cluster */}
      {state.memories.length > 0 && (
        <div className="p-5 bg-slate-950/40 border border-slate-850/60 rounded-xl relative overflow-hidden h-36 flex items-center justify-center">
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
          
          <div className="relative flex items-center justify-center gap-8 md:gap-16 z-10 w-full max-w-2xl">
            {categories.slice(1).map((cat, idx) => {
              const count = state.memories.filter(m => m.category === cat.value).length;
              return (
                <div key={idx} className="flex flex-col items-center space-y-1 bg-slate-900/45 p-2 rounded-lg border border-slate-850/45 text-center min-w-[100px]">
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-mono scale-90">{cat.label.split(' ')[0]}</div>
                  <div className="text-lg font-bold text-teal-400 font-mono leading-none">{count}</div>
                  <div className="text-[9px] text-slate-600 font-mono uppercase">nodes</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls: Search and filter buttons */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between border-b border-slate-800/40 pb-4">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search memory records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-850 text-slate-300 rounded-lg placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-teal-500/80 transition-all duration-300"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveFilter(cat.value)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
                activeFilter === cat.value
                  ? 'bg-teal-500/10 border-teal-500 text-teal-400 shadow-md shadow-teal-500/5'
                  : 'bg-slate-900/30 border-slate-850 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid records */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMemories.length === 0 ? (
          <div className="col-span-full text-center py-16 text-slate-500 text-xs sm:text-sm font-light">
            No memories found matching your filters.
          </div>
        ) : (
          filteredMemories.map((mem) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              key={mem.id} 
              className="p-4 bg-slate-900/10 border border-slate-800/40 rounded-xl space-y-3.5 hover:border-slate-800 hover:bg-slate-900/20 transition duration-300 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className={`px-2 py-0.5 rounded border text-[9px] font-mono tracking-wide flex items-center space-x-1 ${getCategoryStyle(mem.category)}`}>
                    {getCategoryIcon(mem.category)}
                    <span>{mem.category.replace('_', ' ').toUpperCase()}</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 flex items-center space-x-1">
                    <Calendar className="w-2.5 h-2.5" />
                    <span>{new Date(mem.created_at).toLocaleDateString()}</span>
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-light">
                  {mem.content}
                </p>
              </div>

              <div className="border-t border-slate-850/40 pt-2 flex items-center justify-between text-[10px] font-mono text-slate-600">
                <span>Memory node ID: {mem.id}</span>
                <span className="text-teal-400/80">Active</span>
              </div>
            </motion.div>
          ))
        )}
      </div>

    </div>
  );
}
