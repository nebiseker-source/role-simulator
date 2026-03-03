# Agent Orchestration Design (MVP -> Pro)

## 1. Ürün Hedefi
Bu sistem tek bir prompt üreticisi değil, rol bazlı bir dijital proje ekibi olarak davranır:
- İş Analisti (BA)
- Product Owner (PO)
- İş Mimarı (SA)
- Data Bilimci (DS)
- Reviewer (Kalite Güvence)

Hedef: Kullanıcının verdiği iş/problem tanımını uçtan uca plan, gereksinim, mimari, veri bilimi yaklaşımı ve kalite kontrol çıktısına dönüştürmek.

## 2. Mimari Yaklaşım
### 2.1 Katmanlar
1. UI Katmanı
- Simülasyon oluşturma
- Rol bazlı çıktı paneli
- Revizyon ve onay akışı

2. Orchestration Katmanı
- Agent sırası ve bağımlılık yönetimi
- Hata/fallback yönetimi
- Durum makinesi (run state)

3. Knowledge Katmanı (RAG)
- Ders notları
- Kurumsal dokümanlar
- Rol bazlı retrieval

4. Execution Katmanı
- LLM çağrıları
- JSON schema doğrulaması
- Çıktı kalite skoru

## 3. Agent Pipeline
Önerilen sıralı akış:
1. BA Agent
- Problem tanımı
- Gereksinimler
- User story + acceptance

2. PO Agent
- MVP sınırı
- Önceliklendirme
- Sprint/release plan

3. SA Agent
- Bileşen mimarisi
- API ve entegrasyon
- NFR kararları

4. DS Agent
- Problem framing
- Veri/özellik/model planı
- İzleme ve deney tasarımı

5. Reviewer Agent
- Çelişki analizi
- Eksik bölüm analizi
- Revizyon önerisi

## 4. Context Contract
Her agent bir "contract" ile çıkış verir:
- `summary`
- `decisions[]`
- `open_questions[]`
- `risks[]`
- `deliverables[]`

Sonraki agent sadece gerekli contract alanlarını alır. Böylece prompt şişmesi ve tutarsızlık azalır.

## 5. Kalite Güvence Kuralları
Her role özgü kontrol:
- Bölüm tamamlığı
- Terminoloji tutarlılığı
- Ölçülebilir KPI varlığı
- Risk + mitigation eşleşmesi
- Diyagram varlığı

Reviewer skorları:
- Completeness (0-100)
- Feasibility (0-100)
- Traceability (0-100)
- Clarity (0-100)

## 6. Hata ve Fallback Stratejisi
429/billing/rate-limit gibi hatalarda:
- Otomatik fallback rapor (template-based)
- `fallback_used=true` işareti
- Kullanıcıya teknik değil, eylem odaklı mesaj

## 7. Güvenlik ve Uyum
- Audit log: kim ne çalıştırdı
- Prompt ve çıktı versiyonlama
- PII maskesi
- Tenant izolasyonu (workspace bazlı)

## 8. Uygulama Fazları
### Faz 1 (Mevcut sprint)
- Team simulation endpoint
- Basic orchestrator
- Role outputs + final synthesis

### Faz 2
- Reviewer agent
- JSON schema output enforcement
- Quality score kartı

### Faz 3
- Queue + async jobs
- RAG + kaynak atfı
- Export + entegrasyonlar (Jira/Confluence)

## 9. Teknik KPI
- İlk simülasyon başarı oranı
- Ortalama run süresi
- Fallback kullanım oranı
- Çıktıdan export oranı
- 7/30 gün retention
