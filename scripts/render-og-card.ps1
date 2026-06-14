param(
  [Parameter(Mandatory = $true)]
  [string]$Slug
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$articlePath = Join-Path $root "articles\$Slug.html"
$outputDirectory = Join-Path $root "assets\og"
$outputPath = Join-Path $outputDirectory "$Slug.png"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"

if (-not (Test-Path -LiteralPath $articlePath)) { throw "Article not found: $articlePath" }
if (-not (Test-Path -LiteralPath $chrome)) { throw "Chrome not found: $chrome" }

$html = Get-Content -Raw -Encoding UTF8 -LiteralPath $articlePath
$matches = [regex]::Matches($html, "<svg[\s\S]*?</svg>")
if ($matches.Count -eq 0) { throw "No infographic SVG found in $articlePath" }

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$svg = $matches[$matches.Count - 1].Value
$card = "<!doctype html><html><head><meta charset='utf-8'><style>html,body{margin:0;width:1200px;height:630px;background:#F4F6F4;display:grid;place-items:center}svg{width:855px;height:630px;display:block}</style></head><body>$svg</body></html>"
$tempPath = Join-Path $outputDirectory "$Slug-card.html"
$card | Set-Content -Encoding UTF8 -LiteralPath $tempPath
try {
  $url = "file:///" + ((Resolve-Path -LiteralPath $tempPath).Path -replace "\\", "/")
  & $chrome --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1200,630 "--screenshot=$outputPath" $url
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $outputPath)) {
    throw "Card rendering failed for $Slug"
  }
} finally {
  Remove-Item -LiteralPath $tempPath -ErrorAction SilentlyContinue
}

Get-Item -LiteralPath $outputPath | Select-Object FullName, Length
