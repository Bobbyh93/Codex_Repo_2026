# NurseStudy Render Environment Checklist

Use this checklist after the GitHub launch repository is connected to Render. Do not commit real secret values.

## Required Render Variables

| Key | Secret | Purpose | Expected Value Shape |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | Pooled Neon Postgres runtime connection. | `postgresql://...` pooled app URL. |
| `SESSION_SECRET` | yes | Express session signing. | 32+ random characters. |
| `OPENAI_API_KEY` | yes | Server-side lesson generation. | OpenAI API key stored only in Render. |
| `APP_URL` | no | Public app URL for links/callbacks. | `https://<render-hostname>` or custom domain. |
| `NODE_ENV` | no | Production runtime mode. | `production` |
| `ENABLE_EMAIL_DELIVERY` | no | Pilot email switch. | `false` for pilot launch. |
| `ENABLE_PROFESSIONAL_STUDY_GUIDE` | no | Keeps post-MVP guide disabled. | `false` |

## Optional Render Variables

| Key | Secret | Purpose | When To Set |
| --- | --- | --- | --- |
| `SENDGRID_API_KEY` | yes | Email delivery. | Only when `ENABLE_EMAIL_DELIVERY=true`. |
| `FROM_EMAIL` | no | Email sender. | Use verified SendGrid sender if email is enabled. |
| `FROM_NAME` | no | Email sender label. | Optional; default is `NursePrep Analytics`. |
| `NURSING_CURRICULUM_AGENT_ENDPOINT` | yes | Workspace Agent endpoint. | Optional until the agent API channel is active. |
| `NURSING_CURRICULUM_AGENT_API_KEY` | yes | Workspace Agent auth. | Optional until the agent API channel is active. |
| `NURSING_CURRICULUM_AGENT_ID` | no | Audited lesson agent ID. | `agt_69f192d4f1908191baa41586bb0df9ea` |
| `NURSING_CURRICULUM_AGENT_MODEL` | no | Direct OpenAI fallback model. | `gpt-4o-mini` |

## Neon Rule

Use the pooled Neon URL for Render `DATABASE_URL`.

Use the direct Neon URL only for schema push:

```bash
DATABASE_URL="<direct Neon URL>" npm run db:push
```

## Render Verification

After first deploy:

1. Open `/health`; expect JSON status `ok`.
2. Update `APP_URL` to the final Render URL if needed.
3. Run live smoke from a secure shell:

   ```bash
   APP_URL="https://<live-hostname>" npm run smoke:lesson-builder
   ```

4. Confirm `/admin/login`, `/admin/lesson-builder`, and `/lessons/:id` load.
5. Confirm Harrity export status is ready.

## Safety Notes

- Do not paste Render secrets into tracked files.
- Do not put Neon direct URLs in Render runtime variables.
- Keep `ENABLE_EMAIL_DELIVERY=false` until SendGrid is fully configured.
- Keep `ENABLE_PROFESSIONAL_STUDY_GUIDE=false` for the pilot.

