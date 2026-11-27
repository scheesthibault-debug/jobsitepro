# Copie la PWA employé vers le serveur
#   .\deployment\sync-employe-vers-serveur.ps1 -Server "user@127.0.0.1"

param(
  [Parameter(Mandatory = $true)][string]$Server,
  [string]$Dest = "/opt/chantiertrack/pb_public/employe"
)

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$employe = Join-Path $root "chantiertrack-v2\employe"
if (-not (Test-Path $employe)) { $employe = Join-Path $root "employe" }

$files = @(
  "index.html", "manifest.json", "sw.js",
  "icon-192.png", "icon-512.png", "apple-touch-icon.png", "logo-banner.png"
)
$dirs = @("js", "css")

Write-Host "Source: $employe" -ForegroundColor Cyan
Write-Host "Cible:  ${Server}:$Dest" -ForegroundColor Cyan

foreach ($f in $files) {
  $p = Join-Path $employe $f
  if (-not (Test-Path $p)) { Write-Warning "Manquant: $f"; continue }
  scp $p "${Server}:${Dest}/"
  if ($LASTEXITCODE -eq 0) { Write-Host "OK $f" -ForegroundColor Green }
}

foreach ($d in $dirs) {
  $src = Join-Path $employe $d
  if (Test-Path $src) {
    scp -r $src "${Server}:${Dest}/"
    Write-Host "OK dossier $d" -ForegroundColor Green
  }
}

Write-Host "`nSur le telephone: fermer l'onglet, rouvrir /employe/ dans Chrome (pas Facebook)." -ForegroundColor Yellow
