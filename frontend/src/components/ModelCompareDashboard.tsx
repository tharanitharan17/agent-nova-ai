import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, Zap, Clock, Cpu, HardDrive, BarChart3, Trophy, Download, RefreshCw, GitCompare, Play } from 'lucide-react';
import { apiRequest } from '../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OllamaStatus {
  running: boolean;
  endpoint: string;
  models: string[];
  error?: string;
}

interface BenchmarkMetrics {
  avgResponseTimeMs: number;
  totalTokensGenerated: number;
  peakMemoryMB: number;
  cpuUsagePercent: number;
  success: boolean;
  errorMessage?: string;
}

interface QualityScores {
  goalAnalysis: number;
  roadmapQuality: number;
  reasoningQuality: number;
  contextRetention: number;
  taskGeneration: number;
  overall: number;
}

interface ModelBenchmarkResult {
  modelName: string;
  provider: string;
  timestamp: string;
  metrics: BenchmarkMetrics;
  quality: QualityScores;
  responses: Record<string, { text: string; timeMs: number; tokens: number }>;
}

interface ModelComparison {
  deepseek?: ModelBenchmarkResult;
  qwen?: ModelBenchmarkResult;
  timestamp: string;
  summary: {
    fastest: string;
    bestQuality: string;
    lowestMemory: string;
    recommendation: string;
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return apiRequest<T>(path, options);
}

// ─── Quality Bar ─────────────────────────────────────────────────────────────

function QualityBar({ label, value, maxValue = 10 }: { label: string; value: number; maxValue?: number }) {
  const pct = Math.round((value / maxValue) * 100);
  const color = pct >= 70 ? 'from-emerald-500 to-cyan-500' : pct >= 40 ? 'from-amber-500 to-yellow-500' : 'from-rose-500 to-orange-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300 font-mono">{value}/{maxValue}</span>
      </div>
      <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Model Result Card ───────────────────────────────────────────────────────

function ModelResultCard({ result, isWinner }: { result: ModelBenchmarkResult; isWinner?: Record<string, boolean> }) {
  const [expanded, setExpanded] = useState(false);
  const modelLabel = result.modelName.includes('deepseek') ? 'DeepSeek-R1' : 'Qwen 2.5';
  const accent = result.modelName.includes('deepseek') ? 'cyan' : 'violet';

  return (
    <div className={`border rounded-2xl bg-slate-900/30 border-${accent}-500/20 p-5 space-y-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg bg-${accent}-500/15 grid place-items-center`}>
            <Cpu className={`w-4 h-4 text-${accent}-400`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{modelLabel}</h3>
            <p className="text-[10px] text-slate-500 font-mono">{result.modelName}</p>
          </div>
        </div>
        {result.metrics.success
          ? <span className="text-[9px] uppercase font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>Pass</span>
          : <span className="text-[9px] uppercase font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full flex items-center gap-1"><XCircle className="w-3 h-3"/>Fail</span>
        }
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          ['Avg Response', `${result.metrics.avgResponseTimeMs}ms`, Clock, isWinner?.speed],
          ['Total Tokens', `${result.metrics.totalTokensGenerated}`, Zap, false],
          ['Peak Memory', `${result.metrics.peakMemoryMB}MB`, HardDrive, isWinner?.memory],
          ['CPU Usage', `${result.metrics.cpuUsagePercent}%`, Cpu, false],
        ].map(([label, value, Icon, winner]) => (
          <div key={label as string} className="bg-slate-950/40 border border-slate-800/40 rounded-lg p-2.5 relative">
            {winner && <Trophy className="absolute top-1.5 right-1.5 w-3 h-3 text-amber-400" />}
            <div className="flex items-center gap-1.5 text-slate-500 mb-1"><span className="w-3 h-3">{React.createElement(Icon as React.FC<{className: string}>, { className: 'w-3 h-3' })}</span><span className="text-[9px] uppercase">{label as string}</span></div>
            <p className="text-sm font-mono font-bold text-white">{value as string}</p>
          </div>
        ))}
      </div>

      {/* Quality Scores */}
      <div className="space-y-2">
        <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Quality Scores</h4>
        <QualityBar label="Goal Analysis" value={result.quality.goalAnalysis} />
        <QualityBar label="Roadmap Quality" value={result.quality.roadmapQuality} />
        <QualityBar label="Reasoning" value={result.quality.reasoningQuality} />
        <QualityBar label="Context Retention" value={result.quality.contextRetention} />
        <QualityBar label="Task Generation" value={result.quality.taskGeneration} />
        <div className="pt-1 border-t border-slate-800/50">
          <QualityBar label="Overall Score" value={result.quality.overall} />
        </div>
      </div>

      {/* Expand Responses */}
      <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-cyan-400 hover:text-cyan-300">
        {expanded ? 'Hide responses ▲' : 'Show raw responses ▼'}
      </button>
      {expanded && (
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {Object.entries(result.responses).map(([key, val]) => (
            <div key={key} className="bg-slate-950/50 border border-slate-800/30 rounded-lg p-3">
              <div className="flex justify-between text-[9px] text-slate-500 mb-1.5">
                <span className="uppercase font-mono">{key}</span>
                <span>{val.timeMs}ms · ~{val.tokens} tokens</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-6">{val.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ModelCompareDashboard() {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [benchLoading, setBenchLoading] = useState(false);
  const [benchTarget, setBenchTarget] = useState<'deepseek' | 'qwen' | 'compare'>('compare');
  const [comparison, setComparison] = useState<ModelComparison | null>(null);
  const [singleResult, setSingleResult] = useState<ModelBenchmarkResult | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<OllamaStatus>('/api/ollama/status');
      setStatus(data);
    } catch (err) {
      setStatus({ running: false, endpoint: 'Not reachable', models: [], error: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const setupModels = async () => {
    setSetupLoading(true);
    setError('');
    try {
      await apiFetch<unknown>('/api/ollama/setup', { method: 'POST' });
      await checkStatus();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSetupLoading(false);
    }
  };

  const runBenchmark = async () => {
    setBenchLoading(true);
    setError('');
    setSingleResult(null);
    setComparison(null);
    try {
      if (benchTarget === 'compare') {
        const data = await apiFetch<ModelComparison>('/api/ollama/compare', { method: 'POST' });
        setComparison(data);
      } else {
        const data = await apiFetch<ModelBenchmarkResult>(`/api/ollama/benchmark/${benchTarget}`, { method: 'POST' });
        setSingleResult(data);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBenchLoading(false);
    }
  };

  const downloadReport = async () => {
    try {
      const data = await apiFetch<{ markdown: string }>('/api/ollama/report');
      const blob = new Blob([data.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `benchmark-report-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const hasDeepseek = status?.models.some(m => m.startsWith('deepseek-r1')) ?? false;
  const hasQwen = status?.models.some(m => m.startsWith('qwen2.5:3b')) ?? false;

  return (
    <div className="space-y-6 pb-8">
      {/* Ollama Status */}
      <section className="p-5 bg-gradient-to-br from-slate-900/60 to-slate-950/40 border border-slate-800/70 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-white flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-violet-400" />
            Ollama Model Comparison
          </h2>
          <button onClick={checkStatus} disabled={loading} className="text-[10px] text-slate-400 hover:text-cyan-300 flex items-center gap-1">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Checking Ollama status...</div>
        ) : status?.running ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">● Running</span>
              <span className="text-[10px] text-slate-500">{status.endpoint}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <div className={`flex items-center gap-2 p-3 rounded-xl border ${hasDeepseek ? 'border-emerald-500/20 bg-emerald-950/15' : 'border-slate-800/50 bg-slate-950/30'}`}>
                {hasDeepseek ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-slate-600" />}
                <div><p className="text-xs font-medium text-slate-200">DeepSeek-R1</p><p className="text-[10px] text-slate-500">deepseek-r1:8b</p></div>
              </div>
              <div className={`flex items-center gap-2 p-3 rounded-xl border ${hasQwen ? 'border-emerald-500/20 bg-emerald-950/15' : 'border-slate-800/50 bg-slate-950/30'}`}>
                {hasQwen ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-slate-600" />}
                <div><p className="text-xs font-medium text-slate-200">Qwen 2.5</p><p className="text-[10px] text-slate-500">qwen2.5:3b</p></div>
              </div>
            </div>
            {(!hasDeepseek || !hasQwen) && (
              <button onClick={setupModels} disabled={setupLoading} className="px-4 py-2 text-xs bg-violet-500/15 border border-violet-500/25 text-violet-300 rounded-lg hover:bg-violet-500/25 disabled:opacity-50 flex items-center gap-2">
                {setupLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                {setupLoading ? 'Pulling models...' : 'Pull Missing Models'}
              </button>
            )}
          </div>
        ) : (
          <div className="border border-rose-500/20 bg-rose-950/15 rounded-xl p-4">
            <p className="text-xs text-rose-300">Ollama is not running. Start it with: <code className="bg-slate-950 px-1.5 py-0.5 rounded">ollama serve</code></p>
            {status?.error && <p className="text-[10px] text-rose-400/60 mt-1">{status.error}</p>}
          </div>
        )}
      </section>

      {/* Benchmark Controls */}
      {status?.running && (
        <section className="p-5 bg-slate-900/20 border border-slate-800/50 rounded-2xl">
          <h3 className="text-sm font-bold text-white mb-4">Run Benchmark</h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-slate-800/60 overflow-hidden">
              {(['deepseek', 'qwen', 'compare'] as const).map(opt => (
                <button key={opt} onClick={() => setBenchTarget(opt)}
                  className={`px-4 py-2 text-xs font-medium capitalize ${benchTarget === opt ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20' : 'text-slate-400 hover:bg-slate-900'} ${opt !== 'deepseek' ? 'border-l border-slate-800/60' : ''}`}
                >{opt === 'compare' ? 'Compare Both' : opt === 'deepseek' ? 'DeepSeek' : 'Qwen'}</button>
              ))}
            </div>
            <button onClick={runBenchmark} disabled={benchLoading}
              className="px-5 py-2 text-xs font-semibold bg-gradient-to-r from-cyan-500 to-indigo-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2 hover:opacity-90"
            >{benchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}{benchLoading ? 'Running...' : 'Start Benchmark'}</button>
            {(comparison || singleResult) && (
              <button onClick={downloadReport} className="px-4 py-2 text-xs text-slate-400 border border-slate-800/50 rounded-lg hover:bg-slate-900 flex items-center gap-1.5">
                <Download className="w-3 h-3" /> Download Report
              </button>
            )}
          </div>
          {benchLoading && (
            <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              Running {benchTarget === 'compare' ? '5 tests × 2 models' : '5 tests'}. This may take 2-5 minutes per model...
            </div>
          )}
        </section>
      )}

      {/* Error */}
      {error && (
        <div className="border border-rose-500/20 bg-rose-950/15 rounded-xl p-4 text-xs text-rose-300">{error}</div>
      )}

      {/* Comparison Results */}
      {comparison && (
        <>
          {/* Summary */}
          <section className="p-5 bg-gradient-to-r from-indigo-950/25 to-violet-950/20 border border-indigo-500/15 rounded-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-indigo-400" /> Comparison Summary
            </h3>
            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              {[
                ['Fastest', comparison.summary.fastest, 'text-cyan-400'],
                ['Best Quality', comparison.summary.bestQuality, 'text-emerald-400'],
                ['Lowest Memory', comparison.summary.lowestMemory, 'text-amber-400'],
              ].map(([label, value, color]) => (
                <div key={label} className="bg-slate-950/40 border border-slate-800/40 rounded-lg p-3">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
                  <p className={`text-sm font-bold mt-1 ${color}`}>{value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-indigo-200 bg-indigo-500/5 rounded-lg px-3 py-2">
              💡 {comparison.summary.recommendation}
            </p>
          </section>

          {/* Side-by-Side */}
          <div className="grid lg:grid-cols-2 gap-4">
            {comparison.deepseek && (
              <ModelResultCard result={comparison.deepseek} isWinner={{
                speed: comparison.summary.fastest === 'DeepSeek-R1',
                memory: comparison.summary.lowestMemory === 'DeepSeek-R1',
              }} />
            )}
            {comparison.qwen && (
              <ModelResultCard result={comparison.qwen} isWinner={{
                speed: comparison.summary.fastest === 'Qwen 2.5',
                memory: comparison.summary.lowestMemory === 'Qwen 2.5',
              }} />
            )}
          </div>
        </>
      )}

      {/* Single Model Result */}
      {singleResult && !comparison && (
        <div className="max-w-xl">
          <ModelResultCard result={singleResult} />
        </div>
      )}
    </div>
  );
}
