$ErrorActionPreference = 'Stop'
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
foreach ($name in @('Start', 'Stop')) {
    if (Test-Path -LiteralPath (Join-Path $desktop "$name Monopoly.lnk")) { throw "$name Monopoly shortcut already exists; it was not overwritten." }
}
foreach ($name in @('Start', 'Stop')) {
    $shortcut = $shell.CreateShortcut((Join-Path $desktop "$name Monopoly.lnk"))
    $script = Join-Path $PSScriptRoot ("desktop-$($name.ToLower()).ps1")
    $shortcut.TargetPath = $powershell
    $shortcut.IconLocation = "$(Join-Path $PSScriptRoot 'public\favicon.ico'),0"
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
    $shortcut.WorkingDirectory = $PSScriptRoot
    $shortcut.Description = "$name Monopoly and its Tailscale Funnel"
    $shortcut.Save()
}
Write-Host "Created Start Monopoly and Stop Monopoly shortcuts in $desktop"
