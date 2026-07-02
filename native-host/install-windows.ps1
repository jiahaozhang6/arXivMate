param(
  [string]$ExtensionId = "odhkkofghndibicnadgcopplhbogglko",
  [switch]$ChromeOnly,
  [switch]$EdgeOnly
)

$ErrorActionPreference = "Stop"

$HostName = "com.arxivmate.local"
$SourceScript = Join-Path $PSScriptRoot "arxivmate-native-host.js"
$SourceLauncher = Join-Path $PSScriptRoot "arxivmate-native-host.cmd"
if (-not (Test-Path -LiteralPath $SourceScript)) {
  throw "Native host script not found: $SourceScript"
}
if (-not (Test-Path -LiteralPath $SourceLauncher)) {
  throw "Native host launcher not found: $SourceLauncher"
}

$InstallDir = Join-Path $env:LOCALAPPDATA "arXivMate\native-host"
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Copy-Item -LiteralPath $SourceScript -Destination (Join-Path $InstallDir "arxivmate-native-host.js") -Force
Copy-Item -LiteralPath $SourceLauncher -Destination (Join-Path $InstallDir "arxivmate-native-host.cmd") -Force

$ManifestPath = Join-Path $InstallDir "$HostName.json"
$HostScript = Join-Path $InstallDir "arxivmate-native-host.cmd"
$Manifest = [ordered]@{
  name = $HostName
  description = "arXivMate local Codex/Claude config reader"
  path = $HostScript
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
$Manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8

$Targets = @()
if (-not $EdgeOnly) {
  $Targets += "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
}
if (-not $ChromeOnly) {
  $Targets += "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName"
}

foreach ($Target in $Targets) {
  New-Item -Path $Target -Force | Out-Null
  Set-Item -Path $Target -Value $ManifestPath
}

Write-Host "Installed $HostName"
Write-Host "Manifest: $ManifestPath"
Write-Host "Allowed extension: chrome-extension://$ExtensionId/"
