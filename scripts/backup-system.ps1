param(
  [string]$OutputRoot = "..\SAISOKU_BACKUPS\system",
  [string]$BotRepo = "..\saisoku-bot-sales"
)

$ErrorActionPreference = "Stop"

function Get-TimeStamp {
  return Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
}

function Write-GitArchive {
  param(
    [string]$RepoPath,
    [string]$OutputZip
  )

  if (-not (Test-Path -LiteralPath $RepoPath)) {
    throw "Repo path not found: $RepoPath"
  }

  git -C $RepoPath archive --format zip --output $OutputZip HEAD
}

function Get-GitCommit {
  param([string]$RepoPath)

  try {
    return (git -C $RepoPath rev-parse HEAD).Trim()
  } catch {
    return ""
  }
}

$timestamp = Get-TimeStamp
$root = Resolve-Path -LiteralPath "."
$outputDir = Join-Path $OutputRoot $timestamp
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$webZip = Join-Path $outputDir "saisoku-insight-sales.zip"
$botZip = Join-Path $outputDir "saisoku-bot-sales.zip"

Write-GitArchive -RepoPath $root -OutputZip $webZip
Write-GitArchive -RepoPath $BotRepo -OutputZip $botZip

$webCommit = Get-GitCommit -RepoPath $root
$botCommit = Get-GitCommit -RepoPath $BotRepo

$commits = @"
SAISOKU SYSTEM BACKUP
Created At: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Web Repo: saisoku-insight-sales
Web Commit: $webCommit

Bot Repo: saisoku-bot-sales
Bot Commit: $botCommit

Notes:
- ZIP files are generated from git HEAD only.
- Local env files and secrets are not included.
- Keep secrets in a password manager or encrypted vault.
"@

Set-Content -Path (Join-Path $outputDir "commits.txt") -Value $commits -Encoding UTF8

Write-Host "System backup written to $outputDir"
