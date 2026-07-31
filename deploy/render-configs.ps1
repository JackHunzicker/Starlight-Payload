# Render ${VAR} config templates from an env file (default: docker/.env).
# Windows twin of render-configs.sh — same templates, same semantics.
# Usage: powershell -File deploy/render-configs.ps1 [-EnvFile path]
param(
    [string]$EnvFile = ""
)
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
if (-not $EnvFile) { $EnvFile = Join-Path $Root "docker\.env" }
if (-not (Test-Path $EnvFile)) { throw "env file not found: $EnvFile" }

$Templates = @(
    "apps\sharkey\.config\default.yml.template"
)

# KEY=value lines; values may contain '=' (base64) — split on the first '=' only.
$vars = @{}
foreach ($line in Get-Content $EnvFile) {
    if ($line -match '^([A-Z_][A-Z0-9_]*)=(.*)$') {
        $value = $Matches[2].TrimEnd("`r")
        # Strip surrounding double quotes, matching compose's env-file parsing.
        if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $vars[$Matches[1]] = $value
    }
}

foreach ($template in $Templates) {
    $templatePath = Join-Path $Root $template
    $outPath = $templatePath -replace '\.template$', ''
    $content = [System.IO.File]::ReadAllText($templatePath)

    foreach ($key in $vars.Keys) {
        # Literal .Replace — no regex, so '$' in values is safe.
        $content = $content.Replace('${' + $key + '}', $vars[$key])
    }

    $unresolved = [regex]::Matches($content, '\$\{[A-Z_][A-Z0-9_]*\}') |
        ForEach-Object { $_.Value } | Sort-Object -Unique
    if ($unresolved) {
        throw "UNRESOLVED tokens in ${template}: $($unresolved -join ', ')"
    }

    # UTF-8 WITHOUT BOM — a BOM breaks YAML parsers inside the containers.
    [System.IO.File]::WriteAllText($outPath, $content, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "rendered $($outPath.Substring($Root.Length + 1))"
}
