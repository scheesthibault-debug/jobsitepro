# Copie le projet JobsitePro vers le serveur (après copier-coller manuel incomplet)
# Usage:
#   .\deployment\copier-projet-vers-serveur.ps1 -Server "user@127.0.0.1"
#   .\deployment\copier-projet-vers-serveur.ps1 -Server "root@jobsitepro.example.com"

param(
  [Parameter(Mandatory = $true)][string]$Server,
  [string]$RemoteDir = "~/chantiertrack-v2"
)

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$proj = Join-Path $root "chantiertrack-v2"
if (-not (Test-Path $proj)) { $proj = Join-Path $root "chantiertrack-v2\chantiertrack-v2" }
if (-not (Test-Path (Join-Path $proj "patron"))) {
  Write-Error "Dossier patron introuvable. Lancez depuis le bon répertoire."
  exit 1
}

Write-Host "Projet: $proj" -ForegroundColor Cyan
Write-Host "Cible:  ${Server}:${RemoteDir}" -ForegroundColor Cyan

$items = @("patron", "employe", "deployment", "services", "push", "pocketbase")
foreach ($item in $items) {
  $src = Join-Path $proj $item
  if (-not (Test-Path $src)) { Write-Warning "Skip $item"; continue }
  Write-Host "Copie $item ..." -ForegroundColor Yellow
  scp -r $src "${Server}:${RemoteDir}/"
}

Write-Host "`nOK. Sur le serveur SSH :" -ForegroundColor Green
Write-Host "  cd ~/chantiertrack-v2"
Write-Host "  sudo bash deployment/mise-a-jour-jobsitepro.sh"
Write-Host "  sudo bash deployment/configure-gemini-ocr.sh"
Write-Host ""
