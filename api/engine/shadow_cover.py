"""Unified rear shadow cover joining all letters with an adjustable border offset."""

from __future__ import annotations

from dataclasses import dataclass

from shapely.geometry import Polygon
from shapely.ops import unary_union

from engine.font_geometry import _as_polygons, clean_polygon, geometry_to_rings


@dataclass
class ShadowCoverParams:
    enabled: bool = False
    offset_mm: float = 3.0

    @classmethod
    def from_dict(cls, data: dict | None) -> ShadowCoverParams:
        if not data:
            return cls()
        return cls(
            enabled=bool(data.get("shadow_enabled", False)),
            offset_mm=float(data.get("shadow_offset_mm", 3.0)),
        )


def _collect_letter_shapes(glyphs) -> list:
    shapes = []
    for glyph in glyphs:
        geom = glyph.cavity_source
        if geom is not None and not geom.is_empty:
            shapes.append(geom)
    return shapes


def _unified_outer_envelope(letter_shapes: list, offset: float):
    """One connected outer plate spanning every letter (incl. multi-line gaps)."""
    pads = unary_union([shape.buffer(offset, join_style=2) for shape in letter_shapes])
    pads = clean_polygon(pads)
    if pads.is_empty:
        return pads

    parts = list(_as_polygons(pads))
    if len(parts) <= 1:
        return pads

    unioned = clean_polygon(unary_union(letter_shapes))
    hull = clean_polygon(unioned.convex_hull.buffer(offset, join_style=2))
    return clean_polygon(unary_union([pads, hull]))


def _frame_with_letter_holes(outer_geom, letter_shapes: list):
    """Outer plate with a cutout for each letter at its layout position."""
    outer_polys = _as_polygons(outer_geom)
    if not outer_polys:
        return outer_geom

    framed: list[Polygon] = []
    for outer in outer_polys:
        interior_rings = []
        for letter in letter_shapes:
            for letter_poly in _as_polygons(letter):
                try:
                    pt = letter_poly.representative_point()
                except Exception:
                    continue
                if not outer.contains(pt):
                    continue
                interior_rings.append(letter_poly.exterior.coords)
        framed.append(Polygon(outer.exterior.coords, interior_rings))

    if not framed:
        return outer_geom
    if len(framed) == 1:
        return clean_polygon(framed[0])
    return clean_polygon(unary_union(framed))


def build_shadow_shape(glyphs, params: ShadowCoverParams):
    """Unified cover plate with per-letter fitting cutouts and an adjustable border."""
    if not params.enabled or not glyphs:
        return None

    letter_shapes = _collect_letter_shapes(glyphs)
    if not letter_shapes:
        return None

    offset = max(0.5, params.offset_mm)
    outer = _unified_outer_envelope(letter_shapes, offset)
    if outer is None or outer.is_empty:
        return None

    framed = _frame_with_letter_holes(outer, letter_shapes)
    if framed is None or framed.is_empty:
        return None
    return framed


def shadow_preview_rings(glyphs, params: ShadowCoverParams) -> dict | None:
    """2D rings for the unified shadow cover preview."""
    shape = build_shadow_shape(glyphs, params)
    if shape is None:
        return None
    outer, holes = geometry_to_rings(shape)
    return {"outer": outer, "holes": holes}


def build_shadow_mesh(glyphs, params: ShadowCoverParams, depth_mm: float):
    """Extrude the unified shadow cover for STL export."""
    from engine.product_geometry import extrude_geom, sit_on_bed

    shape = build_shadow_shape(glyphs, params)
    if shape is None or depth_mm <= 0:
        return None
    mesh = extrude_geom(shape, depth_mm)
    return sit_on_bed(mesh)
