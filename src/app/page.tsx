"use client";

import { useMemo, useRef, useState } from "react";
import { ROLE_LABELS, RoleKey } from "@/lib/roles";
import MarkdownOutput from "@/components/MarkdownOutput";

const ROLE_HINTS: Record<RoleKey, string> = {
  business_analyst:
    "Gereksinim, stakeholder, user story ve surec odakli cikti.",
  product_owner: "MVP, backlog, onceliklendirme ve release plan odakli cikti.",
  solution_architect:
    "Mimari bilesenler, API taslagi, entegrasyon ve trade-off odakli cikti.",
  data_scientist:
    "Problem framing, veri ihtiyaci, modelleme ve deney tasarimi odakli cikti."
};

export default function Home() {
  const roles = useMemo(() => Object.keys(ROLE_LABELS) as RoleKey[], []);
  const [role, setRole] = useState<RoleKey>("business_analyst");
  const [task, setTask] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [output, setOutput] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

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

  async function exportPdf() {
    if (!outputRef.current || !output.trim()) return;
    setExporting(true);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf")
      ]);

      const canvas = await html2canvas(outputRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true
      });

      const pdf = new jsPDF("p", "pt", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const usableWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * usableWidth) / canvas.width;
      const imgData = canvas.toDataURL("image/png");

      let remainingHeight = imgHeight;
      let position = margin;

      pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight);
      remainingHeight -= pageHeight - margin * 2;

      while (remainingHeight > 0) {
        pdf.addPage();
        position = margin - (imgHeight - remainingHeight);
        pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight);
        remainingHeight -= pageHeight - margin * 2;
      }

      pdf.save(`role-simulation-${role}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero reveal">
        <p className="eyebrow">AI Team Simulation</p>
        <h1>Role-Based Analyst Studio</h1>
        <p className="hero-copy">
          Isi ver, rolu sec, yapilandirilmis analiz ciktisini tek panelde al.
          Bu arayuz MVP icin hizli, SaaS icin olceklenebilir bir iskelet sunar.
        </p>
        <div className="hero-tags">
          <span>BA</span>
          <span>PO</span>
          <span>Architect</span>
          <span>Data Scientist</span>
        </div>
      </section>

      <section className="layout-grid">
        <article className="panel reveal" style={{ animationDelay: "80ms" }}>
          <h2>Simulasyon Kontrol Paneli</h2>

          <label htmlFor="role">Rol</label>
          <select
            id="role"
            className="field"
            value={role}
            onChange={(e) => setRole(e.target.value as RoleKey)}
          >
            {roles.map((k) => (
              <option key={k} value={k}>
                {ROLE_LABELS[k]}
              </option>
            ))}
          </select>
          <p className="hint">{ROLE_HINTS[role]}</p>

          <div className="role-pills">
            {roles.map((k) => (
              <button
                key={k}
                type="button"
                className={k === role ? "pill active" : "pill"}
                onClick={() => setRole(k)}
              >
                {ROLE_LABELS[k]}
              </button>
            ))}
          </div>

          <label htmlFor="task">Is / Problem Tanimi</label>
          <textarea
            id="task"
            className="field textarea"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Ornek: Otobus bileti iptal olan kullaniciya otomatik bildirim ve alternatif sefer onerisi akisi tasarla."
          />

          <button
            onClick={simulate}
            disabled={loading || !task.trim()}
            className="primary-btn"
          >
            {loading ? "Simule ediliyor..." : "Simule Et"}
          </button>
        </article>

        <article className="panel reveal" style={{ animationDelay: "140ms" }}>
          <div className="output-head">
            <h2>Cikti</h2>
            <div className="output-actions">
              <span className="badge">{ROLE_LABELS[role]}</span>
              <button
                type="button"
                className="ghost-btn"
                disabled={exporting || !output.trim()}
                onClick={exportPdf}
              >
                {exporting ? "PDF hazirlaniyor..." : "PDF indir"}
              </button>
            </div>
          </div>
          <div className="output-box" ref={outputRef}>
            {output ? <MarkdownOutput content={output} /> : "-"}
          </div>
        </article>
      </section>
    </main>
  );
}
