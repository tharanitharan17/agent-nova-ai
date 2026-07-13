import '../load-env.js';
import { llmService } from '../server/llm-service.js';

// ─── Benchmark Types ─────────────────────────────────────────────────────────

export interface BenchmarkResult {
  modelName: string;
  provider: string;
  metrics: {
    responseTime: number; // ms
    tokensGenerated: number;
    memoryUsage: number; // MB
    cpuUsage: number; // %
    success: boolean;
    errorMessage?: string;
  };
  quality: {
    goalAnalysis: number; // 1-10
    planningQuality: number; // 1-10
    taskGeneration: number; // 1-10
    contextRetention: number; // 1-10
    reasoning: number; // 1-10
    overall: number; // 1-10
  };
}

export interface BenchmarkComparison {
  deepseek?: BenchmarkResult;
  qwen?: BenchmarkResult;
  summary: {
    fastest: string;
    bestQuality: string;
    mostEfficient: string;
    recommendation: string;
  };
}

// ─── Benchmark Utilities ─────────────────────────────────────────────────────

class BenchmarkRunner {
  private startTime: number = 0;
  private startMemory: number = 0;
  
  start(): void {
    this.startTime = Date.now();
    this.startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  }
  
  end(): { duration: number; memoryDelta: number } {
    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    return {
      duration: endTime - this.startTime,
      memoryDelta: endMemory - this.startMemory,
    };
  }
  
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
  
  getCpuUsage(): number {
    const cpus = require('os').cpus();
    const loadAvg = require('os').loadavg();
    return (loadAvg[0] / cpus.length) * 100;
  }
}

// ─── Test Cases ───────────────────────────────────────────────────────────────

const TEST_GOAL = "I want to become a Data Scientist in 6 months.";

const TEST_CASES = {
  goalAnalysis: {
    prompt: `Analyze this goal and break it down into key components: "${TEST_GOAL}"`,
    systemInstruction: "You are a goal analysis expert. Provide structured analysis.",
  },
  planning: {
    prompt: `Create a learning roadmap for: "${TEST_GOAL}"`,
    systemInstruction: "You are a curriculum architect. Create a structured plan.",
  },
  taskGeneration: {
    prompt: `Generate daily tasks for: "${TEST_GOAL}"`,
    systemInstruction: "You are a task planner. Create actionable tasks.",
  },
  reasoning: {
    prompt: `Reason about the feasibility of: "${TEST_GOAL}"`,
    systemInstruction: "You are a reasoning expert. Use chain-of-thought.",
  },
  context: {
    prompt: `Remember this context: User wants to become a Data Scientist. Now generate a response acknowledging this.`,
    systemInstruction: "You are a memory-aware assistant. Reference context.",
  },
};

// ─── Benchmark Execution ─────────────────────────────────────────────────────

