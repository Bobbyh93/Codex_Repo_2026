# Drive Sync Status

Last checked: 2026-07-10 06:26 UTC

## Current State

The local ops artifacts are versioned in Git and available under `ops/`:

- `HOURLY_WORK_JOBS.md`
- `WORK_LOG.md`
- `NEXT_ASSET_APPROVAL_PACKET.md`
- `NEXT_ASSET_APPROVAL_PACKET.json`

Existing Drive files were discovered for:

- `NEXT_ASSET_APPROVAL_PACKET.md`
- `HOURLY_WORK_JOBS.md`
- `WORK_LOG.md`

The Drive project link resolves to `NursePrep Platform Development`, but the connector reports the Drive location visibility as `access_not_verified`.

## Safe Handling Rule

Do not automatically replace or upload ops files into Drive while the destination remains unverified.

The connector rejected file replacement/upload because it would transfer local workspace ops content to an unverified external Drive location. Keep Git as the authoritative sync surface until the user explicitly approves that Drive transfer after reviewing the destination and contents.

## Next Safe Action

If Drive sync is needed, ask for explicit approval to update these exact Drive files:

- `NEXT_ASSET_APPROVAL_PACKET.md`
- `HOURLY_WORK_JOBS.md`
- `WORK_LOG.md`

Optionally upload:

- `NEXT_ASSET_APPROVAL_PACKET.json`

No raw `.env`, secrets, database dumps, learner data, or admin session data should be uploaded.

## Sync Packet

`ops/EXTERNAL_SYNC_PACKET.md` and `ops/EXTERNAL_SYNC_PACKET.json` now provide the current local handoff list for Drive and Calendar. They include:

- exact Drive candidate files
- exact calendar import file
- generated hourly event count
- current launch health summary
- exclusions that must never be synced
- the current destination verification state

Use this packet as the source of truth before any connector write.
