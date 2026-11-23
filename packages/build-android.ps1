[CmdletBinding()]param(
    [string]$WebDirectory = "dist",
    [string]$OutputDirectory = "portable",
    [string]$AndroidJar = "$env:ANDROID_HOME/platforms/android-35/android.jar",
    [string]$BuildTools = "$env:ANDROID_HOME/build-tools/35.0.0",
    [string]$KeyStore = $env:PIXEL_ANDROID_KEYSTORE,
    [string]$KeyAlias = "pixel-civilization",
    [int]$VersionCode = [int][Math]::Floor([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() / 60)
)
$ErrorActionPreference = "Stop"
$project = Split-Path $PSScriptRoot -Parent
$web = (Resolve-Path -LiteralPath $WebDirectory).Path
if (!(Test-Path -LiteralPath "$web/offline-index.json")) { throw "Run npm run build before packaging." }
if (!$KeyStore -or !(Test-Path -LiteralPath $KeyStore) -or !$env:PIXEL_KEYSTORE_PASSWORD) {
    throw "Set PIXEL_ANDROID_KEYSTORE and PIXEL_KEYSTORE_PASSWORD to your persistent release signing key."
}
if (!(Test-Path -LiteralPath "$env:JAVA_HOME/bin/javac.exe") -or !(Test-Path -LiteralPath $AndroidJar) -or !(Test-Path -LiteralPath "$BuildTools/aapt2.exe")) {
    throw "This Windows build needs a JDK, Android platform 35 and Android build-tools 35.0.0."
}
$work = Join-Path ([IO.Path]::GetTempPath()) ("PixelAndroid-" + [Guid]::NewGuid().ToString("N"))
$null = New-Item -ItemType Directory -Path $work
$null = New-Item -Force -ItemType Directory -Path $OutputDirectory
$out = Join-Path (Resolve-Path -LiteralPath $OutputDirectory).Path "Pixel-Civilization-Android.apk"
function Run([string]$tool, [string[]]$parameters) {
    & $tool @parameters
    if ($LASTEXITCODE -ne 0) {throw ("Packaging failed while running " + [IO.Path]::GetFileName($tool))}
}
try {
    $res = Join-Path $work "res/drawable-nodpi"
    $cls = Join-Path $work "classes"
    $dex = Join-Path $work "dex"
    foreach ($sub in @($res,$cls,$dex,"$work/assets")) {$null = New-Item -Force -ItemType Directory -Path $sub}
    Copy-Item -LiteralPath "$web/pwa-192x192.png" -Destination "$res/island.png"
    Copy-Item -LiteralPath $web -Destination "$work/assets/web" -Recurse
    $java = (Get-ChildItem "$PSScriptRoot/android/src" -Filter "*.java" -File -Recurse).FullName
    Run "$env:JAVA_HOME/bin/javac.exe" (@("-encoding","UTF-8","-source","8","-target","8","-bootclasspath","$BuildTools/core-lambda-stubs.jar;$AndroidJar","-d",$cls) + $java)
    Run "$env:JAVA_HOME/bin/jar.exe" @("cf","$work/classes.jar","-C",$cls,".")
    Run "$env:JAVA_HOME/bin/java.exe" @("-cp","$BuildTools/lib/d8.jar","com.android.tools.r8.D8","--min-api","26","--lib",$AndroidJar,"--output",$dex,"$work/classes.jar")
    Run "$BuildTools/aapt2.exe" @("compile","--dir","$work/res","-o","$work/resources.zip")
    Run "$BuildTools/aapt2.exe" @("link","-o","$work/base.apk","-I",$AndroidJar,"--manifest","$PSScriptRoot/android/AndroidManifest.xml","--min-sdk-version","26","--target-sdk-version","35","--version-code","$VersionCode","--version-name","1.$VersionCode","$work/resources.zip")
    # jar writes Android-standard forward slashes for every nested asset on Windows.
    Run "$env:JAVA_HOME/bin/jar.exe" @("uf","$work/base.apk","-C",$dex,"classes.dex","-C",$work,"assets")
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive=[IO.Compression.ZipFile]::OpenRead("$work/base.apk")
    try {
        $manifest=Get-Content -LiteralPath "$web/offline-index.json" -Raw | ConvertFrom-Json
        foreach($name in @('offline-index.json') + $manifest.files.path) {
            if (!$archive.GetEntry("assets/web/$name")) {throw "APK is missing game file $name"}
        }
    } finally { $archive.Dispose() }
    Run "$BuildTools/zipalign.exe" @("-f","4","$work/base.apk","$work/aligned.apk")
    Run "$env:JAVA_HOME/bin/java.exe" @("-jar","$BuildTools/lib/apksigner.jar","sign","--ks",$KeyStore,"--ks-key-alias",$KeyAlias,"--ks-pass","env:PIXEL_KEYSTORE_PASSWORD","--v4-signing-enabled","false","--out","$work/signed.apk","$work/aligned.apk")
    Run "$env:JAVA_HOME/bin/java.exe" @("-jar","$BuildTools/lib/apksigner.jar","verify","--verbose","--print-certs","$work/signed.apk")
    Copy-Item -Force -LiteralPath "$work/signed.apk" -Destination $out
    Write-Output "Built $out"
} finally {
    $resolved=(Resolve-Path -LiteralPath $work).Path
    if ((Split-Path $resolved -Parent) -eq [IO.Path]::GetTempPath().TrimEnd('\') -and (Split-Path $resolved -Leaf) -match '^PixelAndroid-[0-9a-f]{32}$') {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
