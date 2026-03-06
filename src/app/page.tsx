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
    throw new Error(`${endpoint} boÅŸ yanÄ±t dÃ¶ndÃ¼rdÃ¼ (HTTP ${response.status}).`);
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(
      `${endpoint} JSON dÄ±ÅŸÄ± yanÄ±t dÃ¶ndÃ¼rdÃ¼ (HTTP ${response.status}). Ä°lk iÃ§erik: ${raw.slice(0, 200)}`
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
        team: cells[1] || "TakÄ±m",
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

  const visibleOutput = activeResult === "team" ? teamOutput?.finalSynthesis ?? "" : singleOutput;
  const diagrams = useMemo(() => extractMermaidBlocks(visibleOutput), [visibleOutput]);
  const taskSection = useMemo(
    () =>
      extractSection(visibleOutput, [
        "gÃ¶rev kÄ±rÄ±lÄ±mÄ±",
        "task breakdown",
        "backlog",
        "plan",
        "teslimat Ã§Ä±ktÄ±larÄ±",
      ]),
    [visibleOutput]
  );
  const testSection = useMemo(
    () => extractSection(visibleOutput, ["test senaryolarÄ±", "test", "acceptance criteria"]),
    [visibleOutput]
  );

  useEffect(() => {
    fetch("/api/rag/stats")
      .then((r) => readJsonSafely(r))
      .then((data) => {
        if (typeof data.documents === "number" && typeof data.chunks === "number") {
          setRagStats({ documents: data.documents, chunks: data.chunks });
        }
      })
      .catch(() => {});
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
      if (!r.ok) throw new Error(String(data.error ?? "Dosya iÅŸlenemedi"));

      setFileNotes(String(data.extractedText ?? ""));
      setFileInfo(
        `${data.fileName} â€¢ ${(Number(data.fileSize) / 1024 / 1024).toFixed(2)} MB${data.pageCount ? ` â€¢ ${data.pageCount} sayfa` : ""}${data.clipped ? " â€¢ metin kÄ±saltÄ±ldÄ±" : ""}`
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
      if (!r.ok) throw new Error(String(data.error ?? "API hatasÄ±"));
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
      if (!r.ok) throw new Error(String(data.error ?? "API hatasÄ±"));
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
      if (!r.ok) throw new Error(String(data.error ?? "RAG indexleme hatasÄ±"));

      setRagMessage(`RAG indexleme tamamlandÄ±. DokÃ¼man: ${data.docId}, parÃ§a: ${data.chunkCount}`);
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
      setRagMessage("Jira CSV iÃƒÂ§in gÃƒÂ¶rev bulunamadÃ„Â±. Ãƒâ€“nce simÃƒÂ¼lasyon ÃƒÂ¼ret.");
      return;
    }

    const headers = ["Summary", "Description", "Issue Type", "Priority", "Labels"];
    const rows = tasks.map((t) => [
      `${role.toUpperCase()} - ${t.title}`,
      `TakÃ„Â±m: ${t.team} | Teslimat: ${t.deliverable} | SÃƒÂ¼re: ${t.duration} | BaÃ„Å¸Ã„Â±mlÃ„Â±lÃ„Â±k: ${t.dependency}`,
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
      return <p className="text-slate-500">HenÃ¼z Ã§Ä±ktÄ± yok. YukarÄ±dan simÃ¼lasyon baÅŸlat.</p>;
    }

    if (outputTab === "rapor") return <MarkdownOutput content={visibleOutput} />;

    if (outputTab === "diyagram") {
      if (!diagrams.length) return <p className="text-slate-500">Bu Ã§Ä±ktÄ±da Mermaid diyagramÄ± bulunamadÄ±.</p>;
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
        <p className="text-slate-500">GÃ¶rev kÄ±rÄ±lÄ±mÄ± bÃ¶lÃ¼mÃ¼ bulunamadÄ±.</p>
      );
    }

    return testSection ? (
      <MarkdownOutput content={testSection} />
    ) : (
      <p className="text-slate-500">Test senaryolarÄ± bÃ¶lÃ¼mÃ¼ bulunamadÄ±.</p>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8 md:py-10">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-700 via-cyan-700 to-blue-700 p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/90">Business AI Studio</p>
          <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Role-Based Analist SimÃ¼latÃ¶rÃ¼</h1>
          <p className="mt-3 max-w-4xl text-sm text-sky-100/90 md:text-base">
            Tek rol veya ekip simÃ¼lasyonu Ã§alÄ±ÅŸtÄ±r. Rapor, diyagram, gÃ¶revler ve testler sekmelerle ayrÄ± gÃ¶rÃ¼ntÃ¼lenir.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-black/20 backdrop-blur">
          <h2 className="text-lg font-semibold">SimÃ¼lasyon GiriÅŸi</h2>
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
              <label className="mb-2 block text-sm font-medium">Ä°ÅŸ / Problem TanÄ±mÄ±</label>
              <textarea
                className="min-h-[140px] w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Ã–rn: Sefer iptalinde mÃ¼ÅŸteriyi otomatik bilgilendirme ve alternatif Ã¶neri sÃ¼reci"
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
              <p className="mt-1 text-xs text-slate-400">Limit: en fazla 8 MB, PDF iÃ§in en fazla 40 sayfa.</p>
              <p className="mt-1 text-xs text-cyan-200">
                {fileLoading ? "Dosya iÅŸleniyor..." : fileInfo || (notesFile ? notesFile.name : "Dosya seÃ§ilmedi.")}
              </p>
              {fileError ? <p className="mt-1 text-xs text-rose-300">{fileError}</p> : null}
            </div>

            {fileNotes ? (
              <div className="md:col-span-2 rounded-xl border border-white/10 bg-slate-950/70 p-3">
                <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">Dosyadan Ã‡Ä±kan Ä°Ã§erik Ã–nizleme</div>
                <pre className="max-h-36 overflow-auto whitespace-pre-wrap text-xs text-slate-200">{fileNotes}</pre>
              </div>
            ) : null}

            <div className="md:col-span-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <button
                onClick={runSingleSimulation}
                disabled={loading || !task.trim()}
                className="rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && activeResult === "single" ? "Ã‡alÄ±ÅŸÄ±yor..." : "Tek Rol SimÃ¼le Et"}
              </button>
              <button
                onClick={runTeamSimulation}
                disabled={loading || !task.trim()}
                className="rounded-xl bg-indigo-500 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && activeResult === "team" ? "Ã‡alÄ±ÅŸÄ±yor..." : "Ekip SimÃ¼lasyonu"}
              </button>
              <button
                type="button"
                onClick={addSourceToRag}
                disabled={ragLoading || (!notesFile && !fileNotes)}
                className="rounded-xl border border-cyan-300/40 px-3 py-2.5 text-sm text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
              >
                {ragLoading ? "Ä°ndeksleniyor..." : "KaynaÄŸÄ± RAG'e Ekle"}
              </button>
            </div>

            <div className="md:col-span-2 rounded-xl border border-cyan-300/25 bg-cyan-950/20 p-3 text-xs text-cyan-100/90">
              {ragStats
                ? `Toplam dokÃ¼man: ${ragStats.documents} â€¢ Toplam parÃ§a: ${ragStats.chunks}`
                : "RAG istatistikleri yÃ¼kleniyor..."}
              {ragMessage ? <div className="mt-1">{ragMessage}</div> : null}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white p-5 text-slate-800 shadow-2xl shadow-black/20">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ã‡Ä±ktÄ± Paneli</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadJiraCsv}
                disabled={!visibleOutput}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
              >
                Jira CSV Ã„Â°ndir
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
              { id: "gorevler", label: "GÃ¶revler" },
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
              Quota veya baÄŸlantÄ± sorunu nedeniyle fallback modu kullanÄ±ldÄ±.
              {singleFallbackReason ? ` Detay: ${singleFallbackReason}` : ""}
            </p>
          )}

          <div className="min-h-[72vh] max-h-[85vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-5">
            {renderOutputTab()}
          </div>

          {activeResult === "team" && teamOutput?.steps.length ? (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Rol BazlÄ± Ara Ã‡Ä±ktÄ±lar</h3>
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
