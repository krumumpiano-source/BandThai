# Script to analyze artist names - Simplified version

$songs = Get-Content "existing-songs.json" -Raw | ConvertFrom-Json

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "รายงานการวิเคราะห์ชื่อศิลปิน" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Basic stats
$allArtists = $songs | Where-Object { $_.artist } | Select-Object -ExpandProperty artist
$uniqueArtists = $allArtists | Select-Object -Unique | Sort-Object

Write-Host "สถิติทั่วไป:" -ForegroundColor Yellow
Write-Host "  เพลงทั้งหมด: $($songs.Count)"
Write-Host "  เพลงที่มีศิลปิน: $($allArtists.Count)"
Write-Host "  ศิลปินไม่ซ้ำกัน: $($uniqueArtists.Count)"
Write-Host ""

# 2. Top artists
Write-Host "Top 30 ศิลปินที่มีเพลงมากที่สุด:" -ForegroundColor Yellow
$topArtists = $allArtists | Group-Object | Sort-Object Count -Descending | Select-Object -First 30
foreach ($a in $topArtists) {
    Write-Host "  $($a.Count.ToString().PadLeft(3)) เพลง - $($a.Name)"
}
Write-Host ""

# 3. Check for spacing issues
Write-Host "ตรวจสอบปัญหาช่องว่าง:" -ForegroundColor Yellow
$spacingIssues = @()
foreach ($artist in $uniqueArtists) {
    $trimmed = $artist.Trim()
    if ($artist -ne $trimmed) {
        $count = ($allArtists | Where-Object { $_ -eq $artist }).Count
        $spacingIssues += [PSCustomObject]@{
            Original = $artist
            Trimmed = $trimmed
            Count = $count
        }
    }
}

if ($spacingIssues.Count -gt 0) {
    Write-Host "  พบ $($spacingIssues.Count) รายการที่มีช่องว่างหน้า/หลัง:" -ForegroundColor Red
    $spacingIssues | Format-Table -AutoSize
} else {
    Write-Host "  ไม่พบปัญหา" -ForegroundColor Green
}
Write-Host ""

# 4. Check for case variations
Write-Host "ตรวจสอบชื่อที่ต่างกันแค่ตัวพิมพ์เล็ก/ใหญ่:" -ForegroundColor Yellow
$caseVariations = @()
$lowerMap = @{}

foreach ($artist in $uniqueArtists) {
    $lower = $artist.ToLower().Trim()
    if (-not $lowerMap.ContainsKey($lower)) {
        $lowerMap[$lower] = @()
    }
    $lowerMap[$lower] += $artist
}

$duplicateGroups = $lowerMap.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 }

if ($duplicateGroups.Count -gt 0) {
    Write-Host "  พบ $($duplicateGroups.Count) กลุ่มที่มีชื่อคล้ายกัน:" -ForegroundColor Red
    foreach ($group in $duplicateGroups) {
        Write-Host ""
        Write-Host "  กลุ่ม: $($group.Key)" -ForegroundColor Magenta
        foreach ($variant in $group.Value) {
            $count = ($allArtists | Where-Object { $_ -eq $variant }).Count
            Write-Host "    - '$variant' ($count เพลง)"
        }
    }
    Write-Host ""
} else {
    Write-Host "  ไม่พบปัญหา" -ForegroundColor Green
}
Write-Host ""

# 5. Check for collaborations
Write-Host "ศิลปินร่วมกัน (Featuring/Collaboration):" -ForegroundColor Yellow
$collabPatterns = @('feat', 'ft\.', 'featuring', ' x ', 'ร่วมกับ')
$collaborations = @()

foreach ($artist in $uniqueArtists) {
    $isCollab = $false
    $matchedPattern = ""
    
    if ($artist.Contains('&')) {
        $isCollab = $true
        $matchedPattern = "มี &"
    }
    elseif ($artist.Contains(',') -and $artist.Length -gt 20) {
        $isCollab = $true
        $matchedPattern = "มี ,"
    }
    else {
        foreach ($pattern in $collabPatterns) {
            if ($artist -match $pattern) {
                $isCollab = $true
                $matchedPattern = $pattern
                break
            }
        }
    }
    
    if ($isCollab) {
        $count = ($allArtists | Where-Object { $_ -eq $artist }).Count
        $collaborations += [PSCustomObject]@{
            Artist = $artist
            Count = $count
            Pattern = $matchedPattern
        }
    }
}

