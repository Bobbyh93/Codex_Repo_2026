from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "validate_lesson_governance.py"
SPEC = importlib.util.spec_from_file_location("lesson_governance", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class LessonGovernanceTests(unittest.TestCase):
    def test_production_pilot_is_blocked_by_unresolved_governance(self) -> None:
        report = MODULE.validate_lesson(ROOT / "lessons" / "production_pilot", "production_ready")
        self.assertEqual("blocked", report["status"])
        locations = {item["location"] for item in report["findings"]}
        self.assertIn("administrative.courseId", locations)
        self.assertIn("taxonomyStatus", locations)
        self.assertIn("faculty_review", locations)

    def test_broken_source_and_objective_references_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            lesson_dir = Path(temp)
            governance = json.loads((ROOT / "lessons" / "production_pilot" / "governance.json").read_text(encoding="utf-8"))
            lesson = json.loads((ROOT / "lessons" / "production_pilot" / "lesson_spec.json").read_text(encoding="utf-8"))
            sources = json.loads((ROOT / "lessons" / "production_pilot" / "source_manifest.json").read_text(encoding="utf-8"))
            tts = json.loads((ROOT / "lessons" / "production_pilot" / "tts_request_queue.json").read_text(encoding="utf-8"))
            lesson["slides"][0]["source_refs"] = ["SRC-UNKNOWN"]
            governance["slideTraceability"][0]["objectiveIds"] = ["LO-UNKNOWN"]
            for name, payload in (("governance.json", governance), ("lesson_spec.json", lesson), ("source_manifest.json", sources), ("tts_request_queue.json", tts)):
                (lesson_dir / name).write_text(json.dumps(payload), encoding="utf-8")
            report = MODULE.validate_lesson(lesson_dir, "faculty_review")
            codes = [item["code"] for item in report["findings"]]
            self.assertGreaterEqual(codes.count("broken_reference"), 2)


if __name__ == "__main__":
    unittest.main()
