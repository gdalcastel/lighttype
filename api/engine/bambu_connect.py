"""Bambu Connect URL-scheme handoff for local 3MF files.

See: https://wiki.bambulab.com/en/software/third-party-integration

bambu-connect://import-file?path=<abs>&name=<label>&version=1.0.0
"""

from __future__ import annotations

import os
import re
import shutil
from pathlib import Path
from typing import Any
from urllib.parse import quote

JOB_DIR = Path("/tmp/lighttype-jobs")
EXPORT_DIR = Path(
    os.environ.get("BAMBU_CONNECT_EXPORT_DIR", str(JOB_DIR / "bambu-connect"))
)
CONNECT_VERSION = "1.0.0"
DOCS_URL = "https://wiki.bambulab.com/en/software/third-party-integration"
# Official download page for Bambu Connect / Studio
INSTALL_URL = "https://wiki.bambulab.com/en/software/bambu-connect"


def _sanitize_filename(name: str) -> str:
    base = Path(name).name
    cleaned = re.sub(r"[^\w.\-]+", "_", base, flags=re.UNICODE).strip("._")
    return cleaned or "LightType.3mf"


def build_import_url(absolute_path: str, display_name: str) -> str:
    return (
        "bambu-connect://import-file"
        f"?path={quote(absolute_path, safe='')}"
        f"&name={quote(display_name, safe='')}"
        f"&version={CONNECT_VERSION}"
    )


def host_path_for(container_or_local: Path) -> str:
    """Map container export path to the path Bambu Connect sees on the host."""
    host_root = os.environ.get("BAMBU_CONNECT_HOST_PATH", "").strip()
    export_root = EXPORT_DIR.resolve()
    resolved = container_or_local.resolve()
    export_env = os.environ.get("BAMBU_CONNECT_EXPORT_DIR", "").strip()
    if not host_root and export_env == "/exports":
        raise ValueError(
            "Configure BAMBU_CONNECT_HOST_PATH com o caminho absoluto da pasta "
            "montada em /exports (ex.: .../lighttype/data/bambu-export)."
        )
    if host_root:
        try:
            rel = resolved.relative_to(export_root)
            return str(Path(host_root) / rel)
        except ValueError:
            return str(Path(host_root) / resolved.name)
    return str(resolved)


def capabilities() -> dict:
    host_configured = bool(os.environ.get("BAMBU_CONNECT_HOST_PATH", "").strip())
    return {
        "available": True,
        "scheme": "bambu-connect",
        "version": CONNECT_VERSION,
        "host_path_configured": host_configured,
        "export_dir": str(EXPORT_DIR),
        "docs_url": DOCS_URL,
        "install_url": INSTALL_URL,
    }


def stage_job_for_connect(job: Any) -> dict:
    if job.status != "completed" or not job.zip_path or not job.zip_path.exists():
        raise ValueError("Arquivo ainda não está pronto.")

    filename = (job.result or {}).get("zip_name") or job.zip_path.name
    if not str(filename).lower().endswith(".3mf"):
        raise ValueError("Bambu Connect exige um arquivo .3mf. Exporte em 3MF multi-bandeja.")

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = _sanitize_filename(str(filename))
    staged = EXPORT_DIR / f"{job.id}-{safe_name}"
    shutil.copy2(job.zip_path, staged)

    display = Path(safe_name).stem or "LightType"
    abs_host = host_path_for(staged)
    url = build_import_url(abs_host, display)

    return {
        "url": url,
        "path": abs_host,
        "name": display,
        "filename": staged.name,
        "docs_url": DOCS_URL,
        "install_url": INSTALL_URL,
    }
