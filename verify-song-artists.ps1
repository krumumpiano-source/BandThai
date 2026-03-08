# Script to verify song names match their artists

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ตรวจสอบความถูกต้องของชื่อเพลงกับศิลปิน" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$songs = Get-Content "existing-songs.json" -Raw | ConvertFrom-Json

Write-Host "จำนวนเพลงทั้งหมด: $($songs.Count)"
Write-Host "เพลงที่มีศิลปิน: $(($songs | Where-Object { $_.artist }).Count)"
Write-Host "เพลงที่ไม่มีศิลปิน: $(($songs | Where-Object { -not $_.artist }).Count)"
Write-Host ""

# Known artist-song patterns (Thai songs)
$knownSongs = @{
    # Famous Thai songs with known artists
    "ขาดใจ" = @("Bodyslam")
    "ปล่อย" = @("Bodyslam")
    "คนมันรัก" = @("Bodyslam")
    "เธอคือพระอาทิตย์" = @("Bird Thongchai", "เบิร์ด ธงไชย")
    "รักแท้" = @("Bird Thongchai", "เบิร์ด ธงไชย", "Asanee-Wasan", "อัสนี-วสันต์")
    "ถ้าฉันเป็นเธอ" = @("Palmy", "ปาล์มมี่")
    "แค่มีเธอ" = @("Palmy", "ปาล์มมี่")
    "เพียงล้วงแค้น" = @("แจ้ ดนุพล")
    "หัวใจไม่ได้ว่าง" = @("ก้อง ห้วยไร่")
    "ไม่บอกเธอ" = @("ก้อง ห้วยไร่")
    "18 ฝน" = @("เสือ ธนพล")
    "191" = @("ลาบานูน")
    "ปืนไม่ใช่กระบอง" = @("ลาบานูน")
    "At All" = @("Tattoo Colour")
    "Cinderella" = @("Tattoo Colour")
    "ขาหมู" = @("Tattoo Colour")
    "ขัดใจ" = @("COLORPiTCH")
    "หมกโม" = @("COLORPiTCH")
}

# International songs
$internationalSongs = @{
    "Shape of You" = @("Ed Sheeran")
    "Uptown Funk" = @("Bruno Mars", "Mark Ronson")
    "Someone Like You" = @("Adele")
    "Hello" = @("Adele")
    "Thinking Out Loud" = @("Ed Sheeran")
    "21 Guns" = @("Green Day")
    "24K Magic" = @("Bruno Mars")
}

Write-Host "🔍 ตรวจสอบเพลงที่มีชื่อศิลปินไม่ถูกต้อง..." -ForegroundColor Yellow
Write-Host ""

$issues = @()
$verified = 0

# Check known Thai songs
foreach ($songName in $knownSongs.Keys) {
    $correctArtists = $knownSongs[$songName]
    $foundSongs = $songs | Where-Object { $_.name -eq $songName }
    
    foreach ($song in $foundSongs) {
        if ($song.artist -and $correctArtists -notcontains $song.artist) {
            $issues += [PSCustomObject]@{
                SongName = $song.name
                CurrentArtist = $song.artist
                ExpectedArtist = $correctArtists -join " หรือ "
                Type = "Thai Song Mismatch"
                Id = $song.id
            }
        }
        else {
            $verified++
        }
    }
}

# Check international songs
foreach ($songName in $internationalSongs.Keys) {
    $correctArtists = $internationalSongs[$songName]
    $foundSongs = $songs | Where-Object { $_.name -eq $songName }
    
    foreach ($song in $foundSongs) {
        if ($song.artist -and $correctArtists -notcontains $song.artist) {
            $issues += [PSCustomObject]@{
                SongName = $song.name
                CurrentArtist = $song.artist
                ExpectedArtist = $correctArtists -join " or "
                Type = "International Song Mismatch"
                Id = $song.id
            }
        }
        else {
            $verified++
        }
    }
}

# Check for suspicious patterns
Write-Host "🔍 ตรวจสอบรูปแบบที่น่าสงสัย..." -ForegroundColor Yellow

# Pattern 1: Songs with null or empty artist
$noArtist = $songs | Where-Object { -not $_.artist }
Write-Host "  เพลงที่ไม่มีชื่อศิลปิน: $($noArtist.Count) เพลง"

# Pattern 2: Thai songs with English artist names (suspicious)
$thaiSongEnglishArtist = $songs | Where-Object { 
    $_.name -match '[\u0E00-\u0E7F]' -and 
    $_.artist -and 
    $_.artist -notmatch '[\u0E00-\u0E7F]' -and
    $_.artist -notmatch '^(feat|ft\.|featuring|&|x)' -and
    $_.era -notmatch 'สากล'
}
Write-Host "  เพลงไทยที่มีชื่อศิลปินเป็นภาษาอังกฤษ: $($thaiSongEnglishArtist.Count) เพลง"

# Pattern 3: English songs with Thai artist names (suspicious)
$englishSongThaiArtist = $songs | Where-Object { 
    $_.name -notmatch '[\u0E00-\u0E7F]' -and 
    $_.artist -match '[\u0E00-\u0E7F]' -and
    $_.era -match 'สากล'
}
Write-Host "  เพลงสากลที่มีชื่อศิลปินเป็นภาษาไทย: $($englishSongThaiArtist.Count) เพลง"

Write-Host ""

