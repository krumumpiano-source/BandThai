# Script to fix duplicate artist names in existing-songs.json

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "แก้ไขชื่อศิลปินที่ซ้ำกัน" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Load songs
$songs = Get-Content "existing-songs.json" -Raw | ConvertFrom-Json
$originalCount = $songs.Count
Write-Host "จำนวนเพลงเดิม: $originalCount"

# Track changes
$changes = @()
$duplicatesToRemove = @()

# 1. Find and mark TATTOO COLOUR duplicates for removal
Write-Host "`n1. ตรวจสอบ TATTOO COLOUR vs Tattoo Colour..." -ForegroundColor Yellow
$tattooUpper = $songs | Where-Object { $_.artist -eq "TATTOO COLOUR" }
$tattooTitle = $songs | Where-Object { $_.artist -eq "Tattoo Colour" }

Write-Host "   - 'TATTOO COLOUR': $($tattooUpper.Count) เพลง"
Write-Host "   - 'Tattoo Colour': $($tattooTitle.Count) เพลง"

if ($tattooUpper.Count -gt 0 -and $tattooTitle.Count -gt 0) {
    Write-Host "   ❌ พบเพลงซ้ำ! จะลบ 'TATTOO COLOUR' ออกและเก็บ 'Tattoo Colour'" -ForegroundColor Red
    foreach ($song in $tattooUpper) {
        $duplicatesToRemove += $song.id
        $changes += "ลบ: $($song.name) - TATTOO COLOUR (ซ้ำกับ Tattoo Colour)"
    }
}

# 2. Find and mark Colorpitch duplicates for removal
Write-Host "`n2. ตรวจสอบ COLORPiTCH vs Colorpitch..." -ForegroundColor Yellow
$colorUpper = $songs | Where-Object { $_.artist -eq "COLORPiTCH" }
$colorTitle = $songs | Where-Object { $_.artist -eq "Colorpitch" }

Write-Host "   - 'COLORPiTCH': $($colorUpper.Count) เพลง"
Write-Host "   - 'Colorpitch': $($colorTitle.Count) เพลง"

if ($colorUpper.Count -gt 0 -and $colorTitle.Count -gt 0) {
    Write-Host "   ❌ พบเพลงซ้ำ! จะลบ 'Colorpitch' ออกและเก็บ 'COLORPiTCH'" -ForegroundColor Red
    foreach ($song in $colorTitle) {
        $duplicatesToRemove += $song.id
        $changes += "ลบ: $($song.name) - Colorpitch (ซ้ำกับ COLORPiTCH)"
    }
}

# 3. Remove duplicates
Write-Host "`n3. ลบเพลงซ้ำ..." -ForegroundColor Yellow
$filteredSongs = $songs | Where-Object { $duplicatesToRemove -notcontains $_.id }
$removedCount = $originalCount - $filteredSongs.Count
Write-Host "   ลบออก: $removedCount เพลง"
Write-Host "   เหลือ: $($filteredSongs.Count) เพลง"

# 4. Show summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "สรุปการเปลี่ยนแปลง" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "จำนวนเพลงเดิม: $originalCount"
Write-Host "จำนวนเพลงที่ลบ: $removedCount"
Write-Host "จำนวนเพลงใหม่: $($filteredSongs.Count)"
Write-Host ""
Write-Host "รายละเอียด:" -ForegroundColor Yellow
foreach ($change in $changes) {
    Write-Host "  - $change"
}
Write-Host ""

# 5. Save backup
$backupFile = "existing-songs.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
Write-Host "กำลังสำรอง existing-songs.json → $backupFile" -ForegroundColor Yellow
Copy-Item "existing-songs.json" $backupFile
Write-Host "✅ สำรองข้อมูลเรียบร้อย" -ForegroundColor Green

# 6. Save updated file
Write-Host "`nกำลังบันทึกไฟล์ใหม่..." -ForegroundColor Yellow
$filteredSongs | ConvertTo-Json -Depth 10 | Out-File "existing-songs.json" -Encoding UTF8
Write-Host "✅ บันทึกเรียบร้อย" -ForegroundColor Green

# 7. Verify
Write-Host "`nตรวจสอบผลลัพธ์..." -ForegroundColor Yellow
$newSongs = Get-Content "existing-songs.json" -Raw | ConvertFrom-Json
$allArtists = $newSongs | Where-Object { $_.artist } | Select-Object -ExpandProperty artist
$uniqueArtists = $allArtists | Select-Object -Unique

Write-Host "  เพลงทั้งหมด: $($newSongs.Count)"
Write-Host "  ศิลปินไม่ซ้ำกัน: $($uniqueArtists.Count)"

$tattooCheck = $newSongs | Where-Object { $_.artist -like "*Tattoo*" } | Select-Object -ExpandProperty artist -Unique
$colorCheck = $newSongs | Where-Object { $_.artist -like "*COLOR*" -or $_.artist -like "*Color*" } | Select-Object -ExpandProperty artist -Unique

Write-Host "`nตรวจสอบศิลปินที่แก้ไข:" -ForegroundColor Cyan
Write-Host "  Tattoo Colour: $($tattooCheck -join ', ')"
Write-Host "  COLORPiTCH: $($colorCheck -join ', ')"

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "✅ เสร็จสิ้น!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
