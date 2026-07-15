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
from openai_tts_live_pilot import estimate_mp3_duration_seconds, probable_mp3, validate_queue
from run_hourly_ops import build_hourly_status, contains_invalid_api_key
from validate_nurse_prep_web import validate_app
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

    def test_tts_request_queue_validates(self) -> None:
        import json

        queue = json.loads((ROOT / "manifests" / "tts_request_queue.json").read_text(encoding="utf-8"))
        self.assertEqual(validate_queue(queue), [])
        self.assertEqual(len(queue["requests"]), 2)

    def test_mp3_probe_rejects_non_mp3(self) -> None:
        self.assertFalse(probable_mp3(b"not an mp3 response"))
        self.assertIsNone(estimate_mp3_duration_seconds(b"not an mp3 response"))

    def test_hourly_ops_blocks_paid_retry_after_invalid_key(self) -> None:
        status = build_hourly_status(ROOT, run_date="2026-07-15")
        self.assertEqual(status["selected_work_package"]["id"], "HLB-TTS-ASSET-VERIFICATION-022")
        self.assertEqual(status["checks"]["nurse_prep_web_app"]["status"], "pass")
        self.assertFalse(status["cost_guard"]["paid_ai_actions_allowed"])
        self.assertEqual(status["cost_guard"]["max_next_paid_retry_dollars"], "0.00")
        self.assertIn("openai_tts_live_execution", status["cost_guard"]["blocked_paid_actions"])

    def test_invalid_api_key_detection_is_recursive(self) -> None:
        self.assertTrue(contains_invalid_api_key({"nested": [{"error": {"code": "invalid_api_key"}}]}))
        self.assertFalse(contains_invalid_api_key({"nested": [{"error": {"code": "rate_limit_exceeded"}}]}))

    def test_nurse_prep_web_app_validates(self) -> None:
        self.assertEqual(validate_app(ROOT / "apps" / "nurse-prep-web"), [])


if __name__ == "__main__":
    unittest.main()
