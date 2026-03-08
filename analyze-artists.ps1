# Script to analyze and find duplicate/similar artist names

$songs = Get-Content "existing-songs.json" -Raw | ConvertFrom-Json

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "การวิเคราะห์ชื่อศิลปินในฐานข้อมูล" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# 1. รวบรวมชื่อศิลปินทั้งหมด
$allArtists = $songs | Where-Object { $_.artist } | Select-Object -ExpandProperty artist

Write-Host "📊 สถิติทั่วไป:" -ForegroundColor Yellow
Write-Host "   - จำนวนเพลงทั้งหมด: $($songs.Count)"
Write-Host "   - จำนวนเพลงที่มีชื่อศิลปิน: $($allArtists.Count)"
Write-Host "   - จำนวนเพลงที่ไม่มีชื่อศิลปิน: $($songs.Count - $allArtists.Count)"
Write-Host ""

# 2. หาชื่อศิลปินที่ไม่ซ้ำกัน
$uniqueArtists = $allArtists | Select-Object -Unique | Sort-Object
Write-Host "   - จำนวนศิลปินที่ไม่ซ้ำกัน (ตามตัวอักษร): $($uniqueArtists.Count)"
Write-Host ""

# 3. หาชื่อที่มีปัญหาด้านช่องว่าง
Write-Host "🔍 ปัญหาด้านช่องว่าง:" -ForegroundColor Yellow
$spacingIssues = @()
foreach ($artist in $uniqueArtists) {
    $trimmed = $artist.Trim()
    if ($artist -ne $trimmed) {
        $spacingIssues += [PSCustomObject]@{
            Original = "'$artist'"
            Trimmed = "'$trimmed'"
            Issue = "มีช่องว่างหน้า/หลัง"
        }
    }
    if ($artist -match "\s{2,}") {
        $spacingIssues += [PSCustomObject]@{
            Original = "'$artist'"
            Trimmed = "'$($artist -replace "\s+", " ")'"
            Issue = "มีช่องว่างเกิน 1 ช่อง"
        }
    }
}

if ($spacingIssues.Count -gt 0) {
    Write-Host "   พบ $($spacingIssues.Count) รายการที่มีปัญหาช่องว่าง:" -ForegroundColor Red
    $spacingIssues | Format-Table -AutoSize
} else {
    Write-Host "   ✅ ไม่พบปัญหาด้านช่องว่าง" -ForegroundColor Green
}
Write-Host ""

# 4. จัดกลุ่มตามจำนวนการใช้งาน
Write-Host "📈 ศิลปินที่มีเพลงมากที่สุด (Top 20):" -ForegroundColor Yellow
$artistCounts = $allArtists | Group-Object | Sort-Object Count -Descending | Select-Object -First 20
$artistCounts | ForEach-Object {
    Write-Host "   $($_.Count.ToString().PadLeft(3)) เพลง - $($_.Name)"
}
Write-Host ""

# 5. ตรวจสอบชื่อที่คล้ายกัน (case-insensitive และ normalization)
Write-Host "🔍 ตรวจสอบชื่อศิลปินที่อาจซ้ำกัน:" -ForegroundColor Yellow

$normalizedMap = @{}
foreach ($artist in $uniqueArtists) {
    $normalized = $artist.Trim().ToLower() -replace '\s+', ' '
    if (-not $normalizedMap.ContainsKey($normalized)) {
        $normalizedMap[$normalized] = @()
    }
    $normalizedMap[$normalized] += $artist
}

$duplicates = $normalizedMap.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 }

if ($duplicates.Count -gt 0) {
    Write-Host "   พบ $($duplicates.Count) กลุ่มที่มีชื่อคล้ายกัน:" -ForegroundColor Red
    Write-Host ""
    foreach ($dup in $duplicates) {
        Write-Host "   📌 กลุ่ม: $($dup.Key)" -ForegroundColor Magenta
        foreach ($variant in $dup.Value) {
            $count = ($allArtists | Where-Object { $_ -eq $variant }).Count
            Write-Host "      - '$variant' ($count เพลง)"
        }
        Write-Host ""
    }
} else {
    Write-Host "   ✅ ไม่พบชื่อที่ซ้ำกัน" -ForegroundColor Green
}

# 6. แยกศิลปินร่วมกัน (Featuring/Collaboration)
Write-Host "🎤 ศิลปินร่วมกัน (Featuring/Collaboration):" -ForegroundColor Yellow
$collaborationPatterns = @('feat\.?', 'ft\.?', 'featuring', "&", ' x ', 'ร่วมกับ', 'กับ', ',')
$collaborations = @()

foreach ($artist in $uniqueArtists) {
    $isCollab = $false
    foreach ($pattern in $collaborationPatterns) {
        if ($artist -match $pattern) {
            $isCollab = $true
            break
        }
    }
    if ($isCollab) {
        $count = ($allArtists | Where-Object { $_ -eq $artist }).Count
        $collaborations += [PSCustomObject]@{
            Artist = $artist
            Songs = $count
        }
    }
}

