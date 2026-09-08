from __future__ import annotations

import logging

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from engine.catalog import (
    FONT_CATEGORIES,
    MOUNTING_SYSTEMS,
    PRODUCT_TYPES,
    fonts_public,
    letter_styles_public,
    material_packs_public,
    model_presets_public,
    mounting_systems_public,
    plug_profiles_public,
    wall_profiles_public,
)
from engine.errors import GeometryError, friendly_from_exception
from engine.checkout import (
    process_payment,
    send_verification_code,
    validate_download_token,
    verify_code,
)
from engine.bambu_connect import capabilities as bambu_capabilities
from engine.bambu_connect import stage_job_for_connect
from engine.jobs import create_job, get_job, run_job
from engine.preview import build_preview

logger = logging.getLogger(__name__)

app = FastAPI(title="LightType API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_projects: dict[str, dict] = {}


class MountingHoleModel(BaseModel):
    x: float
    y: float
    shape: str = "circle"
    width_mm: float | None = Field(default=None, ge=1, le=40)
    length_mm: float | None = Field(default=None, ge=1, le=40)
    diameter_mm: float | None = Field(default=None, ge=1, le=20)
    depth_mm: float = Field(default=6, ge=1, le=40)
    corner_radius_mm: float = Field(default=0, ge=0, le=20)
    face: str = "back"
    letter_index: int | None = None
    name: str | None = Field(default=None, max_length=48)


class PreviewRequest(BaseModel):
    text: str = Field(min_length=0, max_length=48)
    font_id: str = "montserrat-bold"
    height_mm: float = Field(default=100, ge=20, le=400)
    depth_mm: float = Field(default=25, ge=8, le=80)
    wall_mm: float = Field(default=2, ge=0.8, le=8)
    front_mm: float = Field(default=1.5, ge=0.6, le=6)
    spacing_mm: float = Field(default=8, ge=0, le=80)
    input_mode: str = "text"
    svg_content: str | None = None
    letter_style_id: str = "snap-fit"
    front_mount: str = "snap-fit"
    front_tolerance_mm: float = Field(default=0.25, ge=0.05, le=1.2)
    snap_fit_tolerance_mm: float = Field(default=0.25, ge=0.05, le=1.2)
    snap_fit_depth_mm: float = Field(default=1.2, ge=0.3, le=4)
    wall_profile_id: str = "flat"
    frieze_count: int = Field(default=2, ge=1, le=6)
    frieze_advance_mm: float = Field(default=1.5, ge=0.4, le=5)
    frieze_spacing_mm: float = Field(default=2, ge=0.5, le=8)
    shelf_ratio: float = Field(default=0.6, ge=0.35, le=0.75)
    shelf_step_mm: float = Field(default=1.0, ge=0.4, le=3.0)
    mounting_holes: list[MountingHoleModel] = Field(default_factory=list)
    base_enabled: bool = False
    base_height_mm: float = Field(default=12, ge=3, le=40)
    base_connector_width_mm: float = Field(default=8, ge=3, le=25)
    base_position: str = "bottom"
    base_connector_tolerance_mm: float = Field(default=0.3, ge=0.1, le=1.0)
    base_mode: str = "snap"
    shadow_enabled: bool = False
    shadow_offset_mm: float = Field(default=3, ge=0.5, le=25)
    diffuser_shell_mm: float = Field(default=0.85, ge=0.5, le=2.0)
    diffuser_tolerance_mm: float = Field(default=0.15, ge=0.05, le=0.5)
    min_cavity_mm: float = Field(default=0, ge=0, le=20)
    accent_lit: bool = True
    mounting_system_id: str = "none"
    material_pack_id: str = "pla-acrylic"
    model_preset_id: str | None = None


class GenerateRequest(BaseModel):
    text: str = Field(min_length=0, max_length=48)
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
    input_mode: str = "text"
    svg_content: str | None = None
    letter_style_id: str = "snap-fit"
    wall_profile_id: str = "flat"
    frieze_count: int = Field(default=2, ge=1, le=6)
    frieze_advance_mm: float = Field(default=1.5, ge=0.4, le=5)
    frieze_spacing_mm: float = Field(default=2, ge=0.5, le=8)
    shelf_ratio: float = Field(default=0.6, ge=0.35, le=0.75)
    shelf_step_mm: float = Field(default=1.0, ge=0.4, le=3.0)
    close_45_base: bool = True
    inclination_mm: float = Field(default=0, ge=0, le=10)
    max_angle_deg: float = Field(default=45, ge=20, le=60)
    mounting_holes: list[MountingHoleModel] = Field(default_factory=list)
    letter_indices: list[int] | None = None
    checkout_token: str | None = None
    base_enabled: bool = False
    base_height_mm: float = Field(default=12, ge=3, le=40)
    base_connector_width_mm: float = Field(default=8, ge=3, le=25)
    base_position: str = "bottom"
    base_connector_tolerance_mm: float = Field(default=0.3, ge=0.1, le=1.0)
    base_mode: str = "snap"
    shadow_enabled: bool = False
    shadow_offset_mm: float = Field(default=3, ge=0.5, le=25)
    diffuser_shell_mm: float = Field(default=0.85, ge=0.5, le=2.0)
    diffuser_tolerance_mm: float = Field(default=0.15, ge=0.05, le=0.5)
    min_cavity_mm: float = Field(default=0, ge=0, le=20)
    accent_lit: bool = True
    mounting_system_id: str = "none"
    material_pack_id: str = "pla-acrylic"
    model_preset_id: str | None = None
    export_format: str = "stl"


class SendCodeRequest(BaseModel):
    email: str = Field(min_length=3, max_length=120)


class VerifyCodeRequest(BaseModel):
    email: str = Field(min_length=3, max_length=120)
    code: str = Field(min_length=5, max_length=5)


class PayRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=64)


