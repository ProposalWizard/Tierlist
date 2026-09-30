@echo off
rem Knowitball playtest breakdown, for Windows.
rem Turns a screen recording into pictures + a transcript ON YOUR PC (fast, no
rem upload of the big video), then zips the small result and drops it in the
rem Drive folder for Claude.
rem
rem Run it: drag your video onto this file, or double-click it and pick one.
rem (Windows may say "Windows protected your PC": click More info, then Run anyway.)
setlocal EnableExtensions
title Knowitball playtest breakdown
set "HERE=%LOCALAPPDATA%\KnowitballVideo"
set "DRIVE_URL=https://drive.google.com/drive/folders/1w_AJFndensiBWMicxiSReM9ZDlyQfBik"
set "SELF=%~f0"
set "PYTHONUTF8=1"

rem 1. Which video?
set "VIDEO=%~1"
if not "%VIDEO%"=="" goto havevideo
for /f "usebackq delims=" %%F in (`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Title = 'Pick the playtest recording'; $d.Filter = 'Videos|*.mp4;*.mkv;*.mov;*.webm;*.avi|All files|*.*'; if ($d.ShowDialog() -eq 'OK') { $d.FileName }"`) do set "VIDEO=%%F"
:havevideo
if "%VIDEO%"=="" goto novideo
if not exist "%VIDEO%" goto novideo

rem 2. Python. Windows has none by default; winget can install it.
set "PY="
py -3 --version >nul 2>&1
if not errorlevel 1 set "PY=py -3"
if defined PY goto havepython
python --version >nul 2>&1
if not errorlevel 1 set "PY=python"
if defined PY goto havepython
echo.
echo This PC has no Python yet. Installing it now (one time, about a minute)...
winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
echo.
echo Python is installed. CLOSE THIS WINDOW, then run this again (drag the video on again).
pause
exit /b 1
:havepython

rem 3. One-time setup: a private folder with the libraries (a few hundred MB).
if not exist "%HERE%" mkdir "%HERE%"
if exist "%HERE%\.ready" goto ready
echo.
echo First time only: installing what is needed (a few minutes)...
%PY% -m venv "%HERE%\venv"
if errorlevel 1 goto fail
"%HERE%\venv\Scripts\python.exe" -m pip install -q --upgrade pip
"%HERE%\venv\Scripts\python.exe" -m pip install -q av faster-whisper numpy pillow
if errorlevel 1 goto fail
echo ok>"%HERE%\.ready"
:ready

rem 4. The breakdown tool itself (folded into the end of this file).
powershell -NoProfile -Command "$t = [IO.File]::ReadAllText($env:SELF); $i = $t.IndexOf(':' + ':PY' + 'START'); $p = $t.Substring($i); $p = $p.Substring($p.IndexOf([char]10) + 1); [IO.File]::WriteAllText($env:HERE + '\breakdown.py', $p, (New-Object System.Text.UTF8Encoding($false)))"
if errorlevel 1 goto fail

rem 5. Run it.
for %%I in ("%VIDEO%") do set "BASE=%%~nI"
for /f %%D in ('powershell -NoProfile -Command "Get-Date -Format MMdd-HHmm"') do set "STAMP=%%D"
set "NAME=%BASE%-%STAMP%"
set "OUT=%USERPROFILE%\Videos\Knowitball breakdowns\%NAME%"
mkdir "%OUT%" 2>nul
echo.
echo Breaking down %BASE%. The first run also downloads the speech model (about 0.5 GB).
"%HERE%\venv\Scripts\python.exe" "%HERE%\breakdown.py" "%VIDEO%" --out "%OUT%"
if errorlevel 1 goto fail

rem 6. One small zip (made by Python, so it opens correctly everywhere), nothing of the big video.
"%HERE%\venv\Scripts\python.exe" -c "import shutil, sys; shutil.make_archive(sys.argv[1], 'zip', sys.argv[1])" "%OUT%"
if errorlevel 1 goto fail
for %%Z in ("%OUT%.zip") do set "BYTES=%%~zZ"
set /a KB=%BYTES%/1024

rem 7. Into the Drive folder, if Google Drive for desktop is on this PC.
set "GOT="
for %%L in (D E F G H I J K L M N O P Q R S T U V W X Y Z) do if exist "%%L:\My Drive\Knowitball playtest recordings\" if not defined GOT set "GOT=%%L:\My Drive\Knowitball playtest recordings"
if not defined GOT if exist "%USERPROFILE%\Google Drive\My Drive\Knowitball playtest recordings\" set "GOT=%USERPROFILE%\Google Drive\My Drive\Knowitball playtest recordings"
if not defined GOT goto nodrive
copy /y "%OUT%.zip" "%GOT%\" >nul
echo.
echo Done. %KB% KB zip copied into your Drive folder.
echo Tell Claude: new breakdown's in (%NAME%.zip)
goto finish
:nodrive
echo.
echo Done. %KB% KB zip is ready, but Drive isn't on this PC, so drag it in yourself.
explorer /select,"%OUT%.zip"
start "" "%DRIVE_URL%"
echo Drag  %NAME%.zip  into the Drive folder that just opened, then tell Claude: new breakdown's in.
:finish
echo.
pause
exit /b 0

:novideo
echo.
echo No video picked (or the file was not found).
pause
exit /b 1

:fail
echo.
echo Something went wrong. Tell Claude what this window says above.
pause
exit /b 1

::PYSTART
