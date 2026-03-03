"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ROLE_LABELS, RoleKey } from "@/lib/roles";

export default function Home() {
  const roles = useMemo(() => Object.keys(ROLE_LABELS) as RoleKey[], []);
  const [role, setRole] = useState<RoleKey>("business_analyst");
  const [task, setTask] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  async function simulate() {
    setLoading(true);
    setOutput("");
    try {
      const r = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, task })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "API error");
      setOutput(data.output);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bilinmeyen hata";
      setOutput(`**Hata:** ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-black text-white grid place-items-center font-semibold">
              RS
            </div>
            <div>
              <div className="text-sm text-zinc-500">Role Simulator</div>
              <h1 className="text-lg font-semibold leading-tight">
                Role-Based Analyst Simulator
              </h1>
            </div>
          </div>

          <a
            className="text-sm text-zinc-600 hover:text-black"
            href="https://localhost:3000"
            onClick={(e) => e.preventDefault()}
          >
            MVP v0.1
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-base font-semibold">Gorev Tanimla</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Bir problem yaz, rol sec ve ciktiyi role uygun formatta uret.
            </p>
          </div>

          <div className="p-6 grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Rol</label>
              <select
                className="border rounded-xl px-3 py-2 bg-white"
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

            <div className="grid gap-2">
              <label className="text-sm font-medium">Is / Problem Tanimi</label>
              <textarea
                className="border rounded-xl px-3 py-2 min-h-[180px] bg-white"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Orn: Sefer iptalinde kullaniciya otomatik bilgilendirme ve alternatif sefer onerisi..."
              />
              <div className="text-xs text-zinc-500 flex justify-between">
                <span>Ipucu: Kapsami, hedefi ve kisitlari yaz.</span>
                <span>{task.length} karakter</span>
              </div>
            </div>

            <button
              onClick={simulate}
              disabled={loading || !task.trim()}
              className="rounded-xl bg-black text-white px-4 py-2.5 font-medium disabled:opacity-50"
            >
              {loading ? "Simulasyon hazirlaniyor..." : "Simule Et"}
            </button>

            <div className="rounded-xl bg-zinc-50 border p-4 text-sm text-zinc-600">
              <div className="font-medium text-zinc-800 mb-1">Not</div>
              <div>
                Eger &quot;429 quota&quot; goruyorsan, Billing/Credit eklemen
                gerekir.
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="p-6 border-b flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Cikti</h2>
              <p className="text-sm text-zinc-500 mt-1">
                Markdown olarak goruntulenir.
              </p>
            </div>
            <button
              className="text-sm rounded-xl border px-3 py-2 hover:bg-zinc-50"
              onClick={() => navigator.clipboard.writeText(output || "")}
              disabled={!output}
            >
              Kopyala
            </button>
          </div>

          <div className="p-6 prose prose-zinc max-w-none">
            {output ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
            ) : (
              <p className="text-zinc-500">Henuz cikti yok. Soldan bir gorev gir.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
