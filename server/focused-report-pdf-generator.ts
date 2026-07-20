import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { db } from './db';
import {
  assessmentReports,
  users,
  chapterTopicMappings,
  textbookChapters,
  textbooks,
  nursingTopics,
} from '../shared/schema';
import { eq } from 'drizzle-orm';
import { parseATIReport, ATITopic } from './ati-parser';
import { deriveChapterUrl } from './textbook-url-utils';
import {
  selectFocusedClusters, FocusedCluster, SubjectCluster,
  detectSubjectSpecialty, mapToCJMPhase, clusterKey, clusterDisplayName,
  buildSubjectReports,
} from './ati-cluster-analyzer';

const COLORS = {
  primary:   '#1e40af',
  secondary: '#0369a1',
  success:   '#059669',
  warning:   '#b45309',
  muted:     '#64748b',
  light:     '#f1f5f9',
  border:    '#e2e8f0',
  dark:      '#1e293b',
  white:     '#ffffff',
  altBg:     '#f8fafc',
  cjm:       '#4338ca', // indigo for CJM phase labels
  adpi:      '#0f766e', // teal for ADPIE line
};


const ALT_TYPE_COLORS: Record<string, string> = {
  'System Disorder':      '#7c3aed',
  'Nursing Skill':        '#0369a1',
  'Nursing Intervention': '#0369a1',
  'Medication':           '#b45309',
  'Pharmacology':         '#b45309',
  'Basic Concept':        '#047857',
  'Therapeutic Procedure':'#0f766e',
  'Health Promotion':     '#15803d',
};

