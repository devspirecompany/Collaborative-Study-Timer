# MongoDB Installation Verification Script
Write-Host "`n=== Checking MongoDB Installation ===" -ForegroundColor Cyan

# Check if MongoDB is installed
$mongodPath = Get-Command mongod -ErrorAction SilentlyContinue
$mongoPath = Get-Command mongo -ErrorAction SilentlyContinue

if ($mongodPath) {
    Write-Host "✅ MongoDB Server (mongod) found at: $($mongodPath.Source)" -ForegroundColor Green
} else {
    Write-Host "❌ MongoDB Server (mongod) not found in PATH" -ForegroundColor Red
}

if ($mongoPath) {
    Write-Host "✅ MongoDB Shell (mongo) found at: $($mongoPath.Source)" -ForegroundColor Green
} else {
    Write-Host "⚠️  MongoDB Shell (mongo) not found (optional)" -ForegroundColor Yellow
}

# Check MongoDB service
Write-Host "`n=== Checking MongoDB Service ===" -ForegroundColor Cyan
$mongoService = Get-Service -Name "*mongo*" -ErrorAction SilentlyContinue

if ($mongoService) {
    foreach ($service in $mongoService) {
        $status = if ($service.Status -eq 'Running') { "✅ Running" } else { "❌ Stopped" }
        $color = if ($service.Status -eq 'Running') { "Green" } else { "Red" }
        Write-Host "$status - $($service.Name) ($($service.DisplayName))" -ForegroundColor $color
    }
} else {
    Write-Host "❌ MongoDB service not found" -ForegroundColor Red
    Write-Host "   MongoDB may not be installed or not installed as a service" -ForegroundColor Yellow
}

# Check if MongoDB is listening on port 27017
Write-Host "`n=== Checking MongoDB Port (27017) ===" -ForegroundColor Cyan
$portCheck = Test-NetConnection -ComputerName localhost -Port 27017 -InformationLevel Quiet -WarningAction SilentlyContinue

if ($portCheck) {
    Write-Host "✅ MongoDB is listening on port 27017" -ForegroundColor Green
    Write-Host "   Your application should be able to connect!" -ForegroundColor Green
} else {
    Write-Host "❌ MongoDB is not listening on port 27017" -ForegroundColor Red
    Write-Host "   MongoDB may not be running. Try starting the service:" -ForegroundColor Yellow
    Write-Host "   Start-Service MongoDB" -ForegroundColor Gray
}

Write-Host "`n=== Next Steps ===" -ForegroundColor Cyan
if ($portCheck) {
    Write-Host "✅ MongoDB is ready! Your backend server should connect automatically." -ForegroundColor Green
} else {
    Write-Host "1. If MongoDB is installed, start the service:" -ForegroundColor Yellow
    Write-Host "   Start-Service MongoDB" -ForegroundColor Gray
    Write-Host "2. If MongoDB is not installed, download from:" -ForegroundColor Yellow
    Write-Host "   https://www.mongodb.com/try/download/community" -ForegroundColor Gray
    Write-Host "3. After installation, run this script again to verify" -ForegroundColor Yellow
}

Write-Host ""

