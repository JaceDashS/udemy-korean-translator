# Dictionary helper: a Chrome native messaging host for the dictionary editor.
#
# Chrome starts this script when the extension connects, and stops it (closes
# stdin) when the extension disconnects, is turned off, or Chrome exits.
# It needs only Windows PowerShell 5.1 and GitHub CLI (gh); no Node or git.
#
# Requests (JSON, one at a time):
#   ping    -> answers at once with $HostVersion (registered and up to date?)
#   update  -> replaces this file with the script the extension sends, then exits
#   status  -> whether gh is installed and logged in, the login, push permission
#   install -> installs GitHub CLI with winget
#   login   -> opens a PowerShell window that runs `gh auth login --web`
#   submit  -> writes only the changed term files (terms/<name>.json) on top of
#              the newest dictionary branch, or answers with the conflicts.
#              owner: commits to the dictionary branch
#              others: forks, commits to a new branch, opens a pull request
#   proposals      -> the user's open dictionary pull requests; conflicted ones
#                     list their term files with both values
#   updateProposal -> rebuilds a conflicted pull request with the chosen values
# dictionary.json is rebuilt from the term files by the branch's Actions workflow.
#
# Registered by tools/register.ps1.

$ErrorActionPreference = "Stop"

# Raise this whenever the requests or their answers change. The editor reads it
# from the copy bundled in the extension and asks to update an older host.
$HostVersion = 3

$Repo ="JaceDashS/udemy-korean-translator"
$Branch = "dictionary"

$MaxWordLength = 200
$Utf8 = New-Object System.Text.UTF8Encoding $false

$stdin = [Console]::OpenStandardInput()
$stdout = [Console]::OpenStandardOutput()

# stdout carries the protocol, so diagnostics go to stderr only.
function Write-Log([string]$text) {
  [Console]::Error.WriteLine("[$(Get-Date -Format o)] $text")
}

# ---- Native messaging framing: 4-byte little-endian length + UTF-8 JSON ----

function Read-Exactly([int]$count) {
  $buffer = New-Object byte[] $count
  $offset = 0
  while ($offset -lt $count) {
    $read = $stdin.Read($buffer, $offset, $count - $offset)
    if ($read -le 0) { return $null }
    $offset += $read
  }
  return , $buffer
}

function Send-Message($object) {
  $bytes = $Utf8.GetBytes((ConvertTo-Json $object -Compress -Depth 6))
  $stdout.Write([BitConverter]::GetBytes([int]$bytes.Length), 0, 4)
  $stdout.Write($bytes, 0, $bytes.Length)
  $stdout.Flush()
}

class HelperError : System.Exception {
  HelperError([string]$message) : base($message) {}
}

# ---- GitHub CLI ----

# Installs change PATH in the registry; this process must see the new value.
function Update-PathFromRegistry {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machine;$user"
}

function Find-Gh {
  Update-PathFromRegistry
  $command = Get-Command gh.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $default = Join-Path $env:ProgramFiles "GitHub CLI\gh.exe"
  if (Test-Path $default) { return $default }
  return $null
}

# Runs gh without a shell and returns exit code, stdout, and stderr.
function Invoke-Gh([string[]]$arguments) {
  $gh = Find-Gh
  if (-not $gh) { throw [HelperError]::new("GitHub CLI is not installed.") }

  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $gh
  $info.Arguments = ($arguments | ForEach-Object { ConvertTo-Argument $_ }) -join " "
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.StandardOutputEncoding = $Utf8
  $info.StandardErrorEncoding = $Utf8

  $process = [System.Diagnostics.Process]::Start($info)
  $out = $process.StandardOutput.ReadToEndAsync()
  $err = $process.StandardError.ReadToEndAsync()
  $process.WaitForExit()
  return [pscustomobject]@{
    Code = $process.ExitCode
    Out = $out.Result.Trim()
    Err = $err.Result.Trim()
  }
}

