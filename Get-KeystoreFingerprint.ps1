param(
    [Parameter(Mandatory=$true)]
    [string]$KeystorePath,
    [Parameter(Mandatory=$false)]
    [string]$StorePassword = "",
    [Parameter(Mandatory=$false)]
    [string]$KeyAlias = ""
)

if (-not (Test-Path $KeystorePath)) {
    Write-Error "Keystore file not found: $KeystorePath"
    exit 1
}

$keytoolPath = $null
$keytoolInPath = Get-Command keytool -ErrorAction SilentlyContinue
if ($keytoolInPath) {
    $keytoolPath = $keytoolInPath.Source
}

if (-not $keytoolPath) {
    $javaPaths = @(
        "C:\Program Files\Java\*\bin\keytool.exe",
        "C:\Program Files (x86)\Java\*\bin\keytool.exe",
        "$env:USERPROFILE\.jdks\*\bin\keytool.exe",
        "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe",
        "C:\Program Files\Microsoft\jdk*\bin\keytool.exe"
    )
    foreach ($pattern in $javaPaths) {
        $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) {
            $keytoolPath = $found.FullName
            break
        }
    }
}

if (-not $keytoolPath -and $env:JAVA_HOME) {
    $javaHomeKeytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"
    if (Test-Path $javaHomeKeytool) {
        $keytoolPath = $javaHomeKeytool
    }
}

if (-not $keytoolPath) {
    Write-Error "keytool.exe not found. Please install Java JDK or Android Studio."
    exit 1
}

Write-Host "Found keytool: $keytoolPath" -ForegroundColor Green

$keytoolArgs = @("-list", "-v", "-keystore", $KeystorePath)
if ($StorePassword) { $keytoolArgs += @("-storepass", $StorePassword) }
if ($KeyAlias) { $keytoolArgs += @("-alias", $KeyAlias) }

Write-Host "Extracting certificate fingerprints..." -ForegroundColor Green
Write-Host ""

$output = & $keytoolPath $keytoolArgs 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Error "keytool failed. Check password and alias."
    Write-Host ($output -join "`n")
    exit 1
}

Write-Host ($output -join "`n")

Write-Host ""
Write-Host "=== Key Fingerprints ===" -ForegroundColor Cyan

foreach ($line in $output) {
    if ($line -match "MD5:\s*(.+)") { Write-Host "MD5:    $($matches[1])" -ForegroundColor Yellow }
    if ($line -match "SHA1:\s*(.+)") { Write-Host "SHA1:   $($matches[1])" -ForegroundColor Green }
    if ($line -match "SHA256:\s*(.+)") { Write-Host "SHA256: $($matches[1])" -ForegroundColor Magenta }
}
