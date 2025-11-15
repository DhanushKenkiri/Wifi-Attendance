param(
    [switch]$SkipHotspot,
    [switch]$SkipPortal,
    [switch]$SkipDashboard,
    [switch]$StartStudentWeb
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSCommandPath
$captivePortalPath = Join-Path $root 'captive-portal'
$dashboardPath = Join-Path $root 'teacher-dashboard'
$studentWebPath = Join-Path $root 'web-app'

function Start-NewConsole {
    param(
        [Parameter(Mandatory = $true)][string]$Title,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$Command
    )

    if (-not (Test-Path -LiteralPath $WorkingDirectory)) {
        Write-Warning "Skipping $Title because $WorkingDirectory was not found."
        return
    }

    $psArgs = @(
        '-NoExit',
        '-Command',
        "Set-Location -LiteralPath '$WorkingDirectory'; `$host.UI.RawUI.WindowTitle = '$Title'; $Command"
    )

    Start-Process -FilePath powershell.exe -ArgumentList $psArgs -WorkingDirectory $WorkingDirectory | Out-Null
    Write-Host "Started $Title window." -ForegroundColor Green
}

if (-not $SkipHotspot) {
    $hotspotScript = Join-Path $captivePortalPath 'setup_network.ps1'
    if (Test-Path -LiteralPath $hotspotScript) {
        Write-Host 'Configuring hotspot and firewall via setup_network.ps1...' -ForegroundColor Cyan
        & powershell.exe -ExecutionPolicy Bypass -File $hotspotScript
    } else {
        Write-Warning "Hotspot script not found at $hotspotScript."
    }
} else {
    Write-Host 'Skipping hotspot configuration as requested.' -ForegroundColor Yellow
}

if (-not $SkipPortal) {
    $portalCommand = "if (Test-Path '.\\.venv\\Scripts\\python.exe') { & '.\\.venv\\Scripts\\python.exe' 'app.py' } else { python app.py }"
    Start-NewConsole -Title 'Captive Portal API' -WorkingDirectory $captivePortalPath -Command $portalCommand
} else {
    Write-Host 'Skipping captive portal startup.' -ForegroundColor Yellow
}

if (-not $SkipDashboard) {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Warning 'npm was not detected in PATH. Install Node.js 18+ to run the teacher dashboard.'
    } else {
        $dashboardCommand = "npm run dev"
        Start-NewConsole -Title 'Teacher Dashboard' -WorkingDirectory $dashboardPath -Command $dashboardCommand
    }
} else {
    Write-Host 'Skipping teacher dashboard startup.' -ForegroundColor Yellow
}

if ($StartStudentWeb) {
    if (-not (Test-Path -LiteralPath $studentWebPath)) {
        Write-Warning "Student web app directory not found at $studentWebPath."
    } elseif (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Warning 'npm was not detected in PATH. Install Node.js 18+ to run the student web app.'
    } else {
        $webCommand = "npm run dev"
        Start-NewConsole -Title 'Student Web App' -WorkingDirectory $studentWebPath -Command $webCommand
    }
}

Write-Host 'All requested services have been launched (where possible).' -ForegroundColor Cyan
Write-Host 'Close the spawned windows to stop individual services.' -ForegroundColor Cyan
