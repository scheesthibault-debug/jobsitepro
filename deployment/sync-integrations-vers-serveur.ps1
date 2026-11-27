# Copie integrations-hub + hooks QB vers le serveur
# Usage:
#   cd <project-dir>
#   .\deployment\sync-integrations-vers-serveur.ps1

$ErrorActionPreference = "Stop"
$Host_ = "127.0.0.1"
$User = "titi"
$Remote = "/mnt/stockage/chantiertrack-v2/chantiertrack-v2"
$Local = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (Test-Path (Join-Path $Local "chantiertrack-v2\services\integrations-hub")) {
  $Local = Join-Path $Local "chantiertrack-v2"
}

Write-Host "=== Sync QuickBooks (integrations-hub + hooks) ===" -ForegroundColor Cyan

$hub = Join-Path $Local "services\integrations-hub"
if (-not (Test-Path $hub)) { throw "Introuvable: $hub" }

scp -r "$hub" "${User}@${Host_}:${Remote}/services/"

$hooks = @(
  "pocketbase\pb_hooks\oauth_connectors.pb.js",
  "pocketbase\pb_hooks\qb_document_router.pb.js",
  "pocketbase\integration_collections.json",
  "deployment\install-integrations-hub-user.sh",
  "deployment\install-qb-hooks.sh",
  "deployment\nginx-chantiertrack-stockage.conf",
  "deployment\DEPLOIEMENT-QUICKBOOKS.md",
  "deployment\demarrer-demo-serveur.sh"
)

foreach ($f in $hooks) {
  $p = Join-Path $Local $f
  if (-not (Test-Path $p)) { Write-Warning "Manquant: $f"; continue }
  $dir = Split-Path $f -Parent
  ssh "${User}@${Host_}" "mkdir -p ${Remote}/$($dir -replace '\\','/')"
  scp $p "${User}@${Host_}:${Remote}/$($f -replace '\\','/')"
  Write-Host "OK $f" -ForegroundColor Green
}

# Patron modules QB
$patronJs = @(
  "patron\js\integrations\connectors-panel.js",
  "patron\js\integrations\integrations-api.js",
  "patron\js\knowify\quickbooks-module.js",
  "patron\js\integrations\qb-document-router.js"
)
foreach ($f in $patronJs) {
  $p = Join-Path $Local $f
  if (Test-Path $p) {
    scp $p "${User}@${Host_}:${Remote}/$($f -replace '\\','/')"
    Write-Host "OK $f" -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "Sur le serveur:" -ForegroundColor Yellow
Write-Host "  bash deployment/install-qb-hooks.sh"
Write-Host "  nano services/integrations-hub/.env"
Write-Host "  bash deployment/install-integrations-hub-user.sh"
Write-Host "  sudo cp deployment/nginx-chantiertrack-stockage.conf /etc/nginx/sites-available/chantiertrack"
Write-Host "  sudo nginx -t && sudo systemctl reload nginx"
