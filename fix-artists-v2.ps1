# Fix duplicate artist names - Correct version

Write-Host "Fixing duplicate artists..." -ForegroundColor Cyan

# Load
$songs = Get-Content "existing-songs.json" -Raw | ConvertFrom-Json
Write-Host "Original count: $($songs.Count)"

# Find duplicates to remove
$duplicateIds = [System.Collections.ArrayList]@()

# 1. TATTOO COLOUR (keep Title Case, remove UPPERCASE)
$tattooUpper = $songs | Where-Object { $_.artist -eq "TATTOO COLOUR" }
Write-Host "`nTATTOO COLOUR: $($tattooUpper.Count) songs to remove"
foreach ($song in $tattooUpper) {
    [void]$duplicateIds.Add($song.id)
    Write-Host "  Remove: $($song.name) - TATTOO COLOUR"
}

# 2. Colorpitch (keep COLORPiTCH, remove Colorpitch)
$colorTitle = $songs | Where-Object { $_.artist -eq "Colorpitch" }
Write-Host "`nColorpitch: $($colorTitle.Count) songs to remove"
foreach ($song in $colorTitle) {
    [void]$duplicateIds.Add($song.id)
    Write-Host "  Remove: $($song.name) - Colorpitch"
}

# Remove duplicates
$filtered = $songs | Where-Object { $duplicateIds -notcontains $_.id }
Write-Host "`nRemoved: $($duplicateIds.Count) songs"
Write-Host "New count: $($filtered.Count)"

# Backup
$backupFile = "existing-songs.backup-before-fix.json"
Copy-Item "existing-songs.json" $backupFile -Force
Write-Host "`nBackup saved: $backupFile"

# Save
$filtered | ConvertTo-Json -Depth 10 | Out-File "existing-songs.json" -Encoding UTF8
Write-Host "Saved: existing-songs.json"

# Verify
$new = Get-Content "existing-songs.json" -Raw | ConvertFrom-Json
$tattooNew = $new | Where-Object { $_.artist -eq "Tattoo Colour" }
$colorNew = $new | Where-Object { $_.artist -eq "COLORPiTCH" }

Write-Host "`nVerification:"
Write-Host "  Total songs: $($new.Count)"
Write-Host "  Tattoo Colour: $($tattooNew.Count) songs"
$tattooNew | ForEach-Object { Write-Host "    - $($_.name)" }
Write-Host "  COLORPiTCH: $($colorNew.Count) songs"
$colorNew | ForEach-Object { Write-Host "    - $($_.name)" }

Write-Host "`nDone!" -ForegroundColor Green
