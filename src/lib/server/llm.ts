import OpenAI from "openai";

export type LlmProvider = "local" | "openai";

type LlmCallInput = {
  system: string;
  user: string;
  temperature?: number;
};

type LlmCallOutput = {
  text: string;
  provider: LlmProvider;
};

export function getLlmProvider(): LlmProvider {
  const raw = (process.env.LLM_PROVIDER ?? "local").toLowerCase();
  return raw === "openai" ? "openai" : "local";
}

export function isQuotaLikeError(err: unknown): boolean {
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

export function isLocalConnectionError(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    message.includes("econnrefused") ||
    message.includes("fetch failed") ||
    message.includes("connect") ||
    message.includes("ollama")
  );
}

async function callOpenAI(input: LlmCallInput): Promise<LlmCallOutput> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY eksik");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const resp = await client.chat.completions.create({
    model,
    temperature: input.temperature ?? 0.4,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user }
    ]
  });

  return {
    text: resp.choices?.[0]?.message?.content?.trim() ?? "",
    provider: "openai"
  };
}

async function callLocalOllama(input: LlmCallInput): Promise<LlmCallOutput> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL ?? "qwen2.5:7b-instruct";

  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user }
      ],
      options: {
        temperature: input.temperature ?? 0.4
      }
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Ollama hatası (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as {
    message?: { content?: string };
  };

  return {
    text: data.message?.content?.trim() ?? "",
    provider: "local"
  };
}

export async function callLlm(input: LlmCallInput): Promise<LlmCallOutput> {
  const provider = getLlmProvider();
  if (provider === "openai") {
    return callOpenAI(input);
  }
  return callLocalOllama(input);
}
