"""In-memory async generation jobs."""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from engine.errors import GeometryError, friendly_from_exception
from engine.generate import generate_parts, params_from_request, project_slug, write_zip_bytes

JOB_DIR = Path("/tmp/lighttype-jobs")
JOB_DIR.mkdir(parents=True, exist_ok=True)

STAGES = [
    ("queued", "Queued"),
    ("building_geometry", "Building geometry"),
    ("creating_hollow", "Creating hollow bodies"),
    ("creating_fronts", "Creating removable fronts"),
    ("adding_plugs", "Adding mounting plugs"),
    ("validating", "Validating STL"),
    ("completed", "Completed"),
]


@dataclass
class Job:
    id: str
    status: str = "queued"
    stage: str = "queued"
    stage_label: str = "Queued"
    progress: int = 0
    error: dict | None = None
    result: dict | None = None
    zip_path: Path | None = None
    created_at: float = field(default_factory=time.time)
    request: dict = field(default_factory=dict)


_jobs: dict[str, Job] = {}
_lock = threading.Lock()


def create_job(payload: dict) -> Job:
    job = Job(id=uuid.uuid4().hex[:16], request=payload)
    with _lock:
        _jobs[job.id] = job
    return job


def get_job(job_id: str) -> Job | None:
    with _lock:
        return _jobs.get(job_id)


def _update(job: Job, **kwargs):
    with _lock:
        for k, v in kwargs.items():
            setattr(job, k, v)


def run_job(job_id: str):
    job = get_job(job_id)
    if job is None:
        return
    _update(job, status="generating", stage="building_geometry", stage_label="Building geometry", progress=8)

    def on_stage(stage: str, label: str, progress: int):
        _update(job, status="generating", stage=stage, stage_label=label, progress=progress)

    try:
        payload = job.request
        params = params_from_request(payload)
        text = payload["text"]
        font_id = payload["font_id"]
        parts = generate_parts(text, font_id, params, on_stage=on_stage)
        zip_bytes = write_zip_bytes(text, font_id, params, parts)
        zip_name = f"{project_slug(text)}.zip"
        zip_path = JOB_DIR / f"{job.id}-{zip_name}"
        zip_path.write_bytes(zip_bytes)
        _update(
            job,
            status="completed",
            stage="completed",
            stage_label="Completed",
            progress=100,
            zip_path=zip_path,
            result={
                "text": text,
                "letter_count": len(parts),
                "part_count": len(parts) * 2,
                "zip_name": zip_name,
                "files": [p["body_name"] for p in parts] + [p["front_name"] for p in parts] + ["README.txt"],
            },
        )
    except GeometryError as exc:
        _update(job, status="failed", stage="failed", stage_label="Couldn't generate", progress=0, error=exc.to_dict())
    except Exception as exc:
        friendly = friendly_from_exception(exc)
        _update(job, status="failed", stage="failed", stage_label="Couldn't generate", progress=0, error=friendly.to_dict())
