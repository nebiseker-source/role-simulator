import { NextResponse } from "next/server";
import { extractTextFromNotesFile } from "@/lib/server/notes-extractor";
import { MAX_NOTES_CHARS } from "@/lib/server/notes-config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const uploaded = form.get("notesFile");

    if (!(uploaded instanceof File) || uploaded.size === 0) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
    }

    const extracted = await extractTextFromNotesFile(uploaded);
    const clippedText = extracted.text.slice(0, MAX_NOTES_CHARS);

    return NextResponse.json({
      fileName: uploaded.name,
      fileSize: uploaded.size,
      pageCount: extracted.pageCount ?? null,
      extractedText: clippedText,
      clipped: extracted.text.length > MAX_NOTES_CHARS,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Dosya işlenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