class ProjectRequest(GenerateRequest):
    name: str | None = None


@app.get("/api/health")
def health():
    return {"ok": True, "service": "lighttype"}


@app.get("/api/fonts")
def list_fonts():
    return {"fonts": fonts_public(), "categories": FONT_CATEGORIES}


@app.get("/api/letter-styles")
def list_letter_styles():
    return {"styles": letter_styles_public()}


@app.get("/api/wall-profiles")
def list_wall_profiles():
    return {"profiles": wall_profiles_public()}


@app.get("/api/model-presets")
def list_model_presets():
    return {"presets": model_presets_public()}


@app.get("/api/material-packs")
def list_material_packs():
    return {"packs": material_packs_public()}


@app.get("/api/mounting-systems")
def list_mounting_systems():
    return {"systems": mounting_systems_public(), "all": MOUNTING_SYSTEMS}


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
    text = body.text.strip()
    if body.input_mode == "svg":
        if not body.svg_content:
            return JSONResponse(
                status_code=422,
                content={"error": {"message": "Upload an SVG file.", "suggestion": "Choose a .svg file to continue."}},
            )
        text = text or "SVG"
    elif not text:
        return JSONResponse(
            status_code=422,
            content={"error": {"message": "Type a name, word or phrase to get started.", "suggestion": ""}},
        )
    try:
        data = build_preview(
            text=text,
            font_id=body.font_id,
            height_mm=body.height_mm,
            wall_mm=body.wall_mm,
            spacing_mm=body.spacing_mm,
            input_mode=body.input_mode,
            svg_content=body.svg_content,
            letter_style_id=body.letter_style_id,
            wall_profile_id=body.wall_profile_id,
            frieze_count=body.frieze_count,
            frieze_advance_mm=body.frieze_advance_mm,
            frieze_spacing_mm=body.frieze_spacing_mm,
            shelf_ratio=body.shelf_ratio,
            shelf_step_mm=body.shelf_step_mm,
            depth_mm=body.depth_mm,
            front_mm=body.front_mm,
            front_mount=body.front_mount,
            front_tolerance_mm=body.front_tolerance_mm,
            snap_fit_tolerance_mm=body.snap_fit_tolerance_mm,
            snap_fit_depth_mm=body.snap_fit_depth_mm,
            mounting_holes=[h.model_dump() for h in body.mounting_holes],
            base_enabled=body.base_enabled,
            base_height_mm=body.base_height_mm,
            base_connector_width_mm=body.base_connector_width_mm,
            base_position=body.base_position,
            base_connector_tolerance_mm=body.base_connector_tolerance_mm,
            base_mode=body.base_mode,
            shadow_enabled=body.shadow_enabled,
            shadow_offset_mm=body.shadow_offset_mm,
            diffuser_shell_mm=body.diffuser_shell_mm,
            diffuser_tolerance_mm=body.diffuser_tolerance_mm,
            min_cavity_mm=body.min_cavity_mm,
            accent_lit=body.accent_lit,
            mounting_system_id=body.mounting_system_id,
            material_pack_id=body.material_pack_id,
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
    except Exception as exc:
        logger.exception("preview failed (text=%r, input_mode=%s)", text, body.input_mode)
        geo = friendly_from_exception(exc)
        return JSONResponse(status_code=422, content={"error": geo.to_dict()})


@app.post("/api/checkout/send-code")
def checkout_send_code(body: SendCodeRequest):
    try:
        return send_verification_code(body.email)
    except ValueError as exc:
        return JSONResponse(
            status_code=422,
            content={"error": {"message": str(exc), "suggestion": ""}},
        )


@app.post("/api/checkout/verify-code")
def checkout_verify_code(body: VerifyCodeRequest):
    try:
        return verify_code(body.email, body.code)
    except ValueError as exc:
        return JSONResponse(
            status_code=422,
            content={"error": {"message": str(exc), "suggestion": ""}},
        )


@app.post("/api/checkout/pay")
def checkout_pay(body: PayRequest):
    try:
        return process_payment(body.session_id)
    except ValueError as exc:
        return JSONResponse(
            status_code=422,
            content={"error": {"message": str(exc), "suggestion": ""}},
        )


@app.post("/api/generate/stl")
def start_stl(body: GenerateRequest, background: BackgroundTasks):
    if not validate_download_token(body.checkout_token):
        return JSONResponse(
            status_code=402,
            content={
                "error": {
                    "message": "Pagamento necessário para baixar os arquivos STL.",
                    "suggestion": "Conclua a verificação de e-mail e o pagamento.",
                }
            },
        )
    if body.input_mode == "text" and not body.text.strip():
        raise HTTPException(status_code=422, detail="Type some text first.")
    if body.input_mode == "svg" and not body.svg_content:
        raise HTTPException(status_code=422, detail="Upload an SVG file first.")
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
    media = (
        "model/3mf"
        if str(filename).lower().endswith(".3mf")
        else "application/zip"
    )
    return FileResponse(
        path=job.zip_path,
        media_type=media,
        filename=filename,
    )


@app.get("/api/bambu-connect/capabilities")
def bambu_connect_capabilities():
    return bambu_capabilities()


@app.post("/api/download/{job_id}/bambu-connect")
def open_in_bambu_connect(job_id: str):
    """Stage the job's .3mf and return a bambu-connect://import-file URL."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="That download is no longer available.")
    try:
        return stage_job_for_connect(job)
    except ValueError as exc:
        return JSONResponse(
            status_code=409,
            content={
                "error": {
                    "message": str(exc),
                    "suggestion": (
                        "Com Docker, rode `make start` (ele grava BAMBU_CONNECT_HOST_PATH no .env). "
                        "O arquivo precisa ser .3mf."
                    ),
                }
            },
        )
