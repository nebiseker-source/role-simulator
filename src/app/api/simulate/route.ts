import { NextResponse } from "next/server";

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

function buildDemoOutput(role: RoleKey, task: string, notes: string): string {
  const notesBlock = notes
    ? `## Referans Not Özeti\n${notes.slice(0, 1200)}\n`
    : "## Referans Not Özeti\n- Not eklenmedi.\n";

  return [
    `# ${roleTitle(role)} Çıktısı (Stabil Demo Modu)`,
    "",
    "## Problem Tanımı",
    task,
    "",
    notesBlock,
    "## Görev Kırılımı",
    "- Analiz ve kapsam netleştirme",
    "- Gereksinim/tasarım üretimi",
    "- Test senaryosu hazırlığı",
    "- Çıktı onayı",
    "",
    "## Test Senaryoları",
    "- Pozitif: Geçerli görev ile rapor oluşur.",
    "- Negatif: Boş görevde validasyon hatası döner.",
    "- Pozitif: Diyagram sekmesinde Mermaid görünür.",
    "",
    "## Kullanılan Kaynaklar",
    "- Local demo şablonu",
    "",
    "```mermaid",
    "flowchart TD",
    "A[Görev Girişi] --> B[Rol Seçimi]",
    "B --> C[Şablon Uygulama]",
    "C --> D[Rapor + Diyagram + Test]",
    "```",
  ].join("\n");
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. /api/simulate için POST kullan." },
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

    return NextResponse.json({
      output: buildDemoOutput(role, task, mergedNotes),
      fallback: true,
      provider: "demo",
      sources: ["Demo stabil route"],
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: message, provider: "demo" }, { status: 500 });
  }
}
