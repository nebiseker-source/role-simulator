# Role Simulator

Rol bazlı analiz çıktısı üreten Next.js tabanlı SaaS MVP.

## Özellikler
- Tek rol simülasyonu (`/api/simulate`)
- Team pipeline simülasyonu (`/api/simulate-team`)
- Ders notu yükleme (`PDF`, `DOCX`, `TXT`, `MD`)
- Dosya metin önizleme (`/api/extract-notes`)
- 429 quota veya local model erişim hatasında otomatik fallback çıktı

## LLM Provider Seçimi
Bu proje iki sağlayıcıyı destekler:
- `local` (önerilen): Ollama
- `openai`: OpenAI API

### `.env.local` örneği
`.env.example` dosyasını kopyala:
```bash
copy .env.example .env.local
```

Varsayılan local mod:
```env
LLM_PROVIDER=local
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b-instruct
```

OpenAI kullanmak istersen:
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

## Local (Ollama) Kurulum
1. Ollama kur
2. Model indir:
```bash
ollama pull qwen2.5:7b-instruct
```
3. Ollama servisinin çalıştığını kontrol et:
```bash
ollama list
```

## Projeyi Çalıştırma
```bash
npm install
npm run dev
```

## Mimari Dokümanlar
- [Agent Orchestration Design](./docs/agent-orchestration-design.md)
- [Multi-Agent DB Schema](./docs/db/multi-agent-schema.sql)
- [MVP -> Pro Backlog](./docs/backlog-mvp-to-pro.md)
