"""Parse SVG path data into Shapely geometry for custom letter input."""

from __future__ import annotations

import math
import re
from xml.etree import ElementTree

from shapely.affinity import scale as shp_scale, translate as shp_translate
from shapely.geometry import Polygon
from shapely.ops import unary_union

from engine.errors import GeometryError
from engine.font_geometry import LaidOutGlyph, clean_polygon, contours_to_geometry

SVG_NS = {"svg": "http://www.w3.org/2000/svg"}


def _safe_float(value: str | float | int | None, default: float = 0.0) -> float | None:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _circle_contour(cx: float, cy: float, r: float, segments: int = 32) -> list[tuple[float, float]]:
    if r <= 0:
        return []
    return [
        (cx + r * math.cos(2 * math.pi * i / segments), cy + r * math.sin(2 * math.pi * i / segments))
        for i in range(segments)
    ]


def _tokenize_path(d: str) -> list:
    tokens = re.findall(r"[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)
    return tokens


def _parse_path(d: str) -> list[list[tuple[float, float]]]:
    tokens = _tokenize_path(d)
    contours: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    i = 0
    cmd = "M"
    cx, cy = 0.0, 0.0
    sx, sy = 0.0, 0.0

    def read_floats(n: int) -> list[float]:
        nonlocal i
        vals = []
        for _ in range(n):
            if i >= len(tokens):
                break
            vals.append(float(tokens[i]))
            i += 1
        return vals

    while i < len(tokens):
        t = tokens[i]
        if t.isalpha():
            cmd = t
            i += 1
            if cmd in "Zz":
                if len(current) >= 3:
                    contours.append(current)
                current = []
                cx, cy = sx, sy
            continue

        rel = cmd.islower()
        c = cmd.upper()

        if c == "M":
            vals = read_floats(2)
            if len(vals) < 2:
                break
            x, y = vals[0], vals[1]
            if rel:
                x += cx
                y += cy
            if len(current) >= 3:
                contours.append(current)
            current = [(x, y)]
            cx, cy = x, y
            sx, sy = x, y
            cmd = "L" if rel else "L"
        elif c == "L":
            vals = read_floats(2)
            if len(vals) < 2:
                break
            x, y = vals[0], vals[1]
            if rel:
                x += cx
                y += cy
            current.append((x, y))
            cx, cy = x, y
        elif c == "H":
            vals = read_floats(1)
            if not vals:
                break
            x = vals[0] + cx if rel else vals[0]
            current.append((x, cy))
            cx = x
        elif c == "V":
            vals = read_floats(1)
            if not vals:
                break
            y = vals[0] + cy if rel else vals[0]
            current.append((cx, y))
            cy = y
        elif c == "C":
            vals = read_floats(6)
            if len(vals) < 6:
                break
            x1, y1, x2, y2, x, y = vals
            if rel:
                x1 += cx
                y1 += cy
                x2 += cx
                y2 += cy
                x += cx
                y += cy
            steps = 8
            for s in range(1, steps + 1):
                t = s / steps
                u = 1 - t
                px = u**3 * cx + 3 * u**2 * t * x1 + 3 * u * t**2 * x2 + t**3 * x
                py = u**3 * cy + 3 * u**2 * t * y1 + 3 * u * t**2 * y2 + t**3 * y
                current.append((px, py))
            cx, cy = x, y
        else:
            i += 1

    if len(current) >= 3:
        contours.append(current)
    return contours


def _paths_from_svg(svg_content: str) -> list[list[tuple[float, float]]]:
    try:
        root = ElementTree.fromstring(svg_content)
    except ElementTree.ParseError as exc:
        raise GeometryError(
            "Couldn't read this SVG file.",
            suggestion="Use a simple SVG with path elements.",
        ) from exc

    all_contours: list[list[tuple[float, float]]] = []
    for elem in root.iter():
        tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
        if tag == "path":
            d = elem.get("d")
            if d:
                all_contours.extend(_parse_path(d))
        elif tag == "polygon":
            pts = elem.get("points", "")
            nums = []
            for v in re.findall(r"[-+]?(?:\d*\.\d+|\d+)", pts):
                parsed = _safe_float(v)
                if parsed is not None:
                    nums.append(parsed)
            if len(nums) >= 6:
                ring = [(nums[i], nums[i + 1]) for i in range(0, len(nums) - 1, 2)]
                if len(ring) >= 3:
                    all_contours.append(ring)
        elif tag == "rect":
            x = _safe_float(elem.get("x", 0), 0.0)
            y = _safe_float(elem.get("y", 0), 0.0)
            w = _safe_float(elem.get("width", 0), 0.0)
            h = _safe_float(elem.get("height", 0), 0.0)
            if x is None or y is None or w is None or h is None:
                continue
            if w > 0 and h > 0:
                all_contours.append([(x, y), (x + w, y), (x + w, y + h), (x, y + h)])
        elif tag == "circle":
            cx = _safe_float(elem.get("cx", 0), 0.0)
            cy = _safe_float(elem.get("cy", 0), 0.0)
            r = _safe_float(elem.get("r", 0), 0.0)
            if cx is None or cy is None or r is None:
                continue
            ring = _circle_contour(cx, cy, r)
            if len(ring) >= 3:
                all_contours.append(ring)
        elif tag == "ellipse":
            cx = _safe_float(elem.get("cx", 0), 0.0)
            cy = _safe_float(elem.get("cy", 0), 0.0)
            rx = _safe_float(elem.get("rx", 0), 0.0)
            ry = _safe_float(elem.get("ry", 0), 0.0)
            if cx is None or cy is None or rx is None or ry is None or rx <= 0 or ry <= 0:
                continue
            segments = 32
            ring = [
                (cx + rx * math.cos(2 * math.pi * i / segments), cy + ry * math.sin(2 * math.pi * i / segments))
                for i in range(segments)
            ]
            all_contours.append(ring)

    return all_contours


def layout_svg(svg_content: str, height_mm: float, spacing_mm: float = 0) -> list[LaidOutGlyph]:
    contours = _paths_from_svg(svg_content)
    if not contours:
        raise GeometryError(
            "No shapes found in the SVG.",
            suggestion="Add path, polygon or rect elements.",
        )
    geom = contours_to_geometry(contours)
    geom = clean_polygon(geom)
    if geom.is_empty:
        raise GeometryError(
            "Couldn't build geometry from the SVG.",
            suggestion="Check that paths are closed.",
        )
    minx, miny, maxx, maxy = geom.bounds
    current_h = maxy - miny
    if current_h < 1e-6:
        raise GeometryError("SVG has zero height.", suggestion="Check the viewBox or path coordinates.")
    scale = height_mm / current_h
    geom = shp_scale(geom, xfact=scale, yfact=scale, origin=(0, 0))
    geom = shp_translate(geom, xoff=-geom.bounds[0], yoff=-geom.bounds[1])
    minx, miny, maxx, maxy = geom.bounds
    glyph_bounds = (minx, miny, maxx, maxy)
    return [
        LaidOutGlyph(
            char="SVG",
            index=0,
            geometry=geom,
            bounds=glyph_bounds,
            glyph_bounds=glyph_bounds,
            x=minx,
            width=maxx - minx,
            height=maxy - miny,
        )
    ]
