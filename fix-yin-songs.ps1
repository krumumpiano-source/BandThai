# Fix songs with (ยิ่น) and (ตอง) suffix - Remove suffix and change singer to female
# Reason: These are male songs transposed to different keys for female singers

$jsonPath = "existing-songs.json"

# Create backup
$backupPath = "existing-songs.backup-before-singer-suffix-fix-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
Copy-Item $jsonPath $backupPath
Write-Host "Backup created: $backupPath" -ForegroundColor Green

# Read JSON with UTF-8 encoding
$songs = Get-Content $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json

# Find songs with (ยิ่น) or (ตอง)
$targetSongs = $songs | Where-Object { $_.name -match '\((ยิ่น|ตอง)\)' }

Write-Host "`nFound $($targetSongs.Count) songs with (ยิ่น) or (ตอง)" -ForegroundColor Cyan
Write-Host "`nSongs to update:" -ForegroundColor Yellow

$updatedCount = 0

foreach ($song in $songs) {
    if ($song.name -match '\((ยิ่น|ตอง)\)') {
        $oldName = $song.name
        $oldSinger = $song.singer
        
        # Remove (ยิ่น) or (ตอง) from name
        $song.name = $song.name -replace '\s*\((ยิ่น|ตอง)\)\s*', ''
        
        # Change singer to female
        $song.singer = "หญิง"
        
        Write-Host "  - $oldName -> $($song.name)"
        Write-Host "    Singer: $oldSinger -> $($song.singer)" -ForegroundColor Gray
        
        $updatedCount++
    }
}

# Save updated JSON with UTF-8 encoding
$songs | ConvertTo-Json -Depth 10 | Set-Content $jsonPath -Encoding UTF8

Write-Host "`n✓ Updated: $updatedCount songs" -ForegroundColor Green
Write-Host "✓ All (ยิ่น) suffixes removed and singers changed to 'หญิง'" -ForegroundColor Green

# Show summary
$femaleCount = ($songs | Where-Object { $_.singer -eq "หญิง" }).Count
Write-Host "`nCurrent stats:" -ForegroundColor Cyan
Write-Host "  Total female songs: $femaleCount" -ForegroundColor White
