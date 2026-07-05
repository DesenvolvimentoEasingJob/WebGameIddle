param(
    [string]$Src = "C:\GitHub\WebGameIddle\front\assets\array_img.png",
    [string]$OutDir = "C:\GitHub\WebGameIddle\front\tools\crops"
)
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$img = [System.Drawing.Bitmap]::FromFile($Src)

# name,x,y,w,h
$regions = Get-Content "$PSScriptRoot\regions.csv" | Where-Object { $_ -and -not $_.StartsWith("#") }
foreach ($line in $regions) {
    $p = $line.Split(",")
    $name = $p[0]; $x = [int]$p[1]; $y = [int]$p[2]; $w = [int]$p[3]; $h = [int]$p[4]
    $rect = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
    $crop = $img.Clone($rect, $img.PixelFormat)
    $crop.Save("$OutDir\$name.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $crop.Dispose()
    Write-Host "saved $name ($x,$y,$w,$h)"
}
$img.Dispose()
