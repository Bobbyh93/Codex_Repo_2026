from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path
from typing import Any

from pilot_fixtures import ROOT, copy_pilot_tree, load_script, passing_pilot_tree, read_json, write_evidence, write_json

MODULE = load_script("validate_lesson_governance")
LESSON = Path("lessons") / "production_pilot"
SLIDE_IDS = ["P01", "P02", "P03"]
PLAYBACK_REPORT = Path("qa/production_pilot_playback_report.json")


def release_asset_findings(root: Path) -> tuple[list[dict[str, str]], dict[str, Any]]:
    findings: list[dict[str, str]] = []
    metrics: dict[str, Any] = {}

    def finding(code: str, location: str, message: str) -> None:
        findings.append({"code": code, "location": location, "message": message})

    MODULE.validate_release_assets(root / LESSON, SLIDE_IDS, finding, metrics, root)
    return findings, metrics


def codes(findings: list[dict[str, str]]) -> set[str]:
    return {item["code"] for item in findings}


class LessonGovernanceReleaseAssetTests(unittest.TestCase):
    def test_committed_pilot_report_is_fresh_and_drives_the_playback_finding(self) -> None:
        committed_status = read_json(ROOT / PLAYBACK_REPORT)["status"]
        findings, metrics = release_asset_findings(ROOT)
        self.assertEqual("playback" in codes(findings), committed_status != "playback_pass")
        self.assertNotIn("playback_stale", codes(findings))
        self.assertEqual(metrics["playback_status"], committed_status)

    def test_passing_evidence_clears_the_playback_findings(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            passing_pilot_tree(root, "pptx")
            findings, metrics = release_asset_findings(root)
            self.assertEqual(findings, [])
            self.assertEqual(metrics["playback_status"], "playback_pass")

    def test_playback_is_re_evaluated_from_evidence_not_the_committed_report(self) -> None:
        def evidence_reset_after_report(root: Path) -> None:
            passing_pilot_tree(root, "pptx")
            write_evidence(root, read_json(ROOT / "qa" / "production_pilot_playback_evidence.json"))

        def hand_written_pass(root: Path) -> None:
            copy_pilot_tree(root)
            write_json(root / PLAYBACK_REPORT, {"status": "playback_pass"})

        def media_qa_deleted_after_report(root: Path) -> None:
            passing_pilot_tree(root, "video")
            (root / "qa" / "production_pilot_media_qa_report.json").unlink()

        for name, arrange in {"evidence_reset": evidence_reset_after_report, "hand_written_pass": hand_written_pass, "media_qa_deleted": media_qa_deleted_after_report}.items():
            with self.subTest(name), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                arrange(root)
                findings, metrics = release_asset_findings(root)
                self.assertEqual(codes(findings), {"playback_stale", "playback"}, findings)
                self.assertEqual(metrics["playback_status"], "blocked")

    def test_stale_report_blocks_even_when_fresh_evidence_passes(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            passing_pilot_tree(root, "pptx")
            committed = read_json(root / PLAYBACK_REPORT)
            committed["passed_targets"] = []
            write_json(root / PLAYBACK_REPORT, committed)
            findings, metrics = release_asset_findings(root)
            self.assertEqual(codes(findings), {"playback_stale"})
            self.assertEqual(metrics["playback_status"], "playback_pass")

    def test_non_object_committed_report_blocks_without_crashing(self) -> None:
        for name, text in {"list": "[]", "garbage": "{not json"}.items():
            with self.subTest(name), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                passing_pilot_tree(root, "pptx")
                write_json(root / PLAYBACK_REPORT, text)
                findings, _ = release_asset_findings(root)
                self.assertEqual(codes(findings), {"playback", "playback_stale"})

    def test_other_lessons_use_their_committed_report_without_pilot_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            copy_pilot_tree(root)  # pilot evidence present and NOT passing; must not be consulted
            (root / "lessons" / "other_lesson").mkdir(parents=True)
            for suffix in ("audio_manifest", "binding_manifest"):
                shutil.copyfile(ROOT / "manifests" / f"production_pilot_{suffix}.json", root / "manifests" / f"other_lesson_{suffix}.json")
            other_report = root / "qa" / "other_lesson_playback_report.json"
            for status, expected in (("playback_pass", set()), ("blocked", {"playback"})):
                with self.subTest(status):
                    write_json(other_report, {"status": status})
                    findings: list[dict[str, str]] = []
                    metrics: dict[str, Any] = {}
                    MODULE.validate_release_assets(root / "lessons" / "other_lesson", SLIDE_IDS, lambda c, l, m: findings.append({"code": c, "location": l, "message": m}), metrics, root)
                    self.assertEqual(codes(findings), expected)
                    self.assertEqual(metrics["playback_status"], status)

    def test_validate_lesson_release_ready_reads_release_assets_from_the_given_root(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            passing_pilot_tree(root, "pptx")
            shutil.copytree(ROOT / LESSON, root / LESSON, dirs_exist_ok=True)
            report = MODULE.validate_lesson(root / LESSON, "release_ready", root)
            found = codes(report["findings"])
            self.assertNotIn("missing_artifact", found)
            self.assertNotIn("playback", found)
            self.assertNotIn("playback_stale", found)
            self.assertEqual(report["metrics"]["playback_status"], "playback_pass")
            self.assertIn("licensed_rn_release", found)  # governance itself is still incomplete

    def test_missing_release_assets_are_reported_before_evaluation(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            passing_pilot_tree(root, "pptx")
            (root / PLAYBACK_REPORT).unlink()
            findings, metrics = release_asset_findings(root)
            self.assertEqual([(item["code"], item["location"]) for item in findings], [("missing_artifact", "playback")])
            self.assertEqual(metrics, {})

    def test_release_ready_target_on_committed_pilot_is_consistent_with_its_playback_report(self) -> None:
        committed_status = read_json(ROOT / PLAYBACK_REPORT)["status"]
        report = MODULE.validate_lesson(ROOT / LESSON, "release_ready")
        self.assertEqual(report["status"], "blocked")
        found = codes(report["findings"])
        self.assertEqual("playback" in found, committed_status != "playback_pass")
        self.assertIn("licensed_rn_release", found)
        self.assertNotIn("playback_stale", found)


if __name__ == "__main__":
    unittest.main()
