Write-Host "Configuring UniNet captive portal network..." -ForegroundColor Cyan

$ssid = "UniNet"
$password = "Student@2024"
$settingsPath = Join-Path $PSScriptRoot 'config\network_settings.json'
$portalIp = '192.168.137.1'
$captiveDnsSettings = $null
$allowedDomains = @("firebaseio.com", "googleapis.com", "gstatic.com", "firebase.google.com")

if (Test-Path -LiteralPath $settingsPath) {
    try {
        $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
        if ($settings.portal_ip) {
            $portalIp = $settings.portal_ip
        }
        if ($settings.captive_dns) {
            $captiveDnsSettings = $settings.captive_dns
        }
        if ($settings.allowed_domains) {
            $allowedDomains = $settings.allowed_domains
        }
    } catch {
        Write-Warning "Unable to parse network_settings.json. Falling back to defaults."
    }
}

Write-Host "\nStarting Wi-Fi hotspot '$ssid'" -ForegroundColor Yellow
netsh wlan set hostednetwork mode=allow ssid=$ssid key=$password | Out-Null
netsh wlan start hostednetwork | Out-Null

Write-Host "\nPreparing captive DNS redirector..." -ForegroundColor Yellow
if ($captiveDnsSettings -and $captiveDnsSettings.enabled) {
    Write-Host "Captive DNS will bind to $($captiveDnsSettings.listen_address):$($captiveDnsSettings.listen_port)." -ForegroundColor Green
    Write-Host "Ensure no other service is using UDP/TCP 53 before launching the portal." -ForegroundColor Green
} else {
    Write-Host "Captive DNS is disabled in config. Enable captive_dns.enabled for automatic login pop-ups." -ForegroundColor DarkYellow
}

$dnsRules = @(
    @{ Name = 'UniNet Captive DNS (UDP)'; Protocol = 'UDP'; Port = 53 },
    @{ Name = 'UniNet Captive DNS (TCP)'; Protocol = 'TCP'; Port = 53 }
)

foreach ($rule in $dnsRules) {
    if (-not (Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue)) {
        try {
            New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Protocol $rule.Protocol -LocalPort $rule.Port -Action Allow | Out-Null
            Write-Host "Added firewall allowance: $($rule.Name)." -ForegroundColor Green
        } catch {
            Write-Host "Unable to add firewall rule $($rule.Name)." -ForegroundColor DarkYellow
        }
    }
}

Write-Host "\nHardening Windows Firewall" -ForegroundColor Yellow
Set-NetFirewallProfile -Profile Domain,Public,Private -DefaultOutboundAction Block

$pythonCandidates = @()
$venvPython = Join-Path $PSScriptRoot ".\.venv\Scripts\python.exe"
if (Test-Path -LiteralPath $venvPython) {
    $pythonCandidates += $venvPython
}

$globalPython = Get-Command python.exe -ErrorAction SilentlyContinue
if ($globalPython) {
    $pythonCandidates += $globalPython.Source
}

$globalPythonw = Get-Command pythonw.exe -ErrorAction SilentlyContinue
if ($globalPythonw) {
    $pythonCandidates += $globalPythonw.Source
}

$pythonCandidates = $pythonCandidates | Where-Object { $_ } | Select-Object -Unique
foreach ($path in $pythonCandidates) {
    try {
        New-NetFirewallRule -DisplayName "Allow $(Split-Path $path -Leaf)" -Direction Outbound -Program $path -Action Allow -ErrorAction SilentlyContinue | Out-Null
    } catch {
        Write-Host "Unable to add firewall rule for $path" -ForegroundColor DarkYellow
    }
}

$firewallDomains = @($allowedDomains)
foreach ($domain in $firewallDomains) {
    try {
        $addresses = (Resolve-DnsName $domain -ErrorAction Stop).IPAddress
        foreach ($address in $addresses) {
            New-NetFirewallRule -DisplayName "Allow $domain $address" -Direction Outbound -RemoteAddress $address -Action Allow -ErrorAction SilentlyContinue | Out-Null
        }
    } catch {
        Write-Host "Unable to resolve $domain. Configure manually." -ForegroundColor DarkYellow
    }
}

Write-Host "\nNetwork setup complete." -ForegroundColor Green
Write-Host "Students can connect to '$ssid' using password '$password'." -ForegroundColor Green
Write-Host "Portal landing page: http://$portalIp/verify" -ForegroundColor Green
