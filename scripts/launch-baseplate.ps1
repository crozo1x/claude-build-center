param(
  [switch]$PreferDev
)

$ErrorActionPreference = 'Stop'

function Show-BasePlateLaunchError {
  param([string]$Message)

  [Console]::Error.WriteLine($Message)

  try {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($Message, 'BasePlate launch failed', 'OK', 'Error') | Out-Null
  } catch {
    # Keep the command-line error above as the fallback for machines without WPF loaded.
  }
}

$scriptPath = $MyInvocation.MyCommand.Path
$scriptsDir = Split-Path -Parent $scriptPath
$repoRoot = Split-Path -Parent $scriptsDir
$unpackedExe = Join-Path $repoRoot 'dist\win-unpacked\BasePlate.exe'
$nodeModules = Join-Path $repoRoot 'node_modules'

if (-not $PreferDev -and (Test-Path -LiteralPath $unpackedExe)) {
  Start-Process -FilePath $unpackedExe -WorkingDirectory (Split-Path -Parent $unpackedExe)
  exit 0
}

if (-not (Test-Path -LiteralPath $nodeModules)) {
  Show-BasePlateLaunchError "BasePlate dependencies are missing. Open PowerShell in '$repoRoot' and run 'npm install', or run 'npm run pack:win' to create dist\win-unpacked\BasePlate.exe."
  exit 1
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue

if (-not $npm) {
  Show-BasePlateLaunchError 'Could not find npm.cmd on PATH. Install Node.js, then reopen PowerShell and try launching BasePlate again.'
  exit 1
}

Start-Process -FilePath $npm.Source -ArgumentList @('start') -WorkingDirectory $repoRoot -WindowStyle Hidden