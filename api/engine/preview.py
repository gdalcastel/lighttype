"""Lightweight preview payload: 2D contours in millimetres for the Three.js viewer."""

from __future__ import annotations

from engine.connection_base import base_preview_rings
from engine.catalog import get_letter_style
from engine.errors import GeometryError
from engine.font_geometry import geometry_to_rings, layout_text, unsupported_characters
from engine.product_geometry import (
    cavity_rings,
    counter_bridges_preview,
    default_min_cavity_mm,
    diffuser_preview_data,
    filter_narrow_cavity,
    filter_unlit_accents,
    rear_wall_mm_for_style,
    simplify_geom,
    snap_fit_preview_data,
    support_ribs_preview,
)
from engine.shadow_cover import ShadowCoverParams, shadow_preview_rings
from engine.svg_geometry import layout_svg
from engine.wall_profile import WallProfileParams, frieze_rings_for_preview, shelf_z_mm


def _layout_glyphs(
    text: str,
    font_id: str,
    height_mm: float,
    spacing_mm: float,
    input_mode: str,
    svg_content: str | None,
    base_params=None,
):
    if input_mode == "svg" and svg_content:
        return layout_svg(svg_content, height_mm, spacing_mm)
    return layout_text(font_id, text, height_mm, spacing_mm, base_params=base_params)


