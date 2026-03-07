"use client";

import { useEffect, useMemo, useState } from "react";
import MarkdownOutput from "@/components/MarkdownOutput";
import MermaidChart from "@/components/MermaidChart";
import { ROLE_LABELS, RoleKey } from "@/lib/roles";

const ACCEPTED_TYPES = ".pdf,.docx,.txt,.md";

type TeamStep = {
  role: RoleKey;
  output: string;
  fallbackUsed: boolean;
};

type TeamResult = {
  steps: TeamStep[];
  finalSynthesis: string;
  fallbackUsed: boolean;
};

type StructuredTask = {
  id: string;
  team: string;
  title: string;
  deliverable: string;
  duration: string;
  dependency: string;
};

type StructuredSimulation = {
  tasks?: StructuredTask[];
};

type OutputTab = "rapor" | "diyagram" | "gorevler" | "testler";

type LlmHealth = {
  ok: boolean;
  provider: string;
  detail: string;
  baseUrl?: string;
  model?: string;
  embedModel?: string;
};

function extractMermaidBlocks(markdown: string): string[] {
  const matches = markdown.matchAll(/```mermaid\s*([\s\S]*?)```/gim);
  return Array.from(matches, (m) => m[1]?.trim() ?? "").filter(Boolean);
}

function extractSection(markdown: string, keywords: string[]): string {
  const lines = markdown.split("\n");
  const headers = lines
    .map((line, index) => ({ line, index }))
    .filter((x) => /^#{1,6}\s+/.test(x.line));

  const start = headers.find((h) =>
    keywords.some((k) => h.line.toLocaleLowerCase("tr-TR").includes(k.toLocaleLowerCase("tr-TR")))
  );
  if (!start) return "";

  const startIndex = start.index;
  const nextHeader = headers.find((h) => h.index > startIndex);
  const endIndex = nextHeader ? nextHeader.index : lines.length;
  return lines.slice(startIndex, endIndex).join("\n").trim();
}

async function readJsonSafely(response: Response): Promise<Record<string, unknown>> {
  const raw = await response.text();
  const endpoint = response.url ? new URL(response.url).pathname : "API";
  if (!raw) {
    throw new Error(`${endpoint} boş yanıt döndürdü (HTTP ${response.status}).`);
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(
      `${endpoint} JSON dışı yanıt döndürdü (HTTP ${response.status}). İlk içerik: ${raw.slice(0, 200)}`
    );
  }
}

function escapeCsv(value: string): string {
  const clean = value.replace(/\r?\n/g, " ").trim();
  return `"${clean.replace(/"/g, '""')}"`;
}

function parseTasksFromMarkdown(section: string): StructuredTask[] {
  const rows = section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && !l.includes("---"));
  return rows
    .slice(1)
    .map((line, i) => {
      const cells = line.split("|").map((x) => x.trim()).filter(Boolean);
      return {
        id: cells[0] || `TASK-${i + 1}`,
        team: cells[1] || "Takım",
        title: cells[2] || "",
        deliverable: cells[3] || "-",
        duration: cells[4] || "-",
        dependency: cells[5] || "-",
      };
    })
    .filter((x) => x.title);
}

