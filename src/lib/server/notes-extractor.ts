import { MAX_FILE_BYTES, MAX_PDF_PAGES } from "@/lib/server/notes-config";

export type ExtractedNotes = {
  text: string;
  pageCount?: number;
};

type PdfParseResult = {
  text?: string;
  numpages?: number;
};

async function extractPdfText(buffer: Buffer): Promise<ExtractedNotes> {
  // pdf-parse@1.x API: default export bir parse fonksiyonu dondurur.
  const pdfModule = await import("pdf-parse");
  const parsePdf = (pdfModule as unknown as {
    default?: (dataBuffer: Buffer) => Promise<PdfParseResult>;
  }).default;

  if (!parsePdf) {
    throw new Error("PDF parser baslatilamadi.");
  }

  const result = await parsePdf(buffer);
  const pageCount = Number(result.numpages ?? 0);
  if (pageCount > MAX_PDF_PAGES) {
    throw new Error(`PDF sayfa limiti asildi. En fazla ${MAX_PDF_PAGES} sayfa yuklenebilir.`);
  }

  return {
    text: String(result.text ?? "").trim(),
    pageCount,
  };
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammothModule = await import("mammoth");
  const mammoth = (mammothModule as unknown as {
    default?: { extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }> };
  }).default;

  if (!mammoth?.extractRawText) {
    throw new Error("DOCX parser baslatilamadi.");
  }

  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

export async function extractTextFromNotesFile(file: File): Promise<ExtractedNotes> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Dosya boyutu 8 MB sinirini asiyor.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const extension = file.name.toLowerCase();

  if (file.type === "application/pdf" || extension.endsWith(".pdf")) {
    return extractPdfText(buffer);
  }

  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension.endsWith(".docx")
  ) {
    return { text: await extractDocxText(buffer) };
  }

  if (file.type.startsWith("text/") || extension.endsWith(".md")) {
    return { text: buffer.toString("utf-8").trim() };
  }

  throw new Error("Desteklenmeyen dosya turu. PDF, DOCX, TXT veya MD yukleyin.");
}
