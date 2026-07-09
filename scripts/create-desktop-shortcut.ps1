param(
  [string]$ShortcutName = 'BasePlate',
  [switch]$Build,
  [switch]$PreferDev
)

$ErrorActionPreference = 'Stop'

$scriptPath = $MyInvocation.MyCommand.Path
$scriptsDir = Split-Path -Parent $scriptPath
$repoRoot = Split-Path -Parent $scriptsDir
$launcherPath = Join-Path $scriptsDir 'launch-baseplate.ps1'
$iconPath = Join-Path $repoRoot 'assets\icon.ico'

if ($Build) {
  Push-Location $repoRoot
  try {
    npm run pack:win
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path -LiteralPath $launcherPath)) {
  throw "Missing launcher script: $launcherPath"
}

$desktopPath = [Environment]::GetFolderPath('DesktopDirectory')
$shortcutPath = Join-Path $desktopPath "$ShortcutName.lnk"
$powershellPath = (Get-Command powershell.exe).Source
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcherPath`""

if ($PreferDev) {
  $arguments += ' -PreferDev'
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellPath
$shortcut.Arguments = $arguments
$shortcut.WorkingDirectory = $repoRoot
$shortcut.Description = 'Launch BasePlate'

if (Test-Path -LiteralPath $iconPath) {
  $shortcut.IconLocation = $iconPath
}

$shortcut.Save()

Write-Host "Created desktop shortcut: $shortcutPath"
Write-Host "Launcher target: $launcherPath"