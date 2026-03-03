import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildSystemPrompt, RoleKey } from "@/lib/roles";
import { MAX_NOTES_CHARS } from "@/lib/server/notes-extractor";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function asRoleKey(value: string): RoleKey | null {
  const roles: RoleKey[] = [
    "business_analyst",
    "product_owner",
    "solution_architect",
    "data_scientist"
  ];
  return roles.includes(value as RoleKey) ? (value as RoleKey) : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const role = asRoleKey(String(body.role ?? ""));
    const task = String(body.task ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const fileNotes = String(body.fileNotes ?? "").trim();

    if (!role || !task) {
      return NextResponse.json(
        { error: "role ve task zorunlu" },
        { status: 400 }
      );
    }

    const mergedNotes = [notes, fileNotes]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, MAX_NOTES_CHARS);

    const system = buildSystemPrompt(role);

    const resp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: mergedNotes
            ? `İŞ: ${task}\n\nREFERANS DERS NOTLARI:\n${mergedNotes}\n\nKurallar:\n- Referans notlarıyla tutarlı ol.\n- Bilgi eksikse varsayımını açıkça belirt.`
            : `İŞ: ${task}`
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