# Quotes one argument for the Windows command line (CommandLineToArgvW rules).
function ConvertTo-Argument([string]$value) {
  if ($value -and $value -notmatch '[\s"]') { return $value }
  $escaped = $value -replace '(\\*)"', '$1$1\"'
  $escaped = $escaped -replace '(\\+)$', '$1$1'
  return '"' + $escaped + '"'
}

# Calls the GitHub API through gh. A request body is passed as a temporary JSON file.
function Invoke-GhApi([string]$path, [string]$method = "GET", $body = $null, [string]$jq = "") {
  $arguments = @("api", "-X", $method, $path)
  $temp = $null
  if ($null -ne $body) {
    $temp = [IO.Path]::GetTempFileName()
    [IO.File]::WriteAllText($temp, (ConvertTo-Json $body -Compress -Depth 6), $Utf8)
    $arguments += @("--input", $temp)
  }
  if ($jq) { $arguments += @("--jq", $jq) }
  try {
    $result = Invoke-Gh $arguments
  } finally {
    if ($temp) { Remove-Item $temp -Force -ErrorAction SilentlyContinue }
  }
  if ($result.Code -ne 0) {
    $detail = if ($result.Err) { $result.Err } else { $result.Out }
    throw [HelperError]::new("gh api $method $path failed: $detail")
  }
  return $result.Out
}

# ---- Requests ----

function Get-Status {
  if (-not (Find-Gh)) {
    return @{ ok = $true; gh = $false; ghAuth = $false }
  }
  $user = Invoke-Gh @("api", "user", "--jq", ".login")
  if ($user.Code -ne 0) {
    return @{ ok = $true; gh = $true; ghAuth = $false }
  }
  $push = Invoke-Gh @("api", "repos/$Repo", "--jq", ".permissions.push")
  return @{
    ok = $true
    gh = $true
    ghAuth = $true
    login = $user.Out
    canPush = ($push.Code -eq 0 -and $push.Out -eq "true")
  }
}

function Install-Gh {
  if (Find-Gh) { return @{ ok = $true; installed = $true } }

  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw [HelperError]::new("winget is not available. Install App Installer from the Microsoft Store, then try again.")
  }

  Write-Log "installing GitHub CLI with winget"
  $process = Start-Process -FilePath $winget.Source -Wait -PassThru -WindowStyle Hidden -ArgumentList @(
    "install", "--id", "GitHub.cli", "-e", "--silent",
    "--accept-source-agreements", "--accept-package-agreements"
  )
  if (-not (Find-Gh)) {
    throw [HelperError]::new("GitHub CLI was not installed (winget exit code $($process.ExitCode)).")
  }
  return @{ ok = $true; installed = $true }
}

