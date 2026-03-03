import { NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/server/rag";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = String(body.query ?? "").trim();
    const topK = Number(body.topK ?? 5);
    if (!query) {
      return NextResponse.json({ error: "query zorunlu" }, { status: 400 });
    }
    const hits = await searchKnowledge(query, topK);
    return NextResponse.json({
      hits: hits.map((h) => ({
        title: h.title,
        chunkIndex: h.chunkIndex,
        text: h.text
      }))
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Arama hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
