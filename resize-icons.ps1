Add-Type -AssemblyName System.Drawing

$srcPath = "D:\桌面\shijian\web\public\app-icon.png"
$baseRes = "D:\桌面\shijian\android\app\src\main\res"

$sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

$src = [System.Drawing.Image]::FromFile($srcPath)

foreach ($dir in $sizes.Keys) {
    $sz = $sizes[$dir]
    $bmp = New-Object System.Drawing.Bitmap($src, $sz, $sz)
    $bmp.Save("$baseRes\$dir\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Save("$baseRes\$dir\ic_launcher_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "$dir - ${sz}x${sz} done"
}

$src.Dispose()
Write-Host "All icons updated!"
