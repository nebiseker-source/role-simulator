# Role Simulator

Rol bazlı analiz çıktısı üreten Next.js tabanlı SaaS MVP.

## Özellikler
- Tek rol simülasyonu (`/api/simulate`)
- Team pipeline simülasyonu (`/api/simulate-team`)
- Ders notu yükleme (`PDF`, `DOCX`, `TXT`, `MD`)
- Dosya metin önizleme (`/api/extract-notes`)
- 429 quota durumunda otomatik fallback çıktı

## Çalıştırma
```bash
npm install
npm run dev
```

## Ortam Değişkeni
`.env.local`:
```env
OPENAI_API_KEY=...
```

## Mimari Dokümanları
- [Agent Orchestration Design](./docs/agent-orchestration-design.md)
- [Multi-Agent DB Schema](./docs/db/multi-agent-schema.sql)
- [MVP -> Pro Backlog](./docs/backlog-mvp-to-pro.md)
