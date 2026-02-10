import type { AgentContext } from "@beacon-os/sdk";
import { createExtendedMockContext } from "../mocks/mock-context-extended.js";
import type { MockModelProviderConfig } from "../mocks/mock-model-provider.js";

export interface EvaluationCase {
  id: string;
  input: Record<string, unknown>;
  expectedOutput: string;
  tags?: string[];
}

export interface EvaluationScore {
  caseId: string;
  passed: boolean;
  score: number;
  actualOutput: string;
  expectedOutput: string;
  durationMs: number;
  tokenUsage: number;
}

export interface EvaluationSummary {
  totalCases: number;
  passed: number;
  failed: number;
  avgScore: number;
  avgDurationMs: number;
  totalTokens: number;
  scores: EvaluationScore[];
}

export class EvaluationRunner {
  private handler: (
    ctx: AgentContext,
    input: Record<string, unknown>,
  ) => Promise<unknown>;
  private modelConfig?: MockModelProviderConfig;
  private scoringFn: (actual: string, expected: string) => number;

  constructor(
    handler: (
      ctx: AgentContext,
      input: Record<string, unknown>,
    ) => Promise<unknown>,
    options?: {
      modelConfig?: MockModelProviderConfig;
      scoringFn?: (actual: string, expected: string) => number;
    },
  ) {
    this.handler = handler;
    this.modelConfig = options?.modelConfig;
    this.scoringFn = options?.scoringFn ?? defaultScoring;
  }

  async evaluate(cases: EvaluationCase[]): Promise<EvaluationSummary> {
    const scores: EvaluationScore[] = [];

    for (const evalCase of cases) {
      const start = Date.now();
      const { ctx, modelProvider } = createExtendedMockContext({
        modelConfig: this.modelConfig,
      });

      try {
        const output = await this.handler(ctx, evalCase.input);
        const actualOutput =
          typeof output === "string" ? output : JSON.stringify(output);
        const score = this.scoringFn(actualOutput, evalCase.expectedOutput);

        scores.push({
          caseId: evalCase.id,
          passed: score >= 0.7,
          score,
          actualOutput,
          expectedOutput: evalCase.expectedOutput,
          durationMs: Date.now() - start,
          tokenUsage: modelProvider.calls.reduce(
            (sum, c) => sum + c.response.usage.totalTokens,
            0,
          ),
        });
      } catch (error) {
        scores.push({
          caseId: evalCase.id,
          passed: false,
          score: 0,
          actualOutput: String(error),
          expectedOutput: evalCase.expectedOutput,
          durationMs: Date.now() - start,
          tokenUsage: 0,
        });
      }
    }

    const passed = scores.filter((s) => s.passed).length;
    return {
      totalCases: cases.length,
      passed,
      failed: cases.length - passed,
      avgScore:
        scores.reduce((sum, s) => sum + s.score, 0) /
        Math.max(scores.length, 1),
      avgDurationMs:
        scores.reduce((sum, s) => sum + s.durationMs, 0) /
        Math.max(scores.length, 1),
      totalTokens: scores.reduce((sum, s) => sum + s.tokenUsage, 0),
      scores,
    };
  }
}

function defaultScoring(actual: string, expected: string): number {
  if (actual === expected) return 1.0;
  const actualLower = actual.toLowerCase();
  const expectedLower = expected.toLowerCase();
  if (
    actualLower.includes(expectedLower) ||
    expectedLower.includes(actualLower)
  )
    return 0.8;
  const expectedWords = expectedLower.split(/\s+/);
  const matchedWords = expectedWords.filter((w) => actualLower.includes(w));
  return matchedWords.length / Math.max(expectedWords.length, 1);
}
