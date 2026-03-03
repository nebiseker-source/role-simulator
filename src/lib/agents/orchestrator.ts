import { buildSystemPrompt, RoleKey } from "@/lib/roles";
import {
  AgentStepResult,
  TEAM_SEQUENCE,
  TeamSimulationInput,
  TeamSimulationOutput
} from "@/lib/agents/types";
import {
  callLlm,
  isLocalConnectionError,
  isQuotaLikeError
} from "@/lib/server/llm";
import { formatRagContext } from "@/lib/server/rag";

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
    "> Uyarı: Bu çıktı model çağrısı başarısız olduğu için fallback modunda üretilmiştir.",
    "",
    "### Problem",
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
  const ragContext = await formatRagContext([task, notes].filter(Boolean).join("\n\n"));
  const notesWithRag = [notes, ragContext].filter(Boolean).join("\n\n");
  const stepResults: AgentStepResult[] = [];
  let anyFallback = false;

  for (const role of TEAM_SEQUENCE) {
    const system = buildSystemPrompt(role);
    const user = buildStepUserPrompt(role, task, notesWithRag, stepResults);

    try {
      const result = await callLlm({
        system,
        user,
        temperature: 0.3
      });
      stepResults.push({
        role,
        output: result.text || buildFallback(role, task),
        fallbackUsed: !result.text
      });
      anyFallback = anyFallback || !result.text;
    } catch (err: unknown) {
      const shouldFallback = isQuotaLikeError(err) || isLocalConnectionError(err);
      if (!shouldFallback) {
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
