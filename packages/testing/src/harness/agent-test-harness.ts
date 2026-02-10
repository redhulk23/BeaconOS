import type { AgentContext } from "@beacon-os/sdk";
import {
  createExtendedMockContext,
  type ExtendedMockContextOptions,
} from "../mocks/mock-context-extended.js";
import type { MockModelProviderConfig } from "../mocks/mock-model-provider.js";

export interface AgentTestCase {
  name: string;
  input: Record<string, unknown>;
  modelConfig?: MockModelProviderConfig;
  expectedOutput?: Record<string, unknown>;
  validate?: (output: unknown) => boolean;
}

export interface AgentTestResult {
  name: string;
  passed: boolean;
  output: unknown;
  error?: string;
  durationMs: number;
  modelCallCount: number;
}

export async function runAgentTest(
  handler: (
    ctx: AgentContext,
    input: Record<string, unknown>,
  ) => Promise<unknown>,
  testCase: AgentTestCase,
  contextOptions?: ExtendedMockContextOptions,
): Promise<AgentTestResult> {
  const start = Date.now();
  const { ctx, modelProvider } = createExtendedMockContext({
    ...contextOptions,
    modelConfig: testCase.modelConfig ?? contextOptions?.modelConfig,
  });

  try {
    const output = await handler(ctx, testCase.input);
    const durationMs = Date.now() - start;

    let passed = true;
    if (testCase.validate) {
      passed = testCase.validate(output);
    } else if (testCase.expectedOutput) {
      passed =
        JSON.stringify(output) === JSON.stringify(testCase.expectedOutput);
    }

    return {
      name: testCase.name,
      passed,
      output,
      durationMs,
      modelCallCount: modelProvider.getCallCount(),
    };
  } catch (error) {
    return {
      name: testCase.name,
      passed: false,
      output: null,
      error: String(error),
      durationMs: Date.now() - start,
      modelCallCount: modelProvider.getCallCount(),
    };
  }
}

export async function runAgentTestSuite(
  handler: (
    ctx: AgentContext,
    input: Record<string, unknown>,
  ) => Promise<unknown>,
  testCases: AgentTestCase[],
  contextOptions?: ExtendedMockContextOptions,
): Promise<{
  results: AgentTestResult[];
  passed: number;
  failed: number;
  totalMs: number;
}> {
  const results: AgentTestResult[] = [];
  const suiteStart = Date.now();

  for (const tc of testCases) {
    const result = await runAgentTest(handler, tc, contextOptions);
    results.push(result);
  }

  return {
    results,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    totalMs: Date.now() - suiteStart,
  };
}
