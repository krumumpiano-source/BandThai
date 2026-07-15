# Fix duplicate artist names

Write-Host "Fixing duplicate artists..." -ForegroundColor Cyan

# Load
$songs = Get-Content "existing-songs.json" -Raw | ConvertFrom-Json
Write-Host "Original count: $($songs.Count)"

# Find duplicates
$tattooUpper = $songs | Where-Object { $_.artist -eq "TATTOO COLOUR" }
$colorTitle = $songs | Where-Object { $_.artist -eq "Colorpitch" }

Write-Host "`nFound duplicates:"
Write-Host "  TATTOO COLOUR: $($tattooUpper.Count) songs"
Write-Host "  Colorpitch: $($colorTitle.Count) songs"

# Normalize names instead of removing
$tattooUpper | ForEach-Object { $_.artist = "Tattoo Colour" }
$colorTitle | ForEach-Object { $_.artist = "COLORPITCH" }

Write-Host "`nNormalized artist names for TATTOO COLOUR and Colorpitch."

# The full list is now the normalized $songs
$filtered = $songs
Write-Host "New count: $($filtered.Count) (No songs were deleted)"

# Backup
$backupFile = "existing-songs.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
Copy-Item "existing-songs.json" $backupFile
Write-Host "`nBackup saved: $backupFile"

# Save
$filtered | ConvertTo-Json -Depth 10 | Out-File "existing-songs.json" -Encoding UTF8
Write-Host "Saved: existing-songs.json"

# Verify
$new = Get-Content "existing-songs.json" -Raw | ConvertFrom-Json
$t = $new | Where-Object { $_.artist -like "*Tattoo*" } | Select-Object -ExpandProperty artist -Unique
$c = $new | Where-Object { $_.artist -like "*COLOR*" -or $_.artist -like "*Color*" } | Select-Object -ExpandProperty artist -Unique

Write-Host "`nVerification:"
Write-Host "  Total songs: $($new.Count)"
Write-Host "  Tattoo variants: $($t -join ', ')"
Write-Host "  Color variants: $($c -join ', ')"
Write-Host "`nDone!" -ForegroundColor Green
