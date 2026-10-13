#!/bin/bash
set -e
cd "$(dirname "$0")"
PKG_ZIP="slide_script_tts_integration_20260610_validated.zip"
PKG_DIR="slide_script_tts_integration_20260610"
if [ ! -d "$PKG_DIR" ]; then
  if [ -f "$PKG_ZIP" ]; then
    unzip -o "$PKG_ZIP" >/dev/null
  else
    echo "Package zip not found. Put this file next to $PKG_ZIP"
    read -p "Press Enter to close..."
    exit 1
  fi
fi
cd "$PKG_DIR"
clear
echo "Harrity Slide Script TTS Setup"
echo "Paste your OpenAI API key below. It will be saved locally to .env in this folder."
echo "The key will not be shown while typing."
echo
read -s -p "OpenAI API key: " OPENAI_API_KEY
echo
if [[ ! "$OPENAI_API_KEY" == sk-* ]]; then
  echo "That does not look like an OpenAI API key. It should start with sk- or sk-proj-."
  read -p "Press Enter to close..."
  exit 1
fi
printf 'OPENAI_API_KEY=%s\n' "$OPENAI_API_KEY" > .env
chmod 600 .env
export OPENAI_API_KEY
python3 scripts/validate_slide_script_tts_manifest.py manifests/slide_script_tts_manifest.example.json
python3 scripts/render_slide_script_tts.py manifests/slide_script_tts_manifest.example.json
echo
echo "Done. Audio should be here:"
echo "$PWD/audio/slide_narration/"
echo
echo "QA file:"
echo "$PWD/manifests/tts_render_qa.json"
echo
read -p "Press Enter to close..."
