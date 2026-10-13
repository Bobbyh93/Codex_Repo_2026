"""Plugin registry: keeps orchestration decoupled from implementation."""
from .taxonomy_gatekeeper import taxonomy_gatekeeper
from .ngn_builder import ngn_builder
from .ckm_exporter import generate_ckm_batch
from .ckm_validator_importer import validate_batch, dry_run_import, live_import
from .ckm_auto_remediator import remediate_batch
from .cpi_engine import run_cpi_trend_analysis

REGISTRY = {
    "taxonomy": taxonomy_gatekeeper,
    "build": ngn_builder,
    "deployment": generate_ckm_batch,
    "validation": validate_batch,
    "dry_run": dry_run_import,
    "live_import": live_import,
    "remediation": remediate_batch,
    "cpi": run_cpi_trend_analysis,
}
