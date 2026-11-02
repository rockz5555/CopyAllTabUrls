$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
$exclude = @("sign.js", "background.js", ".DS_Store", "Thumbs.db")

New-Item -ItemType Directory -Force -Path $dist | Out-Null

function Build-Package {
  param(
    [Parameter(Mandatory)][string]$Source,
    [Parameter(Mandatory)][string]$Name
  )

  $manifestPath = Join-Path $Source "manifest.json"
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  $version = $manifest.version
  $zip = Join-Path $dist "$Name-$version.zip"

  if (Test-Path -LiteralPath $zip) {
    Remove-Item -LiteralPath $zip -Force
  }

  $archive = [System.IO.Compression.ZipFile]::Open($zip, "Create")
  try {
    Get-ChildItem -LiteralPath $Source -Recurse -Force -File |
      Where-Object { $exclude -notcontains $_.Name -and -not $_.Name.StartsWith(".") } |
      ForEach-Object {
        $entryName = $_.FullName.Substring($Source.Length + 1).Replace("\", "/")
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
          $archive, $_.FullName, $entryName, "Optimal"
        ) | Out-Null
      }
  }
  finally {
    $archive.Dispose()
  }

  Write-Output $zip
}

Build-Package -Source (Join-Path $root "chrome") -Name "copy-all-urls-chrome"
Build-Package -Source (Join-Path $root "firefox") -Name "copy-all-urls-firefox"
