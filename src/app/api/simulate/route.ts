import { NextResponse } from "next/server";
import { buildSystemPrompt, RoleKey } from "@/lib/roles";
import { MAX_NOTES_CHARS } from "@/lib/server/notes-extractor";
import {
  callLlm,
  getLlmProvider,
  isLocalConnectionError,
  isQuotaLikeError
} from "@/lib/server/llm";
import { formatRagContext } from "@/lib/server/rag";

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. /api/simulate için POST kullan." },
    { status: 405 }
  );
}

function asRoleKey(value: string): RoleKey | null {
  const roles: RoleKey[] = [
    "business_analyst",
    "product_manager",
    "product_owner",
    "solution_architect",
    "data_scientist"
  ];
  return roles.includes(value as RoleKey) ? (value as RoleKey) : null;
}

function buildFallbackOutput(role: RoleKey, task: string, notes: string): string {
  const notesLine = notes
    ? `- Referans notlardan yararlanıldı (özet): ${notes.slice(0, 320)}...`
    : "- Referans not girilmedi, varsayım bazlı çıkarım yapıldı.";

  const commonStart = [
    "> Uyarı: Model çağrısı başarısız oldu, fallback çıktı üretildi.",
    `> Rol: ${role}`,
    "",
    "## Problem Tanımı",
    task,
    "",
    "## Varsayımlar",
    "- Ekip çapraz fonksiyonel ve haftalık sprintlerle çalışıyor.",
    "- İş hedefi ölçülebilir KPI'larla takip edilecek.",
    notesLine,
    ""
  ].join("\n");

  switch (role) {
    case "business_analyst":
      return [
        commonStart,
        "## Stakeholder Listesi",
        "- İş birimi yöneticisi",
        "- Operasyon ekibi",
        "- Müşteri deneyimi ekibi",
        "- Yazılım geliştirme ekibi",
        "",
        "## Functional Requirements",
        "- Talep girişi, durum takibi ve bildirim mekanizması",
        "- Rol bazlı ekran ve yetki kontrolü",
        "- Raporlama ve denetim kaydı",
        "",
        "## Test Senaryoları",
        "- Pozitif: geçerli talep ile kayıt oluşur",
        "- Negatif: zorunlu alanlar boşken kayıt engellenir",
        "",
        "```mermaid",
        "flowchart TD",
        "A[Talep Girişi] --> B[Ön Değerlendirme]",
        "B --> C{Uygun mu?}",
        "C -- Evet --> D[İşleme Al]",
        "C -- Hayır --> E[Revizyon İsteği]",
        "D --> F[Sonuç Bildirimi]",
        "```"
      ].join("\n");

    case "product_manager":
      return [
        commonStart,
        "## Hedef ve KPI",
        "- North Star: rapor çıktısının iş kararına dönüşme oranı",
        "- KPI: aktif kullanıcı ve export oranı",
        "",
        "## Ürün Stratejisi",
        "- Faz 1: demo mode ve çekirdek rol çıktıları",
        "- Faz 2: RAG kalitesi ve iş akışı",
        "- Faz 3: ekip planı ve işbirliği",
        "",
        "## Görev Kırılımı",
        "- PM: roadmap ve önceliklendirme",
        "- UX: çıktı paneli ve kullanılabilirlik",
        "- Eng: API stabilitesi ve gözlemlenebilirlik",
        "",
        "```mermaid",
        "flowchart LR",
        "F[Fikir] --> M[MVP]",
        "M --> V[Doğrulama]",
        "V --> S[Ölçekleme]",
        "```"
      ].join("\n");

    case "product_owner":
      return [
        commonStart,
        "## Hedef ve Başarı Metrikleri",
        "- KPI-1: süreç tamamlama süresinde %20 azalma",
        "- KPI-2: self-service kullanımında %30 artış",
        "",
        "## Backlog (Epic > Feature > Story)",
        "- Epic: Talep Yönetimi",
        "- Feature: Talep Oluşturma",
        "- Story: Kullanıcı talep formunu doldurur ve kaydeder",
        "",
        "## Test Senaryoları",
        "- Pozitif: durum takibi ekranında doğru lifecycle görünür",
        "- Negatif: geçersiz rol ile erişim engellenir",
        "",
        "```mermaid",
        "flowchart LR",
        "U[Kullanıcı] --> F[Form Doldur]",
        "F --> S[Sistem İşler]",
        "S --> N[Bildirim]",
        "N --> U",
        "```"
      ].join("\n");

    case "solution_architect":
      return [
        commonStart,
        "## Mimari Hedefler",
        "- Ölçeklenebilir, izlenebilir ve güvenli mimari",
        "",
        "## Bileşenler",
        "- Web/Mobile UI",
        "- API Gateway",
        "- İş kuralları servisi",
        "- Notification servisi",
        "",
        "## Test Senaryoları",
        "- Entegrasyon testi: API + servisler",
        "- Yük testi: kritik endpoint latensi",
        "",
        "```mermaid",
        "flowchart TD",
        "UI --> APIGW",
        "APIGW --> APP[Application Service]",
        "APP --> DB[(PostgreSQL)]",
        "APP --> NOTIF[Notification Service]",
        "```"
      ].join("\n");

    case "data_scientist":
      return [
        commonStart,
        "## Problem Framing",
        "- Görev: optimizasyon + sınıflandırma karması",
        "",
        "## Veri İhtiyaçları",
        "- Talep kayıtları, durum geçmişi, sonuç metrikleri",
        "",
        "## Test Senaryoları",
        "- Veri sızıntısı kontrolü",
        "- Drift alarmı eşik testi",
        "",
        "```mermaid",
        "flowchart LR",
        "A[Raw Data] --> B[Feature Pipeline]",
        "B --> C[Model Training]",
        "C --> D[Model Registry]",
        "D --> E[Serving]",
        "E --> F[Monitoring]",
        "```"
      ].join("\n");
  }
}

export async function POST(req: Request) {
  let fallbackRole: RoleKey = "business_analyst";
  let fallbackTask = "Model çağrısı sırasında hata oluştu.";
  let fallbackNotes = "";

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

    const mergedNotes = [notes, fileNotes]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, MAX_NOTES_CHARS);
    const query = [task, mergedNotes].filter(Boolean).join("\n\n");
    const ragContext = await formatRagContext(query);
    const mergedWithRag = [mergedNotes, ragContext].filter(Boolean).join("\n\n");
    fallbackNotes = mergedWithRag;

    const system = buildSystemPrompt(role);
    const userContent = mergedWithRag
      ? `İŞ: ${task}\n\nREFERANS DERS NOTLARI:\n${mergedWithRag}\n\nKurallar:\n- Referans notlarıyla tutarlı ol.\n- Bilgi eksikse varsayımını açıkça belirt.`
      : `İŞ: ${task}`;

    const result = await callLlm({
      system,
      user: userContent,
      temperature: 0.4
    });

    return NextResponse.json({
      output: result.text,
      fallback: false,
      provider: result.provider
    });
  } catch (e: unknown) {
    const provider = getLlmProvider();
    const shouldFallback = isQuotaLikeError(e) || isLocalConnectionError(e);
    if (shouldFallback) {
      return NextResponse.json({
        output: buildFallbackOutput(fallbackRole, fallbackTask, fallbackNotes),
        fallback: true,
        provider
      });
    }
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: message, provider }, { status: 500 });
  }
}
