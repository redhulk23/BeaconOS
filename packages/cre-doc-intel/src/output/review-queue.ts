import { createLogger, generateId } from "@beacon-os/common";
import type { ConfidenceReport } from "../nlp/confidence-scorer.js";

const log = createLogger("cre-doc-intel:review-queue");

export interface ReviewItem {
  id: string;
  documentId: string;
  tenantId: string;
  documentType: string;
  fieldsForReview: string[];
  confidenceReport: ConfidenceReport;
  extractedData: Record<string, unknown>;
  status: "pending" | "in_review" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: Date;
  corrections?: Record<string, unknown>;
  createdAt: Date;
}

export class ReviewQueue {
  private items: Map<string, ReviewItem> = new Map();

  enqueue(
    documentId: string,
    tenantId: string,
    documentType: string,
    extractedData: Record<string, unknown>,
    confidenceReport: ConfidenceReport,
  ): string {
    const id = generateId();
    const fieldsForReview = confidenceReport.fieldScores
      .filter((f) => f.confidence < 0.7)
      .map((f) => f.field);

    const item: ReviewItem = {
      id,
      documentId,
      tenantId,
      documentType,
      fieldsForReview,
      confidenceReport,
      extractedData,
      status: "pending",
      createdAt: new Date(),
    };

    this.items.set(id, item);
    log.info(
      { id, documentId, fieldsCount: fieldsForReview.length },
      "Document queued for review",
    );

    return id;
  }

  getPending(tenantId: string): ReviewItem[] {
    return Array.from(this.items.values()).filter(
      (item) => item.tenantId === tenantId && item.status === "pending",
    );
  }

  getItem(id: string): ReviewItem | undefined {
    return this.items.get(id);
  }

  approve(
    id: string,
    reviewedBy: string,
    corrections?: Record<string, unknown>,
  ): boolean {
    const item = this.items.get(id);
    if (!item || item.status !== "pending") return false;

    item.status = "approved";
    item.reviewedBy = reviewedBy;
    item.reviewedAt = new Date();
    item.corrections = corrections;

    log.info({ id, reviewedBy }, "Review item approved");
    return true;
  }

  reject(id: string, reviewedBy: string, reason?: string): boolean {
    const item = this.items.get(id);
    if (!item || item.status !== "pending") return false;

    item.status = "rejected";
    item.reviewedBy = reviewedBy;
    item.reviewedAt = new Date();

    log.info({ id, reviewedBy, reason }, "Review item rejected");
    return true;
  }
}

let _queue: ReviewQueue | null = null;

export function getReviewQueue(): ReviewQueue {
  if (!_queue) {
    _queue = new ReviewQueue();
  }
  return _queue;
}
