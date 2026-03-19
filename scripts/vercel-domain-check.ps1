$ErrorActionPreference = 'Stop'

Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))

if (-not (Test-Path '.vercel\project.json')) {
  throw 'Missing .vercel\project.json. Run `npx vercel link` first.'
}

$project = Get-Content '.vercel\project.json' | ConvertFrom-Json

Write-Host "Project: $($project.projectName)" -ForegroundColor Cyan
Write-Host "Org ID: $($project.orgId)" -ForegroundColor DarkGray
Write-Host "Project ID: $($project.projectId)" -ForegroundColor DarkGray
Write-Host ''

Write-Host 'Recent deployments:' -ForegroundColor Cyan
npx vercel@latest ls $project.projectName

Write-Host ''
Write-Host 'Account domains:' -ForegroundColor Cyan
npx vercel@latest domains ls
