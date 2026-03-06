type OllamaHeaders = Record<string, string>;

export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
}

export function getOllamaHeaders(includeJsonContentType = true): OllamaHeaders {
  const headers: OllamaHeaders = {};
  if (includeJsonContentType) {
    headers["Content-Type"] = "application/json";
  }

  // Optional API auth style
  if (process.env.OLLAMA_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
  }

  // Optional shared secret for custom proxy/tunnel gate
  if (process.env.OLLAMA_TUNNEL_KEY) {
    headers["x-ollama-tunnel-key"] = process.env.OLLAMA_TUNNEL_KEY;
  }

  return headers;
}
