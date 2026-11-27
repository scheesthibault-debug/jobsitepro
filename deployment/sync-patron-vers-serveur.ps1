# Copie la PWA patron (JobsitePro) vers le serveur — à lancer depuis chantiertrack-v2\
# Exemple VPS :
#   .\deployment\sync-patron-vers-serveur.ps1 -Server "root@jobsitepro.example.com"
# Exemple LAN (titi) :
#   .\deployment\sync-patron-vers-serveur.ps1 -Server "user@127.0.0.1"

param(
  [Parameter(Mandatory = $true)][string]$Server,
  [string]$Dest = "/opt/chantiertrack/pb_public/patron"
)

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$patron = Join-Path $root "chantiertrack-v2\patron"
if (-not (Test-Path $patron)) { $patron = Join-Path $root "patron" }

$files = @(
  "index.html", "manifest.json", "sw.js",
  "icon-192.png", "icon-512.png", "apple-touch-icon.png", "logo-banner.png"
)
$dirs = @("js", "css")

Write-Host "Source: $patron" -ForegroundColor Cyan
Write-Host "Cible:  ${Server}:$Dest" -ForegroundColor Cyan

foreach ($f in $files) {
  $p = Join-Path $patron $f
  if (-not (Test-Path $p)) { Write-Warning "Manquant: $f"; continue }
  scp $p "${Server}:${Dest}/"
  if ($LASTEXITCODE -eq 0) { Write-Host "OK $f" -ForegroundColor Green }
}

foreach ($d in $dirs) {
  $src = Join-Path $patron $d
  if (Test-Path $src) {
    scp -r $src "${Server}:${Dest}/"
    Write-Host "OK dossier $d" -ForegroundColor Green
  }
}

Write-Host "`nTermine. Sur le site: F12 > Application > Service Workers > Unregister, puis Ctrl+F5." -ForegroundColor Yellow
