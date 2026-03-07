# Fix duplicate artist names - Update version

Write-Host "Fixing duplicate artists by updating names..." -ForegroundColor Cyan

# Load
$songs = Get-Content "existing-songs.json" -Raw | ConvertFrom-Json
Write-Host "Original count: $($songs.Count)"

# Update artist names
$updated = 0

foreach ($song in $songs) {
    if ($song.artist -eq "TATTOO COLOUR") {
        $song.artist = "Tattoo Colour"
        $updated++
        Write-Host "Updated: $($song.name) - TATTOO COLOUR -> Tattoo Colour"
    }
    elseif ($song.artist -eq "Colorpitch") {
        $song.artist = "COLORPiTCH"
        $updated++
        Write-Host "Updated: $($song.name) - Colorpitch -> COLORPiTCH"
    }
}

Write-Host "`nTotal updates: $updated"

# Find and remove duplicates by ID
$uniqueSongs = @{}
$duplicates = 0

foreach ($song in $songs) {
    $key = $song.id
    if (-not $uniqueSongs.ContainsKey($key)) {
        $uniqueSongs[$key] = $song
    }
    else {
        $duplicates++
        Write-Host "Duplicate ID found: $($song.id) - $($song.name) - $($song.artist)"
    }
}

$filtered = $uniqueSongs.Values
Write-Host "`nDuplicates removed: $duplicates"
Write-Host "Final count: $($filtered.Count)"

# Backup
$backupFile = "existing-songs.backup-before-update.json"
Copy-Item "existing-songs.json" $backupFile -Force
Write-Host "`nBackup saved: $backupFile"

# Save
$filtered | ConvertTo-Json -Depth 10 | Out-File "existing-songs.json" -Encoding UTF8
Write-Host "Saved: existing-songs.json"

# Verify
$new = Get-Content "existing-songs.json" -Raw | ConvertFrom-Json
$allArtists = $new | Where-Object { $_.artist } | Select-Object -ExpandProperty artist
$tattooCheck = $allArtists | Where-Object { $_ -like "*Tattoo*" } | Select-Object -Unique
$colorCheck = $allArtists | Where-Object { $_ -like "*COLOR*" -or $_ -like "*Color*" } | Select-Object -Unique

Write-Host "`nVerification:"
Write-Host "  Total songs: $($new.Count)"
Write-Host "  Songs with artists: $(($new | Where-Object { $_.artist }).Count)"
Write-Host "  Tattoo variants: $($tattooCheck -join ', ')"
Write-Host "  Color variants: $($colorCheck -join ', ')"

$tattooSongs = $new | Where-Object { $_.artist -eq "Tattoo Colour" }
$colorSongs = $new | Where-Object { $_.artist -eq "COLORPiTCH" }

Write-Host "`nFinal check:"
Write-Host "  Tattoo Colour: $($tattooSongs.Count) songs"
$tattooSongs | ForEach-Object { Write-Host "    - $($_.name)" }
Write-Host "  COLORPiTCH: $($colorSongs.Count) songs"
$colorSongs | ForEach-Object { Write-Host "    - $($_.name)" }

Write-Host "`nDone!" -ForegroundColor Green
