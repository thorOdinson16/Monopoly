$ErrorActionPreference = 'Stop'
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$icon = Join-Path $PSScriptRoot 'public\favicon.ico'
foreach ($name in @('Start', 'Stop')) {
    $link = Join-Path $desktop "$name Monopoly.lnk"
    if (-not (Test-Path -LiteralPath $link)) { throw "Shortcut not found: $link" }
    $shortcut = $shell.CreateShortcut($link)
    $expected = Join-Path $PSScriptRoot ("desktop-$($name.ToLower()).ps1")
    if (-not $shortcut.Arguments.Contains($expected)) { throw "The $name shortcut does not point to this project; it was not changed." }
    $shortcut.IconLocation = "$icon,0"
    $shortcut.Save()
}
Write-Host 'Updated both Monopoly desktop icons.'
