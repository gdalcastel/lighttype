"""FONT GEOMETRY: typeface → glyph → vector path → 2D contour.

Independent from hollow bodies, snap-fits and mounting plugs.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from shapely.affinity import scale as shp_scale, translate as shp_translate
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely.validation import make_valid

from engine.catalog import FontSpec, get_font
from engine.errors import GeometryError, UnsupportedCharacterError

Point = tuple[float, float]


class FlatteningPen(BasePen):
    """Records glyph outlines as polylines, flattening Bézier curves."""

    def __init__(self, glyph_set, tolerance: float = 0.75):
        super().__init__(glyph_set)
        self.tolerance = tolerance
        self.contours: list[list[Point]] = []
        self._current: list[Point] = []

    def _moveTo(self, pt):
        self._close_current()
        self._current = [tuple(pt)]

    def _lineTo(self, pt):
        self._current.append(tuple(pt))

    def _curveToOne(self, p1, p2, p3):
        start = self._current[-1]
        self._flatten_cubic(start, tuple(p1), tuple(p2), tuple(p3))

    def _qCurveToOne(self, p1, p2):
        start = self._current[-1]
        self._flatten_quadratic(start, tuple(p1), tuple(p2))

    def _closePath(self):
        self._close_current()

    def _endPath(self):
        self._close_current()

    def _close_current(self):
        if len(self._current) >= 3:
            pts = _dedupe_ring(self._current)
            if len(pts) >= 3:
                self.contours.append(pts)
        self._current = []

    def _flatten_cubic(self, p0, p1, p2, p3, depth: int = 0):
        if depth > 10 or _cubic_flat(p0, p1, p2, p3, self.tolerance):
            self._current.append(p3)
            return
        p01 = _mid(p0, p1)
        p12 = _mid(p1, p2)
        p23 = _mid(p2, p3)
        p012 = _mid(p01, p12)
        p123 = _mid(p12, p23)
        p0123 = _mid(p012, p123)
        self._flatten_cubic(p0, p01, p012, p0123, depth + 1)
        self._flatten_cubic(p0123, p123, p23, p3, depth + 1)

    def _flatten_quadratic(self, p0, p1, p2, depth: int = 0):
        if depth > 10 or _quad_flat(p0, p1, p2, self.tolerance):
            self._current.append(p2)
            return
        p01 = _mid(p0, p1)
        p12 = _mid(p1, p2)
        p012 = _mid(p01, p12)
        self._flatten_quadratic(p0, p01, p012, depth + 1)
        self._flatten_quadratic(p012, p12, p2, depth + 1)


def _mid(a: Point, b: Point) -> Point:
    return ((a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5)


def _dist2(a: Point, b: Point) -> float:
    dx, dy = a[0] - b[0], a[1] - b[1]
    return dx * dx + dy * dy


def _cubic_flat(p0, p1, p2, p3, tol: float) -> bool:
    tol2 = tol * tol
    return _point_to_seg2(p1, p0, p3) <= tol2 and _point_to_seg2(p2, p0, p3) <= tol2


def _quad_flat(p0, p1, p2, tol: float) -> bool:
    return _point_to_seg2(p1, p0, p2) <= tol * tol


def _point_to_seg2(p, a, b) -> float:
    vx, vy = b[0] - a[0], b[1] - a[1]
    wx, wy = p[0] - a[0], p[1] - a[1]
    c2 = vx * vx + vy * vy
    if c2 < 1e-12:
        return wx * wx + wy * wy
    t = max(0.0, min(1.0, (wx * vx + wy * vy) / c2))
    dx = a[0] + t * vx - p[0]
    dy = a[1] + t * vy - p[1]
    return dx * dx + dy * dy


def _dedupe_ring(pts: list[Point], eps: float = 1e-4) -> list[Point]:
    out: list[Point] = []
    for p in pts:
        if not out or _dist2(out[-1], p) > eps * eps:
            out.append(p)
    if len(out) >= 2 and _dist2(out[0], out[-1]) <= eps * eps:
        out.pop()
    return out


@lru_cache(maxsize=32)
def _font_cmap_for_id(font_id: str) -> dict[int, str]:
    """Cached cmap lookup — safe to share across threads."""
    spec = get_font(font_id)
    if not spec.path.exists():
        raise GeometryError(
            "This style isn’t available right now.",
            suggestion="Choose another font and try again.",
        )
    with TTFont(str(spec.path)) as font:
        return font.getBestCmap() or {}


@lru_cache(maxsize=32)
def _font_cap_height_for_id(font_id: str) -> float:
    spec = get_font(font_id)
    with TTFont(str(spec.path)) as font:
        os2 = font["OS/2"]
        cap = float(getattr(os2, "sCapHeight", 0) or 0)
        if cap > 0:
            return cap
        hhea = font["hhea"]
        return max(float(hhea.ascent) * 0.72, 1.0)


@lru_cache(maxsize=32)
def _font_units_per_em_for_id(font_id: str) -> float:
    spec = get_font(font_id)
    with TTFont(str(spec.path)) as font:
        return float(font["head"].unitsPerEm)


def load_font(font_id: str) -> TTFont:
    """Open a fresh font handle per call — fontTools TTFont is not thread-safe."""
    spec = get_font(font_id)
    if not spec.path.exists():
        raise GeometryError(
            "This style isn’t available right now.",
            suggestion="Choose another font and try again.",
        )
    return TTFont(str(spec.path))


def font_cmap(font: TTFont) -> dict[int, str]:
    return font.getBestCmap() or {}


def cap_height(font: TTFont) -> float:
    os2 = font["OS/2"]
    cap = float(getattr(os2, "sCapHeight", 0) or 0)
    if cap > 0:
        return cap
    hhea = font["hhea"]
    ascent = float(hhea.ascent)
    return max(ascent * 0.72, 1.0)


def units_per_em(font: TTFont) -> float:
    return float(font["head"].unitsPerEm)


def scale_for_height(font_id: str, height_mm: float) -> float:
    return height_mm / _font_cap_height_for_id(font_id)


def supported_codepoint(font_id: str, char: str) -> bool:
    if char == " ":
        return True
    return ord(char) in _font_cmap_for_id(font_id)


def unsupported_characters(font_id: str, text: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for ch in text:
        if ch in seen or ch == "\n" or ch == "\r" or ch == "\t":
            continue
        if not supported_codepoint(font_id, ch):
            found.append(ch)
            seen.add(ch)
    return found


def iter_polygons(geom):
    if geom is None or geom.is_empty:
        return
    t = geom.geom_type
    if t == "Polygon":
        if geom.area > 1e-10:
            yield geom
    elif t in ("MultiPolygon", "GeometryCollection"):
        for g in geom.geoms:
            yield from iter_polygons(g)


def clean_polygon(geom):
    if geom is None or geom.is_empty:
        return geom
    geom = make_valid(geom)
    geom = geom.buffer(0)
    polys = [orient(p, sign=1.0) for p in iter_polygons(geom) if p.area > 1e-10]
    if not polys:
        return Polygon()
    if len(polys) == 1:
        return polys[0]
    return unary_union(polys)


def _as_polygons(geom) -> list:
    if geom is None or geom.is_empty:
        return []
    if not geom.is_valid:
        geom = make_valid(geom)
    geom = geom.buffer(0)
    return [p for p in iter_polygons(geom) if p.area > 1e-8]


def _filter_tiny_holes(poly: Polygon, min_ratio: float = 0.08) -> Polygon:
    """Drop spurious micro-loops from font outlines (common on R, B, P, etc.)."""
    if not poly.interiors:
        return poly
    hole_areas = [Polygon(interior).area for interior in poly.interiors]
    max_area = max(hole_areas)
    if max_area <= 0:
        return poly
    keep = [
        interior
        for interior, area in zip(poly.interiors, hole_areas, strict=True)
        if area >= max_area * min_ratio
    ]
    if len(keep) == len(poly.interiors):
        return poly
    return Polygon(poly.exterior.coords, keep)


def _contains(outer, inner) -> bool:
    try:
        pt = inner.representative_point()
        if not outer.contains(pt):
            return False
        # Strict interior: most of the inner area lies inside the outer.
        overlap = outer.intersection(inner).area
        return overlap >= inner.area * 0.92
    except Exception:
        return False


def contours_to_geometry(contours: list[list[Point]]):
    """Nest contours by containment.

    Contours fully inside another become holes (or islands at even depth).
    Overlapping same-level contours are unioned — the usual TrueType
    construction for bars, spurs and the letter G.
    """
    pieces: list = []
    for ring in contours:
        if len(ring) < 3:
            continue
        coords = list(ring)
        if coords[0] != coords[-1]:
            coords = coords + [coords[0]]
        try:
            poly = Polygon(coords)
        except Exception:
            continue
        if poly.is_empty or poly.area < 1e-8:
            continue
        pieces.extend(_as_polygons(poly))

    if not pieces:
        return Polygon()

    pieces.sort(key=lambda p: p.area, reverse=True)
    parent_of = {i: None for i in range(len(pieces))}
    for i, inner in enumerate(pieces):
        best = None
        best_area = float("inf")
        for j, outer in enumerate(pieces):
            if i == j or outer.area <= inner.area:
                continue
            if _contains(outer, inner) and outer.area < best_area:
                best = j
                best_area = outer.area
        parent_of[i] = best

    def depth(i: int) -> int:
        d = 0
        seen = set()
        cur = i
        while parent_of[cur] is not None and cur not in seen:
            seen.add(cur)
            cur = parent_of[cur]
            d += 1
        return d

    fills = []
    for i, poly in enumerate(pieces):
        if depth(i) % 2 == 1:
            continue
        hole_rings = []
        for h, child in enumerate(pieces):
            if parent_of[h] == i and depth(h) % 2 == 1:
                hole_rings.append(list(child.exterior.coords))
        try:
            built = Polygon(list(poly.exterior.coords), hole_rings)
        except Exception:
            built = poly
        built = _filter_tiny_holes(built)
        fills.extend(_as_polygons(built))

    if not fills:
        return Polygon()
    if len(fills) == 1:
        return clean_polygon(fills[0])
    return clean_polygon(unary_union(fills))


def glyph_geometry(font_id: str, char: str):
    cmap = _font_cmap_for_id(font_id)
    code = ord(char)
    if code not in cmap:
        raise UnsupportedCharacterError(
            f"“{char}” isn’t available in this font.",
            suggestion="Remove this character or choose another font.",
            letter=char,
        )
    name = cmap[code]
    font = load_font(font_id)
    glyph_set = font.getGlyphSet()
    if name not in glyph_set:
        raise UnsupportedCharacterError(
            f"“{char}” isn’t available in this font.",
            suggestion="Remove this character or choose another font.",
            letter=char,
        )
    upm = _font_units_per_em_for_id(font_id)
    tolerance = max(0.6, upm / 1400.0)
    pen = FlatteningPen(glyph_set, tolerance=tolerance)
    glyph_set[name].draw(pen)
    geom = contours_to_geometry(pen.contours)
    if geom.is_empty:
        raise GeometryError(
            f"We couldn’t read the outline for “{char}”.",
            suggestion="Try another font or a different character.",
            letter=char,
        )
    return geom


def geometry_to_rings(geom) -> tuple[list[list[list[float]]], list[list[list[float]]]]:
    outers: list[list[list[float]]] = []
    holes: list[list[list[float]]] = []
    for poly in iter_polygons(geom):
        outers.append([[float(x), float(y)] for x, y in poly.exterior.coords[:-1]])
        for interior in poly.interiors:
            holes.append([[float(x), float(y)] for x, y in interior.coords[:-1]])
    return outers, holes


@dataclass
class LaidOutGlyph:
    char: str
    index: int
    geometry: object
    bounds: tuple[float, float, float, float]
    glyph_bounds: tuple[float, float, float, float]
    x: float
    width: float
    height: float
    letter_geometry: object | None = None

    @property
    def cavity_source(self):
        """Letter body without the connection base — used to avoid hollowing the base strip."""
        return self.letter_geometry if self.letter_geometry is not None else self.geometry


def layout_text(
    font_id: str,
    text: str,
    height_mm: float,
    spacing_mm: float,
    *,
    base_params=None,
    line_spacing_mm: float | None = None,
) -> list[LaidOutGlyph]:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    unsupported = unsupported_characters(font_id, normalized)
    if unsupported:
        shown = " ".join(unsupported[:8])
        raise UnsupportedCharacterError(
            f"This font doesn’t include: {shown}",
            suggestion="Remove those characters or pick another style.",
        )
    scale = scale_for_height(font_id, height_mm)
    space_width = height_mm * 0.32
    line_gap = line_spacing_mm if line_spacing_mm is not None else max(2.0, height_mm * 0.2)
    line_step = height_mm + line_gap
    x = 0.0
    line_index = 0
    letters: list[LaidOutGlyph] = []
    printable_index = 0
    for ch in normalized:
        if ch == " ":
            x += space_width
            continue
        if ch == "\n":
            x = 0.0
            line_index += 1
            continue
        if ch == "\t":
            x += space_width * 4
            continue
        geom = glyph_geometry(font_id, ch)
        geom = shp_scale(geom, xfact=scale, yfact=scale, origin=(0, 0))
        minx, miny, maxx, maxy = geom.bounds
        y_base = -line_index * line_step
        geom = shp_translate(geom, xoff=x - minx, yoff=y_base - miny)
        minx, miny, maxx, maxy = geom.bounds
        glyph_bounds = (minx, miny, maxx, maxy)
        width = maxx - minx
        letter_geom = geom

        if base_params is not None and getattr(base_params, "enabled", False):
            from dataclasses import replace

            from engine.connection_base import add_connection_base

            effective_base = replace(base_params, spacing_mm=spacing_mm)
            geom = add_connection_base(geom, effective_base, glyph_bounds=glyph_bounds)

        full_bounds = geom.bounds
        letters.append(
            LaidOutGlyph(
                char=ch,
                index=printable_index,
                geometry=geom,
                bounds=full_bounds,
                glyph_bounds=glyph_bounds,
                x=minx,
                width=width,
                height=glyph_bounds[3] - glyph_bounds[1],
                letter_geometry=letter_geom if letter_geom is not geom else None,
            )
        )
        printable_index += 1
        x = glyph_bounds[2] + spacing_mm
    if not letters:
        raise GeometryError(
            "Type a name, word or phrase to get started.",
            suggestion="Letters, numbers and punctuation are supported when the font includes them.",
        )
    return letters
