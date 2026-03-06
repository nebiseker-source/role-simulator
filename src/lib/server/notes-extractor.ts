import { MAX_FILE_BYTES, MAX_PDF_PAGES } from "@/lib/server/notes-config";

export type ExtractedNotes = {
  text: string;
  pageCount?: number;
};

async function extractPdfText(buffer: Buffer): Promise<ExtractedNotes> {
  // Lazy import: modül yükleme sorunu olursa route import aşamasında 500'e düşmez.
  const pdfModule = await import("pdf-parse");

  // pdf-parse v2 style
  const PDFParseCtor = (pdfModule as unknown as {
    PDFParse?: new (args: { data: Buffer }) => {
      getInfo: () => Promise<{ total: number }>;
      getText: () => Promise<{ text: string }>;
      destroy: () => Promise<void>;
    };
  }).PDFParse;

  if (PDFParseCtor) {
    const parser = new PDFParseCtor({ data: buffer });
    const info = await parser.getInfo();
    const pageCount = info.total;
    if (pageCount > MAX_PDF_PAGES) {
      await parser.destroy();
      throw new Error(`PDF sayfa limiti aşıldı. En fazla ${MAX_PDF_PAGES} sayfa yüklenebilir.`);
    }
    const result = await parser.getText();
    await parser.destroy();
    return { text: result.text.trim(), pageCount };
  }

  // pdf-parse v1 style
  const parseLegacy = (pdfModule as unknown as {
    default?: (data: Buffer) => Promise<{ text?: string; numpages?: number }>;
  }).default;
  if (parseLegacy) {
    const result = await parseLegacy(buffer);
    const pageCount = Number(result.numpages ?? 0);
    if (pageCount > MAX_PDF_PAGES) {
      throw new Error(`PDF sayfa limiti aşıldı. En fazla ${MAX_PDF_PAGES} sayfa yüklenebilir.`);
    }
    return { text: String(result.text ?? "").trim(), pageCount };
  }

  throw new Error("PDF parser başlatılamadı.");
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammothModule = await import("mammoth");
  const mammoth = (mammothModule as unknown as {
    default?: { extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }> };
  }).default;

  if (!mammoth?.extractRawText) {
    throw new Error("DOCX parser başlatılamadı.");
  }
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

export async function extractTextFromNotesFile(file: File): Promise<ExtractedNotes> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Dosya boyutu 8 MB sınırını aşıyor.");
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

  throw new Error("Desteklenmeyen dosya türü. PDF, DOCX, TXT veya MD yükleyin.");
}
