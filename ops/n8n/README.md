# NCLEX n8n automation

Import `NCLEX Curriculum & Content Pipeline.json`; do not import the similarly named truncated Markdown fragment and do not run the legacy PostgreSQL setup script.

The export is intentionally inactive and contains no credential IDs or secrets. Before testing it in n8n:

1. Bind the existing Google Gemini credential to **Google Gemini Flash Lite**.
2. Create an n8n Header Auth credential for **Authenticated NCLEX Webhook**. Use a randomly generated header value and do not place it in request bodies.
3. Create a separate HTTP Header Auth credential for **Application Preflight** and **Application Persistence API** with header `Authorization` and value `Bearer <N8N_AUTOMATION_TOKEN>`.
4. Set the n8n variable `NCLEX_APP_BASE_URL` to the application origin. The checked-in fallback is `https://nursestudy-lesson-builder.onrender.com`.
5. Set the same strong `N8N_AUTOMATION_TOKEN` only in the application host environment. Optionally set `SHORTS_WEEKLY_GENERATION_LIMIT`; the application always caps it at seven.

Run manual contract tests before activation. The workflow has no Postgres node and must never receive a database credential. Only public or licensed, nonconfidential, non-PHI source material may be sent through the Gemini free tier.

The application preflight runs before Gemini. Replays and exhausted weekly budgets therefore consume no model call. A valid new request is generated, structurally parsed, deterministically checked, and persisted through the authenticated application transaction.

## Daily publisher

Import `NCLEX Daily Short Publisher.json` separately and leave it inactive until private-upload tests pass. Bind the same application Header Auth credential, the existing NurseStudy Google Drive OAuth credential, and a YouTube OAuth credential. Set `NURSESTUDY_SHORTS_MONTH_FOLDER_ID` to the Drive folder ID for the current `NurseStudy/Shorts/YYYY/MM` folder. Set `NCLEX_YOUTUBE_PRIVACY=private` for acceptance testing; change it to `public` only after YouTube project eligibility is confirmed.

The application host must have FFmpeg installed and available as `ffmpeg`, or expose its absolute executable path in `FFMPEG_PATH`. Rendering is deterministic, exactly eight seconds, 1080x1920, caption-led, and silent. Only one render can be claimed per Pacific day. Both Drive and YouTube uploads retry at most twice. Ambiguous YouTube results are marked `publish_unknown`, are excluded from the normal queue, and can be retrieved from `/api/automation/nclex-shorts/reconcile` using the stable `[clip:<short-id>]` search term before any retry.

Schedule `POST /api/automation/nclex-maintenance/compact-events` monthly from a small maintenance workflow. It replaces detailed events older than 90 days with compact per-short summaries.
