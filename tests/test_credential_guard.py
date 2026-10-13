from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from credential_guard import scan_repository  # noqa: E402


class CredentialGuardTests(unittest.TestCase):
    def test_vendored_and_build_directories_are_not_scanned(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            for directory in ("node_modules/some-sdk", "dist/assets", ".worktrees/other", "build"):
                (root / directory).mkdir(parents=True)
                (root / directory / "apikey.js").write_text("module.exports = 'not opened';", encoding="utf-8")
                (root / directory / "notes.md").write_text("sk-proj-abcdefghijklmnopqrstuvwxyz0123456789", encoding="utf-8")
            (root / "README.md").write_text("clean", encoding="utf-8")
            report = scan_repository(root)
            self.assertEqual(report["status"], "pass")
            self.assertEqual(report["blocking_sensitive_filenames"], [])
            self.assertEqual(report["key_pattern_hits"], [])

    def test_repository_files_are_still_blocked(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            (root / "node_modules").mkdir()
            (root / "config").mkdir()
            (root / "config" / "service-apikey.txt").write_text("not opened", encoding="utf-8")
            (root / "notes.md").write_text("sk-proj-abcdefghijklmnopqrstuvwxyz0123456789", encoding="utf-8")
            report = scan_repository(root)
            self.assertEqual(report["status"], "blocked")
            self.assertEqual(report["blocking_sensitive_filenames"], ["config/service-apikey.txt"])
            self.assertEqual([hit["file"] for hit in report["key_pattern_hits"]], ["notes.md"])
            self.assertFalse(report["secret_values_logged"])


if __name__ == "__main__":
    unittest.main()
