# Update artist names for famous songs where we're 100% confident

Write-Host "Updating artist names for well-known songs..." -ForegroundColor Cyan

$songs = Get-Content "existing-songs.json" -Raw | ConvertFrom-Json

# Well-known international songs with definitive artists
$knownArtists = @{
    "Hotel California" = "Eagles"
    "My heart will go on" = "Celine Dion"
    "September" = "Earth, Wind & Fire"
    "Every breath you take" = "The Police"
    "Stand by me" = "Ben E. King"
    "dance monkey" = "Tones and I"
    "Sunday morning" = "Maroon 5"
    "Too good at goodbye" = "Sam Smith"
    "Love me like you do" = "Ellie Goulding"
    "The game of love" = "Santana"
    "How do i live" = "LeAnn Rimes"
    "Friends" = "Marshmello"
    "Shape of You" = "Ed Sheeran"
    "Thinking Out Loud" = "Ed Sheeran"
    "Someone Like You" = "Adele"
    "Hello" = "Adele"
    "Rolling in the Deep" = "Adele"
    "Uptown Funk" = "Mark Ronson ft. Bruno Mars"
    "Can't Stop the Feeling" = "Justin Timberlake"
    "Shallow" = "Lady Gaga & Bradley Cooper"
    "Perfect" = "Ed Sheeran"
    "Despacito" = "Luis Fonsi ft. Daddy Yankee"
    "All of Me" = "John Legend"
    "Stay With Me" = "Sam Smith"
    "Photograph" = "Ed Sheeran"
    "Let Her Go" = "Passenger"
    "Counting Stars" = "OneRepublic"
    "Radioactive" = "Imagine Dragons"
    "Demons" = "Imagine Dragons"
    "Wake Me Up" = "Avicii"
    "Rather Be" = "Clean Bandit"
    "Happy" = "Pharrell Williams"
    "Get Lucky" = "Daft Punk ft. Pharrell Williams"
    "Blurred Lines" = "Robin Thicke ft. T.I. & Pharrell"
    "Titanium" = "David Guetta ft. Sia"
    "We Are Young" = "fun. ft. Janelle Monáe"
    "Payphone" = "Maroon 5"
    "One More Night" = "Maroon 5"
    "Sugar" = "Maroon 5"
    "Animals" = "Maroon 5"
    "Girls Like You" = "Maroon 5 ft. Cardi B"
    "Memories" = "Maroon 5"
    "Beautiful Day" = "U2"
    "With or Without You" = "U2"
    "One" = "U2"
    "Wonderwall" = "Oasis"
    "Don't Look Back in Anger" = "Oasis"
    "Champagne Supernova" = "Oasis"
    "Yellow" = "Coldplay"
    "The Scientist" = "Coldplay"
    "Fix You" = "Coldplay"
    "Viva la Vida" = "Coldplay"
    "Clocks" = "Coldplay"
    "Paradise" = "Coldplay"
    "A Sky Full of Stars" = "Coldplay"
    "Adventure of a Lifetime" = "Coldplay"
    "Something Just Like This" = "The Chainsmokers & Coldplay"
    "Closer" = "The Chainsmokers ft. Halsey"
    "Don't Let Me Down" = "The Chainsmokers ft. Daya"
    "Roses" = "The Chainsmokers ft. ROZES"
    "Starboy" = "The Weeknd ft. Daft Punk"
    "Blinding Lights" = "The Weeknd"
    "Save Your Tears" = "The Weeknd"
    "Can't Feel My Face" = "The Weeknd"
    "The Hills" = "The Weeknd"
    "I Feel It Coming" = "The Weeknd ft. Daft Punk"
    "Earned It" = "The Weeknd"
    "Call Out My Name" = "The Weeknd"
    "Say Something" = "A Great Big World ft. Christina Aguilera"
    "Let It Go" = "Idina Menzel"
    "Royals" = "Lorde"
    "Team" = "Lorde"
    "Pumped Up Kicks" = "Foster the People"
    "Shut Up and Dance" = "Walk the Moon"
    "Riptide" = "Vance Joy"
    "Ho Hey" = "The Lumineers"
    "Stubborn Love" = "The Lumineers"
    "Little Talks" = "Of Monsters and Men"
    "Safe and Sound" = "Capital Cities"
    "Pompeii" = "Bastille"
    "Take Me to Church" = "Hozier"
    "Budapest" = "George Ezra"
    "Shotgun" = "George Ezra"
}

$updated = 0
$notFound = 0

foreach ($song in $songs) {
    if (-not $song.artist -and $knownArtists.ContainsKey($song.name)) {
        $song.artist = $knownArtists[$song.name]
        $updated++
        Write-Host "Updated: $($song.name) -> $($song.artist)" -ForegroundColor Green
    }
    elseif (-not $song.artist) {
        $notFound++
    }
}

Write-Host "`nSummary:" -ForegroundColor Yellow
Write-Host "  Updated: $updated songs"
Write-Host "  Still without artist: $notFound songs"

if ($updated -gt 0) {
    # Backup
    $backupFile = "existing-songs.backup-before-artist-update.json"
    Copy-Item "existing-songs.json" $backupFile -Force
    Write-Host "`nBackup saved: $backupFile" -ForegroundColor Cyan
    
    # Save
    $songs | ConvertTo-Json -Depth 10 | Out-File "existing-songs.json" -Encoding UTF8
    Write-Host "Saved: existing-songs.json" -ForegroundColor Green
    
    # Verify
    $newSongs = Get-Content "existing-songs.json" -Raw | ConvertFrom-Json
    $withArtist = ($newSongs | Where-Object { $_.artist }).Count
    $withoutArtist = ($newSongs | Where-Object { -not $_.artist }).Count
    
    Write-Host "`nVerification:" -ForegroundColor Cyan
    Write-Host "  Total songs: $($newSongs.Count)"
    Write-Host "  With artist: $withArtist"
    Write-Host "  Without artist: $withoutArtist"
    Write-Host "`nDone!" -ForegroundColor Green
}
else {
    Write-Host "`nNo updates needed." -ForegroundColor Yellow
}