if ($collaborations.Count -gt 0) {
    Write-Host "   พบ $($collaborations.Count) รายการที่เป็นศิลปินร่วมกัน:" -ForegroundColor Cyan
    $collaborations | Sort-Object Songs -Descending | ForEach-Object {
        Write-Host "      - $($_.Artist) ($($_.Songs) เพลง)"
    }
} else {
    Write-Host "   ไม่พบรูปแบบศิลปินร่วมกัน"
}
Write-Host ""

# 7. ตรวจสอบชื่อที่มีความยาวแปลกๆ
Write-Host "⚠️  ชื่อศิลปินที่มีความยาวผิดปกติ:" -ForegroundColor Yellow
$tooShort = $uniqueArtists | Where-Object { $_.Length -le 2 }
$tooLong = $uniqueArtists | Where-Object { $_.Length -ge 50 }

if ($tooShort.Count -gt 0) {
    Write-Host "   สั้นเกินไป (<= 2 ตัวอักษร):" -ForegroundColor Red
    $tooShort | ForEach-Object {
        $count = ($allArtists | Where-Object { $_ -eq $_ }).Count
        Write-Host "      - '$_'"
    }
}

if ($tooLong.Count -gt 0) {
    Write-Host "   ยาวเกินไป (>= 50 ตัวอักษร):" -ForegroundColor Red
    $tooLong | ForEach-Object {
        Write-Host "      - '$_' (ความยาว: $($_.Length))"
    }
}

if ($tooShort.Count -eq 0 -and $tooLong.Count -eq 0) {
    Write-Host "   ✅ ไม่พบชื่อที่มีความยาวผิดปกติ" -ForegroundColor Green
}
Write-Host ""

# 8. หาคำที่อาจสะกดผิด (เช่น มีตัวเลขหรืออักขระพิเศษ)
Write-Host "🔍 ชื่อศิลปินที่มีตัวเลขหรืออักขระพิเศษ:" -ForegroundColor Yellow
$specialChars = $uniqueArtists | Where-Object { 
    $_ -match "[0-9]" -or 
    $_ -match "[!@#\$%\^*\(\)_+=\[\]{}|\\:;<>\?/~]" 
}

if ($specialChars.Count -gt 0) {
    Write-Host "   พบ $($specialChars.Count) รายการ:" -ForegroundColor Cyan
    $specialChars | ForEach-Object {
        $count = ($allArtists | Where-Object { $_ -eq $_ }).Count
        Write-Host "      - '$_' ($count เพลง)"
    }
} else {
    Write-Host "   ✅ ไม่พบชื่อที่มีอักขระพิเศษผิดปกติ" -ForegroundColor Green
}
Write-Host ""

# 9. สรุปผล
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "สรุปผลการวิเคราะห์" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "✓ ศิลปินทั้งหมด: $($uniqueArtists.Count) ราย"
Write-Host "✓ ปัญหาช่องว่าง: $($spacingIssues.Count) รายการ"
Write-Host "✓ ชื่อที่อาจซ้ำกัน: $($duplicates.Count) กลุ่ม"
Write-Host "✓ ศิลปินร่วมกัน: $($collaborations.Count) รายการ"
Write-Host "✓ ชื่อสั้น/ยาวผิดปกติ: $($tooShort.Count + $tooLong.Count) รายการ"
Write-Host "✓ ชื่อที่มีอักขระพิเศษ: $($specialChars.Count) รายการ"
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# บันทึกผลลงไฟล์
$reportFile = "artist-analysis-report.txt"
$report = @"
รายงานการวิเคราะห์ชื่อศิลปิน
วันที่: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

สถิติทั่วไป:
- จำนวนเพลงทั้งหมด: $($songs.Count)
- จำนวนเพลงที่มีชื่อศิลปิน: $($allArtists.Count)
- จำนวนศิลปินไม่ซ้ำกัน: $($uniqueArtists.Count)

ปัญหาที่พบ:
- ปัญหาช่องว่าง: $($spacingIssues.Count) รายการ
- ชื่อที่อาจซ้ำกัน: $($duplicates.Count) กลุ่ม
- ศิลปินร่วมกัน: $($collaborations.Count) รายการ
- ชื่อสั้น/ยาวผิดปกติ: $($tooShort.Count + $tooLong.Count) รายการ
- ชื่อที่มีอักขระพิเศษ: $($specialChars.Count) รายการ

รายละเอียดชื่อที่อาจซ้ำกัน:
"@

if ($duplicates.Count -gt 0) {
    foreach ($dup in $duplicates) {
        $report += "`n`nกลุ่ม: $($dup.Key)`n"
        foreach ($variant in $dup.Value) {
            $count = ($allArtists | Where-Object { $_ -eq $variant }).Count
            $report += "  - '$variant' ($count เพลง)`n"
        }
    }
}

$report | Out-File -FilePath $reportFile -Encoding UTF8
Write-Host "💾 บันทึกรายงานแล้ว: $reportFile" -ForegroundColor Green
