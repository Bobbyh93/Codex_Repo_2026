@echo off
setlocal
cd /d %~dp0\..
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install pyinstaller
pyinstaller --onefile --noconsole --name NGN_CKM_Production_Engine start_app.py
if errorlevel 1 exit /b 1
echo Built dist\NGN_CKM_Production_Engine.exe
