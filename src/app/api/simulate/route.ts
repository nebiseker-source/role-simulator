import { NextResponse } from "next/server";
import { buildSystemPrompt, RoleKey } from "@/lib/roles";
import { MAX_NOTES_CHARS } from "@/lib/server/notes-extractor";
import {
  callLlm,
  getLlmProvider,
  isLocalConnectionError,
  isQuotaLikeError,
} from "@/lib/server/llm";
import { formatRagContext } from "@/lib/server/rag";
import {
  formatPlaybookContext,
  formatPlaybookSources,
  searchRolePlaybook,
} from "@/lib/server/playbook-lite";

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. /api/simulate için POST kullan." },
    { status: 405 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

function asRoleKey(value: string): RoleKey | null {
  const roles: RoleKey[] = [
    "business_analyst",
    "product_manager",
    "product_owner",
    "solution_architect",
    "data_scientist",
  ];
  return roles.includes(value as RoleKey) ? (value as RoleKey) : null;
}

function buildFallbackOutput(role: RoleKey, task: string, notes: string, sources: string[]): string {
  const notesLine = notes
    ? `- Referans notlardan yararlanıldı (özet): ${notes.slice(0, 320)}...`
    : "- Referans not girilmedi, varsayım bazlı çıkarım yapıldı.";
  const sourceLines = sources.length
    ? sources.map((s) => `- ${s}`).join("\n")
    : "- Kaynak bulunamadı";

  return [
    "> Uyarı: Model çağrısı başarısız oldu, fallback çıktısı üretildi.",
    `> Rol: ${role}`,
    "",
    "## Problem Tanımı",
    task,
    "",
    "## Playbook Kaynakları",
    sourceLines,
    "",
    "## Varsayımlar",
    notesLine,
    "",
    "## Görev Kırılımı",
    "- Analiz (1-2 gün)",
    "- Tasarım ve diyagram (1 gün)",
    "- Uygulama (2-3 gün)",
    "- Doğrulama (1 gün)",
    "",
    "## Test Senaryoları",
    "- Pozitif: Geçerli görevde rol çıktısı üretilir.",
    "- Negatif: Boş görevde validasyon hatası döner.",
    "- Pozitif: Kaynak referansları raporda görünür.",
    "",
    "```mermaid",
    "flowchart TD",
    "A[Görev] --> B[Rol + Playbook]",
    "B --> C[Analiz]",
    "C --> D[Çıktı + Diyagram + Test]",
    "```",
  ].join("\n");
}

export async function POST(req: Request) {
  let fallbackRole: RoleKey = "business_analyst";
  let fallbackTask = "Model çağrısı sırasında hata oluştu.";
  let fallbackNotes = "";
  let fallbackSources: string[] = [];

  try {
    const body = await req.json();
    const role = asRoleKey(String(body.role ?? ""));
    const task = String(body.task ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const fileNotes = String(body.fileNotes ?? "").trim();

    if (!role || !task) {
      return NextResponse.json({ error: "role ve task zorunlu" }, { status: 400 });
    }

    fallbackRole = role;
    fallbackTask = task;

    const mergedNotes = [notes, fileNotes].filter(Boolean).join("\n\n").slice(0, MAX_NOTES_CHARS);
    const query = [task, mergedNotes].filter(Boolean).join("\n\n");
    const ragContext = await formatRagContext(query);

    const playbookHits = await searchRolePlaybook(role, query, 3);
    const playbookContext = formatPlaybookContext(playbookHits);
    const playbookSources = formatPlaybookSources(playbookHits);
    fallbackSources = playbookSources;

    const mergedWithRag = [mergedNotes, ragContext, playbookContext].filter(Boolean).join("\n\n");
    fallbackNotes = mergedWithRag;

    const system = buildSystemPrompt(role);
    const userContent = [
      `İŞ: ${task}`,
      mergedWithRag ? `REFERANS KAYNAKLAR:\n${mergedWithRag}` : "",
      "Kurallar:",
      "- Önce rol playbook kaynaklarına uy.",
      "- Kaynaklarla çelişen varsayımlar üretme.",
      "- Çıktının sonunda 'Kullanılan Kaynaklar' başlığı aç ve kaynakları madde madde yaz.",
      playbookSources.length
        ? `Kullanılacak Playbook Kaynak Etiketleri:\n${playbookSources.join("\n")}`
        : "Playbook kaynak etiketi bulunamadı.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await callLlm({
      system,
      user: userContent,
      temperature: 0.4,
    });

    return NextResponse.json({
      output: result.text,
      fallback: false,
      provider: result.provider,
      sources: playbookSources,
    });
  } catch (e: unknown) {
    const provider = getLlmProvider();
    const shouldFallback = isQuotaLikeError(e) || isLocalConnectionError(e);
    if (shouldFallback) {
      return NextResponse.json({
        output: buildFallbackOutput(fallbackRole, fallbackTask, fallbackNotes, fallbackSources),
        fallback: true,
        provider,
        sources: fallbackSources,
      });
    }
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: message, provider }, { status: 500 });
  }
}
