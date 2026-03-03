"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

  useEffect(() => {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return;
    try {
      setHistory(JSON.parse(raw) as NotesHistoryItem[]);
    } catch {
      setHistory([]);
    }
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
      createdAt: new Date().toLocaleString("tr-TR")
    };
    persistHistory([item, ...history].slice(0, MAX_HISTORY));
  }

  function loadHistoryItem(id: string) {
    const found = history.find((x) => x.id === id);
    if (found) setNotes(found.notes);
  }

  function removeHistoryItem(id: string) {
    persistHistory(history.filter((x) => x.id !== id));
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
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "Dosya işlenemedi");

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
    setSingleFallback(false);
    try {
      const r = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, task, notes, fileNotes })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "API hatası");
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
    try {
      const r = await fetch("/api/simulate-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, notes: [notes, fileNotes].filter(Boolean).join("\n\n") })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "API hatası");
      setTeamOutput(data as TeamResult);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bilinmeyen hata";
      setTeamOutput({
        steps: [],
        finalSynthesis: `**Hata:** ${message}`,
        fallbackUsed: false
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8 md:py-10">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-700 via-sky-700 to-indigo-700 p-6 md:p-8">
          <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -left-12 -bottom-16 h-44 w-44 rounded-full bg-teal-300/20 blur-3xl" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/90">Business AI Studio</p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Role-Based Analist Simülatörü</h1>
            <p className="mt-3 max-w-3xl text-sm text-sky-100/90 md:text-base">
              Tek rol veya ekip (BA → PO → İş Mimarı → Data Bilimci) simülasyonu çalıştırabilirsin.
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-black/20 backdrop-blur">
            <h2 className="text-lg font-semibold">Simülasyon Girişi</h2>
            <div className="mt-5 space-y-4">
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

              <div>
                <label className="mb-2 block text-sm font-medium">İş / Problem Tanımı</label>
                <textarea
                  className="min-h-[150px] w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 outline-none ring-cyan-400 transition focus:ring-2"
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  placeholder="Örn: Sefer iptali durumunda kullanıcıya otomatik bilgilendirme ve alternatif sefer önerisi akışı tasarla."
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium">Ders Notları (Metin)</label>
                  <button
                    type="button"
                    onClick={saveCurrentNotes}
                    className="rounded-lg border border-cyan-300/40 px-2.5 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10"
                  >
                    Notları Kaydet
                  </button>
                </div>
                <textarea
                  className="min-h-[100px] w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 outline-none ring-cyan-400 transition focus:ring-2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Bulanık modelleme, optimizasyon teknikleri, kurum içi BA standartları..."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Ders Notu Dosyası (PDF/Word/TXT/MD)</label>
                <input
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={(e) => handleNotesFile(e.target.files?.[0] ?? null)}
                  className="block w-full cursor-pointer rounded-xl border border-dashed border-cyan-300/40 bg-slate-950 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-1.5 file:text-white hover:border-cyan-300/70"
                />
                <p className="mt-1 text-xs text-slate-400">Limit: en fazla 8 MB, PDF için en fazla 40 sayfa.</p>
                <p className="mt-1 text-xs text-cyan-200">
                  {fileLoading ? "Dosya işleniyor..." : fileInfo || (notesFile ? notesFile.name : "Dosya seçilmedi.")}
                </p>
                {fileError ? <p className="mt-1 text-xs text-rose-300">{fileError}</p> : null}
              </div>

              {fileNotes ? (
                <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                  <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">Dosyadan Çıkan Not Önizleme</div>
                  <pre className="max-h-36 overflow-auto whitespace-pre-wrap text-xs text-slate-200">{fileNotes}</pre>
                </div>
              ) : null}

              {history.length ? (
                <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                  <div className="mb-2 text-xs uppercase tracking-wider text-slate-400">Not Geçmişi</div>
                  <div className="space-y-2">
                    {history.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg border border-white/10 p-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-cyan-200">{item.title}</p>
                          <p className="text-[11px] text-slate-400">{item.createdAt}</p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => loadHistoryItem(item.id)}
                            className="rounded-md border border-cyan-300/40 px-2 py-1 text-[11px] text-cyan-200"
                          >
                            Yükle
                          </button>
                          <button
                            type="button"
                            onClick={() => removeHistoryItem(item.id)}
                            className="rounded-md border border-rose-300/40 px-2 py-1 text-[11px] text-rose-200"
                          >
                            Sil
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
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
                  {loading && activeResult === "team" ? "Çalışıyor..." : "Ekip Simülasyonu Çalıştır"}
                </button>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white p-5 text-slate-800 shadow-2xl shadow-black/20">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Çıktı</h2>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(
                    activeResult === "team" ? teamOutput?.finalSynthesis ?? "" : singleOutput
                  )
                }
                disabled={activeResult === "team" ? !teamOutput?.finalSynthesis : !singleOutput}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
              >
                Kopyala
              </button>
            </div>

            {activeResult === "single" ? (
              <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 prose prose-slate max-w-none">
                {singleFallback ? (
                  <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
                    Quota nedeniyle fallback modu kullanıldı.
                  </p>
                ) : null}
                {singleOutput ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{singleOutput}</ReactMarkdown>
                ) : (
                  <p className="text-slate-500">Henüz tek rol çıktısı yok.</p>
                )}
              </div>
            ) : null}

            {activeResult === "team" ? (
              <div className="space-y-3 max-h-[70vh] overflow-auto">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 prose prose-slate max-w-none">
                  {teamOutput?.fallbackUsed ? (
                    <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
                      Ekip simülasyonunda bazı adımlarda fallback modu kullanıldı.
                    </p>
                  ) : null}
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {teamOutput?.finalSynthesis ?? "Henüz ekip çıktısı yok."}
                  </ReactMarkdown>
                </div>
                {teamOutput?.steps.map((step) => (
                  <details key={step.role} className="rounded-xl border border-slate-200 bg-white p-3">
                    <summary className="cursor-pointer font-semibold">
                      {ROLE_LABELS[step.role]} {step.fallbackUsed ? "(fallback)" : ""}
                    </summary>
                    <div className="mt-3 prose prose-slate max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.output}</ReactMarkdown>
                    </div>
                  </details>
                ))}
              </div>
            ) : null}

            {!activeResult ? <p className="text-slate-500">Henüz çıktı yok. Soldan simülasyon başlat.</p> : null}
          </article>
        </section>
      </div>
    </main>
  );
}
