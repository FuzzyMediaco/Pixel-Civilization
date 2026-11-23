[CmdletBinding()]param([string]$WebDirectory="dist",[string]$OutputDirectory="portable")
$ErrorActionPreference="Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$base=Get-Content -Raw -LiteralPath "$WebDirectory/offline-index.json"
$index=$base | ConvertFrom-Json
$sha=[Security.Cryptography.SHA256]::Create()
try {
    foreach($app in @(
        @{name="Pixel-Civilization-Windows-x64.zip";prefix="Pixel Civilization/web/"},
        @{name="Pixel-Civilization-Android.apk";prefix="assets/web/"}
    )){
        $package=Join-Path (Resolve-Path -LiteralPath $OutputDirectory).Path $app.name
        $zip=[IO.Compression.ZipFile]::OpenRead($package)
        try {
            $reader=[IO.StreamReader]::new($zip.GetEntry($app.prefix+"offline-index.json").Open())
            try {if($reader.ReadToEnd() -cne $base){throw "Web edition does not match in $package"}} finally {$reader.Dispose()}
            foreach($file in $index.files) {
                $asset=$zip.GetEntry($app.prefix+$file.path)
                if(!$asset -or $asset.Length -ne $file.size){throw "Missing or incomplete $($file.path) in $package"}
                $stream=$asset.Open()
                try {$actual=[BitConverter]::ToString($sha.ComputeHash($stream)).Replace("-","").ToLowerInvariant()} finally {$stream.Dispose()}
                if($actual -cne $file.sha256){throw "Incorrect digest for $($file.path) in $package"}
            }
            Write-Output "$($app.name) contains all $($index.files.Count) verified files from edition $($index.release)."
        } finally {$zip.Dispose()}
    }
} finally {$sha.Dispose()}
