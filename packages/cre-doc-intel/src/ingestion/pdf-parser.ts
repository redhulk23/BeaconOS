import pdfParse from "pdf-parse";
import { createLogger } from "@beacon-os/common";

const log = createLogger("cre-doc-intel:pdf-parser");

export interface ParsedPdf {
  text: string;
  pageCount: number;
  metadata: Record<string, unknown>;
}

export async function parsePdf(buffer: Buffer): Promise<ParsedPdf> {
  const data = await pdfParse(buffer);

  log.debug(
    { pages: data.numpages, textLength: data.text.length },
    "PDF parsed",
  );

  return {
    text: data.text,
    pageCount: data.numpages,
    metadata: {
      title: data.info?.Title,
      author: data.info?.Author,
      creator: data.info?.Creator,
      producer: data.info?.Producer,
    },
  };
}

export function isPdfScanned(parsedPdf: ParsedPdf): boolean {
  // If very little text relative to pages, likely scanned
  const avgCharsPerPage = parsedPdf.text.length / Math.max(1, parsedPdf.pageCount);
  return avgCharsPerPage < 100;
}
