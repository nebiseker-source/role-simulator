import { MAX_FILE_BYTES, MAX_PDF_PAGES } from "@/lib/server/notes-config";

export type ExtractedNotes = {
  text: string;
  pageCount?: number;
};

type PdfParseResult = {
  text?: string;
  numpages?: number;
};

function ensurePageLimit(pageCount: number) {
  if (pageCount > MAX_PDF_PAGES) {
    throw new Error(`PDF sayfa limiti asildi. En fazla ${MAX_PDF_PAGES} sayfa yuklenebilir.`);
  }
}

function normalizePdfResult(result: PdfParseResult): ExtractedNotes {
  const pageCount = Number(result.numpages ?? 0);
  ensurePageLimit(pageCount);
  return {
    text: String(result.text ?? "").trim(),
    pageCount,
  };
}

async function extractPdfText(buffer: Buffer): Promise<ExtractedNotes> {
  // "pdf-parse" ana girisi bazi ortamlarda debug test dosyasini acmaya calisabiliyor.
  // Bu nedenle dogrudan parser dosyasini yukluyoruz.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const parsePdf = require("pdf-parse/lib/pdf-parse.js") as
    | ((dataBuffer: Buffer) => Promise<PdfParseResult>)
    | undefined;

  if (typeof parsePdf !== "function") {
    throw new Error("PDF parser baslatilamadi.");
  }

  try {
    const result = await parsePdf(buffer);
    return normalizePdfResult(result);
  } catch (firstError) {
    // Bazı PDF'lerde ilk parser "fetch failed" dönebiliyor.
    // Bu durumda paketin ana export'unu ikinci yöntem olarak deneriz.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const parsePdfMain = require("pdf-parse") as ((dataBuffer: Buffer) => Promise<PdfParseResult>) | undefined;
    if (typeof parsePdfMain === "function") {
      try {
        const result = await parsePdfMain(buffer);
        return normalizePdfResult(result);
      } catch {
        // ilk hatayı koru
      }
    }

    const message = firstError instanceof Error ? firstError.message : String(firstError);
    if (message.toLowerCase().includes("fetch failed")) {
      throw new Error(
        "PDF ayrıştırılamadı (fetch failed). PDF'i Word/TXT olarak veya daha sade bir PDF olarak tekrar yükleyin."
      );
    }
    throw firstError;
  }
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
