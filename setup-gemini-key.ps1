# Gemini API Key Setup Script
# This script helps you set up your Gemini API key

Write-Host "`n🤖 Gemini API Key Setup`n" -ForegroundColor Cyan
Write-Host "This script will help you configure your Gemini API key for AI features.`n" -ForegroundColor White

$envFile = "server\.env"

# Check if .env file exists
if (-not (Test-Path $envFile)) {
    Write-Host "❌ server/.env file not found!" -ForegroundColor Red
    Write-Host "Creating it now...`n" -ForegroundColor Yellow
    
    $defaultContent = @"
PORT=5000
MONGODB_URI=mongodb://localhost:27017/spireworks
OPENAI_API_KEY=your-openai-api-key-here
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-secret-key-change-this-in-production
GEMINI_API_KEY=your-gemini-api-key-here
"@
    $defaultContent | Out-File -FilePath $envFile -Encoding utf8
    Write-Host "✅ Created server/.env file`n" -ForegroundColor Green
}

# Read current .env content
$content = Get-Content $envFile -Raw
$lines = Get-Content $envFile

# Check current API key status
$currentKey = ""
foreach ($line in $lines) {
    if ($line -match "^GEMINI_API_KEY\s*=\s*(.+)$") {
        $currentKey = $matches[1].Trim()
        break
    }
}

Write-Host "Current Status:" -ForegroundColor Yellow
if ($currentKey -and $currentKey -ne "your-gemini-api-key-here" -and $currentKey -ne "") {
    $keyPreview = $currentKey.Substring(0, [Math]::Min(10, $currentKey.Length)) + "..."
    Write-Host "  ✅ API Key is set: $keyPreview" -ForegroundColor Green
    Write-Host "`nIf you're still getting errors, make sure to restart the backend server!`n" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "  ❌ API Key is NOT set (still using placeholder)`n" -ForegroundColor Red
}

Write-Host "To get your FREE Gemini API key:" -ForegroundColor Cyan
Write-Host "  1. Go to: https://aistudio.google.com/app/apikey" -ForegroundColor White
Write-Host "  2. Sign in with your Google account" -ForegroundColor White
Write-Host "  3. Click 'Create API Key'" -ForegroundColor White
Write-Host "  4. Copy the API key (starts with 'AIzaSy...')`n" -ForegroundColor White

$apiKey = Read-Host "Paste your Gemini API key here (or press Enter to skip)"

if ($apiKey -and $apiKey.Trim() -ne "") {
    $apiKey = $apiKey.Trim()
    
    # Validate format (should start with AIzaSy)
    if (-not $apiKey.StartsWith("AIzaSy")) {
        Write-Host "`n⚠️  Warning: API key doesn't start with 'AIzaSy'. Make sure you copied the correct key.`n" -ForegroundColor Yellow
        $continue = Read-Host "Continue anyway? (y/n)"
        if ($continue -ne "y" -and $continue -ne "Y") {
            Write-Host "`nCancelled. Please run this script again with the correct API key.`n" -ForegroundColor Yellow
            exit 0
        }
    }
    
    # Update .env file
    $newLines = @()
    $found = $false
    foreach ($line in $lines) {
        if ($line -match "^GEMINI_API_KEY\s*=") {
            $newLines += "GEMINI_API_KEY=$apiKey"
            $found = $true
        } else {
            $newLines += $line
        }
    }
    
    if (-not $found) {
        $newLines += "GEMINI_API_KEY=$apiKey"
    }
    
    $newLines | Out-File -FilePath $envFile -Encoding utf8 -NoNewline
    # Add newline at end
    Add-Content -Path $envFile -Value ""
    
    Write-Host "`n✅ API key saved to server/.env file!" -ForegroundColor Green
    Write-Host "`n⚠️  IMPORTANT: Restart your backend server for changes to take effect!" -ForegroundColor Yellow
    Write-Host "  1. Stop the backend server (Ctrl+C)" -ForegroundColor White
    Write-Host "  2. Run: cd server" -ForegroundColor White
    Write-Host "  3. Run: npm run dev`n" -ForegroundColor White
} else {
    Write-Host "`n⚠️  No API key provided. Skipping setup.`n" -ForegroundColor Yellow
    Write-Host "You can manually edit server/.env and add:" -ForegroundColor White
    Write-Host "  GEMINI_API_KEY=your-actual-api-key-here`n" -ForegroundColor Cyan
}

