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

function isQuotaLikeError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    status === 429 ||
    message.includes("429") ||
    message.includes("quota") ||
    message.includes("billing") ||
    message.includes("insufficient")
  );
}

function buildFallbackOutput(role: RoleKey, task: string, notes: string): string {
  const notesLine = notes
    ? `- Referans notlardan yararlanildi (ozet): ${notes.slice(0, 320)}...`
    : "- Referans not girilmedi, varsayim bazli cikarim yapildi.";

  const commonStart = [
    "> Uyari: OpenAI quota/billing hatasi (429) nedeniyle bu cikti fallback modunda uretilmistir.",
    `> Rol: ${role}`,
    "",
    `## Problem Tanimi`,
    `${task}`,
    "",
    `## Varsayimlar`,
    "- Ekip capraz fonksiyonel ve haftalik sprintlerle calisiyor.",
    "- Is hedefi olculebilir KPI'larla takip edilecek.",
    notesLine,
    ""
  ].join("\n");

  switch (role) {
    case "business_analyst":
      return [
        commonStart,
        "## Stakeholder Listesi",
        "- Is birimi yoneticisi",
        "- Operasyon ekibi",
        "- Musteri deneyimi ekibi",
        "- Yazilim gelistirme ekibi",
        "",
        "## Functional Requirements",
        "- Talep girisi, durum takibi ve bildirim mekanizmasi",
        "- Rol bazli ekran ve yetki kontrolu",
        "- Raporlama ve denetim kaydi",
        "",
        "## Non-Functional Requirements",
        "- Performans: kritik ekran yanit suresi < 2 sn",
        "- Guvenlik: rol bazli erisim + audit log",
        "- Erisilebilirlik: temel WCAG uyumu",
        "",
        "## User Story + Acceptance Criteria",
        "- Kullanici olarak talebimi olusturmak istiyorum, boylece sureci takip edebilirim.",
        "- Given gecerli veri, When kaydet tiklanir, Then talep ID uretilir ve durum 'Acilik' olur.",
        "",
        "## Riskler ve Onlemler",
        "- Risk: Kapsam kaymasi -> Onlem: MVP siniri ve degisiklik kurulu",
        "- Risk: Veri kalitesi -> Onlem: zorunlu alan ve dogrulama kurallari",
        "",
        "## Tahmini Plan (4 hafta)",
        "- Hafta 1: As-Is/To-Be + gereksinim onayi",
        "- Hafta 2: User story ve acceptance kriterleri",
        "- Hafta 3: UAT senaryolari + teknik handoff",
        "- Hafta 4: Pilot ve iyilestirme",
        "",
        "```mermaid",
        "flowchart TD",
        "A[Talep Girisi] --> B[On Degerlendirme]",
        "B --> C{Uygun mu?}",
        "C -- Evet --> D[Isleme Al]",
        "C -- Hayir --> E[Revizyon Istegi]",
        "D --> F[Sonuc Bildirimi]",
        "```"
      ].join("\n");

    case "product_owner":
      return [
        commonStart,
        "## Hedef ve Basari Metrikleri",
        "- KPI-1: surec tamamlama suresinde %20 azalma",
        "- KPI-2: self-service kullaniminda %30 artis",
        "",
        "## MVP Tanimi",
        "- Temel talep olusturma ve durum takibi",
        "- Bildirim ve alternatif onerisi",
        "",
        "## Backlog (Epic > Feature > Story)",
        "- Epic: Talep Yonetimi",
        "- Feature: Talep Olusturma",
        "- Story: Kullanici talep formunu doldurur ve kaydeder",
        "",
        "## Onceliklendirme (RICE)",
        "- Talep olusturma: Reach yuksek, Effort dusuk -> Oncelik 1",
        "- Gelismis raporlama: Reach orta, Effort orta -> Oncelik 2",
        "",
        "## Release Plan",
        "- Sprint 1: temel akislar",
        "- Sprint 2: bildirim + iyilestirme",
        "",
        "```mermaid",
        "flowchart LR",
        "U[Kullanici] --> F[Form Doldur]",
        "F --> S[Sistem Isler]",
        "S --> N[Bildirim]",
        "N --> U",
        "```"
      ].join("\n");

    case "solution_architect":
      return [
        commonStart,
        "## Mimari Hedefler",
        "- Olceklenebilir, izlenebilir ve guvenli mimari",
        "",
        "## Bilesenler",
        "- Web/Mobile UI",
        "- API Gateway",
        "- Is kurallari servisi",
        "- Notification servisi",
        "- Raporlama DB",
        "",
        "## API Taslaklari",
        "- POST /requests",
        "- GET /requests/{id}",
        "- POST /requests/{id}/notify",
        "",
        "## NFR Kararlari",
        "- Authn/Authz: JWT + RBAC",
        "- Rate limit: 100 req/min per token",
        "- Cache: sik sorgular icin 60 sn",
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
        "- Gorev: optimizasyon + siniflandirma karmasi",
        "",
        "## Veri Ihtiyaclari",
        "- Talep kayitlari, durum gecmisi, sonuc metrikleri",
        "",
        "## Ozellik Fikirleri",
        "- Talep tipi, kanal, zaman, gecmis cozum suresi",
        "",
        "## Model Onerileri",
        "- Baseline: lojistik regresyon / karar agaci",
        "- Gelismis: gradient boosting",
        "",
        "## Degerlendirme",
        "- F1, precision-recall, maliyet bazli KPI",
        "",
        "## Uretime Alma",
        "- Gunluk batch egitim + drift izlemesi",
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
  const body = await req.json();
  const role = asRoleKey(String(body.role ?? ""));
  const task = String(body.task ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  const fileNotes = String(body.fileNotes ?? "").trim();

  if (!role || !task) {
    return NextResponse.json({ error: "role ve task zorunlu" }, { status: 400 });
  }

  const mergedNotes = [notes, fileNotes]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_NOTES_CHARS);

  const system = buildSystemPrompt(role);
  const userContent = mergedNotes
    ? `İŞ: ${task}\n\nREFERANS DERS NOTLARI:\n${mergedNotes}\n\nKurallar:\n- Referans notlarıyla tutarlı ol.\n- Bilgi eksikse varsayımını açıkça belirt.`
    : `İŞ: ${task}`;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      output: buildFallbackOutput(role, task, mergedNotes),
      fallback: true
    });
  }

  try {
    const resp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent }
      ]
    });

    const content = resp.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ output: content, fallback: false });
  } catch (e: unknown) {
    if (isQuotaLikeError(e)) {
      return NextResponse.json({
        output: buildFallbackOutput(role, task, mergedNotes),
        fallback: true
      });
    }
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
