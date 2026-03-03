import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildSystemPrompt, RoleKey } from "@/lib/roles";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const role = body.role as RoleKey;
    const task = String(body.task ?? "").trim();
    const notes = String(body.notes ?? "").trim();

    if (!role || !task) {
      return NextResponse.json(
        { error: "role ve task zorunlu" },
        { status: 400 }
      );
    }

    const system = buildSystemPrompt(role);

    const resp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: notes
            ? `IS: ${task}\n\nREFERANS DERS NOTLARI:\n${notes}\n\nKurallar:\n- Referans notlariyla tutarli ol.\n- Bilgi eksikse varsayimini acikca belirt.`
            : `IS: ${task}`
        }
      ]
    });

    const content = resp.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ output: content });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
