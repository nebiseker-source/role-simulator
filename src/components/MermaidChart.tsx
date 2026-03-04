"use client";

import { useEffect, useMemo, useState } from "react";

type MermaidChartProps = {
  chart: string;
};

export default function MermaidChart({ chart }: MermaidChartProps) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const id = useMemo(
    () => `mermaid-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  useEffect(() => {
    let canceled = false;

    async function renderChart() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            primaryColor: "#68d8ff",
            primaryTextColor: "#0f172a",
            primaryBorderColor: "#0ea5e9",
            lineColor: "#334155",
            secondaryColor: "#c7f9cc",
            tertiaryColor: "#ffd6a5",
            clusterBkg: "#e0f2fe",
            clusterBorder: "#0284c7"
          },
          securityLevel: "loose"
        });

        const { svg: rendered } = await mermaid.render(id, chart);
        if (!canceled) {
          setSvg(rendered);
          setError("");
        }
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "Mermaid diyagramı oluşturulamadı.";
        if (!canceled) {
          setSvg("");
          setError(message);
        }
      }
    }

    setSvg("");
    setError("");
    renderChart();

    return () => {
      canceled = true;
    };
  }, [chart, id]);

  if (error) {
    return <pre className="mermaid-fallback">Diyagram hatası: {error}</pre>;
  }

  if (!svg) {
    return <div className="mermaid-loading">Diyagram çiziliyor...</div>;
  }

  return (
    <div
      className="mermaid-chart"
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label="Mermaid diagram"
    />
  );
}
