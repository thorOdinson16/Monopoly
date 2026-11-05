$ErrorActionPreference = 'Stop'
$stateFile = Join-Path (Split-Path $PSScriptRoot -Parent) 'data\desktop-session.json'
Add-Type -AssemblyName System.Windows.Forms
try {
    if (-not (Test-Path -LiteralPath $stateFile)) { throw 'No desktop-started Monopoly session was found.' }
    $state = Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json
    foreach ($item in @(@($state.funnelId, $state.funnelStart), @($state.serverId, $state.serverStart))) {
        $process = Get-Process -Id $item[0] -ErrorAction SilentlyContinue
        if ($process -and $process.StartTime.ToUniversalTime().Ticks -eq $item[1]) { Stop-Process -Id $process.Id }
    }
    $tailscale = (Get-Command tailscale -ErrorAction Stop).Source
    $configText = & $tailscale serve status --json
    if ($LASTEXITCODE -ne 0) { throw 'The processes stopped, but the public route could not be checked. Check Tailscale status.' }
    if ($configText) {
        $config = $configText | ConvertFrom-Json
        foreach ($web in $config.Web.PSObject.Properties) {
            if ($web.Name -notmatch ':8443$') { continue }
            $handler = $web.Value.Handlers.PSObject.Properties['/']
            if ($handler -and $handler.Value.Proxy -match '^http://127\.0\.0\.1:3100/?$') {
                & $tailscale funnel --https=8443 off | Out-Null
                if ($LASTEXITCODE -ne 0) { throw 'The game stopped, but its Tailscale route could not be disabled.' }
            }
        }
    }
    Remove-Item -LiteralPath $stateFile
    [System.Windows.Forms.MessageBox]::Show('Monopoly stopped. Saved games remain on their devices.', 'Monopoly') | Out-Null
} catch {
    [System.Windows.Forms.MessageBox]::Show("Could not stop Monopoly: $($_.Exception.Message)", 'Monopoly') | Out-Null
    exit 1
}
