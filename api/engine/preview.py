"""Lightweight preview payload: 2D contours in millimetres for the Three.js viewer."""

from __future__ import annotations

from engine.errors import GeometryError
from engine.font_geometry import geometry_to_rings, layout_text, unsupported_characters
from engine.product_geometry import cavity_rings, simplify_geom


def build_preview(
    text: str,
    font_id: str,
    height_mm: float,
    wall_mm: float,
    spacing_mm: float,
) -> dict:
    letters_in = layout_text(font_id, text, height_mm, spacing_mm)
    letters_out = []
    min_x = min_y = 1e9
    max_x = max_y = -1e9

    for glyph in letters_in:
        geom = simplify_geom(glyph.geometry, 0.16)
        cavity = cavity_rings(geom, wall_mm)
        cavity = simplify_geom(cavity, 0.16) if not cavity.is_empty else cavity
        outer, holes = geometry_to_rings(geom)
        inner, inner_holes = geometry_to_rings(cavity) if not cavity.is_empty else ([], [])
        minx, miny, maxx, maxy = geom.bounds
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
                "outer": outer,
                "holes": holes,
                "inner": inner,
                "inner_holes": inner_holes,
                "has_cavity": bool(inner),
            }
        )

    if not letters_out:
        raise GeometryError("Type a name, word or phrase to get started.")

    return {
        "text": text,
        "font_id": font_id,
        "height_mm": height_mm,
        "wall_mm": wall_mm,
        "spacing_mm": spacing_mm,
        "letters": letters_out,
        "layout_width": float(max_x - min_x),
        "layout_height": float(max_y - min_y),
        "bounds": [float(min_x), float(min_y), float(max_x), float(max_y)],
        "unsupported": unsupported_characters(font_id, text),
        "letter_count": len(letters_out),
    }
