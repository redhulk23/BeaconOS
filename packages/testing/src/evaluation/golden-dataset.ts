import type { EvaluationCase } from "./evaluator.js";

export interface GoldenDataset {
  name: string;
  version: string;
  description: string;
  cases: EvaluationCase[];
}

export function createGoldenDataset(data: GoldenDataset): GoldenDataset {
  return data;
}

export function filterByTags(dataset: GoldenDataset, tags: string[]): EvaluationCase[] {
  return dataset.cases.filter((c) => c.tags?.some((t) => tags.includes(t)));
}

export function sampleCases(dataset: GoldenDataset, count: number): EvaluationCase[] {
  const shuffled = [...dataset.cases].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
