"""Wall profile geometry: flat, shelf ledge, or stepped frieze moulding."""

from __future__ import annotations

from dataclasses import dataclass

import trimesh

from engine.font_geometry import clean_polygon


@dataclass
class WallProfileParams:
    profile_id: str = "flat"
    frieze_count: int = 2
    frieze_advance_mm: float = 1.5
    frieze_spacing_mm: float = 2.0
    close_45_base: bool = True
    inclination_mm: float = 0.0
    max_angle_deg: float = 45.0
    # Shelf: thicker LED cavity, thinner face pocket → internal ledge
    shelf_ratio: float = 0.6
    shelf_step_mm: float = 1.0


def _geom_ops():
    from engine.product_geometry import (
        extrude_geom,
        inward_offset,
        ring_between,
        translate_mesh,
        union_meshes,
    )
    return extrude_geom, inward_offset, ring_between, translate_mesh, union_meshes


def shelf_z_mm(depth: float, params: WallProfileParams) -> float:
    ratio = max(0.35, min(float(params.shelf_ratio), 0.75))
    return max(4.0, min(depth - 6.0, depth * ratio))


def shelf_step_clamped(wall_mm: float, params: WallProfileParams) -> float:
    return max(0.4, min(float(params.shelf_step_mm), wall_mm * 0.45))


def build_walls(
    walls_2d,
    cavity,
    geom,
    depth: float,
    params: WallProfileParams,
    wall_mm: float,
) -> trimesh.Trimesh:
    extrude_geom, _, _, _, _ = _geom_ops()
    if params.profile_id == "shelf":
        return _build_shelf_walls(walls_2d, cavity, geom, depth, params, wall_mm)
    if params.profile_id == "frieze" and params.frieze_count >= 1:
        return _build_frieze_walls(walls_2d, cavity, geom, depth, params, wall_mm)
    return extrude_geom(walls_2d, depth)


def _build_shelf_walls(
    walls_2d,
    cavity,
    geom,
    depth: float,
    params: WallProfileParams,
    wall_mm: float,
) -> trimesh.Trimesh:
    """Two-zone wall: full thickness to shelf_z, then thinner pocket (creates ledge)."""
    extrude_geom, _, _, translate_mesh, union_meshes = _geom_ops()
    step = shelf_step_clamped(wall_mm, params)
    z_shelf = shelf_z_mm(depth, params)

    lower = extrude_geom(walls_2d, z_shelf)

    # Expand cavity toward the outer wall → thinner upper walls, same outer silhouette.
    try:
        upper_inner = cavity.buffer(step, join_style=2, mitre_limit=2.5, resolution=16)
    except Exception:
        upper_inner = cavity
    upper_inner = clean_polygon(upper_inner)
    if upper_inner is None or upper_inner.is_empty:
        return extrude_geom(walls_2d, depth)

    upper_walls = clean_polygon(geom.difference(upper_inner))
    if upper_walls is None or upper_walls.is_empty or upper_walls.area < walls_2d.area * 0.25:
        return extrude_geom(walls_2d, depth)

    upper_h = max(0.8, depth - z_shelf)
    upper = extrude_geom(upper_walls, upper_h)
    upper = translate_mesh(upper, [0, 0, z_shelf])
    return union_meshes([lower, upper])


def _build_frieze_walls(
    walls_2d,
    cavity,
    geom,
    depth: float,
    params: WallProfileParams,
    wall_mm: float,
) -> trimesh.Trimesh:
    extrude_geom, inward_offset, ring_between, translate_mesh, union_meshes = _geom_ops()
    count = max(1, min(params.frieze_count, 6))
    advance = max(0.4, min(params.frieze_advance_mm, wall_mm * 0.85))
    spacing = max(0.5, params.frieze_spacing_mm)
    band = max(0.6, spacing)
    meshes: list[trimesh.Trimesh] = []

    usable = max(depth - 2.0, depth * 0.55)
    z = 0.0
    prev_inner = cavity

    for i in range(count):
        step_in = advance * (i + 1)
        groove_inner = inward_offset(prev_inner, band * 0.35)
        groove_outer = inward_offset(prev_inner, band)
        ring = ring_between(groove_outer, groove_inner, geom)
        if ring is None or ring.is_empty or ring.area < 0.2:
            continue
        seg_h = usable / count
        mesh = extrude_geom(ring, seg_h)
        mesh = translate_mesh(mesh, [0, 0, z])
        meshes.append(mesh)
        z += seg_h
        prev_inner = inward_offset(cavity, step_in)

    outer_shell = clean_polygon(geom.difference(inward_offset(cavity, advance * 0.35)))
    if not outer_shell.is_empty and outer_shell.area > 0.3:
        shell_h = max(1.2, depth - z)
        shell = extrude_geom(outer_shell, shell_h)
        shell = translate_mesh(shell, [0, 0, z])
        meshes.append(shell)

    if not meshes:
        return extrude_geom(walls_2d, depth)
    return union_meshes(meshes)


def frieze_rings_for_preview(cavity, geom, params: WallProfileParams, wall_mm: float) -> list[tuple]:
    """Return (ring_geom, step, index) tuples for preview rendering."""
    _, inward_offset, ring_between, _, _ = _geom_ops()
    if params.profile_id == "shelf":
        step = shelf_step_clamped(wall_mm, params)
        try:
            upper_inner = cavity.buffer(step, join_style=2, mitre_limit=2.5, resolution=16)
        except Exception:
            return []
        upper_inner = clean_polygon(upper_inner)
        if upper_inner is None or upper_inner.is_empty:
            return []
        ledge = ring_between(upper_inner, cavity, geom)
        if ledge is None or ledge.is_empty:
            return []
        return [(ledge, step, 0)]
    if params.profile_id != "frieze":
        return []
    count = max(1, min(params.frieze_count, 6))
    advance = max(0.4, min(params.frieze_advance_mm, wall_mm * 0.85))
    spacing = max(0.5, params.frieze_spacing_mm)
    bands: list[tuple] = []
    prev_inner = cavity
    for i in range(count):
        step_in = advance * (i + 1)
        groove_inner = inward_offset(prev_inner, spacing * 0.35)
        groove_outer = inward_offset(prev_inner, spacing)
        ring = ring_between(groove_outer, groove_inner, geom)
        if ring is None or ring.is_empty:
            continue
        bands.append((ring, step_in, i))
        prev_inner = inward_offset(cavity, step_in)
    return bands
