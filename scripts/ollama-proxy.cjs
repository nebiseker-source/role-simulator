/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("http");

const LISTEN_PORT = Number(process.env.OLLAMA_PROXY_PORT || 11435);
const TARGET_BASE = (process.env.OLLAMA_TARGET_BASE || "http://127.0.0.1:11434").replace(/\/+$/, "");
const TUNNEL_KEY = process.env.OLLAMA_TUNNEL_KEY || "";

const ALLOWED_PATHS = new Set([
  "/api/chat",
  "/api/embed",
  "/api/embeddings",
  "/api/tags",
]);

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${LISTEN_PORT}`);

    if (url.pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        target: TARGET_BASE,
        auth: Boolean(TUNNEL_KEY),
      });
    }

    if (!ALLOWED_PATHS.has(url.pathname)) {
      return sendJson(res, 404, { error: "path_not_allowed" });
    }

    if (TUNNEL_KEY) {
      const got = req.headers["x-ollama-tunnel-key"];
      if (got !== TUNNEL_KEY) {
        return sendJson(res, 401, { error: "unauthorized" });
      }
    }

    const body = await readBody(req);
    const upstream = await fetch(`${TARGET_BASE}${url.pathname}${url.search}`, {
      method: req.method,
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
      },
      body: body.length ? body : undefined,
    });

    const text = await upstream.text();
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    });
    res.end(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : "proxy_error";
    sendJson(res, 500, { error: message });
  }
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`[ollama-proxy] listening on http://127.0.0.1:${LISTEN_PORT}`);
  console.log(`[ollama-proxy] target: ${TARGET_BASE}`);
  console.log(`[ollama-proxy] tunnel key enabled: ${Boolean(TUNNEL_KEY)}`);
});
