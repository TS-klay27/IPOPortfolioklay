<#
  KLUIVERT OS — recipe used on 2026-11-17 to optimize the 11 certificate PDFs (39.32 MB -> 3.77 MB).
  Only the page image is re-encoded (JPEG); page size, ICC colour profile and every other PDF object
  are copied byte-for-byte. Originals are never modified.

  Usage:
    (from development\kluivert-os)
    powershell -ExecutionPolicy Bypass -File tools\pdf\optimize-certificates.ps1 -Source <folder with originals> -Out <new folder>

  Settings: 200 DPI for an A4 page (1654 px wide), JPEG quality 88.
  Certificate 10 uses 1800 px / quality 90 (it exceeded the local-error threshold at 1654 px).
  Requires: Python 3 (standard library only) and Windows PowerShell 5.1 (System.Drawing).
#>
param(
  [Parameter(Mandatory)] [string]$Source,
  [Parameter(Mandatory)] [string]$Out
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Add-Type -Path (Join-Path $here 'ImgTool.cs') -ReferencedAssemblies System.Drawing
if ((Resolve-Path $Source).Path -eq (Resolve-Path -LiteralPath $Out -ErrorAction SilentlyContinue).Path) { throw 'Out must be a different folder from Source' }
New-Item -ItemType Directory -Force $Out | Out-Null
$work = Join-Path ([IO.Path]::GetTempPath()) ('kluivert-os-pdf-' + [guid]::NewGuid())
New-Item -ItemType Directory $work | Out-Null
$override = @{ '10' = @{ w = 1800; q = 90 } }
try {
  foreach ($f in Get-ChildItem $Source -Filter *.pdf | Sort-Object Name) {
    $id = $f.Name.Substring(0, 2)
    $bmp = Join-Path $work "$id.bmp"; $jpg = Join-Path $work "$id.jpg"
    $meta = python -I (Join-Path $here 'pdfimg.py') extract $f.FullName $bmp | ConvertFrom-Json
    $w = 1654; $q = 88
    if ($override.ContainsKey($id)) { $w = $override[$id].w; $q = $override[$id].q }
    $w = [Math]::Min($w, $meta.W); $h = [int][Math]::Round($meta.H * $w / $meta.W)
    [void][ImgTool]::MakeJpeg($bmp, $jpg, $w, $h, $q)
    $m = [ImgTool]::Compare($bmp, $jpg)
    $dst = Join-Path $Out $f.Name
    python -I (Join-Path $here 'pdfimg.py') rebuild $f.FullName $jpg $w $h $dst | Out-Null
    $chk = python -I (Join-Path $here 'pdfimg.py') check $dst | ConvertFrom-Json
    $ok = $chk.startxref_ok -and $chk.eof -and $chk.xref_bad.Count -eq 0 -and $chk.pages -eq 1 -and $chk.image_length_ok
    '{0}  {1:N0} -> {2:N0} B  {3}x{4} q{5}  PSNR {6:N2} dB  worst {7:N2}  structure {8}' -f $f.Name, $f.Length, (Get-Item $dst).Length, $w, $h, $q, $m[0], $m[1], ($(if ($ok) { 'OK' } else { 'FAILED' }))
  }
} finally { Remove-Item $work -Recurse -Force }