export default function Home() {
  const roles = useMemo(() => Object.keys(ROLE_LABELS) as RoleKey[], []);
  const [role, setRole] = useState<RoleKey>("business_analyst");
  const [task, setTask] = useState("");
  const [notesFile, setNotesFile] = useState<File | null>(null);
  const [fileNotes, setFileNotes] = useState("");
  const [fileInfo, setFileInfo] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeResult, setActiveResult] = useState<"single" | "team" | "">("");
  const [singleOutput, setSingleOutput] = useState("");
  const [singleStructured, setSingleStructured] = useState<StructuredSimulation | null>(null);
  const [singleFallback, setSingleFallback] = useState(false);
  const [singleFallbackReason, setSingleFallbackReason] = useState("");
  const [teamOutput, setTeamOutput] = useState<TeamResult | null>(null);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragMessage, setRagMessage] = useState("");
  const [ragStats, setRagStats] = useState<{ documents: number; chunks: number } | null>(null);
  const [outputTab, setOutputTab] = useState<OutputTab>("rapor");
  const [llmHealth, setLlmHealth] = useState<LlmHealth | null>(null);
  const [llmHealthLoading, setLlmHealthLoading] = useState(false);

  const visibleOutput = activeResult === "team" ? teamOutput?.finalSynthesis ?? "" : singleOutput;
  const diagrams = useMemo(() => extractMermaidBlocks(visibleOutput), [visibleOutput]);
  const taskSection = useMemo(
    () =>
      extractSection(visibleOutput, [
        "görev kırılımı",
        "task breakdown",
        "backlog",
        "plan",
        "teslimat çıktıları",
      ]),
    [visibleOutput]
  );
  const testSection = useMemo(
    () => extractSection(visibleOutput, ["test senaryoları", "test", "acceptance criteria"]),
    [visibleOutput]
  );

  async function checkLlmHealth() {
    setLlmHealthLoading(true);
    try {
      const r = await fetch("/api/llm/health", { cache: "no-store" });
      const data = await readJsonSafely(r);
      setLlmHealth({
        ok: Boolean(data.ok),
        provider: String(data.provider ?? "-"),
        detail: String(data.detail ?? "-"),
        baseUrl: data.baseUrl ? String(data.baseUrl) : undefined,
        model: data.model ? String(data.model) : undefined,
        embedModel: data.embedModel ? String(data.embedModel) : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bilinmeyen hata";
      setLlmHealth({
        ok: false,
        provider: "unknown",
        detail: message,
      });
    } finally {
      setLlmHealthLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/rag/stats")
      .then((r) => readJsonSafely(r))
      .then((data) => {
        if (typeof data.documents === "number" && typeof data.chunks === "number") {
          setRagStats({ documents: data.documents, chunks: data.chunks });
        }
      })
      .catch(() => {});

    checkLlmHealth();
  }, []);

  async function handleSourceFile(file: File | null) {
    setNotesFile(file);
    setFileNotes("");
    setFileInfo("");
    setFileError("");
    if (!file) return;

    setFileLoading(true);
    try {
      const form = new FormData();
      form.append("notesFile", file);
      const r = await fetch("/api/extract-notes", { method: "POST", body: form });
      const data = await readJsonSafely(r);
      if (!r.ok) throw new Error(String(data.error ?? "Dosya işlenemedi"));

      setFileNotes(String(data.extractedText ?? ""));
      setFileInfo(
        `${data.fileName} • ${(Number(data.fileSize) / 1024 / 1024).toFixed(2)} MB${data.pageCount ? ` • ${data.pageCount} sayfa` : ""}${data.clipped ? " • metin kısaltıldı" : ""}`
      );
    } catch (err: unknown) {
      setFileError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setFileLoading(false);
    }
  }

  async function runSingleSimulation() {
    setLoading(true);
    setActiveResult("single");
    setSingleOutput("");
    setSingleStructured(null);
    setSingleFallback(false);
    setSingleFallbackReason("");
    setOutputTab("rapor");
    try {
      const r = await fetch("/api/simulate-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, task, fileNotes }),
      });
      const data = await readJsonSafely(r);
      if (!r.ok) throw new Error(String(data.error ?? "API hatası"));
      setSingleOutput(String(data.output ?? ""));
      setSingleStructured((data.structured as StructuredSimulation | null) ?? null);
      setSingleFallback(Boolean(data.fallback));
      setSingleFallbackReason(String(data.fallbackReason ?? ""));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bilinmeyen hata";
      setSingleOutput(`**Hata:** ${message}`);
    } finally {
      setLoading(false);
    }
  }

  async function runTeamSimulation() {
    setLoading(true);
    setActiveResult("team");
    setTeamOutput(null);
    setOutputTab("rapor");
    try {
      const r = await fetch("/api/simulate-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          notes: fileNotes,
        }),
      });
      const data = await readJsonSafely(r);
      if (!r.ok) throw new Error(String(data.error ?? "API hatası"));
      setTeamOutput(data as unknown as TeamResult);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bilinmeyen hata";
      setTeamOutput({
        steps: [],
        finalSynthesis: `**Hata:** ${message}`,
        fallbackUsed: false,
      });
    } finally {
      setLoading(false);
    }
  }

  async function addSourceToRag() {
    setRagLoading(true);
    setRagMessage("");
    try {
      const form = new FormData();
      form.append("title", task.trim() ? task.trim().slice(0, 80) : "Kaynak Dosya");
      form.append("text", fileNotes);
      form.append("role", role);
      if (notesFile) form.append("file", notesFile);

      const r = await fetch("/api/rag/index", { method: "POST", body: form });
      const data = await readJsonSafely(r);
      if (!r.ok) throw new Error(String(data.error ?? "RAG indexleme hatası"));

      setRagMessage(`RAG indexleme tamamlandı. Doküman: ${data.docId}, parça: ${data.chunkCount}`);
      const statsResp = await fetch("/api/rag/stats");
      const stats = await readJsonSafely(statsResp);
      if (typeof stats.documents === "number" && typeof stats.chunks === "number") {
        setRagStats({ documents: stats.documents, chunks: stats.chunks });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bilinmeyen hata";
      setRagMessage(`Hata: ${message}`);
    } finally {
      setRagLoading(false);
    }
  }

  function downloadJiraCsv() {
    const structuredTasks = singleStructured?.tasks ?? [];
    const tasks = structuredTasks.length ? structuredTasks : parseTasksFromMarkdown(taskSection || visibleOutput);
    if (!tasks.length) {
      setRagMessage("Jira CSV için görev bulunamadı. Önce simülasyon üret.");
      return;
    }

    const headers = ["Summary", "Description", "Issue Type", "Priority", "Labels"];
    const rows = tasks.map((t) => [
      `${role.toUpperCase()} - ${t.title}`,
      `Takım: ${t.team} | Teslimat: ${t.deliverable} | Süre: ${t.duration} | Bağımlılık: ${t.dependency}`,
      "Task",
      "Medium",
      `${role},ai-simulator`,
    ]);

    const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jira-export-${role}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function renderOutputTab() {
    if (!visibleOutput) {
      return <p className="text-slate-500">Henüz çıktı yok. Yukarıdan simülasyon başlat.</p>;
    }

    if (outputTab === "rapor") return <MarkdownOutput content={visibleOutput} />;

    if (outputTab === "diyagram") {
      if (!diagrams.length) return <p className="text-slate-500">Bu çıktıda Mermaid diyagramı bulunamadı.</p>;
      return (
        <div className="space-y-4">
          {diagrams.map((chart, i) => (
            <div key={`${i}-${chart.slice(0, 20)}`} className="rounded-xl border border-slate-200 bg-white p-3">
              <MermaidChart chart={chart} />
            </div>
          ))}
        </div>
      );
    }

    if (outputTab === "gorevler") {
      return taskSection ? (
        <MarkdownOutput content={taskSection} />
      ) : (
        <p className="text-slate-500">Görev kırılımı bölümü bulunamadı.</p>
      );
    }

    return testSection ? (
      <MarkdownOutput content={testSection} />
    ) : (
      <p className="text-slate-500">Test senaryoları bölümü bulunamadı.</p>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8 md:py-10">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-700 via-cyan-700 to-blue-700 p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/90">Business AI Studio</p>
          <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Role-Based Analist Simülatörü</h1>
          <p className="mt-3 max-w-4xl text-sm text-sky-100/90 md:text-base">
            Tek rol veya ekip simülasyonu çalıştır. Rapor, diyagram, görevler ve testler sekmelerle ayrı görüntülenir.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-black/20 backdrop-blur">
          <h2 className="text-lg font-semibold">Simülasyon Girişi</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Rol</label>
              <select
                className="w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2"
                value={role}
                onChange={(e) => setRole(e.target.value as RoleKey)}
              >
                {roles.map((k) => (
                  <option key={k} value={k}>
                    {ROLE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">İş / Problem Tanımı</label>
              <textarea
                className="min-h-[140px] w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Örn: Sefer iptalinde müşteriyi otomatik bilgilendirme ve alternatif öneri süreci"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Kaynak Dosya (PDF/Word/TXT/MD)</label>
              <input
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={(e) => handleSourceFile(e.target.files?.[0] ?? null)}
                className="block w-full cursor-pointer rounded-xl border border-dashed border-cyan-300/40 bg-slate-950 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-1.5 file:text-white hover:border-cyan-300/70"
              />
              <p className="mt-1 text-xs text-slate-400">Limit: en fazla 8 MB, PDF için en fazla 40 sayfa.</p>
              <p className="mt-1 text-xs text-cyan-200">
                {fileLoading ? "Dosya işleniyor..." : fileInfo || (notesFile ? notesFile.name : "Dosya seçilmedi.")}
              </p>
              {fileError ? <p className="mt-1 text-xs text-rose-300">{fileError}</p> : null}
            </div>

            {fileNotes ? (
              <div className="md:col-span-2 rounded-xl border border-white/10 bg-slate-950/70 p-3">
                <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">Dosyadan Çıkan İçerik Önizleme</div>
                <pre className="max-h-36 overflow-auto whitespace-pre-wrap text-xs text-slate-200">{fileNotes}</pre>
              </div>
            ) : null}

            <div className="md:col-span-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <button
                onClick={runSingleSimulation}
                disabled={loading || !task.trim()}
                className="rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && activeResult === "single" ? "Çalışıyor..." : "Tek Rol Simüle Et"}
              </button>
              <button
                onClick={runTeamSimulation}
                disabled={loading || !task.trim()}
                className="rounded-xl bg-indigo-500 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && activeResult === "team" ? "Çalışıyor..." : "Ekip Simülasyonu"}
              </button>
              <button
                type="button"
                onClick={addSourceToRag}
                disabled={ragLoading || (!notesFile && !fileNotes)}
                className="rounded-xl border border-cyan-300/40 px-3 py-2.5 text-sm text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
              >
                {ragLoading ? "İndeksleniyor..." : "Kaynağı RAG'e Ekle"}
              </button>
            </div>

            <div className="md:col-span-2 rounded-xl border border-cyan-300/25 bg-cyan-950/20 p-3 text-xs text-cyan-100/90">
              {ragStats
                ? `Toplam doküman: ${ragStats.documents} • Toplam parça: ${ragStats.chunks}`
                : "RAG istatistikleri yükleniyor..."}
              {ragMessage ? <div className="mt-1">{ragMessage}</div> : null}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white p-5 text-slate-800 shadow-2xl shadow-black/20">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Çıktı Paneli</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadJiraCsv}
                disabled={!visibleOutput}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
              >
                Jira CSV İndir
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(visibleOutput)}
                disabled={!visibleOutput}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
              >
                Kopyala
              </button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { id: "rapor", label: "Rapor" },
              { id: "diyagram", label: `Diyagramlar (${diagrams.length})` },
              { id: "gorevler", label: "Görevler" },
              { id: "testler", label: "Testler" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setOutputTab(tab.id as OutputTab)}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  outputTab === tab.id
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(singleFallback || teamOutput?.fallbackUsed) && (
            <p className="mb-3 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
              Quota veya bağlantı sorunu nedeniyle fallback modu kullanıldı.
              {singleFallbackReason ? ` Detay: ${singleFallbackReason}` : ""}
            </p>
          )}

          <div className="mb-3 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-xs text-slate-700">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">Model Bağlantı Durumu</span>
              <button
                type="button"
                onClick={checkLlmHealth}
                disabled={llmHealthLoading}
                className="rounded border border-slate-400 px-2 py-0.5 hover:bg-slate-200 disabled:opacity-60"
              >
                {llmHealthLoading ? "Kontrol ediliyor..." : "Yeniden kontrol et"}
              </button>
            </div>
            {llmHealth ? (
              <div className="mt-1">
                {llmHealth.ok ? "Bağlı" : "Bağlantı sorunu"} | {llmHealth.provider} | {llmHealth.detail}
              </div>
            ) : (
              <div className="mt-1 text-slate-500">Durum bekleniyor...</div>
            )}
          </div>

          <div className="min-h-[72vh] max-h-[85vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-5">
            {renderOutputTab()}
          </div>

          {activeResult === "team" && teamOutput?.steps.length ? (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Rol Bazlı Ara Çıktılar</h3>
              {teamOutput.steps.map((step) => (
                <details key={step.role} className="rounded-xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer font-semibold">
                    {ROLE_LABELS[step.role]} {step.fallbackUsed ? "(fallback)" : ""}
                  </summary>
                  <div className="mt-3">
                    <MarkdownOutput content={step.output} />
                  </div>
                </details>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
