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

from engine.catalog import PlugProfile
from engine.errors import GeometryError, friendly_from_exception
from engine.font_geometry import clean_polygon, iter_polygons

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

    @property
    def rear_wall(self) -> float:
        if self.rear_wall_mm is not None:
            return max(0.8, self.rear_wall_mm)
        return max(1.2, min(self.wall_mm, self.depth_mm * 0.25))


def inward_offset(geom, distance: float):
    if distance <= 0:
        return geom
    offset = geom.buffer(-distance, join_style=2, mitre_limit=2.8, resolution=16)
    offset = clean_polygon(offset)
    if offset is None or offset.is_empty:
        return Polygon()
    return offset


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
            "We couldn't create this letter at the current size.",
            suggestion="Try increasing the letter height or reducing the wall thickness.",
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
            "We couldn't create this letter at the current size.",
            suggestion="Try a simpler font or a larger letter height.",
        )
    return union_meshes(meshes)


def union_meshes(meshes: list[trimesh.Trimesh]) -> trimesh.Trimesh:
    meshes = [m for m in meshes if m is not None and len(m.faces) > 0]
    if not meshes:
        raise GeometryError("We couldn't combine the parts of this letter.")
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
            "We couldn't create this letter at the current size.",
            suggestion="Try increasing the letter height or reducing the wall thickness.",
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
) -> trimesh.Trimesh:
    profile = params.plug_profile
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
) -> tuple[trimesh.Trimesh, trimesh.Trimesh]:
    try:
        return _build_body_and_front(letter_geom, char, params)
    except GeometryError:
        raise
    except Exception as exc:
        raise friendly_from_exception(exc, letter=char) from exc


def _build_body_and_front(
    letter_geom,
    char: str,
    params: ProductParams,
) -> tuple[trimesh.Trimesh, trimesh.Trimesh]:
    geom = simplify_geom(letter_geom, SIMPLIFY_STL)
    if geom.is_empty:
        raise GeometryError(
            f"We couldn't create the letter “{char}” at the current size.",
            suggestion="Try increasing the letter height or choosing another font.",
            letter=char,
        )

    wall = params.wall_mm
    depth = params.depth_mm
    rear = params.rear_wall
    if depth <= rear + 2.0:
        raise GeometryError(
            "The letter is too shallow for a hollow interior.",
            suggestion="Increase the depth or reduce the wall thickness.",
            letter=char,
        )

    cavity = inward_offset(geom, wall)
    if cavity.is_empty or cavity.area < geom.area * 0.08:
        raise GeometryError(
            f"The letter “{char}” is too thin to hollow at this wall thickness.",
            suggestion="Increase the letter height or reduce the wall thickness.",
            letter=char,
        )

    walls_2d = clean_polygon(geom.difference(cavity))
    if walls_2d.is_empty:
        raise GeometryError(
            f"We couldn't hollow the letter “{char}”.",
            suggestion="Try a larger height or a thinner wall.",
            letter=char,
        )

    walls = extrude_geom(walls_2d, depth)
    rear_cap = extrude_geom(geom, rear)
    body = union_meshes([walls, rear_cap])

    if params.front_mount == "snap-fit":
        body, front = _apply_snap_fit(body, geom, cavity, params)
    else:
        front = extrude_geom(geom, params.front_mm)

    body = attach_plug(body, geom, params)
    return body, front


def _apply_snap_fit(
    body: trimesh.Trimesh,
    geom,
    cavity,
    params: ProductParams,
) -> tuple[trimesh.Trimesh, trimesh.Trimesh]:
    """Receiving channel in the body, locking lip on the removable front."""
    tol = max(0.08, params.snap_fit_tolerance_mm)
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
