[CmdletBinding()]param(
    [string]$WebDirectory = "dist",
    [string]$OutputDirectory = "portable",
    [string]$WebViewSdk = $env:PIXEL_WEBVIEW_SDK
)
$ErrorActionPreference = "Stop"
$web=(Resolve-Path -LiteralPath $WebDirectory).Path
if (!(Test-Path -LiteralPath "$web/offline-index.json")) {throw "Run npm run build before packaging."}
$work=Join-Path ([IO.Path]::GetTempPath()) ("PixelWindows-"+[Guid]::NewGuid().ToString("N"))
$null=New-Item -ItemType Directory $work
$null=New-Item -Force -ItemType Directory $OutputDirectory
$out=Join-Path (Resolve-Path -LiteralPath $OutputDirectory).Path "Pixel-Civilization-Windows-x64.zip"
try {
    if (!$WebViewSdk) {
        $WebViewSdk=Join-Path $work "sdk"
        $zip=Join-Path $work "sdk.zip"
        Invoke-WebRequest -Uri "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/1.0.4370.26/microsoft.web.webview2.1.0.4370.26.nupkg" -OutFile $zip
        Expand-Archive -LiteralPath $zip -DestinationPath $WebViewSdk
    }
    $sdk=(Resolve-Path -LiteralPath $WebViewSdk).Path
    $app=Join-Path $work "Pixel Civilization"
    $null=New-Item -ItemType Directory $app
    Copy-Item -LiteralPath $web -Destination "$app/web" -Recurse
    foreach($lib in @("Core","WinForms")){Copy-Item -LiteralPath "$sdk/lib/net462/Microsoft.Web.WebView2.$lib.dll" -Destination $app}
    Copy-Item -LiteralPath "$sdk/runtimes/win-x64/native/WebView2Loader.dll" -Destination $app
    Get-ChildItem $sdk -File | Where-Object Name -match 'LICENSE|NOTICE' | Copy-Item -Destination $app
    Copy-Item -LiteralPath "$PSScriptRoot/windows/Read me.txt" -Destination $app
    $compiler="$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe"
    $sources=(Get-ChildItem "$PSScriptRoot/windows" -Filter "*.cs" -File).FullName
    & $compiler /nologo /target:winexe /platform:x64 "/out:$app/Pixel Civilization.exe" "/win32icon:$PSScriptRoot/../public/favicon.ico" "/win32manifest:$PSScriptRoot/windows/app.manifest" /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll "/r:$app/Microsoft.Web.WebView2.Core.dll" "/r:$app/Microsoft.Web.WebView2.WinForms.dll" @sources
    if ($LASTEXITCODE -ne 0) {throw "Windows build failed."}
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip=Join-Path $work "release.zip"
    [IO.Compression.ZipFile]::CreateFromDirectory($app,$zip,[IO.Compression.CompressionLevel]::Optimal,$true)
    Copy-Item -Force -LiteralPath $zip -Destination $out
    Write-Output "Built $out"
} finally {
    $resolved=(Resolve-Path -LiteralPath $work).Path
    if ((Split-Path $resolved -Parent) -eq [IO.Path]::GetTempPath().TrimEnd('\') -and (Split-Path $resolved -Leaf) -match '^PixelWindows-[0-9a-f]{32}$') {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
