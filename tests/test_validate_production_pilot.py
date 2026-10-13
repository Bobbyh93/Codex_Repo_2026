from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from pilot_fixtures import (
    ROOT,
    copy_pilot_tree,
    load_script,
    media_qa_report,
    passing_evidence,
    passing_pilot_tree,
    read_json,
    refresh_playback_report,
    write_evidence,
    write_json,
)

MODULE = load_script("validate_production_pilot")

PLAYBACK_REPORT = Path("qa/production_pilot_playback_report.json")


class ValidateProductionPilotTests(unittest.TestCase):
    def test_committed_release_report_matches_a_fresh_run_and_never_hardcodes_ffmpeg(self) -> None:
        report = MODULE.validate(ROOT)
        committed = read_json(ROOT / "qa" / "production_pilot_release_report.json")
        playback = read_json(ROOT / PLAYBACK_REPORT)
        self.assertEqual(report, committed)
        self.assertFalse(any("ffmpeg" in item for item in report["external_blockers"]))
        expected = "release_pass" if playback["status"] == "playback_pass" else "pilot_audio_pass_playback_blocked"
        self.assertEqual(report["status"], expected)
        self.assertEqual(MODULE.exit_code(report), 0 if expected == "release_pass" else 1)

    def test_fully_passing_release_state_exits_zero_on_every_release_path(self) -> None:
        for release_path in ("pptx", "google_slides", "video"):
            with self.subTest(release_path), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                passing_pilot_tree(root, release_path)
                report = MODULE.validate(root)
                self.assertEqual(report["status"], "release_pass", report)
                self.assertEqual(report["errors"], [])
                self.assertEqual(report["external_blockers"], [])
                self.assertEqual(report["warnings"], [])
                self.assertEqual(report["release_path"], release_path)
                self.assertTrue(report["source_grounded"])
                self.assertEqual(MODULE.exit_code(report), 0)

    def test_playback_is_re_evaluated_from_evidence_not_the_committed_report(self) -> None:
        def media_qa_deleted_after_report(root: Path) -> None:
            passing_pilot_tree(root, "video")
            (root / "qa" / "production_pilot_media_qa_report.json").unlink()

        def evidence_reset_after_report(root: Path) -> None:
            passing_pilot_tree(root, "pptx")
            write_evidence(root, read_json(ROOT / "qa" / "production_pilot_playback_evidence.json"))

        def hand_written_pass(root: Path) -> None:
            copy_pilot_tree(root)
            write_json(root / PLAYBACK_REPORT, {"status": "playback_pass", "pilot_id": "therapeutic-communication-pilot", "slide_count": 3, "release_path": "video", "blockers": [], "errors": []})

        def media_qa_edited_after_report(root: Path) -> None:
            passing_pilot_tree(root, "video")
            write_json(root / "qa" / "production_pilot_media_qa_report.json", media_qa_report(artifact_sha256="b" * 64))

        cases = {
            "media_qa_deleted": (media_qa_deleted_after_report, "Machine media QA report is not recorded for the video release path (qa/production_pilot_media_qa_report.json)."),
            "evidence_reset": (evidence_reset_after_report, "Release playback path has not been selected."),
            "hand_written_pass": (hand_written_pass, "Release playback path has not been selected."),
            "media_qa_edited": (media_qa_edited_after_report, "Machine media QA checksum does not match the final artifact."),
        }
        stale = "qa/production_pilot_playback_report.json is stale: re-run scripts/validate_playback_evidence.py."
        for name, (arrange, expected) in cases.items():
            with self.subTest(name), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                arrange(root)
                report = MODULE.validate(root)
                self.assertEqual(report["status"], "pilot_audio_pass_playback_blocked")
                self.assertIn(expected, report["external_blockers"])
                self.assertIn(stale, report["external_blockers"])
                self.assertEqual(MODULE.exit_code(report), 1)

    def test_stale_committed_report_blocks_even_when_fresh_evidence_passes(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            passing_pilot_tree(root, "pptx")
            committed = read_json(root / PLAYBACK_REPORT)
            committed["passed_targets"] = []
            write_json(root / PLAYBACK_REPORT, committed)
            report = MODULE.validate(root)
            self.assertEqual(report["status"], "pilot_audio_pass_playback_blocked")
            self.assertEqual(report["playback_status"], "playback_pass")
            self.assertEqual(report["external_blockers"], ["qa/production_pilot_playback_report.json is stale: re-run scripts/validate_playback_evidence.py."])
            self.assertEqual(MODULE.exit_code(report), 1)

    def test_blocked_playback_propagates_blockers_and_errors(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            copy_pilot_tree(root)
            evidence = passing_evidence("video")
            evidence["playback_records"] = evidence["playback_records"][:1]  # browser only
            evidence["notes"] = ["token: Bearer abc123"]
            write_evidence(root, evidence, media_qa_report())
            refresh_playback_report(root)
            report = MODULE.validate(root)
            self.assertEqual(report["status"], "pilot_audio_pass_playback_blocked")
            self.assertIn("Missing required playback target: lms", report["external_blockers"])
            self.assertIn("Playback report error: Playback evidence contains a secret-like marker.", report["external_blockers"])
            self.assertEqual(report["warnings"], [])
            self.assertEqual(MODULE.exit_code(report), 1)

    def test_unpassed_playback_without_detail_still_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            copy_pilot_tree(root)
            report = MODULE.validate(root)
            self.assertEqual(report["status"], "pilot_audio_pass_playback_blocked")
            self.assertTrue(report["external_blockers"])
            self.assertEqual(MODULE.exit_code(report), 1)
            self.assertEqual(report["external_blockers"], read_json(root / PLAYBACK_REPORT)["blockers"])

    def test_non_object_committed_playback_report_blocks_without_crashing(self) -> None:
        for name, text in {"list": "[]", "garbage": "{not json"}.items():
            with self.subTest(name), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                passing_pilot_tree(root, "pptx")
                write_json(root / PLAYBACK_REPORT, text)
                report = MODULE.validate(root)
                self.assertEqual(report["status"], "blocked")
                self.assertIn("qa/production_pilot_playback_report.json is not a JSON object.", report["errors"])
                self.assertFalse(report["source_grounded"])
                self.assertEqual(MODULE.exit_code(report), 1)

    def test_missing_artifact_blocks_with_exit_one(self) -> None:
        for relative in ("manifests/production_pilot_binding_manifest.json", "qa/production_pilot_playback_report.json"):
            with self.subTest(relative), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                passing_pilot_tree(root, "pptx")
                (root / relative).unlink()
                report = MODULE.validate(root)
                self.assertEqual(report["status"], "blocked")
                self.assertIn(f"Missing required artifact: {relative}", report["errors"])
                self.assertEqual(report["external_blockers"], [])
                self.assertEqual(MODULE.exit_code(report), 1)

    def test_artifact_swap_after_report_is_flagged_stale(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            passing_pilot_tree(root, "pptx")
            evidence = read_json(root / "qa" / "production_pilot_playback_evidence.json")
            evidence["final_artifact"]["sha256"] = "c" * 64
            for record in evidence["playback_records"]:
                record["artifact_sha256"] = "c" * 64
            write_evidence(root, evidence)
            report = MODULE.validate(root)
            self.assertEqual(report["status"], "pilot_audio_pass_playback_blocked")
            self.assertEqual(report["external_blockers"], ["qa/production_pilot_playback_report.json is stale: re-run scripts/validate_playback_evidence.py."])
            self.assertEqual(MODULE.exit_code(report), 1)

    def test_structural_errors_outrank_passing_playback(self) -> None:
        lesson = Path("lessons/production_pilot/lesson_spec.json")
        audio = Path("manifests/production_pilot_audio_manifest.json")
        binding = Path("manifests/production_pilot_binding_manifest.json")

        def edit(root: Path, relative: Path, mutate) -> None:
            payload = read_json(root / relative)
            mutate(payload)
            write_json(root / relative, payload)

        def unknown_source(root: Path) -> None:
            edit(root, lesson, lambda l: l["slides"][0].__setitem__("source_refs", ["SRC-UNKNOWN"]))

        def no_slides(root: Path) -> None:
            edit(root, lesson, lambda l: l.__setitem__("slides", []))

        def duplicate_slide(root: Path) -> None:
            edit(root, lesson, lambda l: l["slides"].append(dict(l["slides"][0])))

        def unverified_audio(root: Path) -> None:
            edit(root, audio, lambda m: m["audio_assets"][0].__setitem__("status", "pending"))

        def binding_not_ready(root: Path) -> None:
            edit(root, binding, lambda m: m.__setitem__("status", "draft"))

        def missing_binding(root: Path) -> None:
            edit(root, binding, lambda m: m.__setitem__("bindings", m["bindings"][1:]))

        cases = {
            "unknown_source": (unknown_source, "references an unknown source"),
            "no_slides": (no_slides, "lesson_spec.json has no slides"),
            "duplicate_slide": (duplicate_slide, "is a duplicate slide_id"),
            "unverified_audio": (unverified_audio, "has no verified audio asset"),
            "binding_not_ready": (binding_not_ready, "binding manifest is not ready_for_downstream_binding"),
            "missing_binding": (missing_binding, "has no binding manifest entry"),
        }
        for name, (mutate, expected) in cases.items():
            with self.subTest(name), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                passing_pilot_tree(root, "pptx")
                mutate(root)
                refresh_playback_report(root)
                report = MODULE.validate(root)
                self.assertEqual(report["status"], "blocked")
                self.assertTrue(any(expected in item for item in report["errors"]), report["errors"])
                self.assertFalse(report["source_grounded"])
                self.assertEqual(MODULE.exit_code(report), 1)

    def test_main_writes_report_and_returns_exit_code(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            passing_pilot_tree(root, "pptx")
            out = root / "out" / "release_report.json"
            self.assertEqual(MODULE.main(root, out), 0)
            self.assertEqual(read_json(out)["status"], "release_pass")
            (root / "qa" / "production_pilot_playback_evidence.json").unlink()
            self.assertEqual(MODULE.main(root, out), 1)
            self.assertEqual(read_json(out)["status"], "pilot_audio_pass_playback_blocked")

    def test_exit_code_never_trusts_status_alone(self) -> None:
        self.assertEqual(MODULE.exit_code({"status": "release_pass", "errors": ["x"], "external_blockers": []}), 1)
        self.assertEqual(MODULE.exit_code({"status": "release_pass", "errors": [], "external_blockers": ["y"]}), 1)
        self.assertEqual(MODULE.exit_code({"status": "pilot_audio_pass_playback_blocked", "errors": [], "external_blockers": []}), 1)
        self.assertEqual(MODULE.exit_code({"status": "release_pass", "errors": [], "external_blockers": []}), 0)


if __name__ == "__main__":
    unittest.main()
