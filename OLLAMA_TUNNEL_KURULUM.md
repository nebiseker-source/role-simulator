# Ollama Tunnel Kurulum (Vercel -> Local)

Bu dosya, Vercel uzerindeki uygulamanin senin bilgisayarinda calisan Ollama'ya guvenli sekilde baglanmasi icindir.

## 1) Yerel Proxy'yi Baslat

Proje klasorunde:

```powershell
cd C:\Users\Nebi\Documents\Projects\businessanalyst\role-sim
$env:OLLAMA_TARGET_BASE="http://127.0.0.1:11434"
$env:OLLAMA_PROXY_PORT="11435"
$env:OLLAMA_TUNNEL_KEY="GUCLU_BIR_GIZLI_ANAHTAR"
npm run ollama:proxy
```

Saglik kontrol:

```powershell
curl http://127.0.0.1:11435/health
```

## 2) Tunnel Ac (Ngrok veya LocalTunnel)

### Secenek A: ngrok (onerilen)

```powershell
ngrok http 11435
```

Ngrok sana bir HTTPS URL verir (ornek: `https://abc123.ngrok-free.app`).

### Secenek B: localtunnel

```powershell
npx localtunnel --port 11435
```

## 3) Vercel Env Degiskenleri

Vercel Project Settings -> Environment Variables:

- `LLM_PROVIDER=local`
- `OLLAMA_BASE_URL=https://<tunnel-url>`
- `OLLAMA_MODEL=qwen2.5:7b-instruct`
- `OLLAMA_EMBED_MODEL=nomic-embed-text`
- `OLLAMA_TUNNEL_KEY=GUCLU_BIR_GIZLI_ANAHTAR`

Not:
- `OLLAMA_TUNNEL_KEY`, proxyde ve Vercel'de ayni olmali.
- Key kullanmadan tunnel acma (herkese acik olur).

## 4) Test

1. Ollama acik:
   - `ollama serve`
2. Proxy acik:
   - `npm run ollama:proxy`
3. Tunnel acik:
   - `ngrok http 11435`
4. Vercel'de `Redeploy` yap.
5. Uygulamada tek rol simulasyonu calistir.

## 5) Guvenlik Notlari

- Tunnel URL'yi acik paylasma.
- `OLLAMA_TUNNEL_KEY` anahtarini duzenli degistir.
- Isin bitince ngrok/localtunnel ve proxy prosesini kapat.