def build_preview(
    text: str,
    font_id: str,
    height_mm: float,
    wall_mm: float,
    spacing_mm: float,
    *,
    input_mode: str = "text",
    svg_content: str | None = None,
    letter_style_id: str = "snap-fit",
    wall_profile_id: str = "flat",
    frieze_count: int = 2,
    frieze_advance_mm: float = 1.5,
    frieze_spacing_mm: float = 2.0,
    shelf_ratio: float = 0.6,
    shelf_step_mm: float = 1.0,
    depth_mm: float = 25.0,
    front_mm: float = 1.5,
    front_mount: str | None = None,
    front_tolerance_mm: float = 0.25,
    snap_fit_tolerance_mm: float = 0.25,
    snap_fit_depth_mm: float = 1.2,
    mounting_holes: list[dict] | None = None,
    base_enabled: bool = False,
    base_height_mm: float = 12.0,
    base_connector_width_mm: float = 8.0,
    base_position: str = "bottom",
    base_connector_tolerance_mm: float = 0.3,
    base_mode: str = "snap",
    shadow_enabled: bool = False,
    shadow_offset_mm: float = 3.0,
    diffuser_shell_mm: float = 0.85,
    diffuser_tolerance_mm: float = 0.15,
    min_cavity_mm: float = 0.0,
    accent_lit: bool = True,
    mounting_system_id: str = "none",
    material_pack_id: str = "pla-acrylic",
) -> dict:
    from engine.connection_base import ConnectionBaseParams

    base_params = ConnectionBaseParams(
        enabled=base_enabled,
        height_mm=base_height_mm,
        connector_width_mm=base_connector_width_mm,
        position=base_position,
        connector_tolerance_mm=base_connector_tolerance_mm,
        spacing_mm=spacing_mm,
        mode=base_mode,
    )
    letters_in = _layout_glyphs(
        text, font_id, height_mm, spacing_mm, input_mode, svg_content, base_params=base_params
    )
    style = get_letter_style(letter_style_id)
    mount = front_mount or style.get("front_mount", "snap-fit")
    rear_mm = rear_wall_mm_for_style(wall_mm, depth_mm, style.get("rear_type", "solid"))
    supports = int(style.get("supports", 0))
    effective_profile = wall_profile_id
    if mount == "diffuser" and effective_profile == "flat":
        effective_profile = "shelf"
    wall_params = WallProfileParams(
        profile_id=effective_profile,
        frieze_count=frieze_count,
        frieze_advance_mm=frieze_advance_mm,
        frieze_spacing_mm=frieze_spacing_mm,
        shelf_ratio=shelf_ratio,
        shelf_step_mm=shelf_step_mm,
    )
    letters_out = []
    min_x = min_y = 1e9
    max_x = max_y = -1e9

    holes_out = mounting_holes or []

    for glyph in letters_in:
        geom = simplify_geom(glyph.geometry, 0.16)
        cavity_source = simplify_geom(glyph.cavity_source, 0.16)
        cavity = cavity_rings(cavity_source, wall_mm)
        cavity = simplify_geom(cavity, 0.16) if not cavity.is_empty else cavity
        min_cav = min_cavity_mm if min_cavity_mm > 0 else default_min_cavity_mm(wall_mm, depth_mm)
        cavity = filter_unlit_accents(cavity, cavity_source, accent_lit)
        cavity = filter_narrow_cavity(cavity, min_cav)
        cavity = simplify_geom(cavity, 0.16) if cavity is not None and not cavity.is_empty else cavity
        outer, holes = geometry_to_rings(geom)
        inner, inner_holes = geometry_to_rings(cavity) if cavity is not None and not cavity.is_empty else ([], [])
        frieze_bands = []
        if effective_profile in ("frieze", "shelf") and not cavity.is_empty:
            for ring_geom, step, idx in frieze_rings_for_preview(cavity, geom, wall_params, wall_mm):
                fr_outer, fr_holes = geometry_to_rings(ring_geom)
                frieze_bands.append({"outer": fr_outer, "holes": fr_holes, "step": step, "index": idx})
        snap_fit = snap_fit_preview_data(
            geom,
            cavity,
            depth_mm=depth_mm,
            front_mm=front_mm,
            wall_mm=wall_mm,
            rear_mm=rear_mm,
            front_mount=mount,
            snap_fit_tolerance_mm=snap_fit_tolerance_mm,
            snap_fit_depth_mm=snap_fit_depth_mm,
            front_tolerance_mm=front_tolerance_mm,
        )
        diffuser = None
        if mount == "diffuser" and not cavity.is_empty:
            diffuser = diffuser_preview_data(
                geom,
                cavity,
                depth_mm=depth_mm,
                front_mm=front_mm,
                wall_mm=wall_mm,
                wall_profile=wall_params,
                diffuser_shell_mm=diffuser_shell_mm,
                diffuser_tolerance_mm=diffuser_tolerance_mm,
            )
        counter_bridges = counter_bridges_preview(geom, cavity)
        support_ribs = support_ribs_preview(geom.bounds, supports, rear_mm, depth_mm, wall_mm)
        minx, miny, maxx, maxy = geom.bounds
        gbounds = glyph.glyph_bounds
        connection_base = base_preview_rings(gbounds, base_params) if base_params.enabled else None
        min_x, min_y = min(min_x, minx), min(min_y, miny)
        max_x, max_y = max(max_x, maxx), max(max_y, maxy)
        letters_out.append(
            {
                "char": glyph.char,
                "index": glyph.index,
                "x": glyph.x,
                "width": glyph.width,
                "height": glyph.height,
                "bounds": [minx, miny, maxx, maxy],
                "glyph_bounds": [gbounds[0], gbounds[1], gbounds[2], gbounds[3]],
                "outer": outer,
                "holes": holes,
                "inner": inner,
                "inner_holes": inner_holes,
                "has_cavity": bool(inner),
                "frieze_bands": frieze_bands,
                "snap_fit": snap_fit,
                "diffuser": diffuser,
                "counter_bridges": counter_bridges,
                "support_ribs": support_ribs,
                "rear_mm": rear_mm,
                "shelf_z": shelf_z_mm(depth_mm, wall_params) if effective_profile == "shelf" else None,
                "connection_base": connection_base,
            }
        )

    if not letters_out:
        raise GeometryError("Type a name, word or phrase to get started.")

    shadow_params = ShadowCoverParams(enabled=shadow_enabled, offset_mm=shadow_offset_mm)
    shadow_cover = shadow_preview_rings(letters_in, shadow_params) if shadow_params.enabled else None

    return {
        "text": text,
        "font_id": font_id,
        "height_mm": height_mm,
        "wall_mm": wall_mm,
        "spacing_mm": spacing_mm,
        "input_mode": input_mode,
        "letter_style_id": letter_style_id,
        "letter_style": style,
        "wall_profile_id": effective_profile,
        "frieze_count": frieze_count,
        "frieze_advance_mm": frieze_advance_mm,
        "frieze_spacing_mm": frieze_spacing_mm,
        "shelf_ratio": shelf_ratio,
        "shelf_step_mm": shelf_step_mm,
        "depth_mm": depth_mm,
        "front_mm": front_mm,
        "front_mount": mount,
        "front_tolerance_mm": front_tolerance_mm,
        "snap_fit_tolerance_mm": snap_fit_tolerance_mm,
        "snap_fit_depth_mm": snap_fit_depth_mm,
        "diffuser_shell_mm": diffuser_shell_mm,
        "diffuser_tolerance_mm": diffuser_tolerance_mm,
        "min_cavity_mm": min_cavity_mm if min_cavity_mm > 0 else default_min_cavity_mm(wall_mm, depth_mm),
        "accent_lit": accent_lit,
        "mounting_system_id": mounting_system_id,
        "material_pack_id": material_pack_id,
        "base_enabled": base_enabled,
        "base_height_mm": base_height_mm,
        "base_connector_width_mm": base_connector_width_mm,
        "base_position": base_position,
        "base_connector_tolerance_mm": base_connector_tolerance_mm,
        "base_mode": base_mode,
        "shadow_enabled": shadow_enabled,
        "shadow_offset_mm": shadow_offset_mm,
        "shadow_cover": shadow_cover,
        "shadow_depth_mm": rear_mm if shadow_enabled else None,
        "mounting_holes": holes_out,
        "letters": letters_out,
        "layout_width": float(max_x - min_x),
        "layout_height": float(max_y - min_y),
        "bounds": [float(min_x), float(min_y), float(max_x), float(max_y)],
        "unsupported": unsupported_characters(font_id, text) if input_mode == "text" else [],
        "letter_count": len(letters_out),
    }
