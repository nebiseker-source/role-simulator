import { NextResponse } from "next/server";
import { indexKnowledgeDocument } from "@/lib/server/rag";
import { extractTextFromNotesFile } from "@/lib/server/notes-extractor";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let title = "Untitled";
    let text = "";
    let role = "shared";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      title = String(form.get("title") ?? "Uploaded Notes").trim() || "Uploaded Notes";
      const rawText = String(form.get("text") ?? "").trim();
      role = String(form.get("role") ?? "shared").trim() || "shared";
      text = rawText;
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        const extracted = await extractTextFromNotesFile(file);
        text = [rawText, extracted.text].filter(Boolean).join("\n\n");
        if (title === "Uploaded Notes") {
          title = file.name;
        }
      }
    } else {
      const body = await req.json();
      title = String(body.title ?? "Manual Notes").trim() || "Manual Notes";
      text = String(body.text ?? "").trim();
      role = String(body.role ?? "shared").trim() || "shared";
    }

    if (!text) {
      return NextResponse.json({ error: "Indexlenecek metin bulunamadı." }, { status: 400 });
    }

    const result = await indexKnowledgeDocument({ title, text, role });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Indexleme hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
