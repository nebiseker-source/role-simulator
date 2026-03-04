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
    "data_scientist",
  ];
  return roles.includes(value as RoleKey) ? (value as RoleKey) : null;
}

function buildFallbackOutput(role: RoleKey, task: string, notes: string): string {
  const notesLine = notes
    ? `- Referans notlardan yararlanıldı (özet): ${notes.slice(0, 320)}...`
    : "- Referans not girilmedi, varsayım bazlı çıkarım yapıldı.";

  const coloredHeader = [
    "%%{init: {'theme':'base','themeVariables': {'primaryColor':'#7dd3fc','primaryBorderColor':'#0284c7','lineColor':'#0f172a','secondaryColor':'#bbf7d0','tertiaryColor':'#fde68a'}}}%%",
    "flowchart TD",
  ];

  const commonStart = [
    "> Uyarı: Model çağrısı başarısız oldu, fallback çıktısı üretildi.",
    `> Rol: ${role}`,
    "",
    "## Problem Tanımı",
    task,
    "",
    "## Varsayımlar",
    "- Ekip çapraz fonksiyonel ve haftalık sprintlerle çalışıyor.",
    "- İş hedefi ölçülebilir KPI'larla takip edilecek.",
    notesLine,
    "",
    "## Görev Kırılımı (Task Breakdown)",
    "- Analiz: Gereksinimlerin netleştirilmesi (1-2 gün)",
    "- Tasarım: Akış ve diyagramların hazırlanması (1 gün)",
    "- Uygulama: API/UI düzenlemeleri (2-3 gün)",
    "- Doğrulama: Test ve kabul adımları (1 gün)",
    "",
    "## Test Senaryoları",
    "- Pozitif: Geçerli veri ile simülasyon çıktısı üretilir.",
    "- Negatif: Rol veya görev boşken validasyon hatası döner.",
    "- Negatif: Desteklenmeyen dosya yüklemesinde hata mesajı döner.",
    "- Pozitif: Mermaid bloğu varsa diyagram sekmesinde çizilir.",
    "- Pozitif: Görev/Test sekmeleri ilgili bölümü filtreler.",
    "",
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
        "```mermaid",
        ...coloredHeader,
        "A[Talep Girişi]:::start --> B[Ön Değerlendirme]:::step",
        "B --> C{Uygun mu?}:::decision",
        "C -- Evet --> D[İşleme Al]:::step",
        "C -- Hayır --> E[Revizyon İsteği]:::risk",
        "D --> F[Sonuç Bildirimi]:::done",
        "classDef start fill:#bbf7d0,stroke:#16a34a,color:#052e16;",
        "classDef step fill:#dbeafe,stroke:#2563eb,color:#172554;",
        "classDef decision fill:#fef3c7,stroke:#d97706,color:#78350f;",
        "classDef risk fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;",
        "classDef done fill:#cffafe,stroke:#0891b2,color:#083344;",
        "```",
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
        "```mermaid",
        ...coloredHeader,
        "F[Fikir]:::start --> M[MVP]:::step",
        "M --> V[Doğrulama]:::decision",
        "V --> S[Ölçekleme]:::done",
        "classDef start fill:#bbf7d0,stroke:#16a34a,color:#052e16;",
        "classDef step fill:#dbeafe,stroke:#2563eb,color:#172554;",
        "classDef decision fill:#fef3c7,stroke:#d97706,color:#78350f;",
        "classDef done fill:#cffafe,stroke:#0891b2,color:#083344;",
        "```",
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
        "```mermaid",
        ...coloredHeader,
        "U[Kullanıcı]:::start --> F[Form Doldur]:::step",
        "F --> S[Sistem İşler]:::step",
        "S --> N[Bildirim]:::done",
        "N --> U",
        "classDef start fill:#bbf7d0,stroke:#16a34a,color:#052e16;",
        "classDef step fill:#dbeafe,stroke:#2563eb,color:#172554;",
        "classDef done fill:#cffafe,stroke:#0891b2,color:#083344;",
        "```",
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
        "```mermaid",
        ...coloredHeader,
        "UI[Web/Mobile UI]:::start --> APIGW[API Gateway]:::step",
        "APIGW --> APP[Application Service]:::step",
        "APP --> DB[(PostgreSQL)]:::decision",
        "APP --> NOTIF[Notification Service]:::done",
        "classDef start fill:#bbf7d0,stroke:#16a34a,color:#052e16;",
        "classDef step fill:#dbeafe,stroke:#2563eb,color:#172554;",
        "classDef decision fill:#fef3c7,stroke:#d97706,color:#78350f;",
        "classDef done fill:#cffafe,stroke:#0891b2,color:#083344;",
        "```",
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
        "```mermaid",
        ...coloredHeader,
        "A[Raw Data]:::start --> B[Feature Pipeline]:::step",
        "B --> C[Model Training]:::step",
        "C --> D[Model Registry]:::decision",
        "D --> E[Serving]:::done",
        "E --> F[Monitoring]:::done",
        "classDef start fill:#bbf7d0,stroke:#16a34a,color:#052e16;",
        "classDef step fill:#dbeafe,stroke:#2563eb,color:#172554;",
        "classDef decision fill:#fef3c7,stroke:#d97706,color:#78350f;",
        "classDef done fill:#cffafe,stroke:#0891b2,color:#083344;",
        "```",
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

    const mergedNotes = [notes, fileNotes].filter(Boolean).join("\n\n").slice(0, MAX_NOTES_CHARS);
    const query = [task, mergedNotes].filter(Boolean).join("\n\n");
    const ragContext = await formatRagContext(query);
    const mergedWithRag = [mergedNotes, ragContext].filter(Boolean).join("\n\n");
    fallbackNotes = mergedWithRag;

    const system = buildSystemPrompt(role);
    const userContent = mergedWithRag
      ? `İŞ: ${task}\n\nREFERANS DERS NOTLARI:\n${mergedWithRag}\n\nKurallar:\n- Referans notlarla tutarlı ol.\n- Bilgi eksikse varsayımını açıkça belirt.`
      : `İŞ: ${task}`;

    const result = await callLlm({
      system,
      user: userContent,
      temperature: 0.4,
    });

    return NextResponse.json({
      output: result.text,
      fallback: false,
      provider: result.provider,
    });
  } catch (e: unknown) {
    const provider = getLlmProvider();
    const shouldFallback = isQuotaLikeError(e) || isLocalConnectionError(e);
    if (shouldFallback) {
      return NextResponse.json({
        output: buildFallbackOutput(fallbackRole, fallbackTask, fallbackNotes),
        fallback: true,
        provider,
      });
    }
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: message, provider }, { status: 500 });
  }
}
