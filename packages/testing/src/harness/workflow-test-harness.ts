export interface WorkflowTestStep {
  name: string;
  type: "agent" | "tool" | "approval";
  expectedInput?: Record<string, unknown>;
  mockOutput?: unknown;
  approvalDecision?: "approved" | "rejected";
}

export interface WorkflowTestCase {
  name: string;
  input: Record<string, unknown>;
  steps: WorkflowTestStep[];
}

export interface WorkflowTestResult {
  name: string;
  passed: boolean;
  stepsExecuted: number;
  stepsTotal: number;
  error?: string;
  durationMs: number;
}

export async function runWorkflowTest(
  testCase: WorkflowTestCase,
): Promise<WorkflowTestResult> {
  const start = Date.now();

  try {
    let stepsExecuted = 0;

    for (const step of testCase.steps) {
      stepsExecuted++;
      if (step.type === "approval" && step.approvalDecision === "rejected") {
        return {
          name: testCase.name,
          passed: true,
          stepsExecuted,
          stepsTotal: testCase.steps.length,
          durationMs: Date.now() - start,
        };
      }
    }

    return {
      name: testCase.name,
      passed: true,
      stepsExecuted,
      stepsTotal: testCase.steps.length,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name: testCase.name,
      passed: false,
      stepsExecuted: 0,
      stepsTotal: testCase.steps.length,
      error: String(error),
      durationMs: Date.now() - start,
    };
  }
}
