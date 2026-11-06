# Creates the Android upload key locally. The private keystore never leaves this computer.
$ErrorActionPreference = "Stop"

$androidDir = Join-Path (Get-Location) "android"
$keystore = Join-Path $androidDir "release-keystore.jks"
$alias = "contentfactory"

if (-not (Test-Path $androidDir -PathType Container)) {
  throw "Run this script from the repository root; the android folder was not found."
}
if (Test-Path $keystore) {
  throw "Keystore already exists at $keystore. Refusing to overwrite it."
}

$keytoolCommand = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytoolCommand) {
  throw "Java keytool was not found. Install JDK 17 and ensure its bin folder is on PATH."
}

Write-Host "A private upload keystore will be created locally. Do not upload or share it."
Write-Host "Keytool will ask you to enter and confirm a strong keystore password and key password."
Write-Host "Use unique passwords and store them in a trusted password manager."
& $keytoolCommand.Source -genkeypair -v -keystore $keystore -storetype JKS -alias $alias -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Babak Aghamohammadhassani, C=IR"
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $keystore)) {
  throw "Keystore creation failed."
}

Write-Host ""
Write-Host "Upload-key certificate details (the SHA-256 below is NOT the Play App Signing fingerprint):"
& $keytoolCommand.Source -list -v -keystore $keystore -alias $alias -storetype JKS
if ($LASTEXITCODE -ne 0) {
  throw "Keystore verification failed. Keep the file safe and resolve the keytool error."
}

Write-Host ""
Write-Host "Created: $keystore"
Write-Host "Back up the keystore and both passwords securely in separate protected locations."
Write-Host "Never commit this file, email it, or paste it into chat."
Write-Host "For assetlinks.json, use the SHA-256 certificate from Play Console > App integrity > App signing key certificate, NOT this upload-key fingerprint."
