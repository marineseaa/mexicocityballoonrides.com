# Generate Hugo tour pages from JSON data
# Run this script whenever you update the offers JSON or tours_config.yaml
# Auto-detects the offers JSON via gyg_*.json glob — no per-site filename edit needed.

$ErrorActionPreference = "Stop"

# Resolve paths absolutely from this script's location (parent dir = site root).
# .NET WriteAllText does NOT honor PowerShell Set-Location, so any invocation via
# an absolute path (e.g. `& "C:\...\scripts\generate-tour-pages.ps1"`) would
# otherwise write tour pages relative to the original session CWD instead of the
# site root — observed Run 10 montserrat.
$siteRoot = Split-Path -Parent $PSScriptRoot

# Parse YAML config manually (simple parser for our use case)
$toursConfigPath = Join-Path $siteRoot "data/tours_config.yaml"
if (-not (Test-Path $toursConfigPath)) {
    Write-Error "data/tours_config.yaml not found at $toursConfigPath — create it with a 'featured_tours:' list of tour IDs (mirror data/experiences_config.yaml IDs)."
    exit 1
}
$yamlContent = Get-Content $toursConfigPath -Raw
$tourIds = @()
$yamlContent -split "`n" | ForEach-Object {
    if ($_ -match '^\s*-\s*(\d+)') {
        $tourIds += [int]$matches[1]
    }
}
if ($tourIds.Count -eq 0) {
    Write-Error "data/tours_config.yaml contains no tour IDs (pattern '- <id>'). Populate it with IDs that mirror data/experiences_config.yaml."
    exit 1
}

# Auto-detect the offers JSON via glob (Run 24+ codification — was hardcoded to
# the tokyo scaffold filename, broke every clone that forgot to edit this line).
$dataDir = Join-Path $siteRoot "data"
$offersFiles = @(Get-ChildItem -Path $dataDir -Filter "gyg_*.json" -File -ErrorAction SilentlyContinue)
if ($offersFiles.Count -eq 0) {
    Write-Error "No gyg_*.json file found in $dataDir — copy the GYG offers JSON to data/ first."
    exit 1
}
if ($offersFiles.Count -gt 1) {
    # Multiple match — pick the largest (the offers catalog is typically the biggest gyg_*.json file)
    $offersFiles = $offersFiles | Sort-Object Length -Descending
    Write-Warning "Multiple gyg_*.json files in data/ — using largest: $($offersFiles[0].Name)"
}
$offersPath = $offersFiles[0].FullName
Write-Host "Reading offers from: $($offersFiles[0].Name)"
$allTours = Get-Content $offersPath -Raw -Encoding UTF8 | ConvertFrom-Json

# Create tours directory
$toursDir = Join-Path $siteRoot "content/tours"
if (-not (Test-Path $toursDir)) {
    New-Item -ItemType Directory -Force -Path $toursDir | Out-Null
}

# Generate a page for each configured tour
$count = 0
foreach ($tourId in $tourIds) {
    $tour = $allTours | Where-Object { $_.id -eq $tourId }

    if (-not $tour) {
        Write-Warning "Tour ID $tourId not found in JSON"
        continue
    }

    # Create URL-friendly slug
    # Step 0: transliterate letters NFD does NOT decompose (ø æ å ß ð þ ł, and the
    # Turkish dotless/dotted i pair ı İ) else Step 2 strips them: "Tromsø" -> "troms"
    # (norwayfishingtour.com, 2026-07) and "Topkapı" -> "topkap"
    # (topkapipalace-tours.com, 2026-08-28). Keep in sync with the .py.
    $title = $tour.title
    foreach ($p in @(@('ø','o'),@('Ø','O'),@('æ','ae'),@('Æ','Ae'),@('å','a'),@('Å','A'),@('ß','ss'),@('ð','d'),@('þ','th'),@('ł','l'),@([char]0x0131,'i'),@([char]0x0130,'I'))) {
        $title = $title.Replace($p[0], $p[1])
    }
    # Step 1: Unicode normalize to strip diacritics (e.g. ō → o, ā → a)
    $normalized = $title.Normalize([System.Text.NormalizationForm]::FormD)
    $slug = [System.Text.RegularExpressions.Regex]::Replace($normalized, '\p{M}', '')
    # Step 2: strip remaining non-ASCII-alphanumeric chars and collapse to hyphens
    $slug = $slug -replace '[^a-zA-Z0-9\s-]', '' -replace '\s+', '-' -replace '-+', '-'
    $slug = $slug.ToLower().Trim('-')

    # Escape quotes in description
    $description = $tour.abstract -replace '"', '\"'

    # Create markdown content
    $frontmatter = @"
---
title: "$($tour.title)"
date: $(Get-Date -Format "yyyy-MM-dd")
draft: false
type: "tour"
tourId: $($tour.id)
url: "/tours/$slug/"
description: "$description"
---
"@

    # Write to file with UTF8 encoding (no BOM)
    $filename = "$toursDir/$slug.md"
    [System.IO.File]::WriteAllText($filename, $frontmatter, [System.Text.UTF8Encoding]::new($false))

    Write-Host "Generated: $filename"
    $count++
}

Write-Host ""
Write-Host "Generated $count tour pages"
Write-Host "Run hugo server to preview"
