import OpenAI from "openai";
import { buildSystemPrompt, RoleKey } from "@/lib/roles";
import {
  AgentStepResult,
  TEAM_SEQUENCE,
  TeamSimulationInput,
  TeamSimulationOutput
} from "@/lib/agents/types";

const modelName = "gpt-4.1-mini";

function isQuotaLikeError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    status === 429 ||
    message.includes("429") ||
    message.includes("quota") ||
    message.includes("billing") ||
    message.includes("insufficient")
  );
}

function roleTitle(role: RoleKey): string {
  switch (role) {
    case "business_analyst":
      return "İş Analisti";
    case "product_owner":
      return "Product Owner";
    case "solution_architect":
      return "İş Mimarı";
    case "data_scientist":
      return "Data Bilimci";
  }
}

function buildFallback(role: RoleKey, task: string): string {
  return [
    `## ${roleTitle(role)} Fallback Çıktısı`,
    "> Uyarı: Bu çıktı OpenAI quota/billing hatası nedeniyle fallback modunda üretilmiştir.",
    "",
    `### Problem`,
    task,
    "",
    "### Plan",
    "- Mevcut durum analizi",
    "- Hedef durum tanımı",
    "- Önceliklendirilmiş aksiyonlar",
    "- Risk azaltım planı",
    "",
    "```mermaid",
    "flowchart TD",
    "A[Problem] --> B[Analiz]",
    "B --> C[Plan]",
    "C --> D[Uygulama]",
    "```"
  ].join("\n");
}

function buildStepUserPrompt(
  role: RoleKey,
  task: string,
  notes: string,
  previousOutputs: AgentStepResult[]
): string {
  const previousContext = previousOutputs.length
    ? previousOutputs
        .map(
          (x) =>
            `### ${roleTitle(x.role)} Çıktısı\n${x.output.slice(0, 2500)}`
        )
        .join("\n\n")
    : "Önceki adım çıktısı yok.";

  return [
    `İŞ: ${task}`,
    "",
    notes ? `REFERANS NOTLAR:\n${notes}` : "REFERANS NOTLAR: yok",
    "",
    "ÖNCEKİ ADIM ÖZETLERİ:",
    previousContext,
    "",
    `Bu adımda sadece ${roleTitle(role)} bakış açısından çıktı üret.`,
    "Çıktı dili: Türkçe, format: Markdown."
  ].join("\n");
}

function buildSynthesis(stepResults: AgentStepResult[]): string {
  const sections = stepResults
    .map((x) => `## ${roleTitle(x.role)}\n${x.output}`)
    .join("\n\n");
  return [
    "# Team Simulation Final Raporu",
    "",
    sections,
    "",
    "## Birleşik Aksiyon Listesi",
    "- Gereksinim ve kapsamı netleştir",
    "- MVP ve sprint planını kilitle",
    "- Mimari ve NFR kararlarını onayla",
    "- Veri/model izleme planını başlat"
  ].join("\n");
}

export async function runTeamSimulation(
  input: TeamSimulationInput
): Promise<TeamSimulationOutput> {
  const notes = (input.notes ?? "").trim();
  const task = input.task.trim();
  const stepResults: AgentStepResult[] = [];
  let anyFallback = false;

  if (!process.env.OPENAI_API_KEY) {
    const fallbackSteps = TEAM_SEQUENCE.map((role) => {
      const output = buildFallback(role, task);
      return { role, output, fallbackUsed: true };
    });
    return {
      steps: fallbackSteps,
      finalSynthesis: buildSynthesis(fallbackSteps),
      fallbackUsed: true
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  for (const role of TEAM_SEQUENCE) {
    const system = buildSystemPrompt(role);
    const user = buildStepUserPrompt(role, task, notes, stepResults);

    try {
      const resp = await client.chat.completions.create({
        model: modelName,
        temperature: 0.3,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      });
      const output = resp.choices?.[0]?.message?.content?.trim() ?? "";
      stepResults.push({
        role,
        output: output || buildFallback(role, task),
        fallbackUsed: !output
      });
      anyFallback = anyFallback || !output;
    } catch (err: unknown) {
      if (!isQuotaLikeError(err)) {
        throw err;
      }
      anyFallback = true;
      stepResults.push({
        role,
        output: buildFallback(role, task),
        fallbackUsed: true
      });
    }
  }

  return {
    steps: stepResults,
    finalSynthesis: buildSynthesis(stepResults),
    fallbackUsed: anyFallback
  };
}