# The login runs in a visible window: gh shows a one-time code there. The
# extension opens github.com/login/device in a Chrome tab, so gh's own browser
# launch is turned off (GH_BROWSER) to avoid a second tab.
function Start-Login {
  $gh = Find-Gh
  if (-not $gh) { throw [HelperError]::new("GitHub CLI is not installed.") }

  $script = @"
`$host.UI.RawUI.WindowTitle = 'GitHub 로그인'
Write-Host 'GitHub 로그인' -ForegroundColor Cyan
Write-Host '1. 아래에 나오는 일회용 코드(XXXX-XXXX)를 확인하세요.'
Write-Host '2. 질문이 나오면 Enter를 누르세요.'
Write-Host '3. 열린 Chrome 탭(github.com/login/device)에 코드를 입력하고 승인하세요.'
Write-Host ''
`$env:GH_BROWSER = 'cmd /c rem'
& '$($gh -replace "'", "''")' auth login --web --hostname github.com --git-protocol https
if (`$LASTEXITCODE -eq 0) {
  Write-Host ''
  Write-Host '로그인했습니다. 이 창은 닫아도 됩니다. 사전 편집기가 이어서 진행합니다.' -ForegroundColor Green
} else {
  Write-Host ''
  Write-Host '로그인하지 못했습니다. 사전 편집기에서 GitHub 로그인 버튼을 다시 누르세요.' -ForegroundColor Yellow
}
"@
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
  Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-NoExit", "-EncodedCommand", $encoded) | Out-Null
  Write-Log "opened the login window"
  return @{ ok = $true }
}

# ---- Term files: terms/<name>.json on the dictionary branch, one per term ----

$TermPath = '^terms/[a-z0-9-]+-[0-9a-f]{8}\.json$'

# Rejects a change that is not a term file path with a valid term (or a delete).
function Get-Changes($request) {
  $changes = @($request.changes)
  if ($changes.Count -eq 0) { throw [HelperError]::new("No changes were sent.") }
  if ($changes.Count -gt 5000) { throw [HelperError]::new("Too many changes.") }
  foreach ($change in $changes) {
    if ([string]$change.path -notmatch $TermPath) {
      throw [HelperError]::new("Invalid term path: $($change.path)")
    }
    if ($null -ne $change.base -and [string]$change.base -notmatch '^[0-9a-f]{40}$') {
      throw [HelperError]::new("Invalid base for $($change.path)")
    }
    if ($null -ne $change.content) { Test-Term ([string]$change.content) $change.path }
  }
  return $changes
}

function Test-Term([string]$content, [string]$path) {
  try {
    $term = $content | ConvertFrom-Json
  } catch {
    throw [HelperError]::new("$path is not valid JSON.")
  }
  $word = $term.word
  $ok = ($word -is [string]) -and $word.Trim().Length -gt 0 -and $word.Length -le $MaxWordLength
  if ($ok -and $null -ne $term.meaning) {
    $ok = ($term.meaning -is [string]) -and $term.meaning.Length -le $MaxWordLength
  }
  if ($ok -and $null -ne $term.exact) { $ok = $term.exact -eq $true }
  if (-not $ok) { throw [HelperError]::new("Invalid term in $($path): $content") }
}

# Git's blob id of a text, to compare a file with what is on the branch.
function Get-BlobSha([string]$text) {
  $bytes = $Utf8.GetBytes($text)
  $header = $Utf8.GetBytes("blob $($bytes.Length)`0")
  $sha1 = [Security.Cryptography.SHA1]::Create()
  $all = New-Object byte[] ($header.Length + $bytes.Length)
  [Array]::Copy($header, $all, $header.Length)
  [Array]::Copy($bytes, 0, $all, $header.Length, $bytes.Length)
  return (($sha1.ComputeHash($all) | ForEach-Object { $_.ToString("x2") }) -join "")
}

function Get-TargetSha($change) {
  if ($null -eq $change.content) { return $null }
  return Get-BlobSha ([string]$change.content)
}

function Get-Head([string]$repository) {
  return Invoke-GhApi "repos/$repository/git/ref/heads/$Branch" -jq ".object.sha"
}

# The commit's tree id and the blob id of every term file, in one call.
function Get-TermState([string]$repository, [string]$commit) {
  $json = Invoke-GhApi "repos/$repository/git/trees/$($commit)?recursive=1" -jq '{tree: .sha, truncated: .truncated, files: [.tree[] | select(.type == "blob" and (.path | startswith("terms/"))) | {path, sha}]}'
  $data = $json | ConvertFrom-Json
  if ($data.truncated) { throw [HelperError]::new("The term list is too large to read at once.") }
  $shas = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([StringComparer]::Ordinal)
  foreach ($file in @($data.files)) { $shas[$file.path] = $file.sha }
  return @{ Tree = $data.tree; Shas = $shas }
}

function Get-Sha($state, [string]$path) {
  if ($state.Shas.ContainsKey($path)) { return $state.Shas[$path] }
  return $null
}

function Get-BlobText([string]$repository, $sha) {
  if ($null -eq $sha) { return $null }
  $base64 = Invoke-GhApi "repos/$repository/git/blobs/$sha" -jq ".content"
  return $Utf8.GetString([Convert]::FromBase64String(($base64 -replace '\s', '')))
}

# Splits the changes against the branch state: already equal (dropped),
# conflicting (the file changed since the editor loaded it), or pending.
function Compare-Changes([string]$repository, $state, $changes) {
  $pending = New-Object System.Collections.Generic.List[object]
  $conflicts = New-Object System.Collections.Generic.List[object]
  foreach ($change in $changes) {
    $current = Get-Sha $state $change.path
    if ($current -eq (Get-TargetSha $change)) { continue }
    if ($current -ne $change.base) {
      $conflicts.Add(@{ path = $change.path; current = (Get-BlobText $repository $current) })
    } else {
      $pending.Add($change)
    }
  }
  return @{ Pending = $pending; Conflicts = $conflicts }
}

# One commit on top of $parent that writes or deletes the changed term files.
function New-TermsCommit([string]$repository, [string]$parent, [string]$tree, $changes, [string]$message) {
  $entries = @(foreach ($change in $changes) {
    if ($null -eq $change.content) {
      @{ path = $change.path; mode = "100644"; type = "blob"; sha = $null }
    } else {
      @{ path = $change.path; mode = "100644"; type = "blob"; content = [string]$change.content }
    }
  })
  $newTree = Invoke-GhApi "repos/$repository/git/trees" "POST" @{ base_tree = $tree; tree = $entries } ".sha"
  return Invoke-GhApi "repos/$repository/git/commits" "POST" @{ message = $message; tree = $newTree; parents = @($parent) } ".sha"
}

function Move-Branch([string]$repository, [string]$name, [string]$commit, [bool]$force) {
  $flag = if ($force) { "force=true" } else { "force=false" }
  $result = Invoke-Gh @("api", "-X", "PATCH", "repos/$repository/git/refs/heads/$name", "-f", "sha=$commit", "-F", $flag)
  return $result.Code -eq 0
}

function Get-Message($request) {
  $message = ([string]$request.message).Trim()
  if (-not $message) { throw [HelperError]::new("A commit message is required.") }
  if ($message.Length -gt 4000) { throw [HelperError]::new("The commit message is too long.") }
  return $message
}

function Get-Fork {
  $fork = Invoke-GhApi "repos/$Repo/forks" "POST" @{} ".full_name"
  for ($i = 0; $i -lt 30; $i++) {
    if ((Invoke-Gh @("api", "repos/$fork", "--jq", ".full_name")).Code -eq 0) { break }
    Start-Sleep -Seconds 1
  }
  return $fork
}

# Owner: commits only the changed term files on top of the newest dictionary
# branch, so other people's terms are never overwritten. A term that changed
# on the branch since the editor loaded it comes back as a conflict, and
# nothing is committed. If another push lands between reading and writing,
# the branch update is refused (no force) and the whole check runs again.
# Everyone else: the same check, then a commit on a fork branch and a pull request.
function Submit-Terms($request) {
  $message = Get-Message $request
  $changes = Get-Changes $request

  $status = Get-Status
  if (-not $status.ghAuth) { throw [HelperError]::new("GitHub CLI is not logged in.") }

  for ($attempt = 1; $attempt -le 3; $attempt++) {
    $head = Get-Head $Repo
    $state = Get-TermState $Repo $head
    $check = Compare-Changes $Repo $state $changes
    if ($check.Conflicts.Count -gt 0) {
      Write-Log "conflicts: $($check.Conflicts.Count)"
      return @{ ok = $true; conflicts = @($check.Conflicts) }
    }
    $mode = if ($status.canPush) { "direct" } else { "proposal" }
    if ($check.Pending.Count -eq 0) { return @{ ok = $true; mode = $mode; changed = $false } }

    if ($status.canPush) {
      $commit = New-TermsCommit $Repo $head $state.Tree $check.Pending $message
      if (Move-Branch $Repo $Branch $commit $false) {
        Write-Log "direct commit $commit ($($check.Pending.Count) files)"
        return @{ ok = $true; mode = "direct"; changed = $true; commit = $commit.Substring(0, 7) }
      }
      Write-Log "branch moved during submit; retrying ($attempt)"
      continue
    }

    $fork = Get-Fork
    $commit = New-TermsCommit $fork $head $state.Tree $check.Pending $message
    $newBranch = "dictionary-update-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
    Invoke-GhApi "repos/$fork/git/refs" "POST" @{ ref = "refs/heads/$newBranch"; sha = $commit } ".ref" | Out-Null
    $owner = $fork.Split("/")[0]
    $url = Invoke-GhApi "repos/$Repo/pulls" "POST" @{
      title = $message.Split("`n")[0]
      head = "$($owner):$newBranch"
      base = $Branch
      body = "Submitted from the dictionary editor. Each term is its own file, so this can be merged with the merge button."
    } ".html_url"
    Write-Log "proposal opened $url ($($check.Pending.Count) files)"
    return @{ ok = $true; mode = "proposal"; changed = $true; url = $url }
  }
  throw [HelperError]::new("The dictionary branch kept changing. Try again in a moment.")
}

# The open dictionary pull requests of the logged-in user. For a conflicted
# one, every term file it changes is listed with its own value and the
# branch's current value; `conflict` marks files that both sides changed.
function Get-Proposals {
  $status = Get-Status
  if (-not $status.ghAuth) { throw [HelperError]::new("GitHub CLI is not logged in.") }
  $login = $status.login

  $json = Invoke-GhApi "repos/$Repo/pulls?state=open&base=$Branch&per_page=100" -jq "[.[] | select(.user.login == `"$login`" and (.head.ref | startswith(`"dictionary-update-`"))) | {number, url: .html_url, title}]"
  $list = New-Object System.Collections.Generic.List[object]
  $current = $null
  foreach ($pr in @($json | ConvertFrom-Json)) {
    if ($null -eq $pr) { continue }
    $info = $null
    for ($i = 0; $i -lt 4; $i++) {
      $info = Invoke-GhApi "repos/$Repo/pulls/$($pr.number)" -jq "{mergeable, head: .head.sha, repo: .head.repo.full_name}" | ConvertFrom-Json
      if ($null -ne $info.mergeable) { break }
      Start-Sleep -Seconds 2
    }
    $item = @{ number = $pr.number; url = $pr.url; title = $pr.title; mergeable = $info.mergeable }
    if ($info.mergeable -eq $false) {
      if ($null -eq $current) { $current = Get-TermState $Repo (Get-Head $Repo) }
      $item.files = @(Get-ProposalFiles $pr.number $info $current)
    }
    $list.Add($item)
  }
  return @{ ok = $true; login = $login; proposals = @($list) }
}

