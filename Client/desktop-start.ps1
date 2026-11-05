$ErrorActionPreference = 'Stop'
$client = $PSScriptRoot
$data = Join-Path (Split-Path $client -Parent) 'data'
$stateFile = Join-Path $data 'desktop-session.json'
Add-Type -AssemblyName System.Windows.Forms
function Notify($message) { [System.Windows.Forms.MessageBox]::Show($message, 'Monopoly') | Out-Null }
$server = $null
$funnel = $null
try {
    New-Item -ItemType Directory -Force -Path $data | Out-Null
    if (Test-Path -LiteralPath $stateFile) {
        $old = Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json
        $existing = Get-Process -Id $old.serverId -ErrorAction SilentlyContinue
        if ($existing -and $existing.StartTime.ToUniversalTime().Ticks -eq $old.serverStart) { throw 'Monopoly is already running. Use the Stop shortcut first.' }
    }
    $node = (Get-Command node -ErrorAction Stop).Source
    $tailscale = (Get-Command tailscale -ErrorAction Stop).Source
    $statusText = & $tailscale status --json
    if ($LASTEXITCODE -ne 0) { throw 'Could not read Tailscale status. Check that Tailscale is running and signed in.' }
    $status = $statusText | ConvertFrom-Json
    if ($status.BackendState -ne 'Running' -or -not $status.Self.DNSName) { throw 'Connect Tailscale before starting Monopoly.' }
    $configText = & $tailscale serve status --json
    if ($LASTEXITCODE -ne 0) { throw 'Could not check existing Tailscale routes. No route was changed.' }
    if ($configText) {
        $config = $configText | ConvertFrom-Json
        if ($config.TCP -and $config.TCP.PSObject.Properties['8443']) { throw 'Tailscale port 8443 is already in use. No route was changed.' }
    }
    $env:PORT = '3100'
    $ErrorActionPreference = 'Continue'
    & $node (Join-Path $client 'build-public.cjs') *> (Join-Path $data 'desktop-build.log')
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) { throw 'The game build failed. See data\desktop-build.log.' }
    $server = Start-Process -FilePath $node -ArgumentList 'serve-public.cjs' -WorkingDirectory $client -WindowStyle Hidden -RedirectStandardOutput (Join-Path $data 'desktop-server.log') -RedirectStandardError (Join-Path $data 'desktop-server-error.log') -PassThru
    $ready = $false
    for ($i = 0; $i -lt 30 -and -not $ready; $i++) {
        Start-Sleep -Milliseconds 250
        if ($server.HasExited) { throw 'The Monopoly server could not start. Check MongoDB, server dependencies, and data\desktop-server-error.log.' }
        try { $ready = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:3100/').StatusCode -eq 200 } catch {}
    }
    if (-not $ready) { throw 'The Monopoly server did not become ready.' }
    $funnel = Start-Process -FilePath $tailscale -ArgumentList 'funnel','--https=8443','http://127.0.0.1:3100' -WorkingDirectory $client -WindowStyle Hidden -RedirectStandardOutput (Join-Path $data 'desktop-funnel.log') -RedirectStandardError (Join-Path $data 'desktop-funnel-error.log') -PassThru
    Start-Sleep -Seconds 2
    $funnel.Refresh()
    if ($funnel.HasExited) { throw 'Tailscale Funnel could not start. Check data\desktop-funnel-error.log and enable Funnel in Tailscale if prompted.' }
    @{ serverId = $server.Id; serverStart = $server.StartTime.ToUniversalTime().Ticks; funnelId = $funnel.Id; funnelStart = $funnel.StartTime.ToUniversalTime().Ticks } | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
    $url = 'https://' + $status.Self.DNSName.TrimEnd('.') + ':8443'
    Notify "Monopoly started.`n`nShare this address: $url`n`nUse Stop Monopoly to close the game and its public link."
    Start-Process -FilePath $url | Out-Null
} catch {
    if ($funnel -and -not $funnel.HasExited) { Stop-Process -Id $funnel.Id }
    if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id }
    Notify "Could not start Monopoly: $($_.Exception.Message)"
    exit 1
}
