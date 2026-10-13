import { createHash, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import { db } from "../db";
import { renderCaptionShort } from "../nclex-short-renderer";
import {
  nursingTopics,
  practiceQuestions,
  quizShorts,
  shortAutomationEvents,
  sourceRegistry,
} from "@shared/schema";
import {
  nclexAutomationIngestSchema,
  nclexIngestSourceSchema,
  resolveLegacyNclexStandard,
  validateGeneratedNclexContent,
  validateNclexSourceSafety,
} from "@shared/nclex-automation-contract";

const DEFAULT_WEEKLY_LIMIT = 7;
const MAX_PUBLISH_RETRIES = 2;

let tablesReady = false;

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function bearerToken(req: Request) {
  const authorization = req.header("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function requireAutomationAuth(req: Request, res: Response) {
  const configuredToken = process.env.N8N_AUTOMATION_TOKEN?.trim();
  if (!configuredToken) {
    res.status(503).json({ error: "NCLEX automation is not configured" });
    return false;
  }
  if (!safeEqual(bearerToken(req), configuredToken)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function requireAutomationEnabled(res: Response) {
  if (process.env.NCLEX_AUTOMATION_ENABLED?.trim().toLowerCase() === "false") {
    res.status(429).json({ error: "NCLEX automation is paused by its spend or operations guardrail" });
    return false;
  }
  return true;
}

function weeklyLimit() {
  const parsed = Number.parseInt(process.env.SHORTS_WEEKLY_GENERATION_LIMIT || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, DEFAULT_WEEKLY_LIMIT) : DEFAULT_WEEKLY_LIMIT;
}

async function ensureNclexAutomationTables() {
  if (tablesReady) return;

  // source_registry already belongs to the application. CREATE IF NOT EXISTS
  // keeps this independently deployable on older databases without creating a
  // second database or granting n8n direct database access.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS source_registry (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      source_kind text NOT NULL DEFAULT 'document',
      source_type text NOT NULL DEFAULT 'reference',
      source_uri text,
      drive_file_id text,
      document_id varchar REFERENCES documents(id),
      subject text,
      edition text,
      citation_policy text NOT NULL DEFAULT 'cite_paraphrase',
      approval_status text NOT NULL DEFAULT 'approved',
      ingestion_status text NOT NULL DEFAULT 'ready',
      metadata jsonb DEFAULT '{}'::jsonb,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quiz_shorts (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      nursing_topic_id varchar REFERENCES nursing_topics(id) ON DELETE SET NULL,
      practice_question_id varchar REFERENCES practice_questions(id) ON DELETE SET NULL,
      source_registry_id varchar REFERENCES source_registry(id) ON DELETE SET NULL,
      external_unit_id integer NOT NULL,
      standard_id integer NOT NULL,
      nclex_category text NOT NULL,
      generated_payload jsonb NOT NULL,
      content_hash text NOT NULL UNIQUE,
      idempotency_key text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'qa_passed',
      scheduled_for timestamp,
      drive_file_id text,
      drive_url text,
      youtube_video_id text,
      youtube_url text,
      retry_count integer NOT NULL DEFAULT 0,
      error_message text,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      published_at timestamp
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS short_automation_events (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      short_id varchar REFERENCES quiz_shorts(id) ON DELETE CASCADE,
      request_id text,
      event_type text NOT NULL,
      status text NOT NULL,
      details jsonb DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS quiz_shorts_status_schedule_idx ON quiz_shorts(status, scheduled_for)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS short_automation_events_created_idx ON short_automation_events(created_at)`);
  tablesReady = true;
}

function replayResponse(existing: typeof quizShorts.$inferSelect) {
  return {
    replayed: true,
    request_id: existing.idempotencyKey,
    topic_id: existing.nursingTopicId,
    question_id: existing.practiceQuestionId,
    short_id: existing.id,
    source_id: existing.sourceRegistryId,
    status: existing.status,
  };
}

async function findReplay(idempotencyKey: string, contentHash: string) {
  const [existing] = await db
    .select()
    .from(quizShorts)
    .where(or(eq(quizShorts.idempotencyKey, idempotencyKey), eq(quizShorts.contentHash, contentHash)))
    .limit(1);
  return existing;
}

function normalizedContentHash(input: {
  unit_id: number;
  topic_name: string;
  raw_content: string;
  standard_id: number;
}) {
  return sha256(JSON.stringify({
    unit_id: input.unit_id,
    topic_name: input.topic_name.trim().replace(/\s+/g, " ").toLowerCase(),
    raw_content: input.raw_content.trim().replace(/\s+/g, " "),
    standard_id: input.standard_id,
  }));
}

export function registerNclexAutomationRoutes(app: Express) {
  app.post("/api/automation/nclex-ingest/preflight", async (req, res) => {
    if (!requireAutomationAuth(req, res)) return;
    if (!requireAutomationEnabled(res)) return;
    const parsed = nclexIngestSourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid ingestion source", issues: parsed.error.issues });
    }
    const input = parsed.data;
    if (!resolveLegacyNclexStandard(input.standard_id)) {
      return res.status(400).json({ error: "Unsupported standard_id" });
    }
    const sourceIssues = validateNclexSourceSafety(`${input.topic_name}\n${input.raw_content}`);
    if (sourceIssues.length) {
      return res.status(422).json({ error: "Source safety QA failed", issues: sourceIssues });
    }

    try {
      await ensureNclexAutomationTables();
      const contentHash = normalizedContentHash(input);
      const requestId = input.request_id || `nclex-${contentHash.slice(0, 24)}`;
      const replay = await findReplay(requestId, contentHash);
      if (replay) return res.status(200).json(replayResponse(replay));

      const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [usage] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(quizShorts)
        .where(gte(quizShorts.createdAt, windowStart));
      if ((usage?.count || 0) >= weeklyLimit()) {
        return res.status(429).json({ error: "Weekly free-tier generation limit reached" });
      }
      return res.status(200).json({ replayed: false, request_id: requestId, content_hash: contentHash });
    } catch (error: any) {
      console.error("NCLEX automation preflight failed", { code: error?.code });
      return res.status(503).json({ error: "NCLEX preflight unavailable" });
    }
  });

  app.post("/api/automation/nclex-ingest", async (req, res) => {
    if (!requireAutomationAuth(req, res)) return;
    if (!requireAutomationEnabled(res)) return;

    const parsed = nclexAutomationIngestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid ingestion payload", issues: parsed.error.issues });
    }

    const input = parsed.data;
    const nclexCategory = resolveLegacyNclexStandard(input.standard_id);
    if (!nclexCategory) {
      return res.status(400).json({ error: "Unsupported standard_id" });
    }

    const sourceIssues = validateNclexSourceSafety(`${input.topic_name}\n${input.raw_content}`);
    if (sourceIssues.length) {
      return res.status(422).json({ error: "Source safety QA failed", issues: sourceIssues });
    }

    const outputIssues = validateGeneratedNclexContent(input.raw_content, input.generated);
    if (outputIssues.length) {
      return res.status(422).json({ error: "Generated clinical/source QA failed", issues: outputIssues });
    }

    const contentHash = normalizedContentHash(input);
    const requestId = input.request_id || `nclex-${contentHash.slice(0, 24)}`;
    const idempotencyKey = requestId;

    try {
      await ensureNclexAutomationTables();

      const replay = await findReplay(idempotencyKey, contentHash);
      if (replay) return res.status(200).json(replayResponse(replay));

      const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [usage] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(quizShorts)
        .where(gte(quizShorts.createdAt, windowStart));
      if ((usage?.count || 0) >= weeklyLimit()) {
        return res.status(429).json({ error: "Weekly free-tier generation limit reached" });
      }

      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('nclex-weekly-generation-limit'))`);
        const [transactionReplay] = await tx
          .select()
          .from(quizShorts)
          .where(or(eq(quizShorts.idempotencyKey, idempotencyKey), eq(quizShorts.contentHash, contentHash)))
          .limit(1);
        if (transactionReplay) return { replay: transactionReplay } as const;

        const [transactionUsage] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(quizShorts)
          .where(gte(quizShorts.createdAt, windowStart));
        if ((transactionUsage?.count || 0) >= weeklyLimit()) {
          return { budgetExceeded: true } as const;
        }

        const [existingTopic] = await tx
          .select()
          .from(nursingTopics)
          .where(sql`lower(${nursingTopics.name}) = lower(${input.topic_name})`)
          .limit(1);

        const [topic] = existingTopic
          ? await tx.update(nursingTopics)
              .set({
                description: input.raw_content.slice(0, 2_000),
                clinicalConcepts: [nclexCategory],
                frequency: sql`coalesce(${nursingTopics.frequency}, 0) + 1`,
                lastSeen: new Date(),
              })
              .where(eq(nursingTopics.id, existingTopic.id))
              .returning()
          : await tx.insert(nursingTopics).values({
              name: input.topic_name,
              description: input.raw_content.slice(0, 2_000),
              clinicalConcepts: [nclexCategory],
              frequency: 1,
              lastSeen: new Date(),
            }).returning();

        const [source] = await tx.insert(sourceRegistry).values({
          title: `${input.topic_name} (unit ${input.unit_id})`,
          sourceKind: "webhook_text",
          sourceType: "automation_ingest",
          sourceUri: `n8n://nclex-ingest/${requestId}`,
          subject: nclexCategory,
          citationPolicy: "source_bound",
          approvalStatus: "approved",
          ingestionStatus: "ready",
          metadata: {
            unitId: input.unit_id,
            standardId: input.standard_id,
            nclexCategory,
            rawContent: input.raw_content,
            contentHash,
            requestId,
            providerTier: "gemini_free",
          },
        }).returning();

        const correctIndex = input.generated.options.findIndex((option) => option.is_correct);
        const correctAnswer = ["A", "B", "C", "D"][correctIndex];
        const [question] = await tx.insert(practiceQuestions).values({
          topicId: topic.id,
          question: input.generated.question_stem,
          optionA: input.generated.options[0].option_text,
          optionB: input.generated.options[1].option_text,
          optionC: input.generated.options[2].option_text,
          optionD: input.generated.options[3].option_text,
          correctAnswer,
          explanation: input.generated.options[correctIndex].rationale_text,
          difficulty: "medium",
          cognitiveLevel: "apply",
          nclexCategory,
        }).returning();

        const [short] = await tx.insert(quizShorts).values({
          nursingTopicId: topic.id,
          practiceQuestionId: question.id,
          sourceRegistryId: source.id,
          externalUnitId: input.unit_id,
          standardId: input.standard_id,
          nclexCategory,
          generatedPayload: input.generated,
          contentHash,
          idempotencyKey,
          status: "qa_passed",
        }).returning();

        await tx.insert(shortAutomationEvents).values({
          shortId: short.id,
          requestId,
          eventType: "ingest",
          status: "created",
          details: { contentHash, standardId: input.standard_id, nclexCategory },
        });

        return { topic, source, question, short } as const;
      });

      if ("replay" in result && result.replay) return res.status(200).json(replayResponse(result.replay));
      if ("budgetExceeded" in result && result.budgetExceeded) {
        return res.status(429).json({ error: "Weekly free-tier generation limit reached" });
      }
      return res.status(201).json({
        replayed: false,
        request_id: requestId,
        topic_id: result.topic.id,
        question_id: result.question.id,
        short_id: result.short.id,
        source_id: result.source.id,
        status: result.short.status,
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        const replay = await findReplay(idempotencyKey, contentHash);
        if (replay) return res.status(200).json(replayResponse(replay));
      }
      console.error("NCLEX automation ingest failed", { requestId, code: error?.code });
      return res.status(500).json({ error: "NCLEX ingestion failed; retry with the same request_id" });
    }
  });

  app.get("/api/automation/nclex-shorts/next", async (req, res) => {
    if (!requireAutomationAuth(req, res)) return;
    try {
      await ensureNclexAutomationTables();
      const todayPacific = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const [publishedToday] = await db
        .select({ id: quizShorts.id })
        .from(quizShorts)
        .where(and(
          eq(quizShorts.status, "published"),
          sql`to_char(${quizShorts.publishedAt} AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD') = ${todayPacific}`,
        ))
        .limit(1);
      if (publishedToday) return res.status(429).json({ error: "Daily publication limit reached" });

      const [next] = await db
        .select()
        .from(quizShorts)
        .where(and(
          eq(quizShorts.status, "qa_passed"),
          or(sql`${quizShorts.scheduledFor} IS NULL`, sql`${quizShorts.scheduledFor} <= now()`),
        ))
        .orderBy(desc(quizShorts.createdAt))
        .limit(1);
      return next ? res.json(next) : res.status(204).send();
    } catch (error: any) {
      console.error("NCLEX publication queue failed", { code: error?.code });
      return res.status(503).json({ error: "Publication queue unavailable" });
    }
  });

  app.get("/api/automation/nclex-shorts/reconcile", async (req, res) => {
    if (!requireAutomationAuth(req, res)) return;
    try {
      await ensureNclexAutomationTables();
      const rows = await db
        .select()
        .from(quizShorts)
        .where(eq(quizShorts.status, "publish_unknown"))
        .orderBy(desc(quizShorts.updatedAt))
        .limit(25);
      return res.json(rows.map((short) => ({
        ...short,
        stable_clip_id: short.id,
        youtube_search_term: `[clip:${short.id}]`,
      })));
    } catch (error: any) {
      console.error("NCLEX reconciliation queue failed", { code: error?.code });
      return res.status(503).json({ error: "Reconciliation queue unavailable" });
    }
  });

  app.post("/api/automation/nclex-shorts/:id/render", async (req, res) => {
    if (!requireAutomationAuth(req, res)) return;
    if (!/^[A-Za-z0-9-]{8,80}$/.test(req.params.id)) {
      return res.status(400).json({ error: "Invalid short ID" });
    }
    try {
      await ensureNclexAutomationTables();
      const todayPacific = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const short = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'nclex-daily-render:' + todayPacific}))`);
        const [renderedToday] = await tx
          .select({ id: shortAutomationEvents.id })
          .from(shortAutomationEvents)
          .where(and(
            eq(shortAutomationEvents.eventType, "render"),
            eq(shortAutomationEvents.status, "started"),
            sql`to_char(${shortAutomationEvents.createdAt} AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD') = ${todayPacific}`,
          ))
          .limit(1);
        if (renderedToday) return "daily_limit" as const;
        const [claimed] = await tx.update(quizShorts).set({
          status: "rendering",
          updatedAt: new Date(),
          errorMessage: null,
        }).where(and(eq(quizShorts.id, req.params.id), eq(quizShorts.status, "qa_passed"))).returning();
        if (!claimed) return null;
        await tx.insert(shortAutomationEvents).values({
          shortId: claimed.id,
          requestId: claimed.idempotencyKey,
          eventType: "render",
          status: "started",
          details: { renderer: "ffmpeg", durationSeconds: 8, dimensions: "1080x1920" },
        });
        return claimed;
      });
      if (short === "daily_limit") return res.status(429).json({ error: "Daily render limit reached" });
      if (!short) return res.status(409).json({ error: "Short is unavailable or already claimed" });

      const payload = short.generatedPayload as any;
      const rendered = await renderCaptionShort({
        clipId: short.id,
        title: String(payload.video_script?.title || "NCLEX Quick Check"),
        assetContent: String(payload.video_script?.asset_content || ""),
        keyword: String(payload.keyword_to_highlight || "NCLEX"),
        cta: String(payload.cta || "Review the rationale."),
      });
      await db.transaction(async (tx) => {
        await tx.update(quizShorts).set({ status: "rendered", updatedAt: new Date() }).where(eq(quizShorts.id, short.id));
        await tx.insert(shortAutomationEvents).values({
          shortId: short.id,
          requestId: short.idempotencyKey,
          eventType: "render",
          status: "completed",
          details: { clipId: short.id, binaryStoredInDatabase: false },
        });
      });
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename=\"nclex-${short.id}.mp4\"`);
      return res.sendFile(rendered.filePath, (error) => {
        void rendered.cleanup();
        if (error && !res.headersSent) res.status(500).json({ error: "Rendered file delivery failed" });
      });
    } catch (error: any) {
      await db.update(quizShorts).set({
        status: "qa_passed",
        errorMessage: "Render failed; retry is safe",
        updatedAt: new Date(),
      }).where(eq(quizShorts.id, req.params.id)).catch(() => undefined);
      console.error("NCLEX render failed", { shortId: req.params.id, code: error?.code });
      return res.status(503).json({ error: "FFmpeg rendering unavailable" });
    }
  });

  app.post("/api/automation/nclex-shorts/:id/publication", async (req, res) => {
    if (!requireAutomationAuth(req, res)) return;
    const { drive_file_id, drive_url, youtube_video_id, youtube_url, status } = req.body || {};
    if (!drive_file_id || !["private", "published", "publish_unknown"].includes(status) || (status !== "publish_unknown" && !youtube_video_id)) {
      return res.status(400).json({ error: "drive_file_id, a valid status, and (unless unknown) youtube_video_id are required" });
    }
    try {
      await ensureNclexAutomationTables();
      const [updated] = await db.transaction(async (tx) => {
        const [short] = await tx.update(quizShorts).set({
          driveFileId: String(drive_file_id),
          driveUrl: drive_url ? String(drive_url) : null,
          youtubeVideoId: youtube_video_id ? String(youtube_video_id) : null,
          youtubeUrl: youtube_url ? String(youtube_url) : null,
          status,
          publishedAt: status === "published" ? new Date() : null,
          updatedAt: new Date(),
          errorMessage: null,
        }).where(eq(quizShorts.id, req.params.id)).returning();
        if (!short) return [];
        await tx.insert(shortAutomationEvents).values({
          shortId: short.id,
          requestId: short.idempotencyKey,
          eventType: "publication",
          status,
          details: { driveFileId: short.driveFileId, youtubeVideoId: short.youtubeVideoId },
        });
        return [short];
      });
      return updated ? res.json(updated) : res.status(404).json({ error: "Short not found" });
    } catch (error: any) {
      console.error("NCLEX publication update failed", { shortId: req.params.id, code: error?.code });
      return res.status(503).json({ error: "Publication status could not be recorded" });
    }
  });

  app.post("/api/automation/nclex-shorts/:id/failure", async (req, res) => {
    if (!requireAutomationAuth(req, res)) return;
    const message = typeof req.body?.error === "string" ? req.body.error.slice(0, 1_000) : "Publication failed";
    try {
      await ensureNclexAutomationTables();
      const [current] = await db.select().from(quizShorts).where(eq(quizShorts.id, req.params.id)).limit(1);
      if (!current) return res.status(404).json({ error: "Short not found" });
      const retries = current.retryCount + 1;
      const status = retries >= MAX_PUBLISH_RETRIES ? "quarantined" : "qa_passed";
      const [updated] = await db.transaction(async (tx) => {
        const rows = await tx.update(quizShorts).set({
          retryCount: retries,
          status,
          errorMessage: message,
          updatedAt: new Date(),
        }).where(eq(quizShorts.id, current.id)).returning();
        await tx.insert(shortAutomationEvents).values({
          shortId: current.id,
          requestId: current.idempotencyKey,
          eventType: "publication_failure",
          status,
          details: { retryCount: retries, error: message },
        });
        return rows;
      });
      return res.json(updated);
    } catch (error: any) {
      console.error("NCLEX failure update failed", { shortId: req.params.id, code: error?.code });
      return res.status(503).json({ error: "Failure status could not be recorded" });
    }
  });

  app.post("/api/automation/nclex-maintenance/compact-events", async (req, res) => {
    if (!requireAutomationAuth(req, res)) return;
    try {
      await ensureNclexAutomationTables();
      const result = await db.transaction(async (tx) => {
        const summaries = await tx.execute(sql`
          INSERT INTO short_automation_events (short_id, request_id, event_type, status, details, created_at)
          SELECT
            short_id,
            max(request_id),
            'retention_compaction',
            'compacted',
            jsonb_build_object(
              'eventsCompacted', count(*),
              'oldestEventAt', min(created_at),
              'newestEventAt', max(created_at)
            ),
            now()
          FROM short_automation_events
          WHERE created_at < now() - interval '90 days'
            AND event_type <> 'retention_compaction'
          GROUP BY short_id
          RETURNING id
        `);
        const deleted = await tx.execute(sql`
          DELETE FROM short_automation_events
          WHERE created_at < now() - interval '90 days'
            AND event_type <> 'retention_compaction'
          RETURNING id
        `);
        return { summaries: summaries.rowCount || 0, deleted: deleted.rowCount || 0 };
      });
      return res.json(result);
    } catch (error: any) {
      console.error("NCLEX event compaction failed", { code: error?.code });
      return res.status(503).json({ error: "Event compaction unavailable" });
    }
  });
}