function Get-ProposalFiles($number, $info, $current) {
  $paths = Invoke-GhApi "repos/$Repo/pulls/$number/files?per_page=100" -jq "[.[].filename]" | ConvertFrom-Json
  $parent = Invoke-GhApi "repos/$($info.repo)/git/commits/$($info.head)" -jq ".parents[0].sha"
  $base = Get-TermState $info.repo $parent
  $mine = Get-TermState $info.repo $info.head
  foreach ($path in @($paths)) {
    if ($path -notmatch $TermPath) { continue }
    $b = Get-Sha $base $path
    $m = Get-Sha $mine $path
    $c = Get-Sha $current $path
    if ($m -eq $c) { continue }
    @{
      path = $path
      conflict = ($c -ne $b)
      mine = (Get-BlobText $info.repo $m)
      current = (Get-BlobText $Repo $c)
    }
  }
}

# Rebuilds a conflicted pull request on top of the newest dictionary branch
# with the values the user chose, and moves its fork branch there. When no
# change is left, the pull request is closed.
function Update-Proposal($request) {
  $status = Get-Status
  if (-not $status.ghAuth) { throw [HelperError]::new("GitHub CLI is not logged in.") }
  $number = [int]$request.number
  $info = Invoke-GhApi "repos/$Repo/pulls/$number" -jq "{login: .user.login, repo: .head.repo.full_name, ref: .head.ref, url: .html_url, title}" | ConvertFrom-Json
  if ($info.login -ne $status.login) { throw [HelperError]::new("This pull request belongs to someone else.") }

  $changes = @($request.changes)
  if ($changes.Count -gt 0) { $changes = Get-Changes $request }
  $head = Get-Head $Repo
  $state = Get-TermState $Repo $head
  $pending = @($changes | Where-Object { (Get-Sha $state $_.path) -ne (Get-TargetSha $_) })

  if ($pending.Count -eq 0) {
    Invoke-GhApi "repos/$Repo/issues/$number/comments" "POST" @{ body = "Closed from the dictionary editor: no change is left after resolving conflicts." } ".id" | Out-Null
    Invoke-GhApi "repos/$Repo/pulls/$number" "PATCH" @{ state = "closed" } ".state" | Out-Null
    return @{ ok = $true; closed = $true; url = $info.url }
  }

  $commit = New-TermsCommit $info.repo $head $state.Tree $pending "$($info.title)`n`nResolve conflicts with the dictionary branch"
  if (-not (Move-Branch $info.repo $info.ref $commit $true)) {
    throw [HelperError]::new("Could not update the pull request branch.")
  }
  Write-Log "proposal $number rebuilt on $head ($($pending.Count) files)"
  return @{ ok = $true; closed = $false; url = $info.url }
}

