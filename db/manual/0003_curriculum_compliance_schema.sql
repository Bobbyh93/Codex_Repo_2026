-- 0003_curriculum_compliance_schema.sql
-- California prelicensure nursing curriculum compliance layer.
--
-- Scope: requirement registry (BVNPT / BRN / NCLEX / concept taxonomy),
--        concept-to-topic crosswalk, delivery blocks, board form catalogue,
--        and a computed coverage view.
--
-- Design notes:
--  * Self-contained. The existing curriculum_* tables are NOT referenced by FK:
--    the application role has neither DDL nor write grant on them.
--  * Hours live in program_requirements.quantity, NOT curriculum_nodes.blueprint_weight,
--    which is CHECK-constrained 0-100 (it is a blueprint percentage, not an hour count).
--  * comparator is explicit so a floor (54 pharmacology hours) is never read as a
--    ceiling (40 hours per week) or an exact figure (576 theory hours).
--  * Coverage is a VIEW, never a table, so a gap report cannot drift from the
--    blocks it summarises.
--
-- Applied to Neon project nameless-bird-19392416 / database nursestudy on 2026-10-15.
-- Reference data (7 frameworks, 147 requirement atoms, 156 form fields, 42 options)
-- is seeded in that database; export separately with pg_dump --data-only.

BEGIN;

-- ---------------------------------------------------------------- frameworks
CREATE TABLE IF NOT EXISTS program_frameworks (
  id                   varchar PRIMARY KEY,
  title                text NOT NULL,
  version              text NOT NULL,
  audience             text NOT NULL,
  board                text,
  jurisdiction         text,
  authority            text,
  reporting_instrument text,
  grain                text CHECK (grain IS NULL OR grain IN ('week','course','term','program')),
  status               text NOT NULL DEFAULT 'published'
                         CHECK (status IN ('draft','proposed','published','deprecated')),
  source_uri           text,
  retrieved_on         date,
  metadata             jsonb DEFAULT '{}'::jsonb,
  created_at           timestamptz DEFAULT now()
);

