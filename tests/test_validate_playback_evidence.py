from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from pilot_fixtures import (
    PLAYBACK as MODULE,
    ROOT,
    SHA,
    copy_pilot_tree,
    evidence_for,
    media_qa_report,
    passing_evidence,
    passing_record,
    read_json,
    write_evidence,
    write_json,
)


class ValidatePlaybackEvidenceTests(unittest.TestCase):
    def test_committed_report_matches_a_fresh_run(self) -> None:
        committed = read_json(ROOT / "qa" / "production_pilot_playback_report.json")
        self.assertEqual(MODULE.validate_playback_evidence(ROOT), committed)

    def test_every_release_path_passes_with_complete_evidence(self) -> None:
        for release_path, targets in MODULE.VALID_RELEASE_PATHS.items():
            with self.subTest(release_path), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                copy_pilot_tree(root)
                write_evidence(root, passing_evidence(release_path), media_qa_report() if release_path == "video" else None)
                report = MODULE.validate_playback_evidence(root)
                self.assertEqual(report["status"], "playback_pass", report)
                self.assertEqual(report["blockers"], [])
                self.assertEqual(report["errors"], [])
                self.assertEqual(report["required_targets"], sorted(targets))
                self.assertEqual(report["passed_targets"], sorted(targets))

    def test_video_requires_a_valid_machine_media_qa_report(self) -> None:
        cases = {
            "missing": (None, "Machine media QA report is not recorded for the video release path (qa/production_pilot_media_qa_report.json)."),
            "invalid_json": ("{not json", "Machine media QA report is not valid JSON (qa/production_pilot_media_qa_report.json)."),
            "list": ("[]", "Machine media QA report is not a JSON object (qa/production_pilot_media_qa_report.json)."),
            "string": ('"pass"', "Machine media QA report is not a JSON object (qa/production_pilot_media_qa_report.json)."),
            "status": (media_qa_report(status="fail"), "Machine media QA status is not pass."),
            "status_case": (media_qa_report(status="PASS"), "Machine media QA status is not pass."),
            "checksum": (media_qa_report(artifact_sha256="b" * 64), "Machine media QA checksum does not match the final artifact."),
            "no_checksum": (media_qa_report(artifact_sha256=None), "Machine media QA checksum does not match the final artifact."),
            "path": (media_qa_report(artifact_path="video/other.mp4"), "Machine media QA artifact path does not match the final artifact."),
            "pilot": (media_qa_report(pilot_id="some-other-pilot"), "Machine media QA pilot_id does not match lesson_spec.json."),
            "secret": (media_qa_report(notes=["Bearer abc123"]), "Machine media QA report contains a secret-like marker."),
        }
        for name, (media_qa, expected) in cases.items():
            with self.subTest(name), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                copy_pilot_tree(root)
                write_evidence(root, passing_evidence("video"), media_qa)
                report = MODULE.validate_playback_evidence(root)
                self.assertEqual(report["status"], "blocked")
                self.assertIn(expected, report["blockers"])

    def test_machine_media_qa_is_not_required_for_slide_decks(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            copy_pilot_tree(root)
            write_evidence(root, passing_evidence("pptx"), None)
            self.assertEqual(MODULE.validate_playback_evidence(root)["status"], "playback_pass")

    def test_required_targets_can_add_but_never_drop_mandatory_targets(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            copy_pilot_tree(root)
            write_evidence(root, evidence_for("video", [passing_record("browser")], required_targets=["browser"]), media_qa_report())
            report = MODULE.validate_playback_evidence(root)
            self.assertEqual(report["status"], "blocked")
            self.assertIn("Missing required playback target: lms", report["blockers"])
            write_evidence(root, evidence_for("pptx", [passing_record("powerpoint")], required_targets=["browser"]))
            report = MODULE.validate_playback_evidence(root)
            self.assertEqual(report["status"], "blocked")
            self.assertIn("Missing required playback target: browser", report["blockers"])
            self.assertEqual(report["required_targets"], ["browser", "powerpoint"])

    def test_evidence_level_errors_block_even_with_passing_records(self) -> None:
        def secret(root: Path) -> None:
            write_evidence(root, evidence_for("pptx", [passing_record("powerpoint")], notes=["token: Bearer abc123"]))

        def wrong_pilot(root: Path) -> None:
            write_evidence(root, evidence_for("pptx", [passing_record("powerpoint")], pilot_id="some-other-pilot"))

        def no_pilot(root: Path) -> None:
            evidence = evidence_for("pptx", [passing_record("powerpoint")])
            del evidence["pilot_id"]
            write_evidence(root, evidence)

        def binding_mismatch(root: Path) -> None:
            write_evidence(root, passing_evidence("pptx"))
            path = root / "manifests" / "production_pilot_binding_manifest.json"
            manifest = read_json(path)
            manifest["bindings"] = manifest["bindings"][1:]
            write_json(path, manifest)

        def not_an_object(root: Path) -> None:
            write_evidence(root, "[]")

        def no_pilot_anywhere(root: Path) -> None:
            no_pilot(root)
            path = root / "lessons" / "production_pilot" / "lesson_spec.json"
            lesson = read_json(path)
            del lesson["pilot_id"]
            write_json(path, lesson)

        cases = {
            "secret": (secret, "Playback evidence contains a secret-like marker."),
            "wrong_pilot": (wrong_pilot, "Playback evidence pilot_id does not match lesson_spec.json."),
            "no_pilot": (no_pilot, "Playback evidence pilot_id does not match lesson_spec.json."),
            "no_pilot_anywhere": (no_pilot_anywhere, "Playback evidence pilot_id does not match lesson_spec.json."),
            "binding_mismatch": (binding_mismatch, "Lesson slides do not exactly match binding manifest slide IDs."),
            "not_an_object": (not_an_object, "Playback evidence is not a JSON object."),
        }
        for name, (mutate, expected) in cases.items():
            with self.subTest(name), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                copy_pilot_tree(root)
                mutate(root)
                report = MODULE.validate_playback_evidence(root)
                self.assertEqual(report["status"], "blocked")
                self.assertIn(expected, report["errors"])

    def test_record_level_problems_block(self) -> None:
        cases = {
            "status": (passing_record("powerpoint", status="fail"), "powerpoint-1: Status is not pass"),
            "checksum": (passing_record("powerpoint", artifact_sha256="b" * 64), "powerpoint-1: Artifact checksum does not match final artifact"),
            "notes": (passing_record("powerpoint", speaker_notes_preserved=False), "powerpoint-1: speaker_notes_preserved is not true"),
            "critical_defect": (
                passing_record("powerpoint", defects=[{"severity": "critical", "status": "open", "summary": "audio drops"}]),
                "powerpoint-1: Unresolved critical defect: audio drops",
            ),
            "capitalised_blocker": (
                passing_record("powerpoint", defects=[{"severity": "Blocker", "status": "open", "summary": "no audio"}]),
                "powerpoint-1: Unresolved blocker defect: no audio",
            ),
            "unknown_severity": (
                passing_record("powerpoint", defects=[{"status": "open", "summary": "unlabelled"}]),
                "powerpoint-1: Unresolved major defect: unlabelled",
            ),
            "high_severity": (
                passing_record("powerpoint", defects=[{"severity": "high", "status": "open", "summary": "stutter"}]),
                "powerpoint-1: Unresolved high defect: stutter",
            ),
            "pending_status": (
                passing_record("powerpoint", defects=[{"severity": "major", "status": "pending", "summary": "clipping"}]),
                "powerpoint-1: Unresolved major defect: clipping",
            ),
            "no_status": (
                passing_record("powerpoint", defects=[{"severity": "major", "summary": "silence"}]),
                "powerpoint-1: Unresolved major defect: silence",
            ),
            "defect_not_an_object": (passing_record("powerpoint", defects=["broken"]), "powerpoint-1: Defect entry is not an object"),
            "defects_not_a_list": (passing_record("powerpoint", defects="broken"), "powerpoint-1: defects is not a list"),
            "narration": (passing_record("powerpoint", narration_audible=False), "powerpoint-1: narration_audible is not true"),
            "full_playback": (passing_record("powerpoint", full_playback_completed=False), "powerpoint-1: full_playback_completed is not true"),
            "tester": (passing_record("powerpoint", tester=""), "powerpoint-1: Missing tester"),
            "not_an_object": ("nope", "record-1: Playback record is not an object"),
        }
        for name, (record, expected) in cases.items():
            with self.subTest(name), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                copy_pilot_tree(root)
                write_evidence(root, evidence_for("pptx", [record]))
                report = MODULE.validate_playback_evidence(root)
                self.assertEqual(report["status"], "blocked")
                self.assertIn(expected, report["blockers"])

    def test_video_records_need_caption_and_seek_evidence(self) -> None:
        for field in ("captions_visible", "captions_synchronized", "pause_resume_passed", "seeking_passed"):
            with self.subTest(field), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                copy_pilot_tree(root)
                records = [passing_record("browser"), passing_record("lms", **{field: False})]
                write_evidence(root, evidence_for("video", records), media_qa_report())
                report = MODULE.validate_playback_evidence(root)
                self.assertEqual(report["status"], "blocked")
                self.assertIn(f"lms-1: {field} is not true", report["blockers"])

    def test_checksum_must_be_a_real_sha256_digest(self) -> None:
        for name, sha in {"placeholder": "TBD", "boolean": True, "short": "abc123", "non_hex": "g" * 64}.items():
            with self.subTest(name), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                copy_pilot_tree(root)
                evidence = evidence_for("pptx", [passing_record("powerpoint", artifact_sha256=sha)])
                evidence["final_artifact"]["sha256"] = sha
                write_evidence(root, evidence)
                report = MODULE.validate_playback_evidence(root)
                self.assertEqual(report["status"], "blocked")
                self.assertIn("Final artifact checksum is not a SHA-256 hex digest.", report["blockers"])
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            copy_pilot_tree(root)
            upper = SHA.upper()
            evidence = evidence_for("pptx", [passing_record("powerpoint", artifact_sha256=upper)])
            evidence["final_artifact"]["sha256"] = upper
            write_evidence(root, evidence)
            report = MODULE.validate_playback_evidence(root)
            self.assertEqual(report["status"], "playback_pass")
            self.assertEqual(report["final_artifact"], {"path": evidence["final_artifact"]["path"], "sha256": upper})

    def test_minor_or_resolved_defects_do_not_block(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            copy_pilot_tree(root)
            defects = [
                {"severity": "minor", "status": "open", "summary": "cosmetic"},
                {"severity": "blocker", "status": "resolved", "summary": "fixed"},
            ]
            write_evidence(root, evidence_for("pptx", [passing_record("powerpoint", defects=defects)]))
            self.assertEqual(MODULE.validate_playback_evidence(root)["status"], "playback_pass")

    def test_odd_shapes_block_instead_of_crashing(self) -> None:
        cases = {
            "final_artifact_null": evidence_for("pptx", [passing_record("powerpoint")], final_artifact=None),
            "final_artifact_string": evidence_for("pptx", [passing_record("powerpoint")], final_artifact="video/final.mp4"),
            "records_string": evidence_for("pptx", "nope"),
            "required_targets_string": evidence_for("pptx", [passing_record("powerpoint")], required_targets="lms"),
        }
        for name, evidence in cases.items():
            with self.subTest(name), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                copy_pilot_tree(root)
                write_evidence(root, evidence)
                report = MODULE.validate_playback_evidence(root)
                self.assertEqual(report["status"], "blocked")
                self.assertTrue(report["blockers"])

    def test_missing_artifacts_block_early(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            copy_pilot_tree(root)
            (root / "qa" / "production_pilot_playback_evidence.json").unlink()
            report = MODULE.validate_playback_evidence(root)
            self.assertEqual(report["status"], "blocked")
            self.assertEqual(report["release_path"], "unknown")
            self.assertIn("Missing required artifact: qa/production_pilot_playback_evidence.json", report["errors"])

    def test_main_writes_report_and_returns_exit_code(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            copy_pilot_tree(root)
            out = root / "out" / "report.json"
            write_evidence(root, passing_evidence("pptx"))
            self.assertEqual(MODULE.main(root, out), 0)
            self.assertEqual(read_json(out)["status"], "playback_pass")
            write_evidence(root, passing_evidence("video"))  # no media QA report
            self.assertEqual(MODULE.main(root, out), 1)
            self.assertEqual(read_json(out)["status"], "blocked")
            self.assertEqual(SHA, "a" * 64)


if __name__ == "__main__":
    unittest.main()
