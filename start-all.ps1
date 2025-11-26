# Start All Services Script
Write-Host "`n🚀 Starting All Services...`n" -ForegroundColor Green
Write-Host "📦 Frontend (React) - Port 3000" -ForegroundColor Cyan
Write-Host "⚙️  Backend (Node.js) - Port 5000" -ForegroundColor Magenta  
Write-Host "🗄️  MongoDB - Port 27017" -ForegroundColor Yellow
Write-Host "`nStarting services...`n" -ForegroundColor White

# Check MongoDB
$mongoRunning = netstat -ano | Select-String -Pattern ":27017" | Select-String -Pattern "LISTENING"
if ($mongoRunning) {
    Write-Host "✅ MongoDB is already running`n" -ForegroundColor Green
} else {
    Write-Host "⚠️  MongoDB is not running. Please start it manually.`n" -ForegroundColor Yellow
}

# Start Frontend and Backend using concurrently
npm run dev

