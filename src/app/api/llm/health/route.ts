import { NextResponse } from "next/server";
import { getLlmProvider } from "@/lib/server/llm";
import { getOllamaBaseUrl, getOllamaHeaders } from "@/lib/server/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const provider = getLlmProvider();

  if (provider === "openai") {
    return NextResponse.json({
      ok: Boolean(process.env.OPENAI_API_KEY),
      provider,
      detail: process.env.OPENAI_API_KEY
        ? "OPENAI_API_KEY bulundu."
        : "OPENAI_API_KEY eksik.",
    });
  }

  const baseUrl = getOllamaBaseUrl();
  const model = process.env.OLLAMA_MODEL ?? "qwen2.5:7b-instruct";
  const embedModel = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

  try {
    const resp = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      headers: getOllamaHeaders(false),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        {
          ok: false,
          provider,
          detail: `Ollama /api/tags hatası (${resp.status}): ${text.slice(0, 200)}`,
          baseUrl,
          model,
          embedModel,
        },
        { status: 200 }
      );
    }

    const data = (await resp.json()) as {
      models?: Array<{ name?: string; model?: string }>;
    };
    const names = (data.models ?? [])
      .map((m) => m.name || m.model || "")
      .filter(Boolean);

    const hasMain = names.some((n) => n.startsWith(model));
    const hasEmbed = names.some((n) => n.startsWith(embedModel));

    return NextResponse.json({
      ok: hasMain && hasEmbed,
      provider,
      detail:
        hasMain && hasEmbed
          ? "Ollama erişilebilir, modeller hazır."
          : "Ollama erişilebilir ama model/embedding modeli eksik.",
      baseUrl,
      model,
      embedModel,
      hasMainModel: hasMain,
      hasEmbedModel: hasEmbed,
      models: names.slice(0, 30),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen bağlantı hatası";
    return NextResponse.json(
      {
        ok: false,
        provider,
        detail: message,
        baseUrl,
        model,
        embedModel,
      },
      { status: 200 }
    );
  }
}