-- -------------------------------------------------------------- requirements
CREATE TABLE IF NOT EXISTS program_requirements (
  id               varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id     varchar NOT NULL REFERENCES program_frameworks(id) ON DELETE CASCADE,
  code             text NOT NULL UNIQUE,
  ordinal          integer,
  requirement_type text NOT NULL CHECK (requirement_type IN (
                     'hours','units','content_area','scheduling_constraint','structural',
                     'specialty_hours','reporting_field','blueprint_category',
                     'blueprint_subcategory','exam_structure','concept_domain','concept_module')),
  label            text NOT NULL,
  description      text,
  quantity         numeric,
  quantity_unit    text,
  comparator       text NOT NULL DEFAULT 'none' CHECK (comparator IN ('min','max','exact','none')),
  modality         text CHECK (modality IS NULL OR modality IN (
                     'theory','clinical','skills_lab','simulation','direct_patient_care','lab','any')),
  scope            text NOT NULL DEFAULT 'program' CHECK (scope IN (
                     'program','content_area','specialty','week','day','shift','course')),
  parent_code      text,
  citation         text NOT NULL,
  source_uri       text,
  -- metadata.measures_content_area lets an hour requirement measure blocks tagged to a
  -- DIFFERENT content area. Required because the 54-hour pharmacology floor lives at
  -- BVNPT.2532.b.pharmacology while blocks are tagged BVNPT.2533.d9.
  metadata         jsonb DEFAULT '{}'::jsonb,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS program_requirements_fw_idx
  ON program_requirements (framework_id, requirement_type);

-- ---------------------------------------------- concept / topic crosswalks
CREATE TABLE IF NOT EXISTS requirement_topic_map (
  id                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_code    text NOT NULL REFERENCES program_requirements(code) ON DELETE CASCADE,
  nursing_topic_id    varchar,   -- no FK: no grant on nursing_topics
  curriculum_node_id  varchar,   -- no FK: no grant on curriculum_nodes
  nursing_subject     text,
  nursing_system      text,      -- advisory only; nursing_topics.system is unreliable
  relation            text NOT NULL DEFAULT 'covers'
                        CHECK (relation IN ('covers','partially_covers','prerequisite_for','assessed_by')),
  confidence          numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  verification_status text NOT NULL DEFAULT 'proposed'
                        CHECK (verification_status IN ('proposed','verified','rejected','superseded')),
  rationale           text,
  evidence            jsonb DEFAULT '{}'::jsonb,
  actor               text,
  created_at          timestamptz DEFAULT now(),
  CHECK (nursing_topic_id IS NOT NULL OR curriculum_node_id IS NOT NULL OR nursing_subject IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS requirement_topic_map_req_idx
  ON requirement_topic_map (requirement_code, verification_status);
CREATE INDEX IF NOT EXISTS requirement_topic_map_topic_idx
  ON requirement_topic_map (nursing_topic_id);

CREATE TABLE IF NOT EXISTS framework_crosswalk (
  id                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  from_code           text NOT NULL REFERENCES program_requirements(code) ON DELETE CASCADE,
  to_code             text NOT NULL REFERENCES program_requirements(code) ON DELETE CASCADE,
  relation            text NOT NULL CHECK (relation IN (
                        'satisfies','partially_satisfies','assessed_by','equivalent_to',
                        'narrower_than','broader_than','no_counterpart')),
  confidence          numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  verification_status text NOT NULL DEFAULT 'proposed'
                        CHECK (verification_status IN ('proposed','verified','rejected','superseded')),
  rationale           text,
  actor               text,
  created_at          timestamptz DEFAULT now(),
  CHECK (from_code <> to_code),
  UNIQUE (from_code, to_code, relation)
);
CREATE INDEX IF NOT EXISTS framework_crosswalk_from_idx ON framework_crosswalk (from_code);
CREATE INDEX IF NOT EXISTS framework_crosswalk_to_idx   ON framework_crosswalk (to_code);

-- ------------------------------------------------------------------ delivery
CREATE TABLE IF NOT EXISTS program_offerings (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id    varchar NOT NULL REFERENCES program_frameworks(id),
  institution     text NOT NULL,
  program_name    text NOT NULL,
  program_type    text NOT NULL CHECK (program_type IN ('VN','ADN','BSN','ELM','LVN-30-unit')),
  academic_system text CHECK (academic_system IS NULL OR academic_system IN ('semester','quarter','clock_hour')),
  weeks_per_term  integer,
  cohort_label    text,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','submitted','approved','active','retired')),
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT program_offerings_identity_uq UNIQUE (institution, program_name, program_type)
);

-- The atomic record. BVNPT 55M-2W is this table grouped by term + week;
-- BRN EDP-P-06 is the same rows grouped by course_number.
CREATE TABLE IF NOT EXISTS instructional_blocks (
  id                        varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id               varchar NOT NULL REFERENCES program_offerings(id) ON DELETE CASCADE,
  term_label                text,
  week_no                   integer,
  unit_title                text,
  course_number             text,
  course_title              text,
  content_area_code         text REFERENCES program_requirements(code),
  theory_hours              numeric NOT NULL DEFAULT 0 CHECK (theory_hours >= 0),
  skills_lab_hours          numeric NOT NULL DEFAULT 0 CHECK (skills_lab_hours >= 0),
  clinical_hours            numeric NOT NULL DEFAULT 0 CHECK (clinical_hours >= 0),
  simulation_hours          numeric NOT NULL DEFAULT 0 CHECK (simulation_hours >= 0),
  direct_patient_care_hours numeric NOT NULL DEFAULT 0 CHECK (direct_patient_care_hours >= 0),
  theory_objectives         jsonb DEFAULT '[]'::jsonb,
  clinical_objectives       jsonb DEFAULT '[]'::jsonb,
  content_outline           text,
  methods_of_instruction    jsonb DEFAULT '[]'::jsonb,
  assignments               text,
  lesson_package_id         varchar,
  nursing_topic_ids         jsonb DEFAULT '[]'::jsonb,
  evidence_refs             jsonb DEFAULT '[]'::jsonb,
  -- 16 CCR 2533(c) makes sequence a regulated property, so the reason is a field.
  sequence_rationale        text,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now(),
  CONSTRAINT instructional_blocks_week_uq UNIQUE (offering_id, term_label, week_no, content_area_code)
);
CREATE INDEX IF NOT EXISTS instructional_blocks_offering_idx
  ON instructional_blocks (offering_id, term_label, week_no);
CREATE INDEX IF NOT EXISTS instructional_blocks_area_idx ON instructional_blocks (content_area_code);
CREATE INDEX IF NOT EXISTS instructional_blocks_course_idx ON instructional_blocks (offering_id, course_number);

-- ------------------------------------------------------- gaps and evidence
CREATE TABLE IF NOT EXISTS requirement_content_gaps (
  id                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_code   text NOT NULL REFERENCES program_requirements(code) ON DELETE CASCADE,
  gap_type           text NOT NULL CHECK (gap_type IN (
                       'no_content','insufficient_content','unreliable_mapping',
                       'needs_semantic_classification','policy_blocked')),
  severity           text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  finding            text NOT NULL,
  evidence           jsonb DEFAULT '{}'::jsonb,
  recommended_action text,
  status             text NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open','in_progress','resolved','accepted_risk')),
  actor              text,
  created_at         timestamptz DEFAULT now()
);

-- ingestion_status is the licence gate: most nursing-education literature is
-- cite_only (no PMC id, not open access), so synthesis works from abstracts plus
-- original authoring, never full-text remixing.
CREATE TABLE IF NOT EXISTS evidence_citations (
  id                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_code    text REFERENCES program_requirements(code) ON DELETE SET NULL,
  pmid                text,
  pmcid               text,
  doi                 text,
  title               text NOT NULL,
  journal             text,
  authors             jsonb DEFAULT '[]'::jsonb,
  pub_year            integer,
  article_types       jsonb DEFAULT '[]'::jsonb,
  mesh_terms          jsonb DEFAULT '[]'::jsonb,
  abstract_available  boolean NOT NULL DEFAULT false,
  source_database     text NOT NULL DEFAULT 'PubMed' CHECK (source_database IN (
                        'PubMed','PubMed Central','ClinicalTrials.gov','CINAHL','other')),
  is_open_access      boolean NOT NULL DEFAULT false,
  license_type        text,
  copyright_holder    text,
  ingestion_status    text NOT NULL DEFAULT 'cite_only'
                        CHECK (ingestion_status IN ('ingestable','cite_only','blocked','pending_check')),
  ingestion_rationale text,
  evidence_role       text CHECK (evidence_role IS NULL OR evidence_role IN (
                        'foundational','supporting','contrasting','methodological','background')),
  retrieved_on        date DEFAULT current_date,
  actor               text,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (pmid, requirement_code)
);
CREATE INDEX IF NOT EXISTS evidence_citations_req_idx    ON evidence_citations (requirement_code);
CREATE INDEX IF NOT EXISTS evidence_citations_ingest_idx ON evidence_citations (ingestion_status);

-- definition_origin keeps a copied glossary definition from entering silently:
-- a term list is vocabulary, but definitions are copyrightable expression.
CREATE TABLE IF NOT EXISTS curriculum_glossary (
  id                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  term                text NOT NULL,
  slug                text NOT NULL UNIQUE,
  definition          text,
  definition_origin   text NOT NULL DEFAULT 'original'
                        CHECK (definition_origin IN ('original','paraphrased','pending','quoted_with_permission')),
  concept_module_code text REFERENCES program_requirements(code),
  nursing_subject     text,
  nursing_system      text,
  aliases             jsonb DEFAULT '[]'::jsonb,
  see_also            jsonb DEFAULT '[]'::jsonb,
  index_refs          jsonb DEFAULT '[]'::jsonb,
  term_source         text,
  licence_note        text,
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','reviewed','published','retired')),
  created_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS curriculum_glossary_module_idx ON curriculum_glossary (concept_module_code);

-- -------------------------------------------------------- board form catalogue
-- Every field and option of every board form, as data. The form application
-- renders from these rows and contains no hand-coded screens.
CREATE TABLE IF NOT EXISTS form_definitions (
  code         text PRIMARY KEY,
  title        text NOT NULL,
  board        text,
  framework_id varchar REFERENCES program_frameworks(id),
  version      text,
  purpose      text,
  source_uri   text,
  submitted_by text,
  repeat_unit  text,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS form_sections (
  code         text PRIMARY KEY,
  form_code    text NOT NULL REFERENCES form_definitions(code) ON DELETE CASCADE,
  ordinal      integer NOT NULL,
  title        text NOT NULL,          -- wording as printed on the official form
  plain_title  text,                   -- plain-language wording shown to the user
  instructions text,
  repeat_mode  text NOT NULL DEFAULT 'single'
                 CHECK (repeat_mode IN ('single','per_row','per_week','per_course')),
  citation     text
);
CREATE INDEX IF NOT EXISTS form_sections_form_idx ON form_sections (form_code, ordinal);

CREATE TABLE IF NOT EXISTS form_fields (
  code             text PRIMARY KEY,
  form_code        text NOT NULL REFERENCES form_definitions(code) ON DELETE CASCADE,
  section_code     text NOT NULL REFERENCES form_sections(code) ON DELETE CASCADE,
  ordinal          integer NOT NULL,
  label            text NOT NULL,      -- as printed on the official form
  plain_label      text,               -- the question the user actually sees
  help_text        text,               -- always visible, never hover-only
  input_type       text NOT NULL CHECK (input_type IN (
                     'text','textarea','number','date','radio','checkbox',
                     'select','signature','computed','heading')),
  unit             text,
  required         boolean NOT NULL DEFAULT false,
  requirement_code text REFERENCES program_requirements(code),
  fixed_value      numeric,            -- the regulatory minimum, shown inline
  validation       jsonb DEFAULT '{}'::jsonb,
  computed_from    jsonb DEFAULT '[]'::jsonb,
  row_group        text,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS form_fields_section_idx ON form_fields (section_code, ordinal);
CREATE INDEX IF NOT EXISTS form_fields_req_idx     ON form_fields (requirement_code);

CREATE TABLE IF NOT EXISTS form_field_options (
  id               varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  field_code       text NOT NULL REFERENCES form_fields(code) ON DELETE CASCADE,
  ordinal          integer NOT NULL,
  value            text NOT NULL,
  label            text NOT NULL,
  help_text        text,
  requirement_code text REFERENCES program_requirements(code),
  UNIQUE (field_code, value)
);
CREATE INDEX IF NOT EXISTS form_field_options_field_idx ON form_field_options (field_code, ordinal);

CREATE TABLE IF NOT EXISTS form_submissions (
  id               varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  form_code        text NOT NULL REFERENCES form_definitions(code),
  offering_id      varchar REFERENCES program_offerings(id) ON DELETE SET NULL,
  label            text,
  status           text NOT NULL DEFAULT 'in_progress'
                     CHECK (status IN ('in_progress','complete','submitted','superseded')),
  answers          jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_fields integer NOT NULL DEFAULT 0,
  total_fields     integer,
  validation       jsonb DEFAULT '[]'::jsonb,
  actor            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS form_submissions_form_idx ON form_submissions (form_code, status);

COMMIT;

-- --------------------------------------------------------------- coverage view
-- Aggregation is SCOPE-AWARE. Three bugs this shape exists to prevent:
--   1. Program-level hour totals joined on content_area_code and always read 0,
--      because a block carries exactly one content area.
--   2. A weekly cap (40 h, 2532(c)) summed across weeks reads exceeds_limit from
--      week two onward forever. Week-scoped requirements take MAX, not SUM.
--   3. The 54-hour pharmacology floor measures a different code than it carries;
--      metadata.measures_content_area redirects the join.
--
-- ASSUMPTION, NOT A QUOTED RULE: clinical = clinical + skills_lab + simulation.
-- 16 CCR 2532(b) requires 954 clinical hours without defining what counts. A real
-- submitted VN program (Cerro Coso) reported 1,068 total clinical as 188 skills lab
-- plus 880 clinical experience, supporting skills lab; simulation is unconfirmed and
-- some boards cap it. Until BVNPT confirms, read clinical coverage as an UPPER BOUND.
DROP VIEW IF EXISTS v_requirement_coverage;
CREATE VIEW v_requirement_coverage AS
WITH wk AS (
  SELECT offering_id, term_label, week_no,
    SUM(theory_hours) AS t, SUM(skills_lab_hours) AS s, SUM(simulation_hours) AS m,
    SUM(clinical_hours) AS c, SUM(direct_patient_care_hours) AS d,
    SUM(theory_hours+skills_lab_hours+simulation_hours+clinical_hours) AS tot
  FROM instructional_blocks GROUP BY offering_id, term_label, week_no
), prog AS (
  SELECT offering_id, SUM(t) AS t, SUM(s) AS s, SUM(m) AS m, SUM(c) AS c, SUM(d) AS d,
    SUM(tot) AS tot, MAX(tot) AS max_week, count(*) AS weeks
  FROM wk GROUP BY offering_id
), area AS (
  SELECT offering_id, content_area_code,
    SUM(theory_hours) AS t, SUM(skills_lab_hours) AS s, SUM(simulation_hours) AS m,
    SUM(clinical_hours) AS c, SUM(direct_patient_care_hours) AS d,
    SUM(theory_hours+skills_lab_hours+simulation_hours+clinical_hours) AS tot,
    count(*) AS blocks, count(lesson_package_id) AS with_pkg
  FROM instructional_blocks WHERE content_area_code IS NOT NULL
  GROUP BY offering_id, content_area_code
), base AS (
  SELECT o.id AS offering_id, o.institution, o.program_name, o.academic_system,
    r.framework_id, r.code AS requirement_code, r.label AS requirement_label,
    r.requirement_type, r.scope, r.comparator, r.quantity AS required_quantity,
    r.quantity_unit, r.modality, r.citation,
    COALESCE(r.metadata->>'measures_content_area', r.code) AS measured_area,
    COALESCE(p.weeks,0) AS weeks_recorded,
    CASE WHEN r.scope IN ('content_area','specialty','course') THEN COALESCE(a.blocks,0)
         ELSE COALESCE(p.weeks,0) END AS block_count,
    COALESCE(a.with_pkg,0) AS blocks_with_lesson_package,
    COALESCE(p.t,0) AS delivered_theory_hours,
    COALESCE(p.c,0)+COALESCE(p.s,0)+COALESCE(p.m,0) AS delivered_clinical_hours,
    COALESCE(p.d,0) AS delivered_dpc_hours,
    COALESCE(p.tot,0) AS delivered_total_hours,
    COALESCE(p.max_week,0) AS busiest_week_hours,
    CASE
      WHEN r.scope = 'program' THEN
        CASE r.modality
          WHEN 'theory' THEN COALESCE(p.t,0)
          WHEN 'clinical' THEN COALESCE(p.c,0)+COALESCE(p.s,0)+COALESCE(p.m,0)
          WHEN 'direct_patient_care' THEN COALESCE(p.d,0)
          ELSE COALESCE(p.tot,0) END
      WHEN r.scope = 'week' THEN COALESCE(p.max_week,0)
      WHEN r.scope IN ('content_area','specialty','course') THEN
        CASE r.modality
          WHEN 'theory' THEN COALESCE(a.t,0)
          WHEN 'clinical' THEN COALESCE(a.c,0)+COALESCE(a.s,0)+COALESCE(a.m,0)
          WHEN 'direct_patient_care' THEN COALESCE(a.d,0)
          ELSE COALESCE(a.tot,0) END
      ELSE NULL END AS delivered
  FROM program_requirements r
  JOIN program_frameworks rf ON rf.id = r.framework_id
  JOIN program_offerings o ON o.framework_id = r.framework_id
     OR o.framework_id IN (SELECT id FROM program_frameworks WHERE board = rf.board)
  LEFT JOIN prog p ON p.offering_id = o.id
  LEFT JOIN area a ON a.offering_id = o.id
                  AND a.content_area_code = COALESCE(r.metadata->>'measures_content_area', r.code)
  WHERE r.requirement_type IN ('hours','units','content_area','scheduling_constraint','specialty_hours')
)
SELECT base.*,
  CASE
    WHEN comparator = 'none' THEN 'not_quantified'
    WHEN scope IN ('day','shift') THEN 'not_evaluable'   -- weekly data cannot test a daily cap
    WHEN delivered IS NULL THEN 'not_evaluable'
    WHEN quantity_unit LIKE '%units%' THEN 'not_tracked_in_hours'
    WHEN weeks_recorded = 0 THEN 'no_coverage'
    WHEN comparator = 'min'   AND delivered >= required_quantity THEN 'met'
    WHEN comparator = 'max'   AND delivered <= required_quantity THEN 'met'
    WHEN comparator = 'exact' AND delivered =  required_quantity THEN 'met'
    WHEN comparator = 'max'   AND delivered >  required_quantity THEN 'exceeds_limit'
    WHEN comparator = 'exact' AND delivered >  required_quantity THEN 'exceeds_limit'
    ELSE 'gap' END AS coverage_status,
  CASE WHEN comparator IN ('min','exact') AND required_quantity > 0 AND delivered IS NOT NULL
       THEN round(100.0 * delivered / required_quantity, 1) ELSE NULL END AS pct_of_requirement
FROM base;