# Sample suspicious cases
if ($thaiSongEnglishArtist.Count -gt 0) {
    Write-Host "ตัวอย่างเพลงไทยที่มีศิลปินเป็นภาษาอังกฤษ (10 เพลงแรก):" -ForegroundColor Magenta
    $thaiSongEnglishArtist | Select-Object -First 10 | ForEach-Object {
        Write-Host "  📌 เพลง: $($_.name) | ศิลปิน: $($_.artist) | ยุค: $($_.era)"
    }
    Write-Host ""
}

if ($englishSongThaiArtist.Count -gt 0) {
    Write-Host "ตัวอย่างเพลงสากลที่มีศิลปินเป็นภาษาไทย (10 เพลงแรก):" -ForegroundColor Magenta
    $englishSongThaiArtist | Select-Object -First 10 | ForEach-Object {
        Write-Host "  📌 เพลง: $($_.name) | ศิลปิน: $($_.artist) | ยุค: $($_.era)"
    }
    Write-Host ""
}

# Check for duplicate song names with different artists
Write-Host "🔍 ตรวจสอบเพลงชื่อเดียวกันแต่ศิลปินต่างกัน..." -ForegroundColor Yellow
$duplicateNames = $songs | Where-Object { $_.artist } | Group-Object -Property name | Where-Object { $_.Count -gt 1 -and ($_.Group.artist | Select-Object -Unique).Count -gt 1 }

Write-Host "  พบเพลงชื่อซ้ำที่มีศิลปินต่างกัน: $($duplicateNames.Count) ชื่อ"
Write-Host ""

if ($duplicateNames.Count -gt 0) {
    Write-Host "รายการเพลงชื่อซ้ำ (20 รายการแรก):" -ForegroundColor Magenta
    $duplicateNames | Select-Object -First 20 | ForEach-Object {
        $songName = $_.Name
        $artists = $_.Group | Select-Object -ExpandProperty artist -Unique
        Write-Host "  📌 เพลง: $songName"
        foreach ($artist in $artists) {
            $count = ($_.Group | Where-Object { $_.artist -eq $artist }).Count
            Write-Host "     - ศิลปิน: $artist ($count version)"
        }
        Write-Host ""
    }
}

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "สรุปผลการตรวจสอบ" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ เพลงที่ตรวจสอบแล้วถูกต้อง: $verified เพลง"
Write-Host "✓ เพลงที่ไม่มีศิลปิน: $($noArtist.Count) เพลง"
Write-Host "✓ เพลงไทยที่มีศิลปินเป็นภาษาอังกฤษ: $($thaiSongEnglishArtist.Count) เพลง"
Write-Host "✓ เพลงสากลที่มีศิลปินเป็นภาษาไทย: $($englishSongThaiArtist.Count) เพลง"
Write-Host "✓ เพลงชื่อซ้ำที่มีศิลปินต่างกัน: $($duplicateNames.Count) ชื่อ"
Write-Host ""

# Save detailed report
$reportFile = "song-artist-verification-report.txt"
$report = @"
รายงานการตรวจสอบความถูกต้องของชื่อเพลงกับศิลปิน
วันที่: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

สถิติ:
- จำนวนเพลงทั้งหมด: $($songs.Count)
- เพลงที่มีศิลปิน: $(($songs | Where-Object { $_.artist }).Count)
- เพลงที่ไม่มีศิลปิน: $($noArtist.Count)

ปัญหาที่พบ:
- เพลงไทยที่มีศิลปินเป็นภาษาอังกฤษ: $($thaiSongEnglishArtist.Count)
- เพลงสากลที่มีศิลปินเป็นภาษาไทย: $($englishSongThaiArtist.Count)
- เพลงชื่อซ้ำที่มีศิลปินต่างกัน: $($duplicateNames.Count)

======================================
รายละเอียดเพลงที่ไม่มีศิลปิน (100 เพลงแรก)
======================================

"@

$noArtist | Select-Object -First 100 | ForEach-Object {
    $report += "$($_.name) | Era: $($_.era) | Singer: $($_.singer) | ID: $($_.id)`n"
}

$report += "`n======================================`n"
$report += "เพลงไทยที่มีศิลปินเป็นภาษาอังกฤษ (100 เพลงแรก)`n"
$report += "======================================`n`n"

$thaiSongEnglishArtist | Select-Object -First 100 | ForEach-Object {
    $report += "เพลง: $($_.name) | ศิลปิน: $($_.artist) | ยุค: $($_.era)`n"
}

$report += "`n======================================`n"
$report += "เพลงสากลที่มีศิลปินเป็นภาษาไทย (100 เพลงแรก)`n"
$report += "======================================`n`n"

$englishSongThaiArtist | Select-Object -First 100 | ForEach-Object {
    $report += "เพลง: $($_.name) | ศิลปิน: $($_.artist) | ยุค: $($_.era)`n"
}

$report += "`n======================================`n"
$report += "เพลงชื่อซ้ำที่มีศิลปินต่างกัน`n"
$report += "======================================`n`n"

$duplicateNames | ForEach-Object {
    $songName = $_.Name
    $report += "เพลง: $songName`n"
    $artists = $_.Group | Select-Object -ExpandProperty artist -Unique
    foreach ($artist in $artists) {
        $count = ($_.Group | Where-Object { $_.artist -eq $artist }).Count
        $report += "  - ศิลปิน: $artist ($count version)`n"
    }
    $report += "`n"
}

$report | Out-File -FilePath $reportFile -Encoding UTF8
Write-Host "💾 บันทึกรายงานแล้ว: $reportFile" -ForegroundColor Green
