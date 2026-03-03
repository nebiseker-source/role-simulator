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

function asRoleKey(value: string): RoleKey | null {
  const roles: RoleKey[] = [
    "business_analyst",
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
    `> Uyarı: Model çağrısı başarısız oldu, fallback çıktı üretildi.`,
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
      return `${commonStart}
## Stakeholder Listesi
- İş birimi yöneticisi
- Operasyon ekibi
- Müşteri deneyimi ekibi
- Yazılım geliştirme ekibi

## Functional Requirements
- Talep girişi, durum takibi ve bildirim mekanizması
- Rol bazlı ekran ve yetki kontrolü
- Raporlama ve denetim kaydı

## Non-Functional Requirements
- Performans: kritik ekran yanıt süresi < 2 sn
- Güvenlik: rol bazlı erişim + audit log
- Erişilebilirlik: temel WCAG uyumu

## User Story + Acceptance Criteria
- Kullanıcı olarak talebimi oluşturmak istiyorum, böylece süreci takip edebilirim.
- Given geçerli veri, When kaydet tıklanır, Then talep ID üretilir ve durum 'Açık' olur.

## Riskler ve Önlemler
- Risk: Kapsam kayması -> Önlem: MVP sınırı ve değişiklik kurulu
- Risk: Veri kalitesi -> Önlem: zorunlu alan ve doğrulama kuralları

## Tahmini Plan (4 hafta)
- Hafta 1: As-Is/To-Be + gereksinim onayı
- Hafta 2: User story ve acceptance kriterleri
- Hafta 3: UAT senaryoları + teknik handoff
- Hafta 4: Pilot ve iyileştirme

\`\`\`mermaid
flowchart TD
A[Talep Girişi] --> B[Ön Değerlendirme]
B --> C{Uygun mu?}
C -- Evet --> D[İşleme Al]
C -- Hayır --> E[Revizyon İsteği]
D --> F[Sonuç Bildirimi]
\`\`\``;

    case "product_owner":
      return `${commonStart}
## Hedef ve Başarı Metrikleri
- KPI-1: süreç tamamlama süresinde %20 azalma
- KPI-2: self-service kullanımında %30 artış

## MVP Tanımı
- Temel talep oluşturma ve durum takibi
- Bildirim ve alternatif önerisi

## Backlog (Epic > Feature > Story)
- Epic: Talep Yönetimi
- Feature: Talep Oluşturma
- Story: Kullanıcı talep formunu doldurur ve kaydeder

## Önceliklendirme (RICE)
- Talep oluşturma: Reach yüksek, Effort düşük -> Öncelik 1
- Gelişmiş raporlama: Reach orta, Effort orta -> Öncelik 2

## Release Plan
- Sprint 1: temel akışlar
- Sprint 2: bildirim + iyileştirme

\`\`\`mermaid
flowchart LR
U[Kullanıcı] --> F[Form Doldur]
F --> S[Sistem İşler]
S --> N[Bildirim]
N --> U
\`\`\``;

    case "solution_architect":
      return `${commonStart}
## Mimari Hedefler
- Ölçeklenebilir, izlenebilir ve güvenli mimari

## Bileşenler
- Web/Mobile UI
- API Gateway
- İş kuralları servisi
- Notification servisi
- Raporlama DB

## API Taslakları
- POST /requests
- GET /requests/{id}
- POST /requests/{id}/notify

## NFR Kararları
- Authn/Authz: JWT + RBAC
- Rate limit: 100 req/min per token
- Cache: sık sorgular için 60 sn

\`\`\`mermaid
flowchart TD
UI --> APIGW
APIGW --> APP[Application Service]
APP --> DB[(PostgreSQL)]
APP --> NOTIF[Notification Service]
\`\`\``;

    case "data_scientist":
      return `${commonStart}
## Problem Framing
- Görev: optimizasyon + sınıflandırma karması

## Veri İhtiyaçları
- Talep kayıtları, durum geçmişi, sonuç metrikleri

## Özellik Fikirleri
- Talep tipi, kanal, zaman, geçmiş çözüm süresi

## Model Önerileri
- Baseline: lojistik regresyon / karar ağacı
- Gelişmiş: gradient boosting

## Değerlendirme
- F1, precision-recall, maliyet bazlı KPI

## Üretime Alma
- Günlük batch eğitim + drift izlemesi

\`\`\`mermaid
flowchart LR
A[Raw Data] --> B[Feature Pipeline]
B --> C[Model Training]
C --> D[Model Registry]
D --> E[Serving]
E --> F[Monitoring]
\`\`\``;
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
