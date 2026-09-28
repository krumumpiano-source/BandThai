# ─────────────────────────────────────────────────────────────────
# deploy-github.ps1  — Push ทุก่างไปยัง GitHub
# ─────────────────────────────────────────────────────────────────
param(
  [string]$msg = "migrate to Supabase"
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host ""
Write-Host "══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Pushing to GitHub..." -ForegroundColor Cyan
Write-Host "══════════════════════════════════════" -ForegroundColor Cyan

$branch = git rev-parse --abbrev-ref HEAD
git add .
git commit -m $msg
git push origin $branch

if ($branch -eq "dev") {
  Write-Host ""
  Write-Host "🔄 กำลังอัปเดตเว็บจริง (Merge dev -> main)..." -ForegroundColor Cyan
  git checkout main
  git merge dev
  git push origin main
  git checkout dev
}

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "✅ Push สำเร็จ!" -ForegroundColor Green
  Write-Host ""
  Write-Host "GitHub Pages จะอัปเดตใน 1-2 นาที" -ForegroundColor Yellow
} else {
  Write-Host ""
  Write-Host "❌ Push ล้มเหลว ดู error ด้านบน" -ForegroundColor Red
}
