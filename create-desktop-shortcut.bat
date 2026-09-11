@echo off
title Create Desktop Shortcut — Made N More
echo Creating Desktop shortcut for Made N More 3D Print Manager...
powershell -NoProfile -Command "$desktop = [Environment]::GetFolderPath('Desktop'); $s=(New-Object -COM WScript.Shell).CreateShortcut(\"$desktop\Made N More 3D Manager.lnk\"); $s.TargetPath=\"%~dp0launch.bat\"; $s.WorkingDirectory=\"%~dp0\"; $s.Description=\"Made N More 3D Printing Business Manager\"; $s.Save()"
echo.
echo [✓] Desktop shortcut created successfully on your Desktop!
timeout /t 3 >nul
