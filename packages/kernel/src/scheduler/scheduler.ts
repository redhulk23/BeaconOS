import { createLogger, type RunId } from "@beacon-os/common";

const log = createLogger("kernel:scheduler");

export interface ScheduledRun {
  runId: RunId;
  agentId: string;
  tenantId: string;
  priority: number;
  enqueuedAt: number;
}

export class AgentScheduler {
  private queue: ScheduledRun[] = [];
  private activeRuns: Map<string, ScheduledRun> = new Map();
  private maxConcurrent: number;

  constructor(maxConcurrent = 10) {
    this.maxConcurrent = maxConcurrent;
  }

  enqueue(run: ScheduledRun): void {
    this.queue.push(run);
    // Sort by priority (higher first), then by enqueue time (FIFO)
    this.queue.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.enqueuedAt - b.enqueuedAt;
    });
    log.debug(
      { runId: run.runId, queueLength: this.queue.length },
      "Run enqueued",
    );
  }

  dequeue(): ScheduledRun | null {
    if (this.activeRuns.size >= this.maxConcurrent) {
      log.debug(
        { active: this.activeRuns.size, max: this.maxConcurrent },
        "At capacity, cannot dequeue",
      );
      return null;
    }

    const run = this.queue.shift() ?? null;
    if (run) {
      this.activeRuns.set(run.runId, run);
      log.debug(
        { runId: run.runId, active: this.activeRuns.size },
        "Run dequeued",
      );
    }
    return run;
  }

  complete(runId: string): void {
    this.activeRuns.delete(runId);
    log.debug(
      { runId, active: this.activeRuns.size },
      "Run completed, slot freed",
    );
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getActiveCount(): number {
    return this.activeRuns.size;
  }

  isActive(runId: string): boolean {
    return this.activeRuns.has(runId);
  }
}
