#!/usr/bin/env pwsh
# Generates a placeholder Tykuru brand icon (1024x1024 PNG) used as the source
# for `tauri icon`. Replace with real branded assets before final release.
#
# The design is intentionally minimal: a rounded square with a "T" glyph. It is
# a placeholder, not a brand asset.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$size = 1024
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

# Rounded-square background (dark slate).
$bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 17, 24, 39))
$radius = 180
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$d = $radius * 2
$path.AddArc(0, 0, $d, $d, 180, 90)
$path.AddArc($size - $d, 0, $d, $d, 270, 90)
$path.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
$path.AddArc(0, $size - $d, $d, $d, 90, 90)
$path.CloseFigure()
$g.FillPath($bg, $path)

# "T" glyph in the center, light color.
$font = New-Object System.Drawing.Font("Segoe UI", 560, [System.Drawing.FontStyle]::Bold)
$fg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
$g.DrawString("T", $font, $fg, $rect, $sf)

$out = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")) "src-tauri\icons\source-icon.png"
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Wrote $out"

$g.Dispose()
$bmp.Dispose()
