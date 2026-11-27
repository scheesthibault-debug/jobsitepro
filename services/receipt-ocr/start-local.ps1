# JobsitePro — lancer le service OCR en local (Windows)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path node_modules)) {
  Write-Host "Installation des dependances npm..."
  npm install
}

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host ""
  Write-Host "Fichier .env cree depuis .env.example"
  Write-Host "OBLIGATOIRE : ouvrez .env et collez votre GOOGLE_AI_API_KEY"
  Write-Host "  https://aistudio.google.com/apikey"
  Write-Host ""
}

$keyLine = Get-Content .env | Where-Object { $_ -match '^GOOGLE_AI_API_KEY=' } | Select-Object -First 1
if (-not $keyLine -or $keyLine -match '^GOOGLE_AI_API_KEY=\s*$') {
  Write-Host "ATTENTION : GOOGLE_AI_API_KEY est vide dans .env — le scan echouera." -ForegroundColor Yellow
}

Write-Host "Demarrage OCR sur http://127.0.0.1:3101 (Ctrl+C pour arreter)"
Write-Host "Test sante : http://127.0.0.1:3101/health"
node server.js
