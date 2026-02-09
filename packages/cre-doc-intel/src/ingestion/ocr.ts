import { createWorker, type Worker } from "tesseract.js";
import { createLogger } from "@beacon-os/common";

const log = createLogger("cre-doc-intel:ocr");

let _worker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (!_worker) {
    _worker = await createWorker("eng");
  }
  return _worker;
}

export interface OcrResult {
  text: string;
  confidence: number;
}

export async function performOcr(imageBuffer: Buffer): Promise<OcrResult> {
  const worker = await getWorker();
  const result = await worker.recognize(imageBuffer);

  log.debug(
    { confidence: result.data.confidence, textLength: result.data.text.length },
    "OCR completed",
  );

  return {
    text: result.data.text,
    confidence: result.data.confidence / 100,
  };
}

export async function terminateOcr(): Promise<void> {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
  }
}
