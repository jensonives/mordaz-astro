<#
.SYNOPSIS
  Renders the MORDAZ logo variants as 1000x1000 PNGs for social profiles.

.DESCRIPTION
  Same approach as the OG cards: headless Edge over a real HTML template, so
  the marks are set in the site's own Archivo and Newsreader rather than a
  substitute face.

  1000x1000 because every platform downsamples: X wants 400, Instagram 320,
  TikTok 200. One large square covers all of them, and upload sites resize
  better than they upscale.

.EXAMPLE
  ./New-Logo.ps1                       # renders all five
  ./New-Logo.ps1 -Variant strike       # just one
#>
[CmdletBinding()]
param(
    [ValidateSet('block','strike','pair','stack','serif','all')]
    [string]$Variant = 'all'
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $PSCommandPath
$root = Split-Path -Parent $here

$edge = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Microsoft Edge not found." }

$template = Join-Path $here 'logo-template.html'
if (-not (Test-Path $template)) { throw "Missing $template" }

$outDir = Join-Path $root 'public\assets\img\logo'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }

$variants = if ($Variant -eq 'all') { @('block','strike','pair','stack','serif') } else { @($Variant) }

foreach ($v in $variants) {
    $outPath = Join-Path $outDir "mordaz-$v.png"
    $url = ([uri]$template).AbsoluteUri + '#' + $v

    $profileDir = Join-Path $env:TEMP ("mordaz-logo-" + [guid]::NewGuid().ToString('N').Substring(0,8))
    $errLog     = Join-Path $env:TEMP ("mordaz-logo-" + [guid]::NewGuid().ToString('N').Substring(0,8) + ".log")

    # Start-Process, not the call operator: Edge writes warnings to stderr and
    # PowerShell 5.1 promotes those to terminating errors under -EA Stop.
    $argLine = @(
        '--headless=new'
        '--disable-gpu'
        '--hide-scrollbars'
        '--force-device-scale-factor=1'
        '--window-size=1000,1000'
        '--virtual-time-budget=5000'
        "--user-data-dir=`"$profileDir`""
        "--screenshot=`"$outPath`""
        "`"$url`""
    ) -join ' '

    Start-Process -FilePath $edge -ArgumentList $argLine -NoNewWindow -Wait `
                  -RedirectStandardError $errLog | Out-Null

    foreach ($p in @($profileDir, $errLog)) {
        try { Remove-Item -Recurse -Force $p -ErrorAction Stop } catch {}
    }

    if (-not (Test-Path $outPath)) { throw "Edge did not produce $outPath" }
    $kb = [math]::Round((Get-Item $outPath).Length / 1KB, 1)
    Write-Output ("  {0,-8} -> mordaz-{0}.png   ({1} KB)" -f $v, $kb)
}
