import { NextResponse } from "next/server";
import { getRagStats } from "@/lib/server/rag";

export const runtime = "nodejs";

export async function GET() {
  try {
    const stats = await getRagStats();
    return NextResponse.json(stats);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "İstatistik hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
