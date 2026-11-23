$ErrorActionPreference="Stop"
$test=Join-Path ([IO.Path]::GetTempPath()) ("PixelUpdateTest-"+[guid]::NewGuid().ToString("N")+".exe")
try {
    $sources = (Get-Item -LiteralPath "$PSScriptRoot/windows/OfflineEdition.cs","$PSScriptRoot/tests/EditionUpdate.cs").FullName
    & "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe" /nologo /target:exe "/out:$test" /r:System.Web.Extensions.dll @sources
    if ($LASTEXITCODE) { throw "Update test did not compile." }
    & $test
    if ($LASTEXITCODE) { throw "Update verification failed." }
} finally {
    # Windows can briefly hold the finished executable while scanning it.
    if(Test-Path -LiteralPath $test){Remove-Item -LiteralPath $test -ErrorAction SilentlyContinue}
}
