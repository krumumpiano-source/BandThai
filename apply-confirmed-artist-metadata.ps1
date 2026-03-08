param(
    [string]$JsonPath = "existing-songs.json",
    [string]$ReportPath = "original-metadata-report-20260307-162814.json",
    [switch]$WhatIf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Convert-FromMojibake([string]$text) {
    if ([string]::IsNullOrWhiteSpace($text)) { return $text }
    $enc1252 = [System.Text.Encoding]::GetEncoding(1252)
    $utf8 = [System.Text.Encoding]::UTF8
    return $utf8.GetString($enc1252.GetBytes($text))
}

Write-Host "Reading songs: $JsonPath" -ForegroundColor Cyan
$songs = Get-Content $JsonPath -Raw -Encoding UTF8 | ConvertFrom-Json

Write-Host "Reading report: $ReportPath" -ForegroundColor Cyan
$report = Get-Content $ReportPath -Raw -Encoding UTF8 | ConvertFrom-Json

# Confirmed by user
$idLove = '97cb99f9-020d-4c61-adfe-3d9a5ca3a98d'      # รักไม่ช่วยอะไร
$idPlayHigh = '647acecf-a2b9-436f-b210-120c7b037f27'  # เล่นของสูง
$idFuenLipta = '5b2427d0-1711-4fd9-872d-038ec29a47a4' # ฝืน(ลิปตา)

$updates = @{}

function Get-ReportItemById([string]$id) {
    return @($report | Where-Object { $_.id -eq $id }) | Select-Object -First 1
}

$loveItem = Get-ReportItemById $idLove
if (-not $loveItem) { throw "Report missing id: $idLove" }
$updates[$idLove] = [ordered]@{ artist = [string]$loveItem.original_artist }

$playItem = Get-ReportItemById $idPlayHigh
if (-not $playItem) { throw "Report missing id: $idPlayHigh" }
$updates[$idPlayHigh] = [ordered]@{ artist = [string]$playItem.original_artist }

$fuenItem = Get-ReportItemById $idFuenLipta
if (-not $fuenItem) { throw "Report missing id: $idFuenLipta" }

# Extract artist hint from parentheses in the (fixed) name, and also normalize the title
$nameFixed = Convert-FromMojibake ([string]$fuenItem.name)
$newName = $nameFixed
$artistHint = $null
if ($nameFixed -match '^(?<t>.*?)\s*\((?<h>[^\)]+)\)\s*$') {
    $newName = $matches['t'].Trim()
    $artistHint = $matches['h'].Trim()
}
if ([string]::IsNullOrWhiteSpace($artistHint)) {
    $artistHint = 'Lipta'
}

$updates[$idFuenLipta] = [ordered]@{ artist = [string]$artistHint; name = [string]$newName }

# Backup
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = "existing-songs.backup-before-confirmed-artist-metadata-$timestamp.json"
Write-Host "Creating backup: $backupPath" -ForegroundColor DarkGray
Copy-Item -Path $JsonPath -Destination $backupPath -Force

$changed = 0
foreach ($id in $updates.Keys) {
    $song = @($songs | Where-Object { $_.id -eq $id }) | Select-Object -First 1
    if (-not $song) {
        Write-Warning "Song not found in dataset: $id"
        continue
    }

    $update = $updates[$id]

    $beforeName = Convert-FromMojibake ([string]$song.name)
    $beforeArtist = Convert-FromMojibake ([string]$song.artist)

    if ($update.Contains('name')) { $song.name = $update.name }
    if ($update.Contains('artist')) { $song.artist = $update.artist }

    $afterName = Convert-FromMojibake ([string]$song.name)
    $afterArtist = Convert-FromMojibake ([string]$song.artist)

    if ($WhatIf) {
        Write-Host "[WhatIf] $id" -ForegroundColor Yellow
    } else {
        $changed++
    }

    Write-Host "- $id" -ForegroundColor Green
    Write-Host "  name:   $beforeName -> $afterName" -ForegroundColor DarkGray
    Write-Host "  artist: $beforeArtist -> $afterArtist" -ForegroundColor DarkGray
}

if ($WhatIf) {
    Write-Host "WhatIf mode: not writing changes." -ForegroundColor Yellow
    exit 0
}

Write-Host "Writing updated JSON..." -ForegroundColor Cyan
$songs | ConvertTo-Json -Depth 20 | Set-Content -Path $JsonPath -Encoding UTF8

Write-Host "Done. Updated songs: $changed" -ForegroundColor Green
Write-Host "Backup: $backupPath" -ForegroundColor Green
