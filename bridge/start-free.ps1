param([switch]$ResetPairing,[switch]$EnableSending)
$ErrorActionPreference='Stop'
$awWorkspace=Split-Path -Parent $PSScriptRoot
$awData=Join-Path $PSScriptRoot '.local'
New-Item -ItemType Directory -Force -Path $awData | Out-Null
$awTokenPath=Join-Path $awData 'computer.dpapi'
$awPidPath=Join-Path $awData 'worker.pid'
$awNode=(Get-Command node -ErrorAction Stop).Source
$awVersion=& $awNode -p 'Number(process.versions.node.split(".")[0])'
if([int]$awVersion -lt 24){throw 'Install Node.js 24 LTS or newer from nodejs.org first.'}
if(Test-Path -LiteralPath $awPidPath){$awExistingId=[int](Get-Content -LiteralPath $awPidPath);$awExisting=Get-CimInstance Win32_Process -Filter ('ProcessId='+$awExistingId) -ErrorAction SilentlyContinue;if($awExisting -and $awExisting.CommandLine -like '*AutoWhatsApp*bridge*index.mjs*'){Write-Host 'AutoWhatsApp is already running. Use Stop-Free.cmd before restarting.';exit}}
if(!(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules/@whiskeysockets/baileys/package.json'))){Push-Location $PSScriptRoot;try{& npm.cmd ci --ignore-scripts;if($LASTEXITCODE -ne 0){throw 'Dependency installation failed.'}}finally{Pop-Location}}
if(!(Test-Path -LiteralPath (Join-Path $awWorkspace 'node_modules/@supabase/supabase-js/package.json'))){Push-Location $awWorkspace;try{& npm.cmd ci --omit=dev --ignore-scripts;if($LASTEXITCODE -ne 0){throw 'Dependency installation failed.'}}finally{Pop-Location}}
if($ResetPairing -or !(Test-Path -LiteralPath $awTokenPath)){
 Write-Host 'Open AutoWhatsApp > Setup, sign in, and select Create PC pairing code.'
 Write-Host 'Paste that private code below. It is encrypted for this Windows user.'
 $awSecure=Read-Host 'PC pairing code' -AsSecureString
 $awSecure | ConvertFrom-SecureString | Set-Content -LiteralPath $awTokenPath
}
$awSecure=Get-Content -LiteralPath $awTokenPath | ConvertTo-SecureString
$awPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($awSecure)
try{$env:AW_COMPUTER_TOKEN=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($awPointer)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($awPointer)}
$awConfig=Get-Content -Raw -LiteralPath (Join-Path $awWorkspace 'src/config.json') | ConvertFrom-Json
$env:SUPABASE_URL=$awConfig.url
$env:SUPABASE_PUBLISHABLE_KEY=$awConfig.key
$env:SESSION_PATH=Join-Path $awData 'whatsapp'
$env:ENABLE_LIVE_SEND=if($EnableSending){'true'}else{'false'}
$env:PORT='10000'
$awProcess=Start-Process -FilePath $awNode -ArgumentList @(('"'+(Join-Path $PSScriptRoot 'index.mjs')+'"')) -WorkingDirectory $awWorkspace -WindowStyle Hidden -RedirectStandardOutput (Join-Path $awData 'worker.log') -RedirectStandardError (Join-Path $awData 'worker-error.log') -PassThru
$awProcess.Id | Set-Content -LiteralPath $awPidPath
Remove-Item Env:AW_COMPUTER_TOKEN
Start-Sleep -Seconds 3
if($awProcess.HasExited){Write-Host 'The worker stopped. Read bridge/.local/worker-error.log for the configuration error.';exit 1}
Write-Host 'Free PC connection started. Keep this PC awake and online. No paid hosting was created.'
Write-Host 'Open AutoWhatsApp > Setup and scan the WhatsApp QR with your phone.'
if($EnableSending){Write-Host 'Live sending is enabled.'}else{Write-Host 'Live sending is OFF pending an approved test recipient/message.'}

