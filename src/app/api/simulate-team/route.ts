import { NextResponse } from "next/server";
import { runTeamSimulation } from "@/lib/agents/orchestrator";

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. /api/simulate-team için POST kullan." },
    { status: 405 }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const task = String(body.task ?? "").trim();
    const notes = String(body.notes ?? "").trim();

    if (!task) {
      return NextResponse.json({ error: "task zorunlu" }, { status: 400 });
    }

    const result = await runTeamSimulation({ task, notes });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
