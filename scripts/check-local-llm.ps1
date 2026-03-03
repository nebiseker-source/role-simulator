param(
  [string]$Model = "qwen2.5:7b-instruct",
  [string]$BaseUrl = "http://127.0.0.1:11434"
)

$ErrorActionPreference = "Stop"

Write-Host "== Local LLM Kontrolu ==" -ForegroundColor Cyan
Write-Host "Model: $Model"
Write-Host "Base URL: $BaseUrl"
Write-Host ""

function Write-Ok([string]$msg) {
  Write-Host "[OK] $msg" -ForegroundColor Green
}

function Write-WarnMsg([string]$msg) {
  Write-Host "[WARN] $msg" -ForegroundColor Yellow
}

function Write-ErrMsg([string]$msg) {
  Write-Host "[ERR] $msg" -ForegroundColor Red
}

# 1) Ollama CLI var mi?
$ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollamaCmd) {
  Write-ErrMsg "Ollama CLI bulunamadi. Once Ollama kur."
  exit 1
}
Write-Ok "Ollama CLI bulundu: $($ollamaCmd.Source)"

# 2) Ollama servis erisimi var mi?
try {
  $tagsUrl = "$BaseUrl/api/tags"
  $tagsResp = Invoke-RestMethod -Uri $tagsUrl -Method Get -TimeoutSec 5
  Write-Ok "Ollama servisine erisildi."
} catch {
  Write-ErrMsg "Ollama servisine baglanilamadi ($BaseUrl)."
  Write-Host "Oneri: Ayrı bir terminalde 'ollama serve' calistir."
  exit 1
}

# 3) Model mevcut mu?
$models = @()
if ($tagsResp.models) {
  $models = $tagsResp.models | ForEach-Object { $_.name }
}

if ($models -contains $Model) {
  Write-Ok "Model mevcut: $Model"
} else {
  Write-WarnMsg "Model bulunamadi: $Model"
  Write-Host "Indirmek icin: ollama pull $Model"
}

# 4) .env.local kontrolu
$envFile = Join-Path (Get-Location) ".env.local"
if (-not (Test-Path $envFile)) {
  Write-WarnMsg ".env.local bulunamadi."
  Write-Host "Olusturup sunlari ekle:"
  Write-Host "  LLM_PROVIDER=local"
  Write-Host "  OLLAMA_BASE_URL=$BaseUrl"
  Write-Host "  OLLAMA_MODEL=$Model"
  exit 0
}

$content = Get-Content -Raw $envFile
$providerOk = $content -match "(?m)^\s*LLM_PROVIDER\s*=\s*local\s*$"
$baseOk = $content -match ("(?m)^\s*OLLAMA_BASE_URL\s*=\s*" + [regex]::Escape($BaseUrl) + "\s*$")
$modelOk = $content -match ("(?m)^\s*OLLAMA_MODEL\s*=\s*" + [regex]::Escape($Model) + "\s*$")

if ($providerOk) { Write-Ok "LLM_PROVIDER=local" } else { Write-WarnMsg "LLM_PROVIDER=local ayari eksik." }
if ($baseOk) { Write-Ok "OLLAMA_BASE_URL dogru" } else { Write-WarnMsg "OLLAMA_BASE_URL beklenen degerde degil." }
if ($modelOk) { Write-Ok "OLLAMA_MODEL dogru" } else { Write-WarnMsg "OLLAMA_MODEL beklenen degerde degil." }

Write-Host ""
Write-Host "Kontrol tamamlandi." -ForegroundColor Cyan