# Replaces this script with the copy bundled in the extension. The running
# process keeps the old code, so it exits after answering; the next request
# starts the new one.
function Update-Host($request) {
  $content = [string]$request.content
  if ($content -notmatch '(?m)^\$HostVersion = (\d+)') {
    throw [HelperError]::new("The update is not a dictionary host script.")
  }
  $version = [int]$Matches[1]
  $target = $PSCommandPath
  $temp = "$target.new"
  # Windows PowerShell 5.1 needs the BOM to read the Korean text as UTF-8.
  [IO.File]::WriteAllText($temp, $content, (New-Object System.Text.UTF8Encoding $true))
  Move-Item -Path $temp -Destination $target -Force
  Write-Log "updated from version $HostVersion to $version"
  return @{ ok = $true; version = $version; restart = $true }
}

function Invoke-Request($request) {
  switch ([string]$request.type) {
    "ping" { return @{ ok = $true; version = $HostVersion } }
    "update" { return Update-Host $request }
    "status" { return Get-Status }
    "install" { return Install-Gh }
    "login" { return Start-Login }
    "submit" { return Submit-Terms $request }
    "proposals" { return Get-Proposals }
    "updateProposal" { return Update-Proposal $request }
    default { throw [HelperError]::new("Unknown request.") }
  }
}

# ---- Main loop: one request at a time until Chrome closes stdin ----

while ($true) {
  $header = Read-Exactly 4
  if ($null -eq $header) { break }
  $length = [BitConverter]::ToInt32($header, 0)
  $body = Read-Exactly $length
  if ($null -eq $body) { break }

  $id = $null
  try {
    $request = $Utf8.GetString($body) | ConvertFrom-Json
    $id = $request.id
    $answer = Invoke-Request $request
    $answer.id = $id
    Send-Message $answer
    if ($answer.restart) { break }
  } catch {
    $message = $_.Exception.Message
    Write-Log "error: $message"
    Send-Message @{ id = $id; ok = $false; error = $message }
  }
}
