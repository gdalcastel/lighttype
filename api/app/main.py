from __future__ import annotations

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from engine.catalog import FONT_CATEGORIES, MOUNTING_SYSTEMS, PRODUCT_TYPES, fonts_public, plug_profiles_public
from engine.errors import GeometryError
from engine.jobs import create_job, get_job, run_job
from engine.preview import build_preview

app = FastAPI(title="LightType API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_projects: dict[str, dict] = {}


class PreviewRequest(BaseModel):
    text: str = Field(min_length=1, max_length=48)
    font_id: str = "montserrat-bold"
    height_mm: float = Field(default=100, ge=20, le=400)
    wall_mm: float = Field(default=2, ge=0.8, le=8)
    spacing_mm: float = Field(default=8, ge=0, le=80)


class GenerateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=48)
    font_id: str = "montserrat-bold"
    height_mm: float = Field(default=100, ge=20, le=400)
    depth_mm: float = Field(default=25, ge=8, le=80)
    wall_mm: float = Field(default=2, ge=0.8, le=8)
    front_mm: float = Field(default=1.5, ge=0.6, le=6)
    spacing_mm: float = Field(default=8, ge=0, le=80)
    plug_profile: str = "profile-a"
    plug_position: str = "bottom-center"
    front_mount: str = "snap-fit"
    front_tolerance_mm: float = Field(default=0.25, ge=0.05, le=1.2)
    snap_fit_tolerance_mm: float = Field(default=0.25, ge=0.05, le=1.2)
    snap_fit_depth_mm: float = Field(default=1.2, ge=0.3, le=4)
    plug_diameter_mm: float | None = Field(default=None, ge=2, le=30)
    plug_length_mm: float | None = Field(default=None, ge=2, le=40)
    plug_neck_diameter_mm: float | None = Field(default=None, ge=1, le=28)
    plug_neck_length_mm: float | None = Field(default=None, ge=0.5, le=20)
    plug_tolerance_mm: float | None = Field(default=None, ge=0.05, le=1.5)
    plug_rotation: float | None = None
    rear_wall_mm: float | None = Field(default=None, ge=0.8, le=10)


class ProjectRequest(GenerateRequest):
    name: str | None = None


@app.get("/api/health")
def health():
    return {"ok": True, "service": "lighttype"}


@app.get("/api/fonts")
def list_fonts():
    return {"fonts": fonts_public(), "categories": FONT_CATEGORIES}


@app.get("/api/plug-profiles")
def list_plugs():
    return {
        "profiles": plug_profiles_public(),
        "product_types": PRODUCT_TYPES,
        "mounting_systems": MOUNTING_SYSTEMS,
    }


@app.post("/api/projects")
def save_project(body: ProjectRequest):
    import uuid

    project_id = uuid.uuid4().hex[:12]
    payload = body.model_dump()
    payload["id"] = project_id
    _projects[project_id] = payload
    return {"id": project_id, "project": payload}


@app.get("/api/projects/{project_id}")
def get_project(project_id: str):
    project = _projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="We couldn't find that project.")
    return project


@app.post("/api/generate/preview")
def preview(body: PreviewRequest):
    try:
        data = build_preview(
            text=body.text,
            font_id=body.font_id,
            height_mm=body.height_mm,
            wall_mm=body.wall_mm,
            spacing_mm=body.spacing_mm,
        )
        return data
    except GeometryError as exc:
        return JSONResponse(status_code=422, content={"error": exc.to_dict()})
    except KeyError:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "message": "That font isn’t available.",
                    "suggestion": "Choose another style and try again.",
                }
            },
        )
    except Exception:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "message": "We couldn't preview these letters right now.",
                    "suggestion": "Check the text and font, then try again.",
                }
            },
        )


@app.post("/api/generate/stl")
def start_stl(body: GenerateRequest, background: BackgroundTasks):
    job = create_job(body.model_dump())
    background.add_task(run_job, job.id)
    return {"job_id": job.id, "status": job.status}


@app.get("/api/generate/{job_id}")
def job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="That generation job was not found.")
    return {
        "job_id": job.id,
        "status": job.status,
        "stage": job.stage,
        "stage_label": job.stage_label,
        "progress": job.progress,
        "error": job.error,
        "result": job.result,
    }


@app.get("/api/download/{job_id}")
def download(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="That download is no longer available.")
    if job.status != "completed" or not job.zip_path or not job.zip_path.exists():
        raise HTTPException(status_code=409, detail="Your files aren’t ready yet.")
    filename = job.result["zip_name"] if job.result else "LightType.zip"
    return FileResponse(
        path=job.zip_path,
        media_type="application/zip",
        filename=filename,
    )
