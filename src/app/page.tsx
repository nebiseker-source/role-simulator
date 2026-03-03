"use client";

import { useMemo, useState } from "react";
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
      setOutput(`Hata: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">
          Role-Based Analyst Simulator (MVP)
        </h1>

        <div className="grid gap-3">
          <label className="text-sm font-medium">Rol</label>
          <select
            className="border rounded px-3 py-2"
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

        <div className="grid gap-3">
          <label className="text-sm font-medium">Is / Problem Tanimi</label>
          <textarea
            className="border rounded px-3 py-2 min-h-[140px]"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Orn: Bilet iade surecini dijitallestir, kullaniciya self-service iade ekrani tasarla..."
          />
        </div>

        <button
          onClick={simulate}
          disabled={loading || !task.trim()}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Simule ediliyor..." : "Simule Et"}
        </button>

        <div className="grid gap-3">
          <label className="text-sm font-medium">Cikti</label>
          <pre className="border rounded p-4 whitespace-pre-wrap">
            {output || "—"}
          </pre>
        </div>
      </div>
    </main>
  );
}