if ($collaborations.Count -gt 0) {
    Write-Host "  พบ $($collaborations.Count) รายการ:" -ForegroundColor Cyan
    $collaborations | Sort-Object Count -Descending | Format-Table Artist, Count, Pattern -Wrap
} else {
    Write-Host "  ไม่พบรูปแบบศิลปินร่วมกัน"
}
Write-Host ""

# 6. Check for unusual length
Write-Host "ชื่อที่มีความยาวผิดปกติ:" -ForegroundColor Yellow
$shortNames = $uniqueArtists | Where-Object { $_.Length -le 2 }
$longNames = $uniqueArtists | Where-Object { $_.Length -ge 50 }

if ($shortNames.Count -gt 0) {
    Write-Host "  สั้นเกินไป (<=2 ตัวอักษร): $($shortNames.Count) ราย" -ForegroundColor Red
    foreach ($name in $shortNames) {
        Write-Host "    - '$name'"
    }
}

if ($longNames.Count -gt 0) {
    Write-Host "  ยาวเกินไป (>=50 ตัวอักษร): $($longNames.Count) ราย" -ForegroundColor Red
    foreach ($name in $longNames) {
        Write-Host "    - '$name' (ความยาว: $($name.Length))"
    }
}

if ($shortNames.Count -eq 0 -and $longNames.Count -eq 0) {
    Write-Host "  ไม่พบปัญหา" -ForegroundColor Green
}
Write-Host ""

# 7. Check for special characters and numbers
Write-Host "ชื่อที่มีตัวเลข:" -ForegroundColor Yellow
$withNumbers = $uniqueArtists | Where-Object { $_ -match "\d" }
if ($withNumbers.Count -gt 0) {
    Write-Host "  พบ $($withNumbers.Count) รายการ:" -ForegroundColor Cyan
    foreach ($name in $withNumbers) {
        $count = ($allArtists | Where-Object { $_ -eq $name }).Count
        Write-Host "    - '$name' ($count เพลง)"
    }
} else {
    Write-Host "  ไม่พบ" -ForegroundColor Green
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "สรุป" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ศิลปินทั้งหมด: $($uniqueArtists.Count) ราย"
Write-Host "ปัญหาช่องว่าง: $($spacingIssues.Count) รายการ"
Write-Host "ชื่อที่อาจซ้ำกัน: $($duplicateGroups.Count) กลุ่ม"
Write-Host "ศิลปินร่วมกัน: $($collaborations.Count) รายการ"
Write-Host "ชื่อสั้น/ยาวผิดปกติ: $($shortNames.Count + $longNames.Count) รายการ"
Write-Host "ชื่อที่มีตัวเลข: $($withNumbers.Count) รายการ"
Write-Host "========================================" -ForegroundColor Cyan

# Save report
$reportFile = "artist-analysis-report.txt"
$report = @"
รายงานการวิเคราะห์ชื่อศิลปิน
วันที่: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

สถิติ:
- เพลงทั้งหมด: $($songs.Count)
- เพลงที่มีศิลปิน: $($allArtists.Count)
- ศิลปินไม่ซ้ำกัน: $($uniqueArtists.Count)

สรุปปัญหา:
- ปัญหาช่องว่าง: $($spacingIssues.Count)
- ชื่อที่อาจซ้ำกัน: $($duplicateGroups.Count) กลุ่ม
- ศิลปินร่วมกัน: $($collaborations.Count)
- ชื่อสั้น/ยาวผิดปกติ: $($shortNames.Count + $longNames.Count)
- ชื่อที่มีตัวเลข: $($withNumbers.Count)

======================================
รายละเอียดชื่อที่อาจซ้ำกัน
======================================

"@

if ($duplicateGroups.Count -gt 0) {
    foreach ($group in $duplicateGroups) {
        $report += "`nกลุ่ม: $($group.Key)`n"
        foreach ($variant in $group.Value) {
            $count = ($allArtists | Where-Object { $_ -eq $variant }).Count
            $report += "  - '$variant' ($count เพลง)`n"
        }
    }
}

$report += "`n======================================`n"
$report += "รายละเอียดศิลปินร่วมกัน`n"
$report += "======================================`n`n"

if ($collaborations.Count -gt 0) {
    foreach ($collab in ($collaborations | Sort-Object Count -Descending)) {
        $report += "$($collab.Artist) ($($collab.Count) เพลง) - รูปแบบ: $($collab.Pattern)`n"
    }
}

$report | Out-File -FilePath $reportFile -Encoding UTF8
Write-Host ""
Write-Host "บันทึกรายงานแล้ว: $reportFile" -ForegroundColor Green
