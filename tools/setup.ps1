# Dictionary editor setup for Windows (PowerShell).
#
# Checks Node.js 18+, git, and GitHub CLI (gh). Asks before installing anything
# missing (through winget), logs in to gh if needed, downloads
# tools/dictionary-helper.js from the main branch, and runs it.
#
# Run in PowerShell:
#   irm https://jacedashs.github.io/udemy-quiz-translator/tools/setup.ps1 | iex
#
# The function returns instead of exiting, so the terminal window stays open.

function Invoke-DictionarySetup {
  $repo = "JaceDashS/udemy-quiz-translator"
  $helperUrl = "https://raw.githubusercontent.com/$repo/main/tools/dictionary-helper.js"
  $helperDir = Join-Path $HOME ".udemy-dictionary-helper"
  $helperFile = Join-Path $helperDir "dictionary-helper.js"

  function Write-Step($text) {
    Write-Host ""
    Write-Host "== $text" -ForegroundColor Cyan
  }

  function Update-PathFromRegistry {
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
  }

  function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
  }

  function Get-NodeMajor {
    if (-not (Test-Command node)) { return 0 }
    $version = (node -v) 2>$null
    if ($version -match '^v(\d+)') { return [int]$Matches[1] }
    return 0
  }

  function Confirm-Install($label) {
    $answer = Read-Host "$label is missing. Install it with winget now? [y/N]"
    return ($answer -match '^(y|yes)$')
  }

  function Install-WithWinget($id) {
    if (-not (Test-Command winget)) {
      Write-Host "winget is not available. Install it from the Microsoft Store (App Installer), then run this command again." -ForegroundColor Yellow
      return
    }
    winget install --id $id -e --accept-source-agreements --accept-package-agreements
    Update-PathFromRegistry
  }

  Write-Step "1/4 Node.js 18 or later"
  if ((Get-NodeMajor) -lt 18) {
    Write-Host "Node.js 18+ was not found."
    if (Confirm-Install "Node.js LTS") { Install-WithWinget "OpenJS.NodeJS.LTS" }
    Update-PathFromRegistry
    if ((Get-NodeMajor) -lt 18) {
      Write-Host "Node.js is still not available. Open a new PowerShell window and run this command again." -ForegroundColor Yellow
      return
    }
  }
  Write-Host "OK: Node.js $(node -v)" -ForegroundColor Green

  Write-Step "2/4 git"
  if (-not (Test-Command git)) {
    Write-Host "git was not found."
    if (Confirm-Install "Git") { Install-WithWinget "Git.Git" }
    Update-PathFromRegistry
    if (-not (Test-Command git)) {
      Write-Host "git is still not available. Open a new PowerShell window and run this command again." -ForegroundColor Yellow
      return
    }
  }
  Write-Host "OK: $(git --version)" -ForegroundColor Green

  Write-Step "3/4 GitHub CLI (gh) and login"
  if (-not (Test-Command gh)) {
    Write-Host "GitHub CLI (gh) was not found."
    if (Confirm-Install "GitHub CLI") { Install-WithWinget "GitHub.cli" }
    Update-PathFromRegistry
    if (-not (Test-Command gh)) {
      Write-Host "gh is still not available. Open a new PowerShell window and run this command again." -ForegroundColor Yellow
      return
    }
  }
  Write-Host "OK: $(gh --version | Select-Object -First 1)" -ForegroundColor Green

  gh auth status *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in to GitHub. Approve the login in your browser when it opens."
    gh auth login --web --git-protocol https
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Login was not completed. Run this command again." -ForegroundColor Yellow
      return
    }
  }
  # Lets git push and clone use the same GitHub login.
  gh auth setup-git
  Write-Host "OK: logged in to GitHub" -ForegroundColor Green

  Write-Step "4/4 Download and start the helper"
  New-Item -ItemType Directory -Force -Path $helperDir | Out-Null
  Invoke-WebRequest -Uri $helperUrl -OutFile $helperFile -UseBasicParsing
  Write-Host "Helper saved to $helperFile" -ForegroundColor Green
  Write-Host ""
  Write-Host "Keep this window open while you edit the dictionary."
  Write-Host "Editor: https://jacedashs.github.io/udemy-quiz-translator/editor/"
  Write-Host "Stop the helper with Ctrl+C."
  Write-Host ""
  node $helperFile
}

Invoke-DictionarySetup
