import { NextResponse } from "next/server";
import { RoleKey } from "@/lib/roles";
import { formatPlaybookSources, searchRolePlaybook } from "@/lib/server/playbook-lite";

export const runtime = "nodejs";

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

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function shortTaskSummary(task: string): string {
  const first = task
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .find((l) => l.length > 12);

  if (!first) return "Görev metni sağlandı.";
  const c = compact(first.replace(/^#+\s*/, ""));
  return c.length > 220 ? `${c.slice(0, 220)}...` : c;
}

function detectDomain(task: string): "trip_cancel_sms" | "generic" {
  const t = task.toLocaleLowerCase("tr-TR");
  if (t.includes("sefer") && t.includes("iptal") && t.includes("sms")) {
    return "trip_cancel_sms";
  }
  return "generic";
}

function roleCoreSections(role: RoleKey): string[] {
  switch (role) {
    case "business_analyst":
      return [
        "## 3) Gereksinimler (Öncelikli)",
        "| ID | Tip | Öncelik | Gereksinim |",
        "| --- | --- | --- | --- |",
        "| FR-01 | Functional | Must | İptal olayı sonrası uygun kullanıcıya bildirim akışı tetiklenmeli. |",
        "| FR-02 | Functional | Must | Aynı bilet/sefer için tekrar gönderim engellenmeli (idempotency). |",
        "| FR-03 | Functional | Should | Başarısız SMS denemelerinde retry/backoff uygulanmalı. |",
        "| NFR-01 | Non-Functional | Must | P95 bildirim başlatma süresi 60 saniye altında olmalı. |",
        "| NFR-02 | Non-Functional | Must | KVKK/izin kontrolü zorunlu olmalı. |",
        "",
        "## 4) Kullanıcı Hikayeleri",
        "- **US-01**: Yolcu olarak seferim iptal olduğunda SMS almak isterim, böylece hızlıca aksiyon alırım.",
        "  - **AC-01**: Given sefer iptal edildi, When olay işlendi, Then 60 sn içinde SMS denemesi başlatılır.",
        "- **US-02**: Operasyon olarak başarısız gönderimleri görmek isterim, böylece manuel müdahale ederim.",
        "  - **AC-02**: Hatalı denemeler hata kodu ve zaman damgası ile raporlanır.",
        "",
      ];
    case "product_manager":
      return [
        "## 3) Ürün Stratejisi ve KPI",
        "- North Star: İptal durumunda zamanında bilgilendirilen yolcu oranı",
        "- KPI-1: Bildirim başlatma süresi (P95)",
        "- KPI-2: Başarılı teslim oranı",
        "- KPI-3: İptal kaynaklı destek çağrısı azalım oranı",
        "",
        "## 4) Yol Haritası",
        "- Faz 1: SMS temel akış + loglama",
        "- Faz 2: Retry/fallback + dashboard",
        "- Faz 3: Kişiselleştirilmiş alternatif öneri",
        "",
      ];
    case "product_owner":
      return [
        "## 3) Backlog (Epic > Feature > Story)",
        "- Epic: İptal Bildirim Yönetimi",
        "- Feature: Olay dinleme ve bildirim tetikleme",
        "- Story: Yolcuya otomatik SMS bilgilendirme",
        "",
        "## 4) Sprint Planı",
        "- Sprint 1: Event -> SMS temel akış",
        "- Sprint 2: Retry + gözlemlenebilirlik",
        "",
      ];
    case "solution_architect":
      return [
        "## 3) Mimari Öneri",
        "- UI: Next.js App Router",
        "- API: Route handlers",
        "- Servis: Bildirim orkestrasyon katmanı",
        "- Veri: Olay kaydı + gönderim logu",
        "",
        "## 4) Non-Functional Kararlar",
        "- Güvenlik: input doğrulama, izin kontrolü, maskeleme",
        "- Dayanıklılık: retry/backoff, dead-letter queue",
        "- Gözlemlenebilirlik: metrik, alarm, izleme paneli",
        "",
      ];
    case "data_scientist":
      return [
        "## 3) Problem Framing",
        "- Amaç: İptal sonrası doğru zamanda doğru kullanıcıyı bilgilendirmek",
        "- Tip: Kural tabanlı karar + ileride tahmin/öneri modeli",
        "",
        "## 4) Ölçüm ve Modelleme Planı",
        "- Baseline: kural tabanlı tetikleme ve segmentleme",
        "- Gelişmiş: gönderim başarısı ve gecikme tahmini",
        "- Metrikler: başarı oranı, gecikme, yanlış gönderim oranı",
        "",
      ];
  }
}

function teamTasks(domain: "trip_cancel_sms" | "generic"): string[] {
  if (domain === "trip_cancel_sms") {
    return [
      "## 5) Ekip Bazlı Görev Dağılımı (Açılacak Tasklar)",
      "| Task ID | Ekip | Görev | Teslimat | Süre | Ön Koşul |",
      "| --- | --- | --- | --- | --- | --- |",
      "| BA-101 | İş Analizi | İptal tetikleyicileri ve iş kurallarını netleştir | BRD + BPMN | 1 gün | Paydaş toplantısı |",
      "| ARC-102 | İş Mimarı | Olay akışı, idempotency ve retry mimarisini tasarla | Mimari karar kaydı | 1 gün | BA-101 |",
      "| DEV-103 | Backend | `cancelled` event tüketimi ve SMS tetikleme servisi geliştir | API + servis kodu | 2 gün | ARC-102 |",
      "| DEV-104 | Entegrasyon | SMS sağlayıcı entegrasyonu + hata kodu haritalama | Entegrasyon modülü | 1 gün | DEV-103 |",
      "| QA-105 | QA | Pozitif/negatif/tekrar gönderim testlerini çalıştır | Test raporu | 1 gün | DEV-104 |",
      "| OPS-106 | Operasyon | Alarm ve dashboard eşiklerini tanımla | Operasyon runbook | 0.5 gün | QA-105 |",
      "| CS-107 | Müşteri Hizmetleri | Standart yanıt metni ve eskalasyon akışını hazırla | Script dokümanı | 0.5 gün | BA-101 |",
      "",
    ];
  }

  return [
    "## 5) Ekip Bazlı Görev Dağılımı (Açılacak Tasklar)",
    "| Task ID | Ekip | Görev | Teslimat | Süre |",
    "| --- | --- | --- | --- | --- |",
    "| BA-201 | İş Analizi | Kapsam, paydaş ve iş kuralı netleştirme | Analiz notu | 1 gün |",
    "| ARC-202 | Mimari | Yüksek seviye çözüm tasarımı | Mimari taslak | 1 gün |",
    "| DEV-203 | Geliştirme | Fonksiyonel gereksinim implementasyonu | Uygulama güncellemesi | 2 gün |",
    "| QA-204 | QA | Kritik akış testleri | Test raporu | 1 gün |",
    "",
  ];
}

function testMatrix(domain: "trip_cancel_sms" | "generic"): string[] {
  if (domain === "trip_cancel_sms") {
    return [
      "## 6) Test Senaryoları",
      "| Test ID | Tür | Senaryo | Beklenen Sonuç |",
      "| --- | --- | --- | --- |",
      "| T-01 | Pozitif | İptal event’i geldi, kullanıcı opt-in açık | 60 sn içinde SMS denemesi başlatılır |",
      "| T-02 | Negatif | Kullanıcı opt-in kapalı | SMS gönderilmez, kayıt düşülür |",
      "| T-03 | Negatif | SMS sağlayıcı 5xx döner | Retry politikası devreye girer |",
      "| T-04 | Negatif | Aynı event iki kez gelir | İkinci gönderim engellenir |",
      "| T-05 | Pozitif | Operasyon paneli iptal işaretler | Olay kuyruğu tetiklenir ve log oluşur |",
      "",
    ];
  }

  return [
    "## 6) Test Senaryoları",
    "- Pozitif: Geçerli görevde rol çıktısı oluşur",
    "- Negatif: Boş görevde validasyon hatası döner",
    "- Pozitif: Kaynak referansları raporda listelenir",
    "",
  ];
}

function workflowDiagram(domain: "trip_cancel_sms" | "generic"): string[] {
  if (domain === "trip_cancel_sms") {
    return [
      "## 7) İş Akışı Diyagramı",
      "```mermaid",
      "flowchart LR",
      "A[Sefer İptal Event'i]:::event --> B{Biletli Yolcu Var mı?}:::decision",
      "B -- Hayır --> Z[İşlem Sonu]:::finish",
      "B -- Evet --> C{SMS İzni Var mı?}:::decision",
      "C -- Hayır --> L[Logla: İzin Yok]:::log",
      "C -- Evet --> D[SMS İçeriği Oluştur]:::process",
      "D --> E[SMS Sağlayıcıya Gönder]:::integration",
      "E --> F{Başarılı mı?}:::decision",
      "F -- Evet --> G[Durum: Bildirildi]:::success",
      "F -- Hayır --> H[Retry/Backoff]:::retry",
      "H --> I{Retry Limiti Aşıldı mı?}:::decision",
      "I -- Hayır --> E",
      "I -- Evet --> J[Fallback/Manuel Kuyruk]:::risk",
      "G --> K[Dashboard Metrikleri]:::log",
      "J --> K",
      "L --> K",
      "classDef event fill:#dbeafe,stroke:#1d4ed8,color:#1e3a8a;",
      "classDef decision fill:#fef3c7,stroke:#d97706,color:#78350f;",
      "classDef process fill:#dcfce7,stroke:#16a34a,color:#14532d;",
      "classDef integration fill:#ede9fe,stroke:#7c3aed,color:#4c1d95;",
      "classDef success fill:#bbf7d0,stroke:#15803d,color:#14532d;",
      "classDef retry fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;",
      "classDef risk fill:#ffe4e6,stroke:#e11d48,color:#881337;",
      "classDef log fill:#e2e8f0,stroke:#475569,color:#0f172a;",
      "classDef finish fill:#f1f5f9,stroke:#334155,color:#0f172a;",
      "```",
      "",
    ];
  }

  return [
    "## 7) İş Akışı Diyagramı",
    "```mermaid",
    "flowchart TD",
    "A[Görev Girişi] --> B[Rol Seçimi]",
    "B --> C[Playbook Arama]",
    "C --> D[Rapor + Diyagram + Test]",
    "classDef box fill:#dbeafe,stroke:#1d4ed8,color:#1e3a8a;",
    "class A,B,C,D box;",
    "```",
    "",
  ];
}

function buildOutput(role: RoleKey, task: string, notes: string, sources: string[], excerpts: string[]): string {
  const domain = detectDomain(task);
  const summary = shortTaskSummary(task);

  const notesBlock = notes
    ? `## 2) Referans Not Özeti\n${notes.slice(0, 1200)}\n`
    : "## 2) Referans Not Özeti\n- Not eklenmedi.\n";

  return [
    `# ${roleTitle(role)} Çıktısı`,
    "",
    "## 1) Problem Özeti",
    `- Girdi özeti: ${summary}`,
    role === "business_analyst"
      ? "- Hedef: İptal bilgisini doğru kullanıcıya, doğru zamanda ve tekrar etmeden iletmek."
      : "- Hedef: Seçilen role göre uygulanabilir iş çıktısı üretmek.",
    "",
    notesBlock,
    ...roleCoreSections(role),
    ...teamTasks(domain),
    ...testMatrix(domain),
    ...workflowDiagram(domain),
    "## 8) Playbooktan Çekilen Bölümler",
    ...(excerpts.length ? excerpts.map((x) => `- ${x}`) : ["- Eşleşen bölüm bulunamadı"]),
    "",
    "## 9) Kullanılan Kaynaklar",
    ...(sources.length ? sources.map((s) => `- ${s}`) : ["- Kaynak bulunamadı"]),
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
