$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

$Port = 3000
$Addresses = @()

try {
  $Addresses = @(
    Get-NetIPConfiguration |
      Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.IPv4Address -ne $null } |
      ForEach-Object { $_.IPv4Address.IPAddress } |
      Where-Object {
        $_ -notlike "127.*" -and
        $_ -notlike "169.254.*"
      }
  )
} catch {
  $Addresses = @()
}

if ($Addresses.Count -eq 0) {
  try {
    $Addresses = @(
      Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
          $_.IPAddress -notlike "127.*" -and
          $_.IPAddress -notlike "169.254.*" -and
          $_.InterfaceAlias -notmatch "vEthernet|Loopback|Docker|WSL"
        } |
        Select-Object -ExpandProperty IPAddress
    )
  } catch {
    $Addresses = @()
  }
}

Write-Host ""
Write-Host "Tracker is starting for phone access." -ForegroundColor Cyan
Write-Host "Laptop and phone must be on the same Wi-Fi network." -ForegroundColor Yellow

if ($Addresses.Count -gt 0) {
  Write-Host ""
  Write-Host "Open this URL on your phone:" -ForegroundColor Green
  foreach ($Address in $Addresses) {
    Write-Host "  http://${Address}:${Port}/mobile" -ForegroundColor Green
  }
} else {
  Write-Host ""
  Write-Host "Could not detect Wi-Fi IP automatically." -ForegroundColor Yellow
  Write-Host "Open a new PowerShell tab and run: ipconfig" -ForegroundColor Yellow
  Write-Host "Then use IPv4 Address from Wi-Fi: http://YOUR-IP:3000/mobile" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Do not open 0.0.0.0 on the phone. Use the 192.168.x.x / 172.x.x.x address above." -ForegroundColor Yellow
Write-Host "If it does not open, allow Node.js in Windows Firewall for Private networks." -ForegroundColor Yellow
Write-Host ""

pnpm dev:lan
