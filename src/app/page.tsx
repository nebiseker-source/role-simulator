"use client";

import { useMemo, useState } from "react";
import MarkdownOutput from "@/components/MarkdownOutput";
import { ROLE_LABELS, RoleKey } from "@/lib/roles";

async function readJsonSafely(response: Response): Promise<Record<string, unknown>> {
  const raw = await response.text();
  const endpoint = response.url ? new URL(response.url).pathname : "API";
  if (!raw) {
    throw new Error(`${endpoint} boş yanıt döndürdü (HTTP ${response.status}).`);
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`${endpoint} JSON dışı yanıt döndürdü (HTTP ${response.status}).`);
  }
}

export default function Home() {
  const roles = useMemo(() => Object.keys(ROLE_LABELS) as RoleKey[], []);
  const [role, setRole] = useState<RoleKey>("business_analyst");
  const [task, setTask] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  async function runSingleSimulation() {
    setLoading(true);
    setOutput("");
    try {
      const r = await fetch("/api/simulate-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, task, notes }),
      });
      const data = await readJsonSafely(r);
      if (!r.ok) throw new Error(String(data.error ?? "API hatası"));
      setOutput(String(data.output ?? ""));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bilinmeyen hata";
      setOutput(`**Hata:** ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8 md:py-10">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-700 via-cyan-700 to-blue-700 p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/90">Business AI Studio</p>
          <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Role-Based Analist Simülatörü</h1>
          <p className="mt-3 max-w-4xl text-sm text-sky-100/90 md:text-base">
            Rol bazlı çıktı üretimi için stabil demo akışı.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold">Simülasyon Girişi</h2>
          <div className="mt-4 grid gap-4">
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

            <div>
              <label className="mb-2 block text-sm font-medium">İş / Problem Tanımı</label>
              <textarea
                className="min-h-[120px] w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Örn: Sefer iptalinde müşteriyi otomatik bilgilendirme akışı"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Ders Notları</label>
              <textarea
                className="min-h-[100px] w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Referans notlarını buraya ekle"
              />
            </div>

            <button
              onClick={runSingleSimulation}
              disabled={loading || !task.trim()}
              className="rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
            >
              {loading ? "Çalışıyor..." : "Tek Rol Simüle Et"}
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white p-5 text-slate-800">
          <h2 className="mb-4 text-lg font-semibold">Çıktı</h2>
          <div className="min-h-[60vh] rounded-xl border border-slate-200 bg-slate-50 p-5">
            {output ? <MarkdownOutput content={output} /> : <p className="text-slate-500">Henüz çıktı yok.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
