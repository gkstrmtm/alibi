$ErrorActionPreference = 'Stop'

function Invoke-CmdCapture {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  $cmdPath = Join-Path $env:SystemRoot 'System32\cmd.exe'
  if (-not (Test-Path $cmdPath)) {
    throw 'cmd.exe was not found on this machine.'
  }

  $stdoutFile = [System.IO.Path]::GetTempFileName()
  $stderrFile = [System.IO.Path]::GetTempFileName()

  try {
    $process = Start-Process -FilePath $cmdPath -ArgumentList @('/d', '/c', $Command) -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
    $stdout = if (Test-Path $stdoutFile) { Get-Content $stdoutFile -Raw } else { '' }
    $stderr = if (Test-Path $stderrFile) { Get-Content $stderrFile -Raw } else { '' }

    return [pscustomobject]@{
      Output = ($stdout + [Environment]::NewLine + $stderr).Trim()
      ExitCode = $process.ExitCode
    }
  }
  finally {
    if (Test-Path $stdoutFile) { Remove-Item $stdoutFile -Force -ErrorAction SilentlyContinue }
    if (Test-Path $stderrFile) { Remove-Item $stderrFile -Force -ErrorAction SilentlyContinue }
  }
}

Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))

if (-not (Test-Path '.vercel\project.json')) {
  throw 'Missing .vercel\project.json. Run `npx vercel link` first.'
}

Write-Host 'Checking Vercel auth...' -ForegroundColor Cyan
$whoami = Invoke-CmdCapture 'npx vercel@latest whoami'
if ($whoami.ExitCode -ne 0 -or -not $whoami.Output.Trim()) {
  throw 'Vercel CLI is not authenticated.'
}

Write-Host 'Running local Vercel build check...' -ForegroundColor Cyan
$build = Invoke-CmdCapture 'npx expo export --platform web'
if ($build.ExitCode -ne 0) {
  throw "Build verification failed.`n$($build.Output)"
}

Write-Host 'Deploying preview build...' -ForegroundColor Cyan
$deploy = Invoke-CmdCapture 'npx vercel@latest deploy --yes'
if ($deploy.ExitCode -ne 0) {
  throw "Preview deployment failed.`n$($deploy.Output)"
}

$deployOutput = $deploy.Output

if ($deployOutput -match 'https://[a-zA-Z0-9.-]+\.vercel\.app') {
  $deploymentUrl = $matches[0]
} else {
  throw 'Preview deployment did not return a URL.'
}

$deploymentUrl = $deploymentUrl.Trim()
Write-Host ''
Write-Host 'Preview deployment ready:' -ForegroundColor Green
Write-Host $deploymentUrl -ForegroundColor Green
