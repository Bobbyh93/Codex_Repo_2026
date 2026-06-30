# NurseStudy GitHub Target Decision

The local launch package is ready for a GitHub/Render handoff. The repository target has been selected, explicitly approved, and populated with a clean deployment source snapshot.

## Repository Candidates Checked

| Repository | Visibility | Default Branch | Size | Permission | Fit |
| --- | --- | --- | --- | --- | --- |
| `Bobbyh93/Codex_Repo_2026` | private | `main` | 0 | admin/push | Recommended personal launch target. |
| `HarrityTeam/chatrepo09262025` | private | `main` | 0 | admin/push | Good organization launch target if this should live under HarrityTeam. |
| `Bobbyh93/repo` | public | `master` | 0 | admin/push | Not recommended; public and branch does not match launch defaults. |

No NurseStudy-named repository was found through the GitHub connector.

## Recommendation

Use `Bobbyh93/Codex_Repo_2026` if the goal is a private personal pilot deployment source.

Use `HarrityTeam/chatrepo09262025` if the goal is an organization-owned HarrityTeam deployment source.

Do not use `Bobbyh93/repo` for this launch unless it is intentionally renamed/reconfigured first.

## Selected Target

The selected live-launch source repository is:

```text
Bobbyh93/Codex_Repo_2026
```

Use this private repository for the internal pilot deployment source.

Current pushed source:

```text
main @ 476f108d7028037d7913943c487f0aa8ad5471f1
```

## Push Safety

The source was pushed through a clean deployment staging repository made from the verified current source files. The old local Git history was not pushed to the live repository, because that history is unrelated to the Render deployment source and may contain deleted local artifacts.

## Remote Setup

Dry run:

```bash
npm run remote:live-launch -- --repo=<owner>/<repo>
```

Apply:

```bash
npm run remote:live-launch -- --repo=<owner>/<repo> --apply
```

Then follow `LIVE_LAUNCH_COMMIT_CHECKLIST.md`.

For this launch, the local `origin` remote is configured as:

```text
https://github.com/Bobbyh93/Codex_Repo_2026.git
```
