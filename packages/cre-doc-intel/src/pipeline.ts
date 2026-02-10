import { createLogger } from "@beacon-os/common";
import type { ModelRouter } from "@beacon-os/model-router";
import { parsePdf, isPdfScanned } from "./ingestion/pdf-parser.js";
import { performOcr } from "./ingestion/ocr.js";
import {
  extractLease,
  type LeaseExtractionResult,
} from "./extraction/lease-extractor.js";
import {
  extractRentRoll,
  type RentRollExtractionResult,
} from "./extraction/rent-roll-extractor.js";
import {
  extractT12,
  type T12ExtractionResult,
} from "./extraction/t12-extractor.js";
import { getReviewQueue } from "./output/review-queue.js";

const log = createLogger("cre-doc-intel:pipeline");

export type DocumentType = "lease" | "amendment" | "rent_roll" | "t12";

export interface PipelineInput {
  buffer: Buffer;
  fileName: string;
  documentType: DocumentType;
  documentId: string;
  tenantId: string;
  agentId: string;
}

export interface PipelineResult {
  documentId: string;
  documentType: DocumentType;
  text: string;
  pageCount: number;
  ocrRequired: boolean;
  extractionResult:
    | LeaseExtractionResult
    | RentRollExtractionResult
    | T12ExtractionResult;
  reviewItemId?: string;
}

export class DocumentIntelligencePipeline {
  private modelRouter: ModelRouter;

  constructor(modelRouter: ModelRouter) {
    this.modelRouter = modelRouter;
  }

  async process(input: PipelineInput): Promise<PipelineResult> {
    log.info(
      { fileName: input.fileName, type: input.documentType },
      "Starting document intelligence pipeline",
    );

    // Step 1: Parse PDF
    const parsed = await parsePdf(input.buffer);
    let text = parsed.text;
    let ocrRequired = false;

    // Step 2: OCR if needed
    if (isPdfScanned(parsed)) {
      log.info("Document appears scanned, performing OCR");
      ocrRequired = true;
      const ocrResult = await performOcr(input.buffer);
      text = ocrResult.text;
    }

    // Step 3: Extract based on document type
    let extractionResult:
      | LeaseExtractionResult
      | RentRollExtractionResult
      | T12ExtractionResult;

    switch (input.documentType) {
      case "lease":
      case "amendment":
        extractionResult = await extractLease(
          text,
          this.modelRouter,
          input.tenantId,
          input.agentId,
        );
        break;
      case "rent_roll":
        extractionResult = await extractRentRoll(
          text,
          this.modelRouter,
          input.tenantId,
          input.agentId,
        );
        break;
      case "t12":
        extractionResult = await extractT12(
          text,
          this.modelRouter,
          input.tenantId,
          input.agentId,
        );
        break;
    }

    // Step 4: Queue for review if needed
    let reviewItemId: string | undefined;
    if (
      "confidenceReport" in extractionResult &&
      extractionResult.confidenceReport.reviewRequired
    ) {
      const queue = getReviewQueue();
      reviewItemId = queue.enqueue(
        input.documentId,
        input.tenantId,
        input.documentType,
        extractionResult.fields as Record<string, unknown>,
        extractionResult.confidenceReport,
      );
      log.info(
        { reviewItemId },
        "Low-confidence extraction queued for HITL review",
      );
    }

    log.info(
      {
        documentId: input.documentId,
        type: input.documentType,
        ocrRequired,
        reviewItemId,
      },
      "Pipeline completed",
    );

    return {
      documentId: input.documentId,
      documentType: input.documentType,
      text,
      pageCount: parsed.pageCount,
      ocrRequired,
      extractionResult,
      reviewItemId,
    };
  }
}
