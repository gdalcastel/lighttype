"""Mounting hole boolean operations on letter bodies."""

from __future__ import annotations

from dataclasses import dataclass

import trimesh
from shapely.geometry import box


@dataclass
class MountingHoleSpec:
    x: float
    y: float
    width_mm: float = 4.0
    length_mm: float = 4.0
    depth_mm: float = 6.0
    corner_radius_mm: float = 2.0
    shape: str = "circle"  # circle | rect
    face: str = "back"  # back | body
    name: str | None = None

    @classmethod
    def from_dict(cls, data: dict) -> "MountingHoleSpec":
        shape = str(data.get("shape", "circle"))
        width = float(data.get("width_mm", data.get("diameter_mm", 4)))
        length = float(data.get("length_mm", data.get("diameter_mm", width)))
        corner = float(data.get("corner_radius_mm", 0))
        if shape == "circle" or data.get("diameter_mm") is not None and "width_mm" not in data:
            shape = "circle"
            width = float(data.get("width_mm", data.get("diameter_mm", 4)))
            length = width
            corner = width / 2.0
        elif corner <= 0:
            corner = 0.0
        return cls(
            x=float(data["x"]),
            y=float(data["y"]),
            width_mm=max(1.0, width),
            length_mm=max(1.0, length),
            depth_mm=float(data.get("depth_mm", 6)),
            corner_radius_mm=max(0.0, corner),
            shape=shape,
            face=str(data.get("face", "back")),
            name=data.get("name"),
        )


def _is_circular(hole: MountingHoleSpec) -> bool:
    if hole.shape == "circle":
        return True
    w, l = hole.width_mm, hole.length_mm
    r = hole.corner_radius_mm
    return abs(w - l) < 0.05 and r >= min(w, l) / 2.0 - 0.05


def _rounded_rect_polygon(width: float, length: float, radius: float):
    w, l = max(1.0, width), max(1.0, length)
    r = max(0.0, min(radius, w / 2.0, l / 2.0))
    if r <= 0.05:
        return box(-w / 2.0, -l / 2.0, w / 2.0, l / 2.0)
    inner = box(-w / 2.0 + r, -l / 2.0 + r, w / 2.0 - r, l / 2.0 - r)
    return inner.buffer(r, resolution=10)


def _cylinder_at(x: float, y: float, z_center: float, radius: float, height: float) -> trimesh.Trimesh:
    cyl = trimesh.creation.cylinder(radius=radius, height=height, sections=24)
    cyl.apply_translation([x, y, z_center])
    return cyl


def _prism_at(
    x: float,
    y: float,
    z_center: float,
    width: float,
    length: float,
    height: float,
    corner_radius: float,
) -> trimesh.Trimesh:
    poly = _rounded_rect_polygon(width, length, corner_radius)
    prism = trimesh.creation.extrude_polygon(poly, height)
    prism.apply_translation([x, y, z_center - height / 2.0])
    return prism


def _hole_cutter(hole: MountingHoleSpec, depth: float, rear_wall: float) -> trimesh.Trimesh:
    h = max(1.0, min(hole.depth_mm, depth))
    if hole.face == "back":
        z = rear_wall / 2.0
    else:
        z = depth / 2.0
    cutter_h = h + 0.4
    if _is_circular(hole):
        r = max(0.8, hole.width_mm / 2.0)
        return _cylinder_at(hole.x, hole.y, z, r, cutter_h)
    return _prism_at(
        hole.x,
        hole.y,
        z,
        hole.width_mm,
        hole.length_mm,
        cutter_h,
        hole.corner_radius_mm,
    )


def apply_mounting_holes(
    body: trimesh.Trimesh,
    holes: list[MountingHoleSpec],
    depth: float,
    rear_wall: float,
) -> trimesh.Trimesh:
    if not holes:
        return body
    from engine.product_geometry import difference_meshes

    result = body
    for hole in holes:
        cutter = _hole_cutter(hole, depth, rear_wall)
        try:
            result = difference_meshes(result, cutter)
        except Exception:
            continue
    return result
