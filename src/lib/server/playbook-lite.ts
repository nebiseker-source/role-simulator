import { promises as fs } from "node:fs";
import path from "node:path";
import { RoleKey } from "@/lib/roles";

type PlaybookHit = {
  source: string;
  title: string;
  excerpt: string;
  score: number;
};

const PLAYBOOK_DIR = path.join(process.cwd(), "playbooks");

const ROLE_PLAYBOOK_FILE: Record<RoleKey, string> = {
  business_analyst: "is_analisti.md",
  product_manager: "product_manager.md",
  product_owner: "product_owner.md",
  solution_architect: "is_mimari.md",
  data_scientist: "data_bilimci.md",
};

function normalize(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  const stopwords = new Set([
    "ve",
    "ile",
    "için",
    "gibi",
    "olan",
    "olanı",
    "bu",
    "bir",
    "da",
    "de",
    "the",
    "for",
    "and",
    "to",
    "of",
  ]);
  return normalize(text)
    .split(" ")
    .filter((x) => x.length > 2 && !stopwords.has(x));
}

function splitSections(markdown: string): Array<{ title: string; body: string; index: number }> {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const sections: Array<{ title: string; body: string; index: number }> = [];
  let currentTitle = "Genel";
  let buffer: string[] = [];
  let idx = 0;

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      if (buffer.join("").trim()) {
        sections.push({ title: currentTitle, body: buffer.join("\n").trim(), index: idx++ });
      }
      currentTitle = headerMatch[1].trim();
      buffer = [];
      continue;
    }
    buffer.push(line);
  }

  if (buffer.join("").trim()) {
    sections.push({ title: currentTitle, body: buffer.join("\n").trim(), index: idx++ });
  }

  return sections;
}

function scoreSection(sectionText: string, queryTokens: string[]): number {
  if (!queryTokens.length) return 0;
  const text = normalize(sectionText);
  let score = 0;
  for (const t of queryTokens) {
    if (text.includes(t)) score += 1;
  }
  return score;
}

export async function searchRolePlaybook(
  role: RoleKey,
  query: string,
  topK = 3
): Promise<PlaybookHit[]> {
  const file = ROLE_PLAYBOOK_FILE[role];
  const filePath = path.join(PLAYBOOK_DIR, file);
  let markdown = "";
  try {
    markdown = await fs.readFile(filePath, "utf-8");
  } catch {
    return [];
  }

  const tokens = tokenize(query);
  const sections = splitSections(markdown);
  const hits = sections
    .map((s) => ({
      source: file,
      title: s.title,
      excerpt: s.body.slice(0, 900),
      score: scoreSection(`${s.title}\n${s.body}`, tokens),
      index: s.index,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(1, topK))
    .map(({ source, title, excerpt, score }) => ({ source, title, excerpt, score }));

  return hits;
}

export function formatPlaybookContext(hits: PlaybookHit[]): string {
  if (!hits.length) return "";
  return hits
    .map((h, i) => `[Playbook ${i + 1}] ${h.source} > ${h.title}\n${h.excerpt}`)
    .join("\n\n");
}

export function formatPlaybookSources(hits: PlaybookHit[]): string[] {
  return hits.map((h, i) => `Playbook ${i + 1}: ${h.source} > ${h.title}`);
}
