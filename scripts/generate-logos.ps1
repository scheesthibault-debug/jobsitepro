# Regénère les icônes patron/employé sans npm (Windows uniquement)
param(
  [string]$Source = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
if (-not $Source) {
  $candidates = @(
    (Join-Path $root "logo-source.png"),
    "$env:USERPROFILE\.cursor\projects\c-Users-schee-Desktop-chantiertrack-v2\assets\*logo*.png"
  )
  foreach ($pat in $candidates) {
    $f = Get-Item $pat -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($f) { $Source = $f.FullName; break }
  }
}
if (-not $Source -or -not (Test-Path $Source)) {
  Write-Host "Usage: .\generate-logos.ps1 -Source 'C:\chemin\vers\logo.png'" -ForegroundColor Yellow
  exit 1
}

Add-Type -AssemblyName System.Drawing

function Save-SquareIcon([System.Drawing.Image]$src, [int]$side, [string]$outPath) {
  $bmp = New-Object System.Drawing.Bitmap $side, $side
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::FromArgb(255, 245, 245, 247))
  $pad = [Math]::Max(4, [int]($side * 0.08))
  $inner = $side - 2 * $pad
  $g.DrawImage($src, $pad, $pad, $inner, $inner)
  $g.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Get-IconCropRect([System.Drawing.Image]$img) {
  $w = $img.Width
  $h = $img.Height
  if ($w -le $h * 1.15) {
    $side = [Math]::Min($w, $h)
    $left = [Math]::Max(0, [int](($w - $side) / 2))
    $top = [Math]::Max(0, [int](($h - $side) / 2))
    return (New-Object System.Drawing.Rectangle $left, $top, $side, $side)
  }
  # Bandeau JobsitePro : picto carré en HAUT AU CENTRE (pas la grue / pas le texte)
  $side = [Math]::Min($w, [Math]::Min($h, [Math]::Min([int]($w * 0.26), [int]($h * 0.72))))
  $left = [Math]::Max(0, [int](($w - $side) / 2))
  $top = [Math]::Max(0, [int]($h * 0.03))
  return (New-Object System.Drawing.Rectangle $left, $top, $side, $side)
}

$img = [System.Drawing.Image]::FromFile($Source)
$rect = Get-IconCropRect $img
$icon = $img.Clone($rect, $img.PixelFormat)
$bannerH = $img.Height
$img.Dispose()

$targets = @(
  (Join-Path $root "patron"),
  (Join-Path $root "employe")
)
foreach ($dir in $targets) {
  Save-SquareIcon $icon 192 (Join-Path $dir "icon-192.png")
  Save-SquareIcon $icon 512 (Join-Path $dir "icon-512.png")
  Save-SquareIcon $icon 180 (Join-Path $dir "apple-touch-icon.png")
  $banner = [System.Drawing.Image]::FromFile($Source)
  $bw = 1200
  $bh = [int]($bannerH * ($bw / $banner.Width))
  $b = New-Object System.Drawing.Bitmap $bw, $bh
  $bg = [System.Drawing.Graphics]::FromImage($b)
  $bg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $bg.DrawImage($banner, 0, 0, $bw, $bh)
  $bg.Dispose()
  $banner.Dispose()
  $b.Save((Join-Path $dir "logo-banner.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $b.Dispose()
  Write-Host "OK $dir"
}
$icon.Dispose()
Copy-Item (Join-Path $targets[0] "icon-512.png") (Join-Path $root "app-icon-512.png") -Force
Write-Host "Terminé (icône = picto J centré, pas la grue)." -ForegroundColor Green
