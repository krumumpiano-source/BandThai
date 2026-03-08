# Verify singer gender accuracy for songs
# Check only songs with singer: male, female, or empty

$jsonPath = "existing-songs.json"

# Read JSON with UTF-8 encoding
$songs = Get-Content $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json

Write-Host "=== Singer Gender Verification ===" -ForegroundColor Cyan
Write-Host ""

# Count by singer type
$male = $songs | Where-Object { $_.singer -eq "ชาย" }
$female = $songs | Where-Object { $_.singer -eq "หญิง" }
$empty = $songs | Where-Object { -not $_.singer -or $_.singer -eq "" }
$duet = $songs | Where-Object { $_.singer -eq "ชาย/หญิง" }
$other = $songs | Where-Object { $_.singer -and $_.singer -ne "ชาย" -and $_.singer -ne "หญิง" -and $_.singer -ne "ชาย/หญิง" }

Write-Host "Total songs: $($songs.Count)" -ForegroundColor White
Write-Host "  - Male: $($male.Count)" -ForegroundColor Cyan
Write-Host "  - Female: $($female.Count)" -ForegroundColor Magenta
Write-Host "  - Duet: $($duet.Count)" -ForegroundColor Yellow
Write-Host "  - Empty: $($empty.Count)" -ForegroundColor Gray
Write-Host "  - Other: $($other.Count)" -ForegroundColor DarkGray
Write-Host ""

# Known male artists (international)
$knownMaleArtists = @(
    "Ed Sheeran", "Sam Smith", "The Weeknd", "Bruno Mars", "Shawn Mendes",
    "Charlie Puth", "Calum Scott", "James Arthur", "Lewis Capaldi",
    "John Legend", "Passenger", "Coldplay", "Maroon 5", "Imagine Dragons",
    "OneRepublic", "Eagles", "Ben E. King", "Santana", "Earth Wind & Fire",
    "The Police", "Frank Sinatra", "Elvis Presley", "Michael Jackson"
)

# Known female artists (international)
$knownFemaleArtists = @(
    "Adele", "Taylor Swift", "Ariana Grande", "Billie Eilish", "Dua Lipa",
    "Ellie Goulding", "Celine Dion", "Whitney Houston", "Mariah Carey",
    "Beyonce", "Rihanna", "Lady Gaga", "Tones and I", "LeAnn Rimes",
    "Sia", "Pink", "Katy Perry", "Miley Cyrus", "Selena Gomez"
)

# Check for potential mismatches
Write-Host "=== Checking for Potential Issues ===" -ForegroundColor Yellow
Write-Host ""

$issues = @()

# Check male songs with female artists
foreach ($song in $male) {
    if ($song.artist) {
        foreach ($femaleArtist in $knownFemaleArtists) {
            if ($song.artist -match [regex]::Escape($femaleArtist)) {
                $issues += [PSCustomObject]@{
                    Type = "Male song with female artist"
                    Name = $song.name
                    Artist = $song.artist
                    Singer = $song.singer
                    Issue = "Artist is female but song marked as male"
                }
            }
        }
    }
}

# Check female songs with male artists
foreach ($song in $female) {
    if ($song.artist) {
        foreach ($maleArtist in $knownMaleArtists) {
            if ($song.artist -match [regex]::Escape($maleArtist)) {
                $issues += [PSCustomObject]@{
                    Type = "Female song with male artist"
                    Name = $song.name
                    Artist = $song.artist
                    Singer = $song.singer
                    Issue = "Artist is male but song marked as female"
                }
            }
        }
    }
}

# Check songs with collaboration markers
$possibleDuets = $songs | Where-Object { 
    ($_.singer -eq "ชาย" -or $_.singer -eq "หญิง") -and 
    ($_.artist -match '\bft\b|\bfeat\b|\bfeaturing\b|&') 
}

foreach ($song in $possibleDuets) {
    $issues += [PSCustomObject]@{
        Type = "Possible duet marked as solo"
        Name = $song.name
        Artist = $song.artist
        Singer = $song.singer
        Issue = "Artist suggests collaboration"
    }
}

if ($issues.Count -gt 0) {
    Write-Host "Found $($issues.Count) potential issues:" -ForegroundColor Red
    Write-Host ""
    $issues | ForEach-Object {
        Write-Host "[$($_.Type)]" -ForegroundColor Yellow
        Write-Host "  Song: $($_.Name)" -ForegroundColor White
        Write-Host "  Artist: $($_.Artist)" -ForegroundColor Gray
        Write-Host "  Current Singer: $($_.Singer)" -ForegroundColor Gray
        Write-Host "  Issue: $($_.Issue)" -ForegroundColor Red
        Write-Host ""
    }
    
    # Export issues to file
    $issues | ConvertTo-Json -Depth 10 | Set-Content "singer-gender-issues.json" -Encoding UTF8
    Write-Host "Issues exported to: singer-gender-issues.json" -ForegroundColor Green
} else {
    Write-Host "[OK] No obvious issues found!" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Songs without Singer Info ===" -ForegroundColor Cyan
Write-Host "Total: $($empty.Count) songs" -ForegroundColor White
Write-Host ""

# Show sample
if ($empty.Count -gt 0) {
    Write-Host "Sample (first 50):" -ForegroundColor Gray
    $empty | Select-Object -First 50 | ForEach-Object {
        $artistInfo = if ($_.artist) { "| Artist: $($_.artist)" } else { "" }
        Write-Host "  - $($_.name) $artistInfo" -ForegroundColor DarkGray
    }
    
    # Export full list
    $emptyReport = $empty | Select-Object name, artist, era, genre | ConvertTo-Json -Depth 10
    $emptyReport | Set-Content "songs-without-singer.json" -Encoding UTF8
    Write-Host ""
    Write-Host "Full list exported to: songs-without-singer.json" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Verification Complete ===" -ForegroundColor Green
