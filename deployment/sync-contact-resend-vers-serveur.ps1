# Sync scripts contact-mail Resend (production)
$ErrorActionPreference = "Stop"
$Host_ = "127.0.0.1"
$User = "titi"
$Root = Join-Path $PSScriptRoot ".."
$Remote = "/mnt/stockage/chantiertrack-v2/chantiertrack-v2"

Write-Host "=== Sync contact-mail Resend -> ${User}@${Host_} ===" -ForegroundColor Cyan

$files = @(
  "deployment\enable-resend-production.sh",
  "deployment\fix-contact-to-entreprise.sh",
  "deployment\contact-mail.env.server",
  "site\js\contact-form.js"
)

foreach ($rel in $files) {
  $local = Join-Path $Root $rel
  if (-not (Test-Path $local)) { throw "Manquant: $local" }
  $remotePath = "$Remote/$($rel -replace '\\','/')"
  scp $local "${User}@${Host_}:$remotePath"
}

Write-Host ""
Write-Host "OK — fichiers copies." -ForegroundColor Green
Write-Host "Sur thibault (SSH) :" -ForegroundColor Yellow
Write-Host "  cd $Remote"
Write-Host "  bash deployment/enable-resend-production.sh"
