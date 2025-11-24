# PowerShell script to restart the server
Write-Host "🛑 Stopping any existing server on port 5000..." -ForegroundColor Yellow

# Find and kill processes on port 5000
$processes = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($processes) {
    foreach ($pid in $processes) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "   ✅ Killed process $pid" -ForegroundColor Green
        } catch {
            Write-Host "   ⚠️  Could not kill process $pid" -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "   ℹ️  No process found on port 5000" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "🚀 Starting server..." -ForegroundColor Green
Write-Host ""

# Start the server
node server.js

