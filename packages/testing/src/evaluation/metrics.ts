export interface AgentMetrics {
  accuracy: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalTokens: number;
  avgTokensPerCall: number;
  costEstimate: number;
}

export function computeMetrics(results: Array<{ passed: boolean; durationMs: number; tokens: number }>): AgentMetrics {
  const passed = results.filter((r) => r.passed).length;
  const latencies = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0);

  return {
    accuracy: results.length > 0 ? passed / results.length : 0,
    avgLatencyMs: latencies.reduce((sum, l) => sum + l, 0) / Math.max(latencies.length, 1),
    p95LatencyMs: latencies[Math.floor(latencies.length * 0.95)] ?? 0,
    totalTokens,
    avgTokensPerCall: results.length > 0 ? totalTokens / results.length : 0,
    costEstimate: (totalTokens / 1_000_000) * 3, // Approximate $3/MTok
  };
}
