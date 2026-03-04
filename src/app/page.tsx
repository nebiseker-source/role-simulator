"use client";

import { useEffect, useMemo, useState } from "react";
import MarkdownOutput from "@/components/MarkdownOutput";
import MermaidChart from "@/components/MermaidChart";
import { ROLE_LABELS, RoleKey } from "@/lib/roles";

const ACCEPTED_TYPES = ".pdf,.docx,.txt,.md";
const HISTORY_KEY = "role_sim_notes_history_v1";
const MAX_HISTORY = 8;

type NotesHistoryItem = {
  id: string;
  title: string;
  notes: string;
  createdAt: string;
};

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
    keywords.some((k) => h.line.toLowerCase().includes(k.toLowerCase()))
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

  if (response.status === 405 && !raw) {
    throw new Error(`${endpoint} icin yontem hatasi (HTTP 405). Sayfayi yenileyip tekrar dene.`);
  }

  if (!raw) {
    throw new Error(`${endpoint} bos yanit dondurdu (HTTP ${response.status}).`);
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(
      `${endpoint} JSON disi yanit dondurdu (HTTP ${response.status}). Ilk icerik: ${raw.slice(0, 200)}`
    );
  }
}

export default function Home() {
  const roles = useMemo(() => Object.keys(ROLE_LABELS) as RoleKey[], []);
  const [role, setRole] = useState<RoleKey>("business_analyst");
  const [task, setTask] = useState("");
  const [notes, setNotes] = useState("");
  const [notesFile, setNotesFile] = useState<File | null>(null);
  const [fileNotes, setFileNotes] = useState("");
  const [fileInfo, setFileInfo] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeResult, setActiveResult] = useState<"single" | "team" | "">("");
  const [singleOutput, setSingleOutput] = useState("");
  const [singleFallback, setSingleFallback] = useState(false);
  const [teamOutput, setTeamOutput] = useState<TeamResult | null>(null);
  const [history, setHistory] = useState<NotesHistoryItem[]>([]);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragMessage, setRagMessage] = useState("");
  const [ragStats, setRagStats] = useState<{ documents: number; chunks: number } | null>(null);
  const [outputTab, setOutputTab] = useState<OutputTab>("rapor");

  const visibleOutput = activeResult === "team" ? teamOutput?.finalSynthesis ?? "" : singleOutput;
  const diagrams = useMemo(() => extractMermaidBlocks(visibleOutput), [visibleOutput]);
  const taskSection = useMemo(
    () => extractSection(visibleOutput, ["gorev kirilimi", "task breakdown", "backlog", "plan"]),
    [visibleOutput]
  );
  const testSection = useMemo(
    () => extractSection(visibleOutput, ["test senaryolari", "test", "acceptance criteria"]),
    [visibleOutput]
  );

  useEffect(() => {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return;
    try {
      setHistory(JSON.parse(raw) as NotesHistoryItem[]);
    } catch {
      setHistory([]);
    }
  }, []);

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

  function persistHistory(items: NotesHistoryItem[]) {
    setHistory(items);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  }

  function saveCurrentNotes() {
    if (!notes.trim()) return;
    const item: NotesHistoryItem = {
      id: crypto.randomUUID(),
      title: task.trim() ? task.trim().slice(0, 42) : "Kaydedilen not",
      notes,
      createdAt: new Date().toLocaleString("tr-TR"),
    };
    persistHistory([item, ...history].slice(0, MAX_HISTORY));
  }

  async function handleNotesFile(file: File | null) {
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
      if (!r.ok) throw new Error(String(data.error ?? "Dosya islenemedi"));

      setFileNotes(String(data.extractedText ?? ""));
      setFileInfo(
        `${data.fileName} | ${(Number(data.fileSize) / 1024 / 1024).toFixed(2)} MB${data.pageCount ? ` | ${data.pageCount} sayfa` : ""}${data.clipped ? " | metin kisaltildi" : ""}`
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
    setSingleFallback(false);
    setOutputTab("rapor");
    try {
      const r = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, task, notes, fileNotes }),
      });
      const data = await readJsonSafely(r);
      if (!r.ok) throw new Error(String(data.error ?? "API hatasi"));
      setSingleOutput(String(data.output ?? ""));
      setSingleFallback(Boolean(data.fallback));
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
          notes: [notes, fileNotes].filter(Boolean).join("\n\n"),
        }),
      });
      const data = await readJsonSafely(r);
      if (!r.ok) throw new Error(String(data.error ?? "API hatasi"));
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

  async function addNotesToRag() {
    setRagLoading(true);
    setRagMessage("");
    try {
      const form = new FormData();
      form.append("title", task.trim() ? task.trim().slice(0, 80) : "Ders Notu");
      form.append("text", notes);
      if (notesFile) form.append("file", notesFile);

      const r = await fetch("/api/rag/index", { method: "POST", body: form });
      const data = await readJsonSafely(r);
      if (!r.ok) throw new Error(String(data.error ?? "RAG indexleme hatasi"));

      setRagMessage(`RAG indexleme tamamlandi. Dokuman: ${data.docId}, parca: ${data.chunkCount}`);
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

  function renderOutputTab() {
    if (!visibleOutput) {
      return <p className="text-slate-500">Henuz cikti yok. Yukaridan simulasyon baslat.</p>;
    }
    if (outputTab === "rapor") return <MarkdownOutput content={visibleOutput} />;
    if (outputTab === "diyagram") {
      if (!diagrams.length) return <p className="text-slate-500">Bu ciktida Mermaid diyagrami bulunamadi.</p>;
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
      return taskSection ? <MarkdownOutput content={taskSection} /> : <p className="text-slate-500">Gorev bolumu bulunamadi.</p>;
    }
    return testSection ? <MarkdownOutput content={testSection} /> : <p className="text-slate-500">Test bolumu bulunamadi.</p>;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8 md:py-10">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-700 via-cyan-700 to-blue-700 p-6 md:p-8">
          <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -left-12 -bottom-16 h-44 w-44 rounded-full bg-teal-300/20 blur-3xl" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/90">Business AI Studio</p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Role-Based Analist Simulatoru</h1>
            <p className="mt-3 max-w-4xl text-sm text-sky-100/90 md:text-base">
              Tek rol veya ekip simulasyonu calistir. Rapor, diyagram, gorevler ve testler sekmelerle ayri goruntulenir.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-black/20 backdrop-blur">
          <h2 className="text-lg font-semibold">Simulasyon Girisi</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Rol</label>
              <select
                className="w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 outline-none ring-cyan-400 transition focus:ring-2"
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
              <label className="mb-2 block text-sm font-medium">Is / Problem Tanimi</label>
              <textarea
                className="min-h-[140px] w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 outline-none ring-cyan-400 transition focus:ring-2"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Orn: Sefer iptalinde musteriyi otomatik bilgilendirme ve alternatif oneri sureci"
              />
            </div>

            <div className="md:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium">Ders Notlari (Metin)</label>
                <button type="button" onClick={saveCurrentNotes} className="rounded-lg border border-cyan-300/40 px-2.5 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10">
                  Notlari Kaydet
                </button>
              </div>
              <textarea
                className="min-h-[110px] w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 outline-none ring-cyan-400 transition focus:ring-2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Role takip ettirmek istedigin ders notu ozetini buraya yaz."
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Ders Notu Dosyasi Ice Aktar (PDF/Word/TXT/MD)</label>
              <input
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={(e) => handleNotesFile(e.target.files?.[0] ?? null)}
                className="block w-full cursor-pointer rounded-xl border border-dashed border-cyan-300/40 bg-slate-950 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-1.5 file:text-white hover:border-cyan-300/70"
              />
              <p className="mt-1 text-xs text-slate-400">Limit: en fazla 8 MB, PDF icin en fazla 40 sayfa.</p>
              <p className="mt-1 text-xs text-cyan-200">{fileLoading ? "Dosya isleniyor..." : fileInfo || (notesFile ? notesFile.name : "Dosya secilmedi.")}</p>
              {fileError ? <p className="mt-1 text-xs text-rose-300">{fileError}</p> : null}
            </div>

            <div className="md:col-span-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <button onClick={runSingleSimulation} disabled={loading || !task.trim()} className="rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">
                {loading && activeResult === "single" ? "Calisiyor..." : "Tek Rol Simule Et"}
              </button>
              <button onClick={runTeamSimulation} disabled={loading || !task.trim()} className="rounded-xl bg-indigo-500 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60">
                {loading && activeResult === "team" ? "Calisiyor..." : "Ekip Simulasyonu"}
              </button>
              <button type="button" onClick={addNotesToRag} disabled={ragLoading || (!notes.trim() && !notesFile)} className="rounded-xl border border-cyan-300/40 px-3 py-2.5 text-sm text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50">
                {ragLoading ? "Indeksleniyor..." : "Notlari RAG'e Ekle"}
              </button>
            </div>

            <div className="md:col-span-2 rounded-xl border border-cyan-300/25 bg-cyan-950/20 p-3 text-xs text-cyan-100/90">
              {ragStats ? `Toplam dokuman: ${ragStats.documents} | Toplam parca: ${ragStats.chunks}` : "RAG istatistikleri yukleniyor..."}
              {ragMessage ? <div className="mt-1">{ragMessage}</div> : null}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white p-5 text-slate-800 shadow-2xl shadow-black/20">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Cikti Paneli</h2>
            <button onClick={() => navigator.clipboard.writeText(visibleOutput)} disabled={!visibleOutput} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50">
              Kopyala
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {[{ id: "rapor", label: "Rapor" }, { id: "diyagram", label: `Diyagramlar (${diagrams.length})` }, { id: "gorevler", label: "Gorevler" }, { id: "testler", label: "Testler" }].map((tab) => (
              <button key={tab.id} onClick={() => setOutputTab(tab.id as OutputTab)} className={`rounded-lg px-3 py-1.5 text-sm ${outputTab === tab.id ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-100"}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {(singleFallback || teamOutput?.fallbackUsed) && <p className="mb-3 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">Quota veya baglanti sorunu nedeniyle fallback modu kullanildi.</p>}

          <div className="min-h-[74vh] max-h-[86vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-5">{renderOutputTab()}</div>
        </section>
      </div>
    </main>
  );
}
