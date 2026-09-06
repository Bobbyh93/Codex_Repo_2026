"""Contract-driven lesson build and curriculum knowledge model pipeline."""
from __future__ import annotations

import json
from datetime import datetime
from uuid import uuid4

from .cpi_engine import log_cpi_event
from .curriculum_master import update_curriculum_master
from .db import init_db
from .duplicates import check_duplicate, normalize_duplicate_policy, record_duplicate_action, register_run
from .job_store import log_event, save_job
from .registry import REGISTRY
from .schemas import BUILD_SCHEMA, DEPLOYMENT_SCHEMA, TAXONOMY_SCHEMA, VALIDATION_SCHEMA


def utc_now() -> str:
    return datetime.utcnow().isoformat()


def _validate_contract(data: dict, required: list[str], phase: str) -> list[str]:
    return [f"{phase}_missing_{field}" for field in required if field not in data]


def _halt(state: dict, error: str) -> dict:
    state["status"] = "failed"
    state["error"] = error
    state["updated_at"] = utc_now()
    save_job(state["job_id"], state)
    log_event(state["job_id"], state.get("phase", "pipeline"), f"HALT: {error}")
    return state


def run_pipeline(input_data: dict, job_id: str | None = None, live_import: bool = False) -> dict:
    init_db()
    job_id = job_id or uuid4().hex
    state = {"job_id": job_id, "status": "running", "phase": "start", "created_at": utc_now(), "input": input_data}
    save_job(job_id, state)
    try:
        state["phase"] = "taxonomy"
        taxonomy_result = REGISTRY["taxonomy"](input_data)
        state["taxonomy"] = taxonomy_result
        if not taxonomy_result.get("pass"):
            return _halt(state, ";".join(taxonomy_result.get("errors", ["taxonomy_failed"])))
        errors = _validate_contract(taxonomy_result["data"], TAXONOMY_SCHEMA, "taxonomy")
        if errors:
            return _halt(state, ";".join(errors))
        duplicate_policy = normalize_duplicate_policy(input_data.get("duplicate_policy") or input_data.get("duplicate_action") or taxonomy_result["data"].get("duplicate_policy"))
        state["input"]["duplicate_policy"] = duplicate_policy
        duplicate_check = check_duplicate(taxonomy_result["data"])
        duplicate_check["policy"] = duplicate_policy
        state["duplicate_check"] = duplicate_check
        state["duplicate_mode"] = "build"
        if duplicate_check.get("is_duplicate"):
            matched_job_id = (duplicate_check.get("matched") or {}).get("job_id")
            record_duplicate_action(duplicate_check["fingerprint"], job_id, duplicate_policy, matched_job_id)
            if duplicate_policy == "skip":
                state["duplicate_mode"] = "skip_exact"
                state["status"] = "skipped_duplicate"
                state["phase"] = "duplicate"
                state["updated_at"] = utc_now()
                save_job(job_id, state)
                return state
            if duplicate_policy == "contribute_to_existing":
                state["duplicate_mode"] = "contribute_to_existing"
            else:
                state["duplicate_mode"] = "create_new_version"
        log_event(job_id, "taxonomy", f"taxonomy status={taxonomy_result.get('status')} duplicate_mode={state['duplicate_mode']}")
        save_job(job_id, state)

        state["phase"] = "build"
        build = REGISTRY["build"](taxonomy_result, job_id, source_context=input_data.get("source_package") or {"sections": input_data.get("source_sections", [])})
        state["build"] = build
        if build.get("status") != "pass":
            return _halt(state, "build_failed")
        errors = _validate_contract(build, BUILD_SCHEMA, "build")
        if errors:
            return _halt(state, ";".join(errors))
        log_event(job_id, "build", f"build status={build.get('status')}")
        save_job(job_id, state)

        state["phase"] = "ckm_export"
        deployment = REGISTRY["deployment"](job_id, state)
        state["deployment"] = deployment
        errors = _validate_contract(deployment, DEPLOYMENT_SCHEMA, "deployment")
        if errors:
            return _halt(state, ";".join(errors))
        log_event(job_id, "ckm_export", f"deployment status={deployment.get('status')}")
        save_job(job_id, state)

        state["phase"] = "validation"
        batch_dir = deployment["batch_dir"]
        validation = REGISTRY["validation"](batch_dir)
        state["validation"] = validation
        for err in validation.get("errors", []):
            concept = taxonomy_result["data"].get("concept", "unknown")
            issue = str(err).split(":")[0]
            log_cpi_event(concept, issue, 3, "ckm_validation", str(err))
        if validation.get("status") == "fail":
            log_event(job_id, "validation", "validation failed; remediation started")
            remediation = REGISTRY["remediation"](batch_dir)
            state["remediation"] = remediation
            batch_dir = remediation["fixed_dir"]
            validation = REGISTRY["validation"](batch_dir)
            state["validation_after_remediation"] = validation
            if validation.get("status") == "fail":
                return _halt(state, "remediation_failed:" + json.dumps(validation.get("errors", [])))
        errors = _validate_contract(validation, VALIDATION_SCHEMA, "validation")
        if errors:
            return _halt(state, ";".join(errors))
        save_job(job_id, state)

        state["phase"] = "dry_run"
        dry = REGISTRY["dry_run"](batch_dir)
        state["dry_run"] = dry
        if dry.get("status") != "pass":
            return _halt(state, "dry_run_blocked")
        if live_import:
            state["phase"] = "live_import"
            imported = REGISTRY["live_import"](batch_dir)
            state["live_import"] = imported
            if imported.get("status") != "pass":
                return _halt(state, "live_import_failed")

        state["phase"] = "curriculum_master"
        state["curriculum_master"] = update_curriculum_master(state)
        register_run(taxonomy_result["data"], job_id, build.get("output_dir", ""), batch_dir, state["created_at"])
        save_job(job_id, state)

        state["phase"] = "cpi"
        state["cpi"] = REGISTRY["cpi"]()
        state["status"] = "complete"
        state["updated_at"] = utc_now()
        log_event(job_id, "complete", "pipeline complete")
        save_job(job_id, state)
        return state
    except Exception as exc:
        return _halt(state, f"exception:{type(exc).__name__}:{exc}")
