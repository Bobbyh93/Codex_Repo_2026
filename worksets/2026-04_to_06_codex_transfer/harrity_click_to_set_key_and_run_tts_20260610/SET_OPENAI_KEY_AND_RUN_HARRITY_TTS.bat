@echo off
setlocal
cd /d "%~dp0"
set PKG_ZIP=slide_script_tts_integration_20260610_validated.zip
set PKG_DIR=slide_script_tts_integration_20260610
if not exist "%PKG_DIR%" (
  if exist "%PKG_ZIP%" (
    powershell -NoProfile -Command "Expand-Archive -Force '%PKG_ZIP%' ."
  ) else (
    echo Package zip not found. Put this file next to %PKG_ZIP%
    pause
    exit /b 1
  )
)
cd "%PKG_DIR%"
echo Harrity Slide Script TTS Setup
echo Paste your OpenAI API key below. It will be saved locally to .env in this folder.
echo.
set /p OPENAI_API_KEY=OpenAI API key: 
echo OPENAI_API_KEY=%OPENAI_API_KEY%>.env
python scripts\validate_slide_script_tts_manifest.py manifests\slide_script_tts_manifest.example.json
python scripts\render_slide_script_tts.py manifests\slide_script_tts_manifest.example.json
echo.
echo Done. Audio should be here:
echo %cd%\audio\slide_narration\
echo.
echo QA file:
echo %cd%\manifests\tts_render_qa.json
echo.
pause