export async function runBenchmark(modelName: string, provider: string): Promise<BenchmarkResult> {
  console.log(`\n[benchmark] Starting benchmark for ${modelName} (${provider})...`);
  
  const runner = new BenchmarkRunner();
  const metrics = {
    responseTime: 0,
    tokensGenerated: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    success: true,
    errorMessage: undefined as string | undefined,
  };
  
  const quality = {
    goalAnalysis: 0,
    planningQuality: 0,
    taskGeneration: 0,
    contextRetention: 0,
    reasoning: 0,
    overall: 0,
  };
  
  try {
    // Test 1: Goal Analysis
    console.log(`[benchmark] Testing goal analysis...`);
    runner.start();
    const analysisResponse = await llmService.generateText(
      TEST_CASES.goalAnalysis.prompt,
      TEST_CASES.goalAnalysis.systemInstruction
    );
    const analysisResult = runner.end();
    metrics.responseTime += analysisResult.duration;
    metrics.tokensGenerated += runner.estimateTokens(analysisResponse);
    quality.goalAnalysis = Math.min(10, Math.max(1, analysisResponse.length / 50)); // Simple heuristic
    console.log(`[benchmark] Goal analysis: ${analysisResult.duration}ms`);
    
    // Test 2: Planning
    console.log(`[benchmark] Testing planning...`);
    runner.start();
    const planResponse = await llmService.generateText(
      TEST_CASES.planning.prompt,
      TEST_CASES.planning.systemInstruction
    );
    const planResult = runner.end();
    metrics.responseTime += planResult.duration;
    metrics.tokensGenerated += runner.estimateTokens(planResponse);
    quality.planningQuality = Math.min(10, Math.max(1, planResponse.length / 100));
    console.log(`[benchmark] Planning: ${planResult.duration}ms`);
    
    // Test 3: Task Generation
    console.log(`[benchmark] Testing task generation...`);
    runner.start();
    const taskResponse = await llmService.generateText(
      TEST_CASES.taskGeneration.prompt,
      TEST_CASES.taskGeneration.systemInstruction
    );
    const taskResult = runner.end();
    metrics.responseTime += taskResult.duration;
    metrics.tokensGenerated += runner.estimateTokens(taskResponse);
    quality.taskGeneration = Math.min(10, Math.max(1, taskResponse.length / 80));
    console.log(`[benchmark] Task generation: ${taskResult.duration}ms`);
    
    // Test 4: Reasoning
    console.log(`[benchmark] Testing reasoning...`);
    runner.start();
    const reasoningResponse = await llmService.generateText(
      TEST_CASES.reasoning.prompt,
      TEST_CASES.reasoning.systemInstruction
    );
    const reasoningResult = runner.end();
    metrics.responseTime += reasoningResult.duration;
    metrics.tokensGenerated += runner.estimateTokens(reasoningResponse);
    quality.reasoning = Math.min(10, Math.max(1, reasoningResponse.length / 60));
    console.log(`[benchmark] Reasoning: ${reasoningResult.duration}ms`);
    
    // Test 5: Context Retention
    console.log(`[benchmark] Testing context retention...`);
    runner.start();
    const contextResponse = await llmService.generateText(
      TEST_CASES.context.prompt,
      TEST_CASES.context.systemInstruction
    );
    const contextResult = runner.end();
    metrics.responseTime += contextResult.duration;
    metrics.tokensGenerated += runner.estimateTokens(contextResponse);
    quality.contextRetention = contextResponse.toLowerCase().includes('data scientist') ? 8 : 5;
    console.log(`[benchmark] Context retention: ${contextResult.duration}ms`);
    
    // Calculate averages
    metrics.responseTime = Math.round(metrics.responseTime / 5);
    metrics.memoryUsage = Math.round((analysisResult.memoryDelta + planResult.memoryDelta + taskResult.memoryDelta + reasoningResult.memoryDelta + contextResult.memoryDelta) / 5);
    metrics.cpuUsage = Math.round(runner.getCpuUsage());
    
    // Calculate overall quality
    quality.overall = Math.round(
      (quality.goalAnalysis + quality.planningQuality + quality.taskGeneration + quality.contextRetention + quality.reasoning) / 5
    );
    
    console.log(`[benchmark] Benchmark completed for ${modelName}`);
    
  } catch (error) {
    metrics.success = false;
    metrics.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[benchmark] Error during benchmark: ${metrics.errorMessage}`);
  }
  
  return {
    modelName,
    provider,
    metrics,
    quality,
  };
}

// ─── Comparison Report ───────────────────────────────────────────────────────

export async function runComparisonBenchmark(): Promise<BenchmarkComparison> {
  console.log('\n========================================');
  console.log('GoalPilot AI - Model Benchmark');
  console.log('========================================');
  
  const results: BenchmarkComparison = {
    summary: {
      fastest: '',
      bestQuality: '',
      mostEfficient: '',
      recommendation: '',
    },
  };
  
  // Benchmark DeepSeek
  try {
    console.log('\n--- Benchmarking DeepSeek ---');
    process.env.LLM_MODEL = 'deepseek-r1:8b';
    results.deepseek = await runBenchmark('deepseek-r1:8b', 'ollama');
  } catch (error) {
    console.error('[benchmark] DeepSeek benchmark failed:', error);
  }
  
  // Benchmark Qwen
  try {
    console.log('\n--- Benchmarking Qwen ---');
    process.env.LLM_MODEL = 'qwen2.5:3b';
    results.qwen = await runBenchmark('qwen2.5:3b', 'ollama');
  } catch (error) {
    console.error('[benchmark] Qwen benchmark failed:', error);
  }
  
  // Generate summary
  if (results.deepseek && results.qwen) {
    results.summary.fastest = 
      results.deepseek.metrics.responseTime < results.qwen.metrics.responseTime
        ? 'DeepSeek'
        : 'Qwen';
    
    results.summary.bestQuality = 
      results.deepseek.quality.overall > results.qwen.quality.overall
        ? 'DeepSeek'
        : 'Qwen';
    
    results.summary.mostEfficient = 
      results.deepseek.metrics.memoryUsage < results.qwen.metrics.memoryUsage
        ? 'DeepSeek'
        : 'Qwen';
    
    results.summary.recommendation = 
      results.summary.bestQuality === 'DeepSeek'
        ? 'DeepSeek is recommended for better overall quality.'
        : 'Qwen is recommended for better overall quality.';
  }
  
  return results;
}

export function generateMarkdownReport(comparison: BenchmarkComparison): string {
  let report = '# GoalPilot AI - Model Performance Comparison\n\n';
  report += `**Test Goal:** "${TEST_GOAL}"\n\n`;
  report += `**Date:** ${new Date().toISOString()}\n\n`;
  
  report += '## Performance Metrics\n\n';
  report += '| Metric | DeepSeek | Qwen |\n';
  report += '|--------|----------|------|\n';
  
  if (comparison.deepseek) {
    report += `| Response Time | ${comparison.deepseek.metrics.responseTime}ms | - |\n`;
    report += `| Tokens Generated | ${comparison.deepseek.metrics.tokensGenerated} | - |\n`;
    report += `| Memory Usage | ${comparison.deepseek.metrics.memoryUsage}MB | - |\n`;
    report += `| CPU Usage | ${comparison.deepseek.metrics.cpuUsage}% | - |\n`;
  }
  
  if (comparison.qwen) {
    report += `| Response Time | - | ${comparison.qwen.metrics.responseTime}ms |\n`;
    report += `| Tokens Generated | - | ${comparison.qwen.metrics.tokensGenerated} |\n`;
    report += `| Memory Usage | - | ${comparison.qwen.metrics.memoryUsage}MB |\n`;
    report += `| CPU Usage | - | ${comparison.qwen.metrics.cpuUsage}% |\n`;
  }
  
  report += '\n## Quality Assessment\n\n';
  report += '| Quality Metric | DeepSeek | Qwen |\n';
  report += '|----------------|----------|------|\n';
  
  if (comparison.deepseek) {
    report += `| Goal Analysis | ${comparison.deepseek.quality.goalAnalysis}/10 | - |\n`;
    report += `| Planning Quality | ${comparison.deepseek.quality.planningQuality}/10 | - |\n`;
    report += `| Daily Tasks | ${comparison.deepseek.quality.taskGeneration}/10 | - |\n`;
    report += `| Context Retention | ${comparison.deepseek.quality.contextRetention}/10 | - |\n`;
    report += `| Reasoning | ${comparison.deepseek.quality.reasoning}/10 | - |\n`;
    report += `| Overall Score | ${comparison.deepseek.quality.overall}/10 | - |\n`;
  }
  
  if (comparison.qwen) {
    report += `| Goal Analysis | - | ${comparison.qwen.quality.goalAnalysis}/10 |\n`;
    report += `| Planning Quality | - | ${comparison.qwen.quality.planningQuality}/10 |\n`;
    report += `| Daily Tasks | - | ${comparison.qwen.quality.taskGeneration}/10 |\n`;
    report += `| Context Retention | - | ${comparison.qwen.quality.contextRetention}/10 |\n`;
    report += `| Reasoning | - | ${comparison.qwen.quality.reasoning}/10 |\n`;
    report += `| Overall Score | - | ${comparison.qwen.quality.overall}/10 |\n`;
  }
  
  report += '\n## Summary\n\n';
  report += `- **Fastest Model:** ${comparison.summary.fastest}\n`;
  report += `- **Best Quality:** ${comparison.summary.bestQuality}\n`;
  report += `- **Most Efficient:** ${comparison.summary.mostEfficient}\n`;
  report += `- **Recommendation:** ${comparison.summary.recommendation}\n`;
  
  return report;
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  runComparisonBenchmark()
    .then(comparison => {
      const report = generateMarkdownReport(comparison);
      console.log('\n' + report);
      
      // Save report to file
      const fs = require('fs');
      fs.writeFileSync('BENCHMARK_REPORT.md', report);
      console.log('\n[benchmark] Report saved to BENCHMARK_REPORT.md');
    })
    .catch(error => {
      console.error('[benchmark] Fatal error:', error);
      process.exit(1);
    });
}
