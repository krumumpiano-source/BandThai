# Lookup original artist + first release year using MusicBrainz (conservative)
# - Does NOT modify existing-songs.json
# - Writes report files for human confirmation
#
# Requirements:
# - Original artist only
# - First release year only
# - If unsure => "ไม่พบข้อมูล" (do not guess)
#
# Notes:
# MusicBrainz rate limit: ~1 req/sec. This script throttles requests.

param(
    [int]$Limit = 30,
    [int]$MinScore = 95,
    [int]$CandidatesPerSong = 10,
    [int]$MaxReleaseGroupsPerRecording = 6
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$jsonPath = "existing-songs.json"

function Convert-FromMojibake([string]$text) {
    if ([string]::IsNullOrWhiteSpace($text)) { return $text }

    # If already Thai Unicode, do not convert.
    if ($text -match '[\u0E00-\u0E7F]') { return $text }

    # Only attempt conversion for likely-mojibake strings.
    if ($text -notmatch 'à') { return $text }

    # Common mojibake pattern in this dataset is UTF-8 bytes mis-decoded as Windows-1252.
    $enc1252 = [System.Text.Encoding]::GetEncoding(1252)
    $utf8 = [System.Text.Encoding]::UTF8
    return $utf8.GetString($enc1252.GetBytes($text))
}

function Get-YearFromDate([string]$dateText) {
    if ([string]::IsNullOrWhiteSpace($dateText)) { return $null }
    if ($dateText -match '^([0-9]{4})') { return [int]$matches[1] }
    return $null
}

function Join-ArtistCredit($artistCredit) {
    if (-not $artistCredit) { return $null }
    $parts = @()
    foreach ($ac in $artistCredit) {
        $namePart = $null
        if ($ac.PSObject.Properties.Name -contains 'name' -and $ac.name) {
            $namePart = [string]$ac.name
        }
        elseif ($ac.PSObject.Properties.Name -contains 'artist' -and $ac.artist -and $ac.artist.name) {
            $namePart = [string]$ac.artist.name
        }
        if ($namePart) { $parts += $namePart }

        if ($ac.PSObject.Properties.Name -contains 'joinphrase' -and $ac.joinphrase) {
            $parts += [string]$ac.joinphrase
        }
    }
    if ($parts.Count -eq 0) { return $null }
    return ($parts -join '')
}

function Test-IsEligibleReleaseGroup($rg) {
    if (-not $rg) { return $false }

    $primary = $null
    if ($rg.PSObject.Properties.Name -contains 'primary-type') { $primary = [string]$rg.'primary-type' }
    if ($primary -notin @('Album', 'Single', 'EP')) { return $false }

    $secondary = @()
    if ($rg.PSObject.Properties.Name -contains 'secondary-types' -and $rg.'secondary-types') {
        $secondary = @($rg.'secondary-types' | ForEach-Object { [string]$_ })
    }

    foreach ($bad in @('Compilation', 'Live', 'Remix', 'Soundtrack', 'DJ-mix', 'Spokenword', 'Interview')) {
        if ($secondary -contains $bad) { return $false }
    }

    return $true
}

function Invoke-MbGet([string]$uri) {
    $headers = @{ 'User-Agent' = 'BandManagementBySoulCiety/1.0 (metadata lookup; contact: local-script)' }
    return Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
}

$releaseGroupCache = @{}
function Get-ReleaseGroup([string]$releaseGroupId) {
    if ([string]::IsNullOrWhiteSpace($releaseGroupId)) { return $null }
    if ($releaseGroupCache.ContainsKey($releaseGroupId)) { return $releaseGroupCache[$releaseGroupId] }

    $rgUrl = "https://musicbrainz.org/ws/2/release-group/${releaseGroupId}?fmt=json"
    $rg = Invoke-MbGet $rgUrl
    Start-Sleep -Milliseconds 1100
    $releaseGroupCache[$releaseGroupId] = $rg
    return $rg
}

Write-Host "Reading songs from $jsonPath" -ForegroundColor Cyan
$songs = Get-Content $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json

# Target: songs with missing artist (null/empty)
$targets = $songs | Where-Object { -not $_.artist -or $_.artist -eq "" }
$targets = $targets | Select-Object -First $Limit

Write-Host "Targets (missing artist): $($targets.Count) (limit=$Limit)" -ForegroundColor Cyan
Write-Host "MinScore=$MinScore (below => ไม่พบข้อมูล)" -ForegroundColor DarkGray

$results = New-Object System.Collections.Generic.List[object]

$index = 0
foreach ($song in $targets) {
    $index++

    $nameRaw = [string]$song.name
    $nameFixed = Convert-FromMojibake $nameRaw
    $fullTitle = $nameFixed.Trim()

    # If the title ends with parentheses, try to treat it as an artist hint (e.g. "ฝืน(ลิปตา)")
    $titleOnly = $fullTitle
    $artistHint = $null
    if ($fullTitle -match '^(?<t>.*?)\s*\((?<h>[^\)]+)\)\s*$') {
        $titleOnly = $matches['t'].Trim()
        $hint = $matches['h'].Trim()
        if (-not [string]::IsNullOrWhiteSpace($hint)) {
            # Ignore known non-artist suffixes
            if ($hint -notmatch '^(ยิ่น|ตอง|live|remix|acoustic|ver\.?|version)$') {
                $artistHint = $hint
            }
        }
    }

    $queryTitle = $titleOnly
    if ([string]::IsNullOrWhiteSpace($queryTitle)) { $queryTitle = $fullTitle }

    Write-Host "[$index/$($targets.Count)] $queryTitle" -ForegroundColor White

    $reportItem = [ordered]@{
        id = $song.id
        name_raw = $nameRaw
        name = $nameFixed
        query = $queryTitle
        source = 'MusicBrainz'
        mb_recording_id = $null
        mb_recording_url = $null
        original_artist = 'ไม่พบข้อมูล'
        first_release_year = 'ไม่พบข้อมูล'
        score = $null
        confidence = 'low'
        note = $null
        candidates = @()
    }

    try {
        $hintFailed = $false
        $queryExpr = "recording:`"$queryTitle`""
        if ($artistHint) {
            $queryExpr = $queryExpr + " AND artist:`"$artistHint`""
        }
        $escaped = [uri]::EscapeDataString($queryExpr)
        $searchUrl = "https://musicbrainz.org/ws/2/recording/?query=${escaped}&limit=5&fmt=json"
        $search = Invoke-MbGet $searchUrl
        Start-Sleep -Milliseconds 1100

        if ($artistHint -and (-not $search.recordings -or $search.recordings.Count -eq 0)) {
            # Retry without artist hint (some artist names differ by language/romanization)
            $hintFailed = $true
            $queryExpr = "recording:`"$queryTitle`""
            $escaped = [uri]::EscapeDataString($queryExpr)
            $searchUrl = "https://musicbrainz.org/ws/2/recording/?query=${escaped}&limit=5&fmt=json"
            $search = Invoke-MbGet $searchUrl
            Start-Sleep -Milliseconds 1100
        }

        if (-not $search.recordings -or $search.recordings.Count -eq 0) {
            $reportItem.note = 'No recording matches'
            $results.Add([pscustomobject]$reportItem)
            continue
        }

        $ordered = $search.recordings | Sort-Object { [int]$_.score } -Descending | Select-Object -First $CandidatesPerSong
        $candidateResults = New-Object System.Collections.Generic.List[object]

        foreach ($cand in $ordered) {
            $candId = [string]$cand.id
            $candScore = [int]$cand.score

            $candItem = [ordered]@{
                mb_recording_id = $candId
                mb_recording_url = "https://musicbrainz.org/recording/${candId}"
                score = $candScore
                artist = $null
                first_release_year = $null
                note = $null
            }

            try {
                $recUrl = "https://musicbrainz.org/ws/2/recording/${candId}?inc=artist-credits+releases+release-groups&fmt=json"
                $rec = Invoke-MbGet $recUrl
                Start-Sleep -Milliseconds 1100

                $candItem.artist = Join-ArtistCredit $rec.'artist-credit'

                # Prefer earliest release-group first-release-date (more stable than release dates)
                $years = @()
                $releaseGroupIds = New-Object System.Collections.Generic.HashSet[string]

                if ($rec.releases) {
                    foreach ($rel in $rec.releases) {
                        # Collect release-group IDs (if present)
                        if ($rel -and $rel.PSObject -and ($rel.PSObject.Properties.Name -contains 'release-group')) {
                            $rgObj = $rel.'release-group'
                            if ($rgObj -and $rgObj.id) {
                                [void]$releaseGroupIds.Add([string]$rgObj.id)
                            }
                        }

                        # Fallback: record any explicit release dates
                        $relDate = $null
                        if ($rel -and $rel.PSObject -and ($rel.PSObject.Properties.Name -contains 'date')) {
                            $relDate = [string]$rel.date
                        }
                        $y = Get-YearFromDate $relDate
                        if ($null -ne $y) { $years += $y }
                    }
                }

                $rgYears = @()
                $rgTake = 0
                foreach ($rgId in $releaseGroupIds) {
                    $rgTake++
                    if ($rgTake -gt $MaxReleaseGroupsPerRecording) { break }
                    $rg = Get-ReleaseGroup $rgId
                    if (-not (Test-IsEligibleReleaseGroup $rg)) { continue }

                    $rgDate = $null
                    if ($rg.PSObject.Properties.Name -contains 'first-release-date') {
                        $rgDate = [string]$rg.'first-release-date'
                    }
                    $y = Get-YearFromDate $rgDate
                    if ($null -ne $y) { $rgYears += $y }
                }

                if ($rgYears.Count -gt 0) {
                    $candItem.first_release_year = ($rgYears | Measure-Object -Minimum).Minimum
                }
                elseif ($years.Count -gt 0) {
                    $candItem.first_release_year = ($years | Measure-Object -Minimum).Minimum
                }
            }
            catch {
                $candItem.note = "Error: $($_.Exception.Message)"
            }

            $candidateResults.Add([pscustomobject]$candItem)
        }

        $reportItem['candidates'] = @($candidateResults.ToArray())

        if ($hintFailed) {
            $reportItem.note = 'No matches with artist hint; title-only candidates included for manual review'
            $results.Add([pscustomobject]$reportItem)
            continue
        }

        $good = @($candidateResults | Where-Object { $_.score -ge $MinScore -and $_.artist -and $_.first_release_year })
        if ($good.Count -eq 0) {
            $bestScore = @($candidateResults | Sort-Object score -Descending | Select-Object -First 1)
            if ($bestScore.Count -gt 0) {
                $reportItem.score = $bestScore[0].score
                $reportItem.note = "No candidate meets requirements (score/artist/year)"
            } else {
                $reportItem.note = 'No candidates'
            }
            $results.Add([pscustomobject]$reportItem)
            continue
        }

        $goodSorted = @($good | Sort-Object score -Descending)
        $topScore = $goodSorted[0].score
        $reportItem.score = $topScore

        # Ambiguity detection: multiple near-top candidates (title-only searches are risky)
        $nearTop = @($goodSorted | Where-Object { ($topScore - $_.score) -le 3 })
        $distinctArtists = @($nearTop | Select-Object -ExpandProperty artist -Unique)
        $distinctYears = @($nearTop | Select-Object -ExpandProperty first_release_year -Unique)
        if ($nearTop.Count -gt 1 -and ($distinctArtists.Count -gt 1 -or $distinctYears.Count -gt 1)) {
            $reportItem.note = 'Ambiguous: multiple near-top candidates'
            $results.Add([pscustomobject]$reportItem)
            continue
        }

        # Select: best score, then earliest year (to prefer original over covers)
        $selected = @(
            $good |
                Sort-Object -Property @(
                    @{ Expression = 'score'; Descending = $true },
                    @{ Expression = 'first_release_year'; Descending = $false }
                ) |
                Select-Object -First 1
        )[0]
        $reportItem.mb_recording_id = $selected.mb_recording_id
        $reportItem.mb_recording_url = $selected.mb_recording_url
        $reportItem.original_artist = $selected.artist
        $reportItem.first_release_year = $selected.first_release_year
        $reportItem.confidence = 'medium'
        $reportItem.note = 'Selected best candidate (score, then earliest year)'

        $results.Add([pscustomobject]$reportItem)
    }
    catch {
        $pos = $null
        if ($_.InvocationInfo -and $_.InvocationInfo.PositionMessage) { $pos = ($_.InvocationInfo.PositionMessage -replace "\r?\n", ' ') }
        $reportItem.note = "Error: $($_.Exception.GetType().FullName): $($_.Exception.Message)" + $(if ($pos) { " | $pos" } else { '' })
        $results.Add([pscustomobject]$reportItem)
    }
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$jsonOut = "original-metadata-report-$timestamp.json"
$csvOut = "original-metadata-report-$timestamp.csv"

$results | ConvertTo-Json -Depth 10 | Set-Content $jsonOut -Encoding UTF8

$csvRows = $results | ForEach-Object {
    [pscustomobject]@{
        id = $_.id
        name_raw = $_.name_raw
        name = $_.name
        query = $_.query
        source = $_.source
        mb_recording_id = $_.mb_recording_id
        mb_recording_url = $_.mb_recording_url
        original_artist = $_.original_artist
        first_release_year = $_.first_release_year
        score = $_.score
        confidence = $_.confidence
        note = $_.note
        candidate_count = @($_.candidates).Count
    }
}

$csvRows | Export-Csv -Path $csvOut -NoTypeInformation -Encoding UTF8

Write-Host "" 
Write-Host "Wrote reports:" -ForegroundColor Green
Write-Host "  - $jsonOut" -ForegroundColor Green
Write-Host "  - $csvOut" -ForegroundColor Green

$found = @($results | Where-Object { $_.original_artist -ne 'ไม่พบข้อมูล' }).Count
Write-Host "Found metadata for: $found / $($results.Count)" -ForegroundColor Cyan
