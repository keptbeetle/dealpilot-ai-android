param(
    [ValidateSet('Setup','Check','Preview','BuildAndroid','Doctor')]
    [string]$Action = 'Check',
    [string]$SdkPath
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $projectRoot '.venv/Scripts/python.exe'

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE" }
}

Push-Location $projectRoot
try {
    foreach ($program in @('node','npm.cmd','python','java','javac')) {
        if (-not (Get-Command $program -ErrorAction SilentlyContinue)) {
            throw "Install $program and add it to PATH before running this command."
        }
    }
    Invoke-Checked 'node' @('-e', "const [major,minor]=process.versions.node.split('.').map(Number);if(major<22||(major===22&&minor<19))process.exit(1)")
    if (-not $env:JAVA_HOME) {
        $env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent (Get-Command javac).Source)
    }
    if (-not $SdkPath) { $SdkPath = $env:ANDROID_SDK_ROOT }
    if (-not $SdkPath) { $SdkPath = $env:ANDROID_HOME }
    if (-not $SdkPath -and (Get-Command adb -ErrorAction SilentlyContinue)) {
        $SdkPath = Split-Path -Parent (Split-Path -Parent (Get-Command adb).Source)
    }
    if ($SdkPath) {
        $SdkPath = (Resolve-Path -LiteralPath $SdkPath).Path
        $env:ANDROID_SDK_ROOT = $SdkPath
        $env:ANDROID_HOME = $SdkPath
        $sdkProperty = 'sdk.dir=' + $SdkPath.Replace('\','/').Replace(':','\:')
        $localProperties = Join-Path $projectRoot 'local.properties'
        if (-not (Test-Path -LiteralPath $localProperties)) {
            [IO.File]::WriteAllText($localProperties, $sdkProperty + "`n")
        }
    }
    if ($Action -eq 'Doctor') {
        Invoke-Checked 'node' @('--version')
        Invoke-Checked 'java' @('-version')
        Write-Output "Android SDK: $SdkPath"
        foreach ($relative in @('platforms/android-36','build-tools/36.0.0','ndk/27.2.12479018')) {
            Write-Output "$relative present: $([bool]($SdkPath -and (Test-Path (Join-Path $SdkPath $relative))))"
        }
        Write-Output "Python environment present: $(Test-Path -LiteralPath $python)"
        return
    }
    if ($Action -eq 'Setup') {
        if (-not (Test-Path -LiteralPath $python)) {
            Invoke-Checked 'python' @('-m','venv','.venv')
        }
        Invoke-Checked $python @('-m','pip','install','--disable-pip-version-check','-r','scripts/requirements-dev.txt')
        Push-Location runtime
        try { Invoke-Checked 'npm.cmd' @('ci','--ignore-scripts','--no-audit','--no-fund') }
        finally { Pop-Location }
        return
    }
    if ($Action -eq 'Preview') {
        Invoke-Checked 'node' @('preview/server.mjs')
        return
    }
    if (-not (Test-Path -LiteralPath $python)) { throw 'Run -Action Setup first.' }
    Push-Location runtime
    try {
        if ($Action -eq 'Check') {
            Invoke-Checked 'npm.cmd' @('test')
            Invoke-Checked 'npm.cmd' @('run','test:ui')
        }
        Invoke-Checked 'npm.cmd' @('run','build')
    } finally { Pop-Location }
    if ($Action -eq 'Check') {
        $env:PYTHONUTF8 = '1'
        Invoke-Checked $python @('-m','unittest','discover','-s','scripts','-p','test_*.py','-v')
    } else {
        if (-not $SdkPath) { throw 'Supply -SdkPath or configure ANDROID_HOME.' }
        Invoke-Checked (Join-Path $projectRoot 'gradlew.bat') @('--no-daemon',':app:assembleDebug',':app:lintDebug',':fixture:assembleDebug')
    }
} finally { Pop-Location }
