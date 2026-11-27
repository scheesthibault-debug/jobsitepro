# Copie le site vitrine JobsitePro vers le serveur (Samba / stockage)
# Usage PowerShell :
#   cd <project-dir>
#   .\deployment\sync-site-vers-serveur.ps1

$ErrorActionPreference = "Stop"
$Host_ = "127.0.0.1"
$User = "titi"
$LocalSite = Join-Path $PSScriptRoot "..\site"
$RemoteBase = "/mnt/stockage/chantiertrack-v2/chantiertrack-v2/site"

Write-Host "=== Sync site JobsitePro -> ${User}@${Host_} ===" -ForegroundColor Cyan

if (-not (Test-Path $LocalSite)) {
  throw "Dossier introuvable: $LocalSite"
}

scp -r "$LocalSite\*" "${User}@${Host_}:${RemoteBase}/"

Write-Host ""
Write-Host "OK — site copie sur le serveur." -ForegroundColor Green
Write-Host "Sur le serveur:" -ForegroundColor Yellow
Write-Host "  bash deployment/demarrer-demo-serveur.sh"
Write-Host "  sudo cp deployment/nginx-chantiertrack-stockage.conf /etc/nginx/sites-available/chantiertrack"
Write-Host "  sudo nginx -t && sudo systemctl reload nginx"