function altTypeColor(altType?: string): string {
  if (!altType) return COLORS.muted;
  for (const [key, color] of Object.entries(ALT_TYPE_COLORS)) {
    if (altType.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return COLORS.muted;
}

function shortAltLabel(altType?: string): string {
  if (!altType) return '';
  const lower = altType.toLowerCase();
  if (lower.includes('system disorder'))                                    return 'System Disorder';
  if (lower.includes('nursing skill') || lower.includes('nursing intervention')) return 'Nursing Skill';
  if (lower.includes('medication') || lower.includes('pharmacology'))       return 'Medication';
  if (lower.includes('basic concept'))                                      return 'Basic Concept';
  if (lower.includes('therapeutic'))                                        return 'Therapeutic Procedure';
  if (lower.includes('health promotion'))                                   return 'Health Promotion';
  return altType.length > 25 ? altType.slice(0, 22) + '\u2026' : altType;
}

export interface TextbookRef {
  chapterId: string;
  textbookTitle: string;
  chapterNumber: string;
  chapterTitle: string;
  pageStart: number | null;
  pageEnd: number | null;
  url: string | null;
}

const TEXTBOOK_REF_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let _textbookRefCache: Map<string, TextbookRef[]> | null = null;
let _textbookRefCacheExpiresAt = 0;

export function invalidateTextbookRefCache(): void {
  _textbookRefCache = null;
  _textbookRefCacheExpiresAt = 0;
}

// ── Chapter detail cache (keyed by chapterId) ─────────────────────────────
interface ChapterDetailEntry {
  data: Record<string, unknown>;
  expiresAt: number;
}
const _chapterDetailCache = new Map<string, ChapterDetailEntry>();

export function invalidateChapterCache(chapterId?: string): void {
  if (chapterId !== undefined) {
    _chapterDetailCache.delete(chapterId);
  } else {
    _chapterDetailCache.clear();
  }
}

export function getChapterDetailCache(chapterId: string): Record<string, unknown> | null {
  const entry = _chapterDetailCache.get(chapterId);
  if (!entry || Date.now() >= entry.expiresAt) {
    _chapterDetailCache.delete(chapterId);
    return null;
  }
  return entry.data;
}

export function setChapterDetailCache(chapterId: string, data: Record<string, unknown>): void {
  _chapterDetailCache.set(chapterId, { data, expiresAt: Date.now() + TEXTBOOK_REF_CACHE_TTL_MS });
}

export async function lookupTextbookReferences(): Promise<Map<string, TextbookRef[]>> {
  const now = Date.now();
  if (_textbookRefCache !== null && now < _textbookRefCacheExpiresAt) {
    return _textbookRefCache;
  }

  const refMap = new Map<string, TextbookRef[]>();
  try {
    const rows = await db
      .select({
        topicName:     nursingTopics.name,
        chapterId:     textbookChapters.id,
        textbookTitle: textbooks.title,
        chapterNumber: textbookChapters.chapterNumber,
        chapterTitle:  textbookChapters.title,
        pageStart:     textbookChapters.pageStart,
        pageEnd:       textbookChapters.pageEnd,
        url:           textbookChapters.url,
      })
      .from(chapterTopicMappings)
      .innerJoin(textbookChapters, eq(chapterTopicMappings.chapterId, textbookChapters.id))
      .innerJoin(textbooks, eq(textbookChapters.textbookId, textbooks.id))
      .leftJoin(nursingTopics, eq(chapterTopicMappings.nursingTopicId, nursingTopics.id))
      .where(eq(textbooks.isActive, true));

    for (const row of rows) {
      const topicName = (row.topicName ?? '').toLowerCase();
      if (!topicName) continue;
      const ref: TextbookRef = {
        chapterId:     row.chapterId,
        textbookTitle: row.textbookTitle,
        chapterNumber: row.chapterNumber,
        chapterTitle:  row.chapterTitle,
        pageStart:     row.pageStart,
        pageEnd:       row.pageEnd,
        url:           row.url,
      };
      const existing = refMap.get(topicName);
      if (existing) {
        if (existing.length < 3 && !existing.some(r => r.chapterId === ref.chapterId)) {
          existing.push(ref);
        }
      } else {
        refMap.set(topicName, [ref]);
      }
    }
  } catch (_) {
    // Catalog not yet populated — silently skip; return whatever we have cached
    if (_textbookRefCache !== null) return _textbookRefCache;
    return refMap;
  }

  _textbookRefCache = refMap;
  _textbookRefCacheExpiresAt = now + TEXTBOOK_REF_CACHE_TTL_MS;
  return refMap;
}

export { deriveChapterUrl } from './textbook-url-utils.js';

export function normalizeTopicName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

export function findTextbookRefs(topicName: string, refs: Map<string, TextbookRef[]>): TextbookRef[] {
  const lower      = topicName.toLowerCase().trim();
  const normalized = normalizeTopicName(topicName);
  const entries    = Array.from(refs.entries());

  const exact = entries.find(([key]) => normalizeTopicName(key) === normalized);
  if (exact) return exact[1];

  const substrMatches = entries
    .filter(([key]) => key.length >= 4 && lower.includes(key))
    .sort((a, b) => b[0].length - a[0].length);
  return substrMatches.length > 0 ? substrMatches[0][1] : [];
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number, addContinuationHeader = false): void {
  if (doc.y + needed > 750) {
    doc.addPage();
    if (addContinuationHeader) {
      doc.rect(0, 0, 612, 30).fill(COLORS.primary);
      doc.y = 40;
    }
  }
}

export async function generateFocusedStudyGuidePDF(reportId: string): Promise<Buffer> {
  const report = await db.query.assessmentReports.findFirst({
    where: eq(assessmentReports.id, reportId),
    with: { user: true },
  });

  if (!report) throw new Error('Report not found');

  const rawText    = report.extractedText ?? '';
  const parsedData = parseATIReport(rawText);
  const allTopics  = parsedData.topics;

  const { specialty, clusters, allAltTopics } = selectFocusedClusters(allTopics);
  const subjectReports = buildSubjectReports(allTopics);

  const overallScore  = report.overallScore != null ? parseFloat(report.overallScore) : null;
  const textbookRefs  = await lookupTextbookReferences();

  const studentName: string =
    report.studentName ??
    (report.user as typeof users.$inferSelect | null)?.username ??
    'Student';
  const assessmentName: string = report.assessmentName ?? report.fileName ?? 'ATI Assessment';
  const testDate: string =
    report.testDate ??
    (report.uploadDate != null ? new Date(report.uploadDate).toLocaleDateString() : '');

  const PAGE_W = 512;
  const LEFT   = 50;
  const RIGHT  = 562;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 45, bottom: 45, left: LEFT, right: 612 - RIGHT },
      info: {
        Title:        'NursePrep Study Guide',
        Author:       'NursePrep Analytics',
        Subject:      'NCLEX Study Report',
        CreationDate: new Date(),
      },
    });

    const chunks: Buffer[] = [];
    const stream = new PassThrough();
    doc.pipe(stream);
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    function hRule(y?: number): void {
      const lineY = y ?? doc.y;
      doc.moveTo(LEFT, lineY).lineTo(RIGHT, lineY).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    }

    // ── NGN Bowtie: 3-column CJM layout ─────────────────────────────────────
    // Columns: [RECOGNIZE & ANALYZE] ▶ [PRIORITIZE & ACT] ◀ [EVALUATE OUTCOMES]
    // Widths:        150 px                  184 px               150 px (+ 2×14 arrow zones = 512)
    // Each topic row includes a "Read: Ch.N — Title" sub-line when a chapter
    // mapping exists, giving per-topic inline references (0–3 per topic).
    function drawBowtie(
      leftTopics:   ATITopic[],
      centerTopics: ATITopic[],
      rightTopics:  ATITopic[],
    ): void {
      const AW    = 14;                         // arrow zone width
      const CW0   = 150;                        // left col width
      const CW1   = PAGE_W - CW0 * 2 - AW * 2; // center col width (= 184)
      const CW2   = 150;                        // right col width
      const CX0   = LEFT;
      const CX1   = LEFT + CW0 + AW;
      const CX2   = CX1 + CW1 + AW;

      const HDR_H   = 18;
      const ROW_H   = 14;  // topic bullet line + score badge line
      const REF_H   = 8;   // per-ref sub-line height
      const PAD_BOT = 6;

      // Sort each column lowest-score-first (matches the web study guide order)
      const sortedLeft   = [...leftTopics].sort((a, b) => (a.groupScore ?? Infinity) - (b.groupScore ?? Infinity));
      const sortedCenter = [...centerTopics].sort((a, b) => (a.groupScore ?? Infinity) - (b.groupScore ?? Infinity));
      const sortedRight  = [...rightTopics].sort((a, b) => (a.groupScore ?? Infinity) - (b.groupScore ?? Infinity));

      // Calculate variable column heights: each topic takes ROW_H + refs * REF_H
      function topicBlockH(t: ATITopic, colW: number): number {
        const refs = findTextbookRefs(t.name, textbookRefs).slice(0, colW > 160 ? 3 : 1);
        return ROW_H + refs.length * REF_H;
      }
      function colContentH(topics: ATITopic[], colW: number): number {
        if (topics.length === 0) return ROW_H;
        return topics.reduce((sum, t) => sum + topicBlockH(t, colW), 0);
      }

      const maxContentH = Math.max(
        colContentH(sortedLeft,   CW0),
        colContentH(sortedCenter, CW1),
        colContentH(sortedRight,  CW2),
      );
      const btH = HDR_H + maxContentH + PAD_BOT;

      ensureSpace(doc, btH + 8);
      const Y0 = doc.y;

      const COLS = [
        { x: CX0, w: CW0, topics: sortedLeft,   label: 'RECOGNIZE & ANALYZE', bg: '#eff6ff', hdr: '#1d4ed8' },
        { x: CX1, w: CW1, topics: sortedCenter, label: 'PRIORITIZE & ACT',     bg: '#f0fdf4', hdr: '#047857' },
        { x: CX2, w: CW2, topics: sortedRight,  label: 'EVALUATE OUTCOMES',    bg: '#fff7ed', hdr: '#b45309' },
      ];

      for (const col of COLS) {
        // Background & border
        doc.rect(col.x, Y0, col.w, btH).fill(col.bg);
        doc.lineWidth(0.4).rect(col.x, Y0, col.w, btH).stroke('#e2e8f0');
        // Header bar
        doc.rect(col.x, Y0, col.w, HDR_H).fill(col.hdr);
        doc.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold')
           .text(col.label, col.x + 3, Y0 + 5, { width: col.w - 6, align: 'center' });

        if (col.topics.length === 0) {
          doc.fillColor('#94a3b8').fontSize(7).font('Helvetica-Oblique')
             .text('\u2014', col.x + 4, Y0 + HDR_H + 4, { width: col.w - 8, align: 'center' });
        } else {
          // Variable-height topic rows: topic bullet + score badge + optional per-ref sub-lines
          const maxRefCount = col.w > 160 ? 3 : 1;
          const maxCh       = col.w > 160 ? 28 : 20;
          let curY = Y0 + HDR_H + 3;

          col.topics.forEach((t) => {
            const score  = t.groupScore;
            const sColor = score == null ? '#64748b' : score < 70 ? '#dc2626' : score < 80 ? '#b45309' : '#059669';

            // Topic bullet (full width)
            doc.fillColor(COLORS.dark).fontSize(7).font('Helvetica')
               .text('\u2022 ' + truncate(t.name, maxCh), col.x + 4, curY, { width: col.w - 8 });
            curY += 8;

            // Score badge on its own line — color-coded: red <70%, amber 70–79%, green ≥80%
            doc.fillColor(sColor).fontSize(6.5).font('Helvetica-Bold')
               .text(score != null ? score.toFixed(0) + '% score' : '–', col.x + 8, curY, { width: col.w - 12 });
            curY += 6;


            // Per-topic ref sub-lines (up to maxRefCount per column width)
            const refs = findTextbookRefs(t.name, textbookRefs).slice(0, maxRefCount);
            for (const ref of refs) {
              const pages = (ref.pageStart != null && ref.pageEnd != null)
                ? ` (pp.\u00a0${ref.pageStart}\u2013${ref.pageEnd})`
                : '';
              const bookW  = col.w > 160 ? 20 : 11;
              const chapW  = col.w > 160 ? 18 : 13;
              const refLabel =
                `${truncate(ref.textbookTitle, bookW)} Ch.\u00a0${ref.chapterNumber} \u2014 ${truncate(ref.chapterTitle, chapW)}${pages}`;
              const resolvedUrl = ref.url ?? deriveChapterUrl(ref.textbookTitle, ref.chapterNumber);
              const textOpts: PDFKit.Mixins.TextOptions = { width: col.w - 10 };
              if (resolvedUrl) {
                textOpts.link = resolvedUrl;
                textOpts.underline = true;
              }
              doc.fillColor(COLORS.success).fontSize(5.5).font('Helvetica-Oblique')
                 .text('  Read: ' + refLabel, col.x + 6, curY, textOpts);
              curY += REF_H;
            }
          });
        }
      }

      // Inward-pointing arrows (bowtie shape: left ▶ center ◀ right)
      const arrowMidY = Y0 + HDR_H + (btH - HDR_H) / 2 - 5;
      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
         .text('\u25b6', CX0 + CW0 + 1, arrowMidY, { width: AW - 2, align: 'center' });
      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
         .text('\u25c4', CX1 + CW1 + 1, arrowMidY, { width: AW - 2, align: 'center' });

      doc.y = Y0 + btH + 6;
    }

    // ── HEADER ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, 612, 70).fill(COLORS.primary);
    doc.fillColor(COLORS.white)
       .fontSize(20).font('Helvetica-Bold')
       .text('NCLEX Study Guide', LEFT, 18, { width: PAGE_W, align: 'center' });
    doc.fontSize(10).font('Helvetica')
       .text('NursePrep Analytics \u2014 Focused Study Report', LEFT, 42, { width: PAGE_W, align: 'center' });

    doc.y = 85;

    // ── META ROW ─────────────────────────────────────────────────────────────
    doc.fillColor(COLORS.dark).fontSize(9).font('Helvetica')
       .text(
         `Assessment: ${assessmentName}   |   Date: ${testDate}   |   Student: ${studentName}`,
         LEFT, doc.y, { width: PAGE_W },
       );
    doc.moveDown(0.6);
    hRule();
    doc.moveDown(0.6);

    // ════════════════════════════════════════════════════════════
    // SECTION 1 — SCORE SUMMARY
    // ════════════════════════════════════════════════════════════
    doc.fillColor(COLORS.primary).fontSize(13).font('Helvetica-Bold')
       .text('SCORE SUMMARY', LEFT, doc.y);
    doc.moveDown(0.4);

    const tableTop = doc.y;
    const colW     = [180, 100, 140, 92];
    const cols     = [
      LEFT,
      LEFT + colW[0],
      LEFT + colW[0] + colW[1],
      LEFT + colW[0] + colW[1] + colW[2],
    ];
    const rowH = 22;

    doc.rect(LEFT, tableTop, PAGE_W, rowH).fill(COLORS.secondary);
    doc.fillColor(COLORS.white).fontSize(9).font('Helvetica-Bold');
    ['Metric', 'Value', 'Metric', 'Value'].forEach((h, i) => {
      doc.text(h, cols[i] + 4, tableTop + 6, { width: colW[i] - 8 });
    });

    const scoreStr     = overallScore != null ? `${overallScore.toFixed(1)}%` : 'N/A';
    const clusterCount = clusters.length;
    const focusCount   = clusters.reduce((n, c) => n + c.topics.length, 0);

    const summaryRows: [string, string, string, string][] = [
      ['Overall Score',    scoreStr,                     'Focus Specialty', truncate(specialty, 22)],
      ['Study Clusters',   String(clusterCount),         'Focused Topics',  String(focusCount)],
      ['Total ALT Items',  String(allAltTopics.length),  'Approach',        'Clinical Judgment Model'],
    ];

    summaryRows.forEach((row, ri) => {
      const rowY    = tableTop + rowH + ri * rowH;
      const bgColor = ri % 2 === 0 ? COLORS.white : COLORS.altBg;
      doc.rect(LEFT, rowY, PAGE_W, rowH).fill(bgColor);
      doc.fillColor(COLORS.dark).fontSize(9);
      row.forEach((cell, ci) => {
        const isBold = ci % 2 === 0;
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
           .fillColor(isBold ? COLORS.secondary : COLORS.dark)
           .text(cell, cols[ci] + 4, rowY + 6, { width: colW[ci] - 8 });
      });
    });

    doc.rect(LEFT, tableTop, PAGE_W, rowH + summaryRows.length * rowH).stroke(COLORS.border);
    doc.y = tableTop + rowH + summaryRows.length * rowH + 14;

    // ── SCORE COLOR LEGEND ───────────────────────────────────────
    {
      const legendY  = doc.y;
      const swSize   = 8;   // color swatch width & height
      const swGap    = 4;   // gap between swatch and text
      const itemGap  = 16;  // gap between legend items
      const items: { color: string; label: string }[] = [
        { color: '#dc2626', label: 'Below 70% — Needs Focus' },
        { color: '#b45309', label: '70–79% — Approaching' },
        { color: '#059669', label: '80%+ — Proficient' },
      ];

      doc.fillColor(COLORS.muted).fontSize(7).font('Helvetica-Bold')
         .text('SCORE KEY:', LEFT, legendY + 1);

      const keyLabelW = doc.widthOfString('SCORE KEY:') + 6;
      let lx = LEFT + keyLabelW;

      for (const item of items) {
        doc.rect(lx, legendY, swSize, swSize).fill(item.color);
        lx += swSize + swGap;
        doc.fillColor(COLORS.dark).fontSize(7).font('Helvetica')
           .text(item.label, lx, legendY + 1, { lineBreak: false });
        lx += doc.widthOfString(item.label) + itemGap;
      }

      doc.y = legendY + swSize + 8;
    }

    // ════════════════════════════════════════════════════════════
    // SECTION 2 — REPORT 1: Primary Subject, Topics Worst-First
    // ════════════════════════════════════════════════════════════
    hRule();
    doc.moveDown(0.6);

    const primarySubject = subjectReports[0];
    const s2Label = primarySubject?.displaySubject ?? specialty;

    // Subject banner
    const s2BannerY = doc.y;
    doc.rect(LEFT, s2BannerY, PAGE_W, 26).fill(COLORS.primary);
    doc.fillColor(COLORS.white).fontSize(11).font('Helvetica-Bold')
       .text(`\u25b6  ${s2Label.toUpperCase()}`, LEFT + 8, s2BannerY + 7, { width: PAGE_W - 100 });
    doc.fillColor(COLORS.light).fontSize(7.5).font('Helvetica')
       .text('REPORT 1 \u2014 MOST MISSED', RIGHT - 100, s2BannerY + 9, { width: 94, align: 'right' });
    doc.y = s2BannerY + 30;

    if (primarySubject) {
      doc.fillColor(COLORS.muted).fontSize(7.5).font('Helvetica')
         .text(
           `${primarySubject.avgGap}% avg gap \u2022 ${primarySubject.topicCount} topics \u2014 grouped by Body System \u25b6 Disorder \u25b6 NGN Phase.`,
           LEFT, doc.y, { width: PAGE_W },
         );
      doc.moveDown(0.5);

      // CJM phase short labels for inline display
      const cjmShortLabel = (phase: string): string => {
        if (phase === 'Recognize Cues')                    return 'Assessment';
        if (phase === 'Analyze Cues')                      return 'Pathophysiology';
        if (phase === 'Prioritize Hypotheses')             return 'Nursing Dx';
        if (phase === 'Generate Solutions & Take Action')  return 'Interventions';
        if (phase === 'Evaluate Outcomes')                 return 'Evaluation';
        return phase;
      };

      // Build body-system groups in first-appearance order, "Other" last
      const psClusters: SubjectCluster[] = primarySubject.clusters ?? [];
      const bsOrder: string[] = [];
      const bsSeen = new Set<string>();
      for (const cl of psClusters) {
        const bs = cl.bodySystem ?? 'Other';
        if (!bsSeen.has(bs)) { bsOrder.push(bs); bsSeen.add(bs); }
      }
      if (bsSeen.has('Other') && bsOrder[bsOrder.length - 1] !== 'Other') {
        bsOrder.splice(bsOrder.indexOf('Other'), 1);
        bsOrder.push('Other');
      }

      for (const bs of bsOrder) {
        // Body-system header row
        ensureSpace(doc, 40, true);
        const bsY = doc.y;
        doc.rect(LEFT, bsY, PAGE_W, 18).fill(COLORS.secondary);
        doc.fillColor(COLORS.white).fontSize(8.5).font('Helvetica-Bold')
           .text(bs.toUpperCase(), LEFT + 8, bsY + 4, { width: PAGE_W - 16 });
        doc.y = bsY + 22;

        for (const cl of psClusters) {
          if ((cl.bodySystem ?? 'Other') !== bs) continue;

          // Disorder sub-header
          ensureSpace(doc, 30, true);
          const clY = doc.y;
          doc.rect(LEFT + 8, clY, PAGE_W - 8, 15).fill(COLORS.light);
          doc.fillColor(COLORS.secondary).fontSize(7.5).font('Helvetica-Bold')
             .text(cl.name, LEFT + 14, clY + 3, { width: PAGE_W - 80 });
          const clScore = cl.avgScore;
          const clScoreColor = clScore < 70 ? '#dc2626' : clScore < 80 ? '#b45309' : '#059669';
          doc.fillColor(clScoreColor).fontSize(7).font('Helvetica-Bold')
             .text(`avg ${clScore.toFixed(0)}%`, RIGHT - 48, clY + 4, { width: 42, align: 'right' });
          doc.y = clY + 18;

          for (const group of cl.cjmGroups) {
            // CJM phase label row
            ensureSpace(doc, 14, true);
            const phY = doc.y;
            doc.fillColor(COLORS.cjm).fontSize(7).font('Helvetica-Bold')
               .text(`  [${cjmShortLabel(group.phase)}]`, LEFT + 8, phY, { width: PAGE_W - 60 });
            doc.y = phY + 11;

            for (const t of group.topics) {
              ensureSpace(doc, 22, true);
              const rowY = doc.y;
              const score = t.groupScore;
              const sColor = score == null ? '#64748b' : score < 70 ? '#dc2626' : score < 80 ? '#b45309' : '#059669';

              // Topic name
              doc.fillColor(COLORS.dark).fontSize(8).font('Helvetica')
                 .text('\u2022 ' + truncate(t.name, 56), LEFT + 12, rowY, { width: PAGE_W - 100 });
              doc.fillColor(sColor).fontSize(8).font('Helvetica-Bold')
                 .text(score != null ? score.toFixed(0) + '%' : '\u2013', RIGHT - 40, rowY, { width: 35, align: 'right' });

              // Textbook ref (one line if available)
              const refs = findTextbookRefs(t.name, textbookRefs).slice(0, 1);
              if (refs.length > 0) {
                const ref = refs[0];
                const pages = (ref.pageStart != null && ref.pageEnd != null)
                  ? ` (pp.\u00a0${ref.pageStart}\u2013${ref.pageEnd})` : '';
                const refText = '  Read: ' + truncate(ref.textbookTitle, 22) + ' Ch.\u00a0' + ref.chapterNumber + ' \u2014 ' + truncate(ref.chapterTitle, 20) + pages;
                const resolvedUrl = ref.url ?? deriveChapterUrl(ref.textbookTitle, ref.chapterNumber);
                const refOpts: PDFKit.Mixins.TextOptions = { width: PAGE_W - 60 };
                if (resolvedUrl) { refOpts.link = resolvedUrl; refOpts.underline = true; }
                doc.fillColor(COLORS.success).fontSize(6).font('Helvetica-Oblique')
                   .text(refText, LEFT + 12, rowY + 10, refOpts);
                doc.y = Math.max(doc.y, rowY + 19);
              } else {
                doc.y = Math.max(doc.y, rowY + 11);
              }
            } // end for topics
          } // end for cjmGroups
        } // end for clusters in body system
      } // end for body systems
    } // end if primarySubject

    // ════════════════════════════════════════════════════════════
    // SECTION 2b — ALSO REVIEW: Subjects 2 and 3
    // ════════════════════════════════════════════════════════════
    const alsoReview = subjectReports.slice(1, 3); // subjects ranked 2nd and 3rd
    if (alsoReview.length > 0) {
      ensureSpace(doc, 60);
      hRule();
      doc.moveDown(0.6);
      doc.fillColor(COLORS.primary).fontSize(11).font('Helvetica-Bold')
         .text('ALSO REVIEW', LEFT, doc.y);
      doc.moveDown(0.25);
      doc.fillColor(COLORS.muted).fontSize(7.5).font('Helvetica')
         .text('Your next most-missed nursing subjects — study these after mastering Report 1.', LEFT, doc.y, { width: PAGE_W });
      doc.moveDown(0.5);

      for (const sr of alsoReview) {
        ensureSpace(doc, 50);
        const banY = doc.y;
        doc.rect(LEFT + 8, banY, PAGE_W - 8, 20).fill(COLORS.secondary);
        doc.fillColor(COLORS.white).fontSize(9).font('Helvetica-Bold')
           .text(`Report ${sr.reportNumber}: ${sr.displaySubject ?? sr.subject}`, LEFT + 16, banY + 5, { width: PAGE_W - 120 });
        const gapStr = `${sr.avgGap}% gap  \u2022  ${sr.topicCount} topic${sr.topicCount !== 1 ? 's' : ''}`;
        doc.fillColor(COLORS.light).fontSize(7.5).font('Helvetica')
           .text(gapStr, RIGHT - 150, banY + 6, { width: 144, align: 'right' });
        doc.y = banY + 24;

        // Top 2 missed topics for this subject (from full allTopics, already worst-first)
        const topTopics = (sr.allTopics ?? []).slice(0, 2);

        if (topTopics.length > 0) {
          for (const t of topTopics) {
            ensureSpace(doc, 16);
            const tY = doc.y;
            const score = t.groupScore;
            const sColor = score == null ? '#64748b' : score < 70 ? '#dc2626' : score < 80 ? '#b45309' : '#059669';
            doc.fillColor(COLORS.dark).fontSize(8).font('Helvetica')
               .text('\u2022 ' + truncate(t.name, 55), LEFT + 20, tY, { width: PAGE_W - 100 });
            doc.fillColor(sColor).fontSize(7.5).font('Helvetica-Bold')
               .text(score != null ? score.toFixed(0) + '%' : '\u2013', RIGHT - 45, tY, { width: 40, align: 'right' });
            doc.y = Math.max(doc.y, tY + 12);
          }
        } else {
          doc.fillColor(COLORS.muted).fontSize(7.5).font('Helvetica-Oblique')
             .text('No focused topics identified.', LEFT + 20, doc.y, { width: PAGE_W - 40 });
          doc.moveDown(0.3);
        }

        doc.moveDown(0.5);
      }
    }

    // ════════════════════════════════════════════════════════════
    // SECTION 3 — ALL TOPICS: SPECIALTY → SYSTEM → CJM BOWTIE
    // ════════════════════════════════════════════════════════════
    if (doc.y > 600) doc.addPage();

    hRule();
    doc.moveDown(0.6);
    doc.fillColor(COLORS.primary).fontSize(13).font('Helvetica-Bold')
       .text('FULL TOPIC REFERENCE', LEFT, doc.y);
    doc.moveDown(0.25);
    doc.fillColor(COLORS.muted).fontSize(7.5).font('Helvetica')
       .text(
         `All ${allAltTopics.length} ALT items \u2014 grouped by Specialty \u25b6 System/Diagnosis \u25b6 NGN Bowtie. ` +
         'Specialties and clusters ordered lowest average score first (biggest gaps at top).',
         LEFT, doc.y, { width: PAGE_W },
       );
    doc.moveDown(0.5);

    // Build 3-level hierarchy: Specialty → Cluster → Bowtie
    const sp3Map = new Map<string, ATITopic[]>();
    for (const t of allAltTopics) {
      const sp = detectSubjectSpecialty(t);
      if (!sp3Map.has(sp)) sp3Map.set(sp, []);
      sp3Map.get(sp)!.push(t);
    }

    const sp3Groups = Array.from(sp3Map.entries())
      .map(([sp, tps]) => ({
        sp,
        tps,
        avg: (() => { const sc = tps.filter(t => t.groupScore != null); return sc.length ? sc.reduce((s, t) => s + (t.groupScore as number), 0) / sc.length : 0; })(),
      }))
      .sort((a, b) => a.avg - b.avg);

    for (const { sp, tps, avg: spAvg } of sp3Groups) {
      ensureSpace(doc, 100);

      // ── Level 1: Specialty header ──────────────────────────────
      const sp3Y = doc.y;
      doc.rect(LEFT, sp3Y, PAGE_W, 22).fill(COLORS.primary);
      doc.fillColor(COLORS.white).fontSize(10).font('Helvetica-Bold')
         .text(`\u25b6  ${sp.toUpperCase()}`, LEFT + 8, sp3Y + 5, { width: PAGE_W - 120 });
      const spScoreColor = spAvg < 70 ? '#fca5a5' : spAvg < 80 ? '#fcd34d' : '#6ee7b7';
      doc.fillColor(spScoreColor).fontSize(8).font('Helvetica-Bold')
         .text(`avg ${spAvg.toFixed(0)}%  \u2022  ${tps.length} topic${tps.length !== 1 ? 's' : ''}`,
           RIGHT - 110, sp3Y + 7, { width: 104, align: 'right' });
      doc.y = sp3Y + 26;

      // ── Level 2: System/Diagnosis clusters ────────────────────
      const cl3Map = new Map<string, ATITopic[]>();
      for (const t of tps) {
        const key = clusterKey(t);
        if (!cl3Map.has(key)) cl3Map.set(key, []);
        cl3Map.get(key)!.push(t);
      }

      const cl3List = Array.from(cl3Map.entries())
        .map(([key, ctps]) => ({
          key,
          ctps,
          avg: (() => { const sc = ctps.filter(t => t.groupScore != null); return sc.length ? sc.reduce((s, t) => s + (t.groupScore as number), 0) / sc.length : 0; })(),
        }))
        .sort((a, b) => a.avg - b.avg);

      for (const { key, ctps, avg: cAvg } of cl3List) {
        ensureSpace(doc, 80);

        // Level 2 header (indented)
        const cl3Y = doc.y;
        doc.rect(LEFT + 10, cl3Y, PAGE_W - 10, 18).fill(COLORS.secondary);
        doc.fillColor(COLORS.white).fontSize(8.5).font('Helvetica-Bold')
           .text(clusterDisplayName(key, ctps), LEFT + 18, cl3Y + 4, { width: PAGE_W - 130 });
        const clScoreColor = cAvg < 70 ? '#fca5a5' : cAvg < 80 ? '#fcd34d' : '#6ee7b7';
        doc.fillColor(clScoreColor).fontSize(7.5).font('Helvetica-Bold')
           .text(`avg ${cAvg.toFixed(0)}%  \u2022  ${ctps.length} topic${ctps.length !== 1 ? 's' : ''}  \u2022  SYSTEM/DIAGNOSIS`,
             RIGHT - 170, cl3Y + 5, { width: 164, align: 'right' });
        doc.y = cl3Y + 22;

        // Level 3: Bowtie
        const btL = ctps.filter(t => { const p = mapToCJMPhase(t); return p === 'Recognize Cues' || p === 'Analyze Cues'; });
        const btC = ctps.filter(t => { const p = mapToCJMPhase(t); return p === 'Prioritize Hypotheses' || p === 'Generate Solutions & Take Action'; });
        const btR = ctps.filter(t => mapToCJMPhase(t) === 'Evaluate Outcomes');

        drawBowtie(btL, btC, btR);
        doc.moveDown(0.3);
      }

      doc.moveDown(0.4);
    }

    // Footer
    doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
       .text(
         `\u00A9 NursePrep Analytics  \u00B7  Generated ${new Date().toLocaleDateString()}`,
         LEFT, 750,
         { width: PAGE_W, align: 'center' },
       );

    doc.end();
  });
}
