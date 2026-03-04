import { NextResponse } from "next/server";
import { formatPlaybookSources, searchRolePlaybook } from "@/lib/server/playbook-lite";

export const runtime = "nodejs";

type RoleKey =
  | "business_analyst"
  | "product_manager"
  | "product_owner"
  | "solution_architect"
  | "data_scientist";

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

function roleTitle(role: RoleKey): string {
  switch (role) {
    case "business_analyst":
      return "İş Analisti";
    case "product_manager":
      return "Product Manager";
    case "product_owner":
      return "Product Owner";
    case "solution_architect":
      return "İş Mimarı";
    case "data_scientist":
      return "Data Bilimci";
  }
}

function roleSections(role: RoleKey): string[] {
  switch (role) {
    case "business_analyst":
      return [
        "## Stakeholder Listesi",
        "- İş birimi",
        "- Operasyon",
        "- Ürün ekibi",
        "- Teknik ekip",
        "",
        "## Functional Requirements",
        "- FR1: Görev için rol bazlı analiz çıktısı üretilmeli",
        "- FR2: Gereksinimler önceliklendirilmeli",
        "- FR3: Süreç diyagramı üretilmeli",
      ];
    case "product_manager":
      return [
        "## Ürün Hedefi ve KPI",
        "- North Star: görev çıktılarının karar destekte kullanım oranı",
        "- KPI: simülasyon tamamlama oranı, export oranı",
        "",
        "## Yol Haritası",
        "- Faz 1: Çekirdek rol çıktıları",
        "- Faz 2: Playbook + RAG kalite artırımı",
        "- Faz 3: Takım işbirliği ve versiyonlama",
      ];
    case "product_owner":
      return [
        "## Backlog (Epic > Feature > Story)",
        "- Epic: Role-Based Simulation",
        "- Feature: Rol seçimi ve görev işleme",
        "- Story: Kullanıcı rol seçip görev girer, çıktı alır",
        "",
        "## Sprint Planı",
        "- Sprint 1: Form + çıktı",
        "- Sprint 2: Diyagram + RAG",
      ];
    case "solution_architect":
      return [
        "## Mimari Öneri",
        "- UI: Next.js App Router",
        "- API: Next.js route handlers",
        "- Bilgi katmanı: Playbook + RAG",
        "",
        "## Non-Functional Kararlar",
        "- Gözlemlenebilirlik: istek/hata logları",
        "- Güvenlik: input doğrulama ve dosya limiti",
      ];
    case "data_scientist":
      return [
        "## Problem Framing",
        "- Görev metni sınıflandırma + şablon eşleme",
        "",
        "## Modelleme Planı",
        "- Baseline: kural tabanlı + retrieval",
        "- Gelişmiş: embedding + semantic ranking",
        "- İzleme: kalite skoru ve geri bildirim",
      ];
  }
}

function buildOutput(role: RoleKey, task: string, notes: string, sources: string[], excerpts: string[]): string {
  const notesBlock = notes
    ? `## Referans Not Özeti\n${notes.slice(0, 1200)}\n`
    : "## Referans Not Özeti\n- Not eklenmedi.\n";

  return [
    `# ${roleTitle(role)} Çıktısı`,
    "",
    "## Problem Tanımı",
    task,
    "",
    notesBlock,
    ...roleSections(role),
    "",
    "## Görev Kırılımı",
    "- Analiz ve kapsam netleştirme",
    "- Rol kurallarına göre plan üretimi",
    "- Test senaryosu çıkarımı",
    "- Çıktı gözden geçirme",
    "",
    "## Test Senaryoları",
    "- Pozitif: Geçerli görev ile rol çıktısı üretilir",
    "- Negatif: Boş görevde validasyon hatası döner",
    "- Pozitif: Kaynak referansları rapor sonunda görünür",
    "",
    "## Playbooktan Çekilen Bölümler",
    ...(excerpts.length ? excerpts.map((x) => `- ${x}`) : ["- Eşleşen bölüm bulunamadı"]),
    "",
    "## Kullanılan Kaynaklar",
    ...(sources.length ? sources.map((s) => `- ${s}`) : ["- Kaynak bulunamadı"]),
    "",
    "```mermaid",
    "flowchart TD",
    "A[Görev Girişi] --> B[Rol Seçimi]",
    "B --> C[Playbook Arama]",
    "C --> D[Rapor + Diyagram + Test]",
    "```",
  ].join("\n");
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. /api/simulate-role için POST kullan." },
    { status: 405 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const role = asRoleKey(String(body.role ?? ""));
    const task = String(body.task ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const fileNotes = String(body.fileNotes ?? "").trim();
    const mergedNotes = [notes, fileNotes].filter(Boolean).join("\n\n");

    if (!role || !task) {
      return NextResponse.json({ error: "role ve task zorunlu" }, { status: 400 });
    }

    const hits = await searchRolePlaybook(role, [task, mergedNotes].filter(Boolean).join("\n\n"), 3);
    const sources = formatPlaybookSources(hits);
    const excerpts = hits.map((h) => `${h.title}: ${h.excerpt.slice(0, 160).replace(/\n/g, " ")}...`);

    return NextResponse.json({
      output: buildOutput(role, task, mergedNotes, sources, excerpts),
      fallback: false,
      provider: "playbook-lite",
      sources,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: message, provider: "playbook-lite" }, { status: 500 });
  }
}
