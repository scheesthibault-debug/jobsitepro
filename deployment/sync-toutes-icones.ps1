# Copie TOUTES les icônes + HTML employé et patron (obligatoire pour finir la grue)
param(
  [Parameter(Mandatory = $true)][string]$Server
)

$root = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "chantiertrack-v2"
if (-not (Test-Path $root)) { $root = Split-Path $PSScriptRoot -Parent }

Write-Host "=== Patron ===" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "sync-patron-vers-serveur.ps1") -Server $Server
Write-Host "=== Employe ===" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "sync-employe-vers-serveur.ps1") -Server $Server
Write-Host "`nSur iPhone: supprimer l'icone JobsitePro, puis reinstaller depuis /employe/" -ForegroundColor Yellow
