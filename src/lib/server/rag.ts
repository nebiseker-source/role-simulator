import { promises as fs } from "node:fs";
import path from "node:path";
import { RoleKey } from "@/lib/roles";

type RagRole = RoleKey | "shared";

type RagChunk = {
  id: string;
  docId: string;
  title: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
  createdAt: string;
  role?: RagRole;
};

type RagIndex = {
  version: 1;
  chunks: RagChunk[];
};

const DATA_DIR = process.env.RAG_DATA_DIR
  ? path.resolve(process.env.RAG_DATA_DIR)
  : process.env.VERCEL
    ? path.join("/tmp", "role-sim-rag")
    : path.join(process.cwd(), "data");
const INDEX_FILE = path.join(DATA_DIR, "rag-index.json");
const DEFAULT_TOP_K = Number(process.env.RAG_TOP_K ?? 5);
const VALID_ROLES = new Set<RoleKey>([
  "business_analyst",
  "product_manager",
  "product_owner",
  "solution_architect",
  "data_scientist",
]);

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeRole(value: string | undefined): RagRole {
  if (!value) return "shared";
  const v = value.trim();
  return VALID_ROLES.has(v as RoleKey) ? (v as RoleKey) : "shared";
}

async function ensureIndex(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(INDEX_FILE);
  } catch {
    const seed: RagIndex = { version: 1, chunks: [] };
    await fs.writeFile(INDEX_FILE, JSON.stringify(seed, null, 2), "utf-8");
  }
}

async function readIndex(): Promise<RagIndex> {
  await ensureIndex();
  const raw = await fs.readFile(INDEX_FILE, "utf-8");
  return JSON.parse(raw) as RagIndex;
}

async function writeIndex(index: RagIndex): Promise<void> {
  await ensureIndex();
  await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");
}

function splitIntoChunks(text: string, chunkSize = 900, overlap = 120): string[] {
  const clean = text.replace(/\r/g, "").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(clean.length, start + chunkSize);
    chunks.push(clean.slice(start, end));
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

async function embedText(text: string): Promise<number[]> {
  const base = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

  const tryNew = await fetch(`${base}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: text
    })
  });

  if (tryNew.ok) {
    const data = (await tryNew.json()) as { embeddings?: number[][] };
    const vec = data.embeddings?.[0];
    if (vec?.length) return vec;
  }

  const tryOld = await fetch(`${base}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: text
    })
  });

  if (!tryOld.ok) {
    const errText = await tryOld.text();
    throw new Error(`Embedding hatası: ${errText}`);
  }

  const oldData = (await tryOld.json()) as { embedding?: number[] };
  if (!oldData.embedding?.length) {
    throw new Error("Embedding vektörü alınamadı.");
  }
  return oldData.embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (!len) return 0;
  let dot = 0;
  let an = 0;
  let bn = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    an += a[i] * a[i];
    bn += b[i] * b[i];
  }
  if (!an || !bn) return 0;
  return dot / (Math.sqrt(an) * Math.sqrt(bn));
}

export async function indexKnowledgeDocument(input: {
  title: string;
  text: string;
  role?: string;
}): Promise<{ docId: string; chunkCount: number }> {
  const docId = uid("doc");
  const chunks = splitIntoChunks(input.text);
  if (!chunks.length) {
    return { docId, chunkCount: 0 };
  }

  const embeddings = await Promise.all(chunks.map((c) => embedText(c)));
  const now = new Date().toISOString();
  const index = await readIndex();
  const role = normalizeRole(input.role);

  const records: RagChunk[] = chunks.map((text, i) => ({
    id: uid("chunk"),
    docId,
    title: input.title || "Untitled",
    chunkIndex: i,
    text,
    embedding: embeddings[i],
    createdAt: now,
    role,
  }));

  index.chunks.push(...records);
  await writeIndex(index);
  return { docId, chunkCount: records.length };
}

export async function searchKnowledge(
  query: string,
  topK = DEFAULT_TOP_K,
  roleFilter?: string
): Promise<RagChunk[]> {
  const q = query.trim();
  if (!q) return [];
  const index = await readIndex();
  if (!index.chunks.length) return [];
  const role = normalizeRole(roleFilter);
  const byRole = index.chunks.filter((chunk) => {
    const chunkRole = chunk.role ?? "shared";
    return role === "shared" ? true : chunkRole === role || chunkRole === "shared";
  });
  const candidates = byRole.length ? byRole : index.chunks;
  const qEmb = await embedText(q);
  const scored = candidates.map((chunk) => ({
    chunk,
    score: cosineSimilarity(qEmb, chunk.embedding)
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, topK)).map((x) => x.chunk);
}

export async function formatRagContext(
  query: string,
  topK = DEFAULT_TOP_K,
  roleFilter?: string
): Promise<string> {
  try {
    const hits = await searchKnowledge(query, topK, roleFilter);
    if (!hits.length) return "";
    return hits
      .map(
        (h, i) =>
          `[Kaynak ${i + 1}] ${h.title} (parca ${h.chunkIndex + 1}, rol: ${h.role ?? "shared"})\n${h.text}`
      )
      .join("\n\n");
  } catch {
    return "";
  }
}

export async function getRagStats(): Promise<{ documents: number; chunks: number }> {
  const index = await readIndex();
  const docSet = new Set(index.chunks.map((x) => x.docId));
  return { documents: docSet.size, chunks: index.chunks.length };
}
