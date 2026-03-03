import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_PDF_PAGES = 40;
export const MAX_NOTES_CHARS = 18000;

export type ExtractedNotes = {
  text: string;
  pageCount?: number;
};

export async function extractTextFromNotesFile(file: File): Promise<ExtractedNotes> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Dosya boyutu 8 MB sınırını aşıyor.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const extension = file.name.toLowerCase();

  if (file.type === "application/pdf" || extension.endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });
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

  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value.trim() };
  }

  if (file.type.startsWith("text/") || extension.endsWith(".md")) {
    return { text: buffer.toString("utf-8").trim() };
  }

  throw new Error("Desteklenmeyen dosya türü. PDF, DOCX, TXT veya MD yükleyin.");
}
