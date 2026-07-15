from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from create_daily_workset import build_workset, render_markdown
from check_openai_runtime import check_runtime
from credential_guard import scan_repository
from validate_state import validate_state


class DailyWorksetTests(unittest.TestCase):
    def test_repository_state_validates(self) -> None:
        errors = validate_state(ROOT / "state")
        self.assertEqual(errors, [])

    def test_workset_selects_first_incomplete_package(self) -> None:
        workset = build_workset(ROOT / "state", "2026-07-14")
        selected = workset["selected_work_package"]
        self.assertEqual(selected["id"], "HLB-TTS-ASSET-VERIFICATION-022")
        self.assertEqual(workset["status"], "blocked_or_planning_only")

    def test_markdown_contains_blockers_and_actions(self) -> None:
        workset = build_workset(ROOT / "state", "2026-07-14")
        markdown = render_markdown(workset)
        self.assertIn("Daily Workset - 2026-07-14", markdown)
        self.assertIn("Selected Work Package", markdown)
        self.assertIn("Recommended Actions", markdown)

    def test_missing_state_file_fails_validation(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            errors = validate_state(Path(tmpdir))
            self.assertTrue(errors)

    def test_openai_runtime_check_does_not_log_key(self) -> None:
        report = check_runtime()
        self.assertFalse(report["openai_api_key_value_logged"])
        self.assertIn("tts_model", report)

    def test_credential_guard_does_not_log_secrets(self) -> None:
        report = scan_repository(ROOT)
        self.assertFalse(report["external_secret_files_read"])
        self.assertFalse(report["secret_values_logged"])
        self.assertEqual(report["status"], "pass")


if __name__ == "__main__":
    unittest.main()
