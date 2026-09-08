"""PRODUCT GEOMETRY: hollow body, rear wall, LED cavity, removable front, snap-fit, rear plug.

Independent from typeface outline extraction. Mechanical dimensions come from
PlugProfile and the generate request — never hardcoded constants in this module.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import trimesh
from shapely.geometry import Polygon
from shapely.ops import unary_union

from engine.catalog import PlugProfile, get_letter_style
from engine.errors import GeometryError, friendly_from_exception
from engine.font_geometry import clean_polygon, geometry_to_rings, iter_polygons
from engine.hole_ops import MountingHoleSpec, apply_mounting_holes
from engine.wall_profile import WallProfileParams, build_walls

SIMPLIFY_STL = 0.06
SIMPLIFY_PREVIEW = 0.18


@dataclass
class ProductParams:
    height_mm: float
    depth_mm: float
    wall_mm: float
    front_mm: float
    spacing_mm: float
    front_tolerance_mm: float
    snap_fit_tolerance_mm: float
    snap_fit_depth_mm: float
    plug_profile: PlugProfile
    plug_position: str
    front_mount: str
    rear_wall_mm: float | None = None
    letter_style_id: str = "snap-fit"
    wall_profile: WallProfileParams | None = None
    mounting_holes: list[MountingHoleSpec] | None = None
    base_enabled: bool = False
    base_height_mm: float = 12.0
    base_connector_width_mm: float = 8.0
    base_position: str = "bottom"
    base_connector_tolerance_mm: float = 0.3
    base_mode: str = "snap"
    shadow_enabled: bool = False
    shadow_offset_mm: float = 3.0
    diffuser_shell_mm: float = 0.85
    diffuser_tolerance_mm: float = 0.15
    min_cavity_mm: float = 6.0
    accent_lit: bool = True
    mounting_system_id: str = "none"
    material_pack_id: str = "pla-acrylic"

    @property
    def connection_base(self):
        from engine.connection_base import ConnectionBaseParams

        return ConnectionBaseParams(
            enabled=self.base_enabled,
            height_mm=self.base_height_mm,
            connector_width_mm=self.base_connector_width_mm,
            position=self.base_position,
            connector_tolerance_mm=self.base_connector_tolerance_mm,
            spacing_mm=self.spacing_mm,
            mode=self.base_mode,
        )

    @property
    def shadow_cover(self):
        from engine.shadow_cover import ShadowCoverParams

        return ShadowCoverParams(
            enabled=self.shadow_enabled,
            offset_mm=self.shadow_offset_mm,
        )

    @property
    def letter_style(self) -> dict:
        return get_letter_style(self.letter_style_id)

    @property
    def rear_wall(self) -> float:
        style = self.letter_style
        rear_type = style.get("rear_type", "solid")
        if rear_type == "none":
            return 0.0
        if rear_type == "thin":
            return max(0.8, self.wall_mm * 0.5)
        if rear_type == "thick":
            return max(2.5, self.wall_mm * 1.8)
        if self.rear_wall_mm is not None:
            return max(0.8, self.rear_wall_mm)
        return max(1.2, min(self.wall_mm, self.depth_mm * 0.25))


def rear_bridge_depth(rear: float, wall_mm: float) -> float:
    """Depth of rear-only counter bridges that keep the front face open."""
    rear_bridge = rear if rear > 0.5 else 0.0
    return max(rear_bridge, wall_mm, 1.2)


def _hole_inside_inner(inner, hole) -> bool:
    try:
        pt = hole.representative_point()
        if not inner.contains(pt):
            return False
        overlap = inner.intersection(hole).area
        return overlap >= hole.area * 0.92
    except Exception:
        return False


def _match_glyph_hole(inner_coords, hole_coords_list: list) -> Polygon | None:
    inner = Polygon(inner_coords + [inner_coords[0]])
    best: Polygon | None = None
    best_area = 0.0
    for coords in hole_coords_list:
        hole = Polygon(coords + [coords[0]])
        if hole.is_empty or hole.area < 1e-8:
            continue
        if not _hole_inside_inner(inner, hole):
            continue
        if hole.area > best_area:
            best = hole
            best_area = hole.area
    return best


def _counter_bridge_rings(letter_geom, cavity):
    """2D rings around glyph counters (expanded cavity hole minus original hole)."""
    _, holes = geometry_to_rings(letter_geom)
    _, inner_holes = geometry_to_rings(cavity)
    if not holes or not inner_holes:
        return None
    rings = []
    for inner_coords in inner_holes:
        matched = _match_glyph_hole(inner_coords, holes)
        if matched is None:
            continue
        inner = Polygon(inner_coords + [inner_coords[0]])
        ring = clean_polygon(inner.difference(matched))
        if ring is None or ring.is_empty or ring.area < 1e-6:
            continue
        rings.append(ring)
    if not rings:
        return None
    return clean_polygon(unary_union(rings))


def split_counter_bridge_walls(walls_2d, letter_geom, cavity):
    """Separate full-depth frame walls from rear-only counter bridge walls."""
    counter_rings = _counter_bridge_rings(letter_geom, cavity)
    if counter_rings is None or counter_rings.is_empty:
        return walls_2d, None
    counter_walls = clean_polygon(walls_2d.intersection(counter_rings))
    if counter_walls is None or counter_walls.is_empty:
        return walls_2d, None
    frame_walls = clean_polygon(walls_2d.difference(counter_walls))
    if frame_walls is None or frame_walls.is_empty:
        return walls_2d, None
    return frame_walls, counter_walls


def build_frame_and_counter_walls(
    walls_2d,
    letter_geom,
    cavity,
    depth: float,
    rear: float,
    wall_mm: float,
    wall_profile: WallProfileParams | None,
) -> trimesh.Trimesh:
    """Extrude all letter walls (perimeter + counters) at full depth."""
    profile = wall_profile or WallProfileParams()
    return build_walls(walls_2d, cavity, letter_geom, depth, profile, wall_mm)


def inward_offset(geom, distance: float):
    if distance <= 0:
        return geom
    offset = geom.buffer(-distance, join_style=2, mitre_limit=2.8, resolution=16)
    offset = clean_polygon(offset)
    if offset is None or offset.is_empty:
        return Polygon()
    return offset


def filter_narrow_cavity(cavity, min_width_mm: float):
    """Drop cavity regions thinner than min_width (solid tips like V)."""
    if cavity is None or cavity.is_empty or min_width_mm <= 0.5:
        return cavity
    r = max(0.25, min_width_mm * 0.5 - 0.08)
    shrunk = cavity.buffer(-r, join_style=2, mitre_limit=2.5, resolution=12)
    shrunk = clean_polygon(shrunk)
    if shrunk is None or shrunk.is_empty:
        return Polygon()
    restored = shrunk.buffer(r, join_style=2, mitre_limit=2.5, resolution=12)
    restored = clean_polygon(restored)
    if restored is None or restored.is_empty:
        return Polygon()
    clipped = clean_polygon(restored.intersection(cavity))
    if clipped is None or clipped.is_empty:
        return Polygon()
    # Keep only parts that still have meaningful area after filtering.
    parts = [p for p in iter_polygons(clipped) if p.area >= min_width_mm * min_width_mm * 0.35]
    if not parts:
        return Polygon()
    return clean_polygon(unary_union(parts))


def filter_unlit_accents(cavity, geom, accent_lit: bool):
    """When accent_lit is False, drop small top islands from the cavity (solid diacritics)."""
    if accent_lit or cavity is None or cavity.is_empty:
        return cavity
    parts = sorted([p for p in iter_polygons(cavity) if p.area > 1e-6], key=lambda p: -p.area)
    if len(parts) <= 1:
        return cavity
    main = parts[0]
    _minx, miny, _maxx, maxy = geom.bounds
    span_y = max(1.0, maxy - miny)
    upper = miny + span_y * 0.55
    kept = [main]
    for p in parts[1:]:
        is_top = p.centroid.y >= upper
        is_small = p.area < main.area * 0.28
        if is_top and is_small:
            continue
        kept.append(p)
    return clean_polygon(unary_union(kept))


def split_diffuser_islands(diff_outer, min_area: float = 8.0) -> list:
    """Return individual diffuser islands (main glyph + accents)."""
    if diff_outer is None or diff_outer.is_empty:
        return []
    parts = [p for p in iter_polygons(diff_outer) if p.area >= min_area]
    parts.sort(key=lambda p: -p.area)
    return parts


def default_min_cavity_mm(wall_mm: float, depth_mm: float) -> float:
    return max(4.0, min(12.0, wall_mm * 2.2, depth_mm * 0.2))


def ring_between(outer_limit, inner_limit, clip):
    ring = clean_polygon(outer_limit.difference(inner_limit))
    if clip is not None:
        ring = clean_polygon(ring.intersection(clip))
    return ring


def simplify_geom(geom, tol: float):
    if geom is None or geom.is_empty:
        return geom
    simple = geom.simplify(tol, preserve_topology=True)
    return clean_polygon(simple)


def extrude_geom(geom, height: float) -> trimesh.Trimesh:
    if geom is None or geom.is_empty or height <= 0:
        raise GeometryError(
            "Não foi possível criar esta letra no tamanho atual.",
            suggestion="Aumente a altura da letra ou reduza a espessura da parede.",
        )
    meshes: list[trimesh.Trimesh] = []
    for poly in iter_polygons(geom):
        poly = clean_polygon(poly)
        if poly.is_empty or poly.area < 1e-6:
            continue
        try:
            mesh = trimesh.creation.extrude_polygon(poly, height)
        except Exception:
            poly = simplify_geom(poly, 0.12)
            mesh = trimesh.creation.extrude_polygon(poly, height)
        if mesh is not None and len(mesh.faces) > 0:
            meshes.append(mesh)
    if not meshes:
        raise GeometryError(
            "Não foi possível criar esta letra no tamanho atual.",
            suggestion="Tente uma fonte mais simples ou uma altura maior.",
        )
    return union_meshes(meshes)


def union_meshes(meshes: list[trimesh.Trimesh]) -> trimesh.Trimesh:
    meshes = [m for m in meshes if m is not None and len(m.faces) > 0]
    if not meshes:
        raise GeometryError("Não foi possível combinar as partes desta letra.")
    if len(meshes) == 1:
        return meshes[0]
    try:
        result = trimesh.boolean.union(meshes, engine="manifold")
        if isinstance(result, list):
            result = trimesh.util.concatenate(result)
        return result
    except Exception:
        return trimesh.util.concatenate(meshes)


def difference_meshes(a: trimesh.Trimesh, b: trimesh.Trimesh) -> trimesh.Trimesh:
    try:
        result = trimesh.boolean.difference([a, b], engine="manifold")
        if isinstance(result, list):
            result = trimesh.util.concatenate(result)
        return result
    except Exception as exc:
        raise GeometryError(
            "Não foi possível criar esta letra no tamanho atual.",
            suggestion="Aumente a altura da letra ou reduza a espessura da parede.",
        ) from exc


def translate_mesh(mesh: trimesh.Trimesh, offset) -> trimesh.Trimesh:
    out = mesh.copy()
    out.apply_translation(offset)
    return out


def _cylinder(radius: float, height: float, sections: int = 32) -> trimesh.Trimesh:
    return trimesh.creation.cylinder(radius=radius, height=height, sections=sections)


def make_plug_mesh(profile: PlugProfile) -> trimesh.Trimesh:
    """Plug aligned with +Y going away from the letter (we rotate later).

    Stack: neck (near letter) then head. Dimensions come only from PlugProfile.
    """
    neck_r = max(0.4, profile.neck_diameter_mm / 2.0)
    head_r = max(neck_r + 0.2, profile.diameter_mm / 2.0)
    neck_h = max(0.6, profile.neck_length_mm)
    head_h = max(0.8, profile.length_mm - neck_h)
    neck = _cylinder(neck_r, neck_h)
    neck.apply_translation([0, 0, neck_h / 2.0])
    head = _cylinder(head_r, head_h)
    head.apply_translation([0, 0, neck_h + head_h / 2.0])
    plug = union_meshes([neck, head])
    # Default creation is along +Z. Rotate to -Y (down into the bar).
    rot = trimesh.transformations.rotation_matrix(np.pi / 2.0, [1, 0, 0])
    plug.apply_transform(rot)
    if profile.rotation:
        extra = trimesh.transformations.rotation_matrix(
            np.radians(profile.rotation), [0, 1, 0]
        )
        plug.apply_transform(extra)
    return plug


def attach_plug(
    body: trimesh.Trimesh,
    letter_geom,
    params: ProductParams,
    *,
    glyph_bounds: tuple[float, float, float, float] | None = None,
) -> trimesh.Trimesh:
    profile = params.plug_profile
    if glyph_bounds is not None:
        minx, miny, maxx, maxy = glyph_bounds
    else:
        minx, miny, maxx, maxy = letter_geom.bounds
    cx = (minx + maxx) / 2.0
    # Bottom-center of the letter, slightly overlapping the body so the union is solid.
    overlap = min(1.6, max(0.8, params.wall_mm * 0.6))
    origin = [cx, miny + overlap, params.rear_wall * 0.45]
    plug = make_plug_mesh(profile)
    plug.apply_translation(origin)
    try:
        return union_meshes([body, plug])
    except Exception:
        # Keep the letter printable even if the prototype plug fails to merge.
        return trimesh.util.concatenate([body, plug])


def build_body_and_front(
    letter_geom,
    char: str,
    params: ProductParams,
    *,
    glyph_bounds: tuple[float, float, float, float] | None = None,
    letter_body_geom=None,
) -> tuple[trimesh.Trimesh, trimesh.Trimesh]:
    try:
        return _build_body_and_front(
            letter_geom,
            char,
            params,
            glyph_bounds=glyph_bounds,
            letter_body_geom=letter_body_geom,
        )
    except GeometryError:
        # Parede do kit (5 mm) pode falhar em traços finos — tenta mais fina.
        if params.wall_mm > 2.8:
            from dataclasses import replace

            thinner = replace(params, wall_mm=max(2.5, round(params.wall_mm * 0.65, 2)))
            try:
                return _build_body_and_front(
                    letter_geom,
                    char,
                    thinner,
                    glyph_bounds=glyph_bounds,
                    letter_body_geom=letter_body_geom,
                )
            except GeometryError:
                pass
        raise
    except Exception as exc:
        raise friendly_from_exception(exc, letter=char) from exc


def _build_body_and_front(
    letter_geom,
    char: str,
    params: ProductParams,
    *,
    glyph_bounds: tuple[float, float, float, float] | None = None,
    letter_body_geom=None,
) -> tuple[trimesh.Trimesh, trimesh.Trimesh]:
    geom = simplify_geom(letter_geom, SIMPLIFY_STL)
    cavity_source = (
        simplify_geom(letter_body_geom, SIMPLIFY_STL)
        if letter_body_geom is not None
        else geom
    )
    if geom.is_empty:
        raise GeometryError(
            f"Não foi possível criar a letra “{char}” no tamanho atual.",
            suggestion="Aumente a altura da letra ou escolha outra fonte.",
            letter=char,
        )

    wall = params.wall_mm
    depth = params.depth_mm
    rear = params.rear_wall
    if depth <= rear + 2.0:
        raise GeometryError(
            "A letra está rasa demais para ter cavidade interna.",
            suggestion="Aumente a profundidade ou reduza a espessura da parede.",
            letter=char,
        )

    cavity = inward_offset(cavity_source, wall)
    if cavity.is_empty or cavity.area < cavity_source.area * 0.08:
        raise GeometryError(
            f"A letra “{char}” é fina demais para ocar com esta parede.",
            suggestion="Aumente a altura da letra ou reduza a espessura da parede.",
            letter=char,
        )

    min_cav = params.min_cavity_mm
    if min_cav <= 0:
        min_cav = default_min_cavity_mm(wall, depth)
    cavity = filter_unlit_accents(cavity, cavity_source, params.accent_lit)
    cavity = filter_narrow_cavity(cavity, min_cav)
    if cavity is None or cavity.is_empty:
        # Fully solid letter (too thin everywhere) — still printable as a block with optional face.
        mount = params.letter_style.get("front_mount", params.front_mount)
        if mount == "fixed":
            body = extrude_geom(geom, depth + params.front_mm)
            front = extrude_geom(geom, params.front_mm)
        else:
            body = extrude_geom(geom, depth)
            front = extrude_geom(inward_offset(geom, max(0.1, params.front_tolerance_mm)), params.front_mm)
        return body, front

    walls_2d = clean_polygon(geom.difference(cavity))
    if walls_2d.is_empty:
        raise GeometryError(
            f"We couldn't hollow the letter “{char}”.",
            suggestion="Try a larger height or a thinner wall.",
            letter=char,
        )

    if params.connection_base.enabled and glyph_bounds is not None:
        from engine.connection_base import side_wall_wire_slots

        wire_cut = side_wall_wire_slots(glyph_bounds, params.connection_base)
        if wire_cut is not None and not wire_cut.is_empty:
            walls_2d = clean_polygon(walls_2d.difference(wire_cut))

    mount = params.letter_style.get("front_mount", params.front_mount)
    wall_profile = params.wall_profile
    if mount == "diffuser":
        from engine.wall_profile import WallProfileParams

        wp = wall_profile or WallProfileParams()
        if wp.profile_id == "flat":
            wall_profile = WallProfileParams(
                profile_id="shelf",
                shelf_ratio=wp.shelf_ratio,
                shelf_step_mm=wp.shelf_step_mm,
                frieze_count=wp.frieze_count,
                frieze_advance_mm=wp.frieze_advance_mm,
                frieze_spacing_mm=wp.frieze_spacing_mm,
            )
        else:
            wall_profile = wp

    walls = build_frame_and_counter_walls(
        walls_2d,
        geom,
        cavity,
        depth,
        rear,
        wall,
        wall_profile,
    )
    rear = params.rear_wall
    if rear > 0.5 and not params.shadow_enabled:
        rear_cap = extrude_geom(geom, rear)
        body = union_meshes([walls, rear_cap])
    else:
        body = walls

    supports = int(params.letter_style.get("supports", 0))
    if supports > 0:
        body = _add_internal_supports(body, cavity, geom, params, supports)

    if mount == "fixed":
        front = None
        body = union_meshes([body, extrude_geom(geom, params.front_mm + depth - rear)])
    elif mount == "diffuser":
        body, front = _apply_printed_diffuser(body, geom, cavity, params, wall_profile)
    elif mount == "press-fit" or params.front_mount == "press-fit":
        body, front = _apply_snap_fit(body, geom, cavity, params, tight=True)
    elif mount == "snap-fit" or params.front_mount == "snap-fit":
        body, front = _apply_snap_fit(body, geom, cavity, params)
    else:
        front = extrude_geom(geom, params.front_mm)

    holes = params.mounting_holes or []
    if holes:
        body = apply_mounting_holes(body, holes, depth, rear)

    if front is None:
        front = extrude_geom(geom, params.front_mm)
    return body, front


def _add_internal_supports(body, cavity, geom, params: ProductParams, count: int) -> trimesh.Trimesh:
    """Add vertical rib(s) inside the cavity."""
    minx, miny, maxx, maxy = geom.bounds
    cx = (minx + maxx) / 2.0
    rib_w = max(1.2, params.wall_mm * 0.8)
    rib_h = params.depth_mm - params.rear_wall - 1.5
    if rib_h < 2:
        return body
    positions = [cx] if count == 1 else [minx + (maxx - minx) * 0.33, minx + (maxx - minx) * 0.67]
    meshes = [body]
    for px in positions[:count]:
        rib = trimesh.creation.box(extents=[rib_w, (maxy - miny) * 0.6, rib_h])
        rib.apply_translation([px, (miny + maxy) / 2, params.rear_wall + rib_h / 2])
        meshes.append(rib)
    try:
        return union_meshes(meshes)
    except Exception:
        return trimesh.util.concatenate(meshes)


def _apply_printed_diffuser(
    body: trimesh.Trimesh,
    geom,
    cavity,
    params: ProductParams,
    wall_profile: WallProfileParams | None,
) -> tuple[trimesh.Trimesh, trimesh.Trimesh]:
    """Hollow printed diffuser with rear flange; supports multi-island accents."""
    from engine.wall_profile import shelf_step_clamped, shelf_z_mm

    wp = wall_profile or WallProfileParams(profile_id="shelf")
    step = shelf_step_clamped(params.wall_mm, wp)
    z_shelf = shelf_z_mm(params.depth_mm, wp)
    tol = max(0.08, min(params.diffuser_tolerance_mm, 0.4))
    shell = max(0.65, min(params.diffuser_shell_mm, params.wall_mm * 0.55))
    face_h = max(0.7, min(params.front_mm, 1.6))
    flange_h = max(0.55, min(shell, 1.0))

    try:
        upper_opening = cavity.buffer(step, join_style=2, mitre_limit=2.5, resolution=16)
    except Exception:
        upper_opening = cavity
    upper_opening = clean_polygon(upper_opening)
    if upper_opening is None or upper_opening.is_empty:
        front = extrude_geom(inward_offset(geom, tol), face_h)
        return body, front

    diff_outer = clean_polygon(upper_opening.buffer(-tol, join_style=2, mitre_limit=2.5, resolution=16))
    if diff_outer is None or diff_outer.is_empty or diff_outer.area < geom.area * 0.05:
        diff_outer = inward_offset(geom, params.wall_mm - step + tol)
    if diff_outer is None or diff_outer.is_empty:
        front = extrude_geom(inward_offset(geom, tol), face_h)
        return body, front

    pocket_h = max(3.0, params.depth_mm - z_shelf - 0.8)
    shell_h = max(2.0, pocket_h - face_h)
    islands = split_diffuser_islands(diff_outer, min_area=max(4.0, shell * shell * 4))
    if not islands:
        islands = [diff_outer]

    parts: list[trimesh.Trimesh] = []
    for island in islands:
        diff_inner = inward_offset(island, shell)
        flange_inner = inward_offset(island, max(step * 0.9, shell * 1.1))

        if flange_inner is not None and not flange_inner.is_empty:
            flange_2d = ring_between(island, flange_inner, None)
            if flange_2d is not None and not flange_2d.is_empty and flange_2d.area > 0.15:
                parts.append(extrude_geom(flange_2d, flange_h))

        if diff_inner is not None and not diff_inner.is_empty:
            wall_2d = ring_between(island, diff_inner, None)
            if wall_2d is not None and not wall_2d.is_empty and wall_2d.area > 0.15:
                walls = extrude_geom(wall_2d, shell_h)
                walls = translate_mesh(walls, [0, 0, flange_h * 0.35])
                parts.append(walls)
        else:
            # Tiny accent: solid plate instead of hollow shell.
            solid = extrude_geom(island, max(face_h, flange_h + 0.4))
            parts.append(solid)
            continue

        face = extrude_geom(island, face_h)
        face = translate_mesh(face, [0, 0, flange_h * 0.35 + shell_h - face_h * 0.15])
        parts.append(face)

    if not parts:
        front = extrude_geom(diff_outer, face_h)
        return body, front

    try:
        front = union_meshes(parts)
    except Exception:
        front = trimesh.util.concatenate(parts)

    return body, front


def diffuser_preview_data(
    geom,
    cavity,
    *,
    depth_mm: float,
    front_mm: float,
    wall_mm: float,
    wall_profile: WallProfileParams | None = None,
    diffuser_shell_mm: float = 0.85,
    diffuser_tolerance_mm: float = 0.15,
) -> dict | None:
    """2D rings for printed-diffuser preview (multi-island aware)."""
    from engine.wall_profile import shelf_step_clamped, shelf_z_mm

    wp = wall_profile or WallProfileParams(profile_id="shelf")
    step = shelf_step_clamped(wall_mm, wp)
    z_shelf = shelf_z_mm(depth_mm, wp)
    tol = max(0.08, min(diffuser_tolerance_mm, 0.4))
    shell = max(0.65, min(diffuser_shell_mm, wall_mm * 0.55))
    face_h = max(0.7, min(front_mm, 1.6))

    try:
        upper_opening = cavity.buffer(step, join_style=2, mitre_limit=2.5, resolution=16)
    except Exception:
        return None
    upper_opening = clean_polygon(upper_opening)
    if upper_opening is None or upper_opening.is_empty:
        return None
    diff_outer = clean_polygon(upper_opening.buffer(-tol, join_style=2, mitre_limit=2.5, resolution=16))
    if diff_outer is None or diff_outer.is_empty:
        return None
    islands = split_diffuser_islands(diff_outer)
    diff_inner = inward_offset(diff_outer, shell)
    flange_inner = inward_offset(diff_outer, max(step * 0.9, shell * 1.1))
    flange_2d = ring_between(diff_outer, flange_inner, None) if flange_inner is not None else None
    wall_2d = ring_between(diff_outer, diff_inner, None) if diff_inner is not None else None

    def rings_payload(g):
        if g is None or g.is_empty:
            return {"outer": [], "holes": []}
        outer, holes = geometry_to_rings(g)
        return {"outer": outer, "holes": holes}

    pocket_h = max(3.0, depth_mm - z_shelf - 0.8)
    return {
        "enabled": True,
        "shelf_z": float(z_shelf),
        "pocket_height": float(pocket_h),
        "shell_mm": float(shell),
        "face_mm": float(face_h),
        "tolerance_mm": float(tol),
        "island_count": len(islands) if islands else 1,
        "outer": rings_payload(diff_outer),
        "inner": rings_payload(diff_inner),
        "flange": rings_payload(flange_2d),
        "shell_wall": rings_payload(wall_2d),
    }


def _apply_snap_fit(
    body: trimesh.Trimesh,
    geom,
    cavity,
    params: ProductParams,
    tight: bool = False,
) -> tuple[trimesh.Trimesh, trimesh.Trimesh]:
    """Receiving channel in the body, locking lip on the removable front."""
    tol = max(0.05 if tight else 0.08, params.snap_fit_tolerance_mm * (0.7 if tight else 1.0))
    depth_in_wall = min(params.snap_fit_depth_mm, max(0.5, params.wall_mm - 0.7))
    channel_h = max(1.0, min(2.2, params.front_mm + 0.4))
    front_tol = max(0.05, params.front_tolerance_mm)

    # Groove lives in the wall, just outside the cavity.
    groove_inner = cavity.buffer(front_tol * 0.5, join_style=2, mitre_limit=2.5)
    groove_outer = cavity.buffer(depth_in_wall, join_style=2, mitre_limit=2.5)
    groove_2d = ring_between(groove_outer, groove_inner, geom)

    lip_inner = cavity.buffer(tol, join_style=2, mitre_limit=2.5)
    lip_outer_2d = cavity.buffer(max(depth_in_wall - tol, tol * 2), join_style=2, mitre_limit=2.5)
    lip_2d = ring_between(lip_outer_2d, lip_inner, geom)

    front = extrude_geom(geom, params.front_mm)

    z_channel = params.depth_mm - channel_h - 0.8
    if z_channel < params.rear_wall + 1.0:
        z_channel = params.rear_wall + 1.0

    if not groove_2d.is_empty and groove_2d.area > 0.4:
        groove = extrude_geom(groove_2d, channel_h)
        groove = translate_mesh(groove, [0, 0, z_channel])
        try:
            body = difference_meshes(body, groove)
        except GeometryError:
            pass

    if not lip_2d.is_empty and lip_2d.area > 0.3:
        lip = extrude_geom(lip_2d, max(channel_h - tol, 0.7))
        # Lip hangs behind the front plate (negative Z in the front's local frame).
        lip = translate_mesh(lip, [0, 0, -max(channel_h - tol, 0.7)])
        try:
            front = union_meshes([front, lip])
        except Exception:
            front = trimesh.util.concatenate([front, lip])

    # Slight shrink of the front plate so it seats into the opening.
    inset = inward_offset(geom, front_tol * 0.35)
    if not inset.is_empty and inset.area > geom.area * 0.7:
        try:
            front_plate = extrude_geom(inset, params.front_mm)
            if not lip_2d.is_empty:
                lip = extrude_geom(lip_2d, max(channel_h - tol, 0.7))
                lip = translate_mesh(lip, [0, 0, -max(channel_h - tol, 0.7)])
                front = union_meshes([front_plate, lip])
            else:
                front = front_plate
        except Exception:
            pass

    return body, front


def sit_on_bed(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    out = mesh.copy()
    bounds = out.bounds
    out.apply_translation([-bounds[0][0], -bounds[0][1], -bounds[0][2]])
    return out


def cavity_rings(letter_geom, wall_mm: float):
    cavity = inward_offset(letter_geom, wall_mm)
    return cavity


def rear_wall_mm_for_style(wall_mm: float, depth_mm: float, rear_type: str, rear_wall_mm: float | None = None) -> float:
    if rear_type == "none":
        return 0.0
    if rear_type == "thin":
        return max(0.8, wall_mm * 0.5)
    if rear_type == "thick":
        return max(2.5, wall_mm * 1.8)
    if rear_wall_mm is not None:
        return max(0.8, rear_wall_mm)
    return max(1.2, min(wall_mm, depth_mm * 0.25))


def snap_fit_preview_data(
    geom,
    cavity,
    *,
    depth_mm: float,
    front_mm: float,
    wall_mm: float,
    rear_mm: float,
    front_mount: str,
    snap_fit_tolerance_mm: float = 0.25,
    snap_fit_depth_mm: float = 1.2,
    front_tolerance_mm: float = 0.25,
) -> dict | None:
    """2D rings and Z placement for snap-fit groove/lip preview (mirrors _apply_snap_fit)."""
    if front_mount not in ("snap-fit", "press-fit"):
        return None

    tight = front_mount == "press-fit"
    tol = max(0.05 if tight else 0.08, snap_fit_tolerance_mm * (0.7 if tight else 1.0))
    depth_in_wall = min(snap_fit_depth_mm, max(0.5, wall_mm - 0.7))
    channel_h = max(1.0, min(2.2, front_mm + 0.4))
    front_tol = max(0.05, front_tolerance_mm)

    groove_inner = cavity.buffer(front_tol * 0.5, join_style=2, mitre_limit=2.5)
    groove_outer = cavity.buffer(depth_in_wall, join_style=2, mitre_limit=2.5)
    groove_2d = ring_between(groove_outer, groove_inner, geom)

    lip_inner = cavity.buffer(tol, join_style=2, mitre_limit=2.5)
    lip_outer = cavity.buffer(max(depth_in_wall - tol, tol * 2), join_style=2, mitre_limit=2.5)
    lip_2d = ring_between(lip_outer, lip_inner, geom)

    inset = inward_offset(geom, front_tol * 0.35)

    z_channel = depth_mm - channel_h - 0.8
    if z_channel < rear_mm + 1.0:
        z_channel = rear_mm + 1.0

    lip_depth = max(channel_h - tol, 0.7)

    def rings_payload(poly):
        if poly is None or poly.is_empty:
            return {"outer": [], "holes": []}
        outer, holes = geometry_to_rings(poly)
        return {"outer": outer, "holes": holes}

    inset_outer, inset_holes = ([], [])
    if not inset.is_empty and inset.area > geom.area * 0.7:
        inset_outer, inset_holes = geometry_to_rings(inset)

    return {
        "enabled": True,
        "tight": tight,
        "channel_z": float(z_channel),
        "channel_height": float(channel_h),
        "lip_depth": float(lip_depth),
        "groove": rings_payload(groove_2d),
        "lip": rings_payload(lip_2d),
        "front_inset": {"outer": inset_outer, "holes": inset_holes},
    }


def support_ribs_preview(
    bounds: tuple[float, float, float, float],
    supports: int,
    rear_mm: float,
    depth_mm: float,
    wall_mm: float,
) -> list[dict]:
    if supports <= 0:
        return []
    minx, miny, maxx, maxy = bounds
    cx = (minx + maxx) / 2.0
    rib_w = max(1.2, wall_mm * 0.8)
    rib_h = depth_mm - rear_mm - 1.5
    if rib_h < 2:
        return []
    span_y = (maxy - miny) * 0.6
    cy = (miny + maxy) / 2.0
    positions = [cx] if supports == 1 else [minx + (maxx - minx) * 0.33, minx + (maxx - minx) * 0.67]
    return [
        {
            "x": float(px),
            "y": float(cy),
            "width": float(rib_w),
            "height": float(span_y),
            "z": float(rear_mm + rib_h / 2.0),
            "depth": float(rib_h),
        }
        for px in positions[:supports]
    ]


def counter_bridges_preview(letter_geom, cavity) -> dict | None:
    counter = _counter_bridge_rings(letter_geom, cavity)
    if counter is None or counter.is_empty:
        return None
    outer, holes = geometry_to_rings(counter)
    if not outer:
        return None
    return {"outer": outer, "holes": holes}

