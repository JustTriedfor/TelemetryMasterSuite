param([string]$name, [string]$page)
$e="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"; $o="$PSScriptRoot\shots\$name.png"
if(Test-Path $o){Remove-Item $o}
& $e --headless=new --disable-gpu --hide-scrollbars --window-size=1920,1200 --virtual-time-budget=4000 "--screenshot=$o" "http://localhost:8765/$page" 2>$null | Out-Null
Start-Sleep 2
