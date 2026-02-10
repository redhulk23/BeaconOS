// Harness
export {
  runAgentTest,
  runAgentTestSuite,
  type AgentTestCase,
  type AgentTestResult,
} from "./harness/agent-test-harness.js";
export {
  runWorkflowTest,
  type WorkflowTestCase,
  type WorkflowTestResult,
  type WorkflowTestStep,
} from "./harness/workflow-test-harness.js";

// Mocks
export {
  MockModelProvider,
  type MockModelProviderConfig,
  type RecordedCall,
} from "./mocks/mock-model-provider.js";
export {
  createMockYardiService,
  createMockCoStarService,
  createMockArgusService,
} from "./mocks/mock-cre-services.js";
export {
  createExtendedMockContext,
  type ExtendedMockContext,
  type ExtendedMockContextOptions,
} from "./mocks/mock-context-extended.js";

// Evaluation
export {
  EvaluationRunner,
  type EvaluationCase,
  type EvaluationScore,
  type EvaluationSummary,
} from "./evaluation/evaluator.js";
export {
  createGoldenDataset,
  filterByTags,
  sampleCases,
  type GoldenDataset,
} from "./evaluation/golden-dataset.js";
export { computeMetrics, type AgentMetrics } from "./evaluation/metrics.js";

// Assertions
export {
  toHaveToolCall,
  toHaveCompleted,
  toHaveOutput,
  toHaveMinTokenUsage,
  toHaveMaxSteps,
} from "./assertions/agent-assertions.js";
export {
  toHavePiiRedacted,
  toPassFairHousing,
  toHaveAuditLog,
  toHaveDisclaimer,
} from "./assertions/compliance-assertions.js";

// Fixtures
export {
  SAMPLE_OFFICE_LEASE,
  SAMPLE_RETAIL_LEASE,
  SAMPLE_INDUSTRIAL_LEASE,
} from "./fixtures/sample-leases.js";
export { SAMPLE_T12, SAMPLE_RENT_ROLL } from "./fixtures/sample-financials.js";
