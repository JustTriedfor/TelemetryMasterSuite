$e="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$o="$PSScriptRoot\..\build\geom_dom.html"
if(Test-Path $o){Remove-Item $o}
& $e --headless=new --disable-gpu --hide-scrollbars --window-size=1920,1200 --virtual-time-budget=8000 "--dump-dom" "http://localhost:8765/mock/v3/index.html?t=25.5&pause=1&geom=1" 2>$null | Out-File -Encoding utf8 $o
(Get-Item $o).Length
