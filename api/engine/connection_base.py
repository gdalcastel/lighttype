"""Connection base (tab) with snap or modular side connectors for joining letters."""

from __future__ import annotations

from dataclasses import dataclass

import trimesh
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from engine.font_geometry import clean_polygon


@dataclass
class ConnectionBaseParams:
    enabled: bool = False
    height_mm: float = 12.0
    connector_width_mm: float = 8.0
    position: str = "bottom"  # bottom | top
    connector_tolerance_mm: float = 0.3
    spacing_mm: float = 0.0
    # snap = male/female integrated; modular = dual sockets + separate STLs
    mode: str = "snap"

    @property
    def is_modular(self) -> bool:
        return self.enabled and self.mode == "modular"

    @classmethod
    def from_dict(cls, data: dict | None) -> ConnectionBaseParams:
        if not data:
            return cls()
        mode = str(data.get("base_mode", data.get("mode", "snap"))).lower()
        if mode not in ("snap", "modular"):
            mode = "snap"
        return cls(
            enabled=bool(data.get("base_enabled", False)),
            height_mm=float(data.get("base_height_mm", 12.0)),
            connector_width_mm=float(data.get("base_connector_width_mm", 8.0)),
            position=str(data.get("base_position", "bottom")),
            connector_tolerance_mm=float(data.get("base_connector_tolerance_mm", 0.3)),
            spacing_mm=float(data.get("spacing_mm", 0.0)),
            mode=mode,
        )


def _base_y_range(miny: float, maxy: float, params: ConnectionBaseParams) -> tuple[float, float]:
    h = max(2.0, params.height_mm)
    if params.position == "top":
        return maxy, maxy + h
    return miny - h, miny


def _connector_dims(params: ConnectionBaseParams) -> tuple[float, float]:
    cw = max(3.0, params.connector_width_mm)
    tol = max(0.1, min(params.connector_tolerance_mm, cw * 0.4))
    return cw, tol


def _connector_y_range(y0: float, y1: float, tol: float) -> tuple[float, float]:
    return y0 + tol, y1 - tol


def _tongue_width(cw: float) -> float:
    return max(3.2, cw * 0.58)


def _male_reach_x(maxx: float, spacing: float, tol: float) -> float:
    return maxx + max(0.0, spacing) - tol * 0.6


def _tunnel_band(cy0: float, cy1: float) -> tuple[float, float, float]:
    tunnel_h = max(3.0, (cy1 - cy0) * 0.55)
    tunnel_cy = (cy0 + cy1) / 2.0
    return tunnel_cy - tunnel_h / 2.0, tunnel_cy + tunnel_h / 2.0, tunnel_h


def _left_connector_wing(minx: float, y0: float, y1: float, cw: float, tol: float, cy0: float, cy1: float):
    """Female C-channel: open pocket on the left side to receive the male tongue."""
    th0, th1, _ = _tunnel_band(cy0, cy1)
    notch_depth = max(1.0, tol * 2.0)
    coords = [
        (minx - cw, y0),
        (minx - cw, th0),
        (minx - cw + notch_depth, th0),
        (minx - cw + notch_depth, th1),
        (minx - cw, th1),
        (minx - cw, y1),
        (minx, y1),
        (minx, cy1),
        (minx - tol, cy1),
        (minx - tol, cy0),
        (minx, cy0),
        (minx, y0),
    ]
    return clean_polygon(Polygon(coords))


def _right_socket_wing(maxx: float, y0: float, y1: float, cw: float, tol: float, cy0: float, cy1: float):
    """Female C-channel mirrored on the right (modular mode)."""
    th0, th1, _ = _tunnel_band(cy0, cy1)
    notch_depth = max(1.0, tol * 2.0)
    coords = [
        (maxx, y0),
        (maxx, cy0),
        (maxx + tol, cy0),
        (maxx + tol, cy1),
        (maxx, cy1),
        (maxx, y1),
        (maxx + cw, y1),
        (maxx + cw, th1),
        (maxx + cw - notch_depth, th1),
        (maxx + cw - notch_depth, th0),
        (maxx + cw, th0),
        (maxx + cw, y0),
    ]
    return clean_polygon(Polygon(coords))


def _right_connector_wing(
    maxx: float,
    y0: float,
    y1: float,
    cw: float,
    tol: float,
    cy0: float,
    cy1: float,
    spacing: float,
):
    """Male tongue: solid rib bridging spacing, with thin top/bottom bridges only."""
    reach = _male_reach_x(maxx, spacing, tol)
    tw = _tongue_width(cw)
    parts = [
        box(maxx - cw, y0, reach, cy0),
        box(maxx - cw, cy1, reach, y1),
        box(maxx - tw + tol * 0.4, cy0 + tol, reach, cy1 - tol),
    ]
    return clean_polygon(unary_union(parts))


def _female_pocket_bounds(
    minx: float,
    cw: float,
    tol: float,
    cy0: float,
    cy1: float,
) -> tuple[float, float, float, float]:
    return minx - cw + tol, cy0, minx - tol, cy1


def _right_pocket_bounds(
    maxx: float,
    cw: float,
    tol: float,
    cy0: float,
    cy1: float,
) -> tuple[float, float, float, float]:
    return maxx + tol, cy0, maxx + cw - tol, cy1


def _male_tongue_bounds(
    maxx: float,
    cw: float,
    tol: float,
    cy0: float,
    cy1: float,
    spacing: float,
) -> tuple[float, float, float, float]:
    tw = _tongue_width(cw)
    reach = _male_reach_x(maxx, spacing, tol)
    return maxx - tw + tol * 0.4, cy0 + tol, reach, cy1 - tol


def _side_tunnel_preview(
    minx: float,
    cw: float,
    tol: float,
    cy0: float,
    cy1: float,
):
    th0, th1, _ = _tunnel_band(cy0, cy1)
    notch_depth = max(1.0, tol * 2.0)
    return box(minx - cw, th0, minx - cw + notch_depth, th1)


def _right_tunnel_preview(
    maxx: float,
    cw: float,
    tol: float,
    cy0: float,
    cy1: float,
):
    th0, th1, _ = _tunnel_band(cy0, cy1)
    notch_depth = max(1.0, tol * 2.0)
    return box(maxx + cw - notch_depth, th0, maxx + cw, th1)


def side_wall_wire_slots(
    glyph_bounds: tuple[float, float, float, float],
    params: ConnectionBaseParams,
):
    """Open female wall(s) so the cavity reaches the receiving pocket."""
    if not params.enabled:
        return None
    minx, miny, maxx, maxy = glyph_bounds
    y0, y1 = _base_y_range(miny, maxy, params)
    cw, tol = _connector_dims(params)
    cy0, cy1 = _connector_y_range(y0, y1, tol)
    th0, th1, _ = _tunnel_band(cy0, cy1)
    left = box(minx - cw, th0, minx, th1)
    if params.is_modular:
        right = box(maxx, th0, maxx + cw, th1)
        return clean_polygon(unary_union([left, right]))
    return left


def build_base_shapes(
    glyph_bounds: tuple[float, float, float, float],
    params: ConnectionBaseParams,
):
    """Build the base strip with side connectors (snap or modular sockets)."""
    minx, miny, maxx, maxy = glyph_bounds
    y0, y1 = _base_y_range(miny, maxy, params)
    cw, tol = _connector_dims(params)
    cy0, cy1 = _connector_y_range(y0, y1, tol)
    spacing = max(0.0, params.spacing_mm)

    center_strip = box(minx, y0, maxx, y1)
    left_solid = _left_connector_wing(minx, y0, y1, cw, tol, cy0, cy1)
    left_groove = box(*_female_pocket_bounds(minx, cw, tol, cy0, cy1))
    left_tunnel = _side_tunnel_preview(minx, cw, tol, cy0, cy1)

    if params.is_modular:
        right_solid = _right_socket_wing(maxx, y0, y1, cw, tol, cy0, cy1)
        male_tab = Polygon()
        right_groove = box(*_right_pocket_bounds(maxx, cw, tol, cy0, cy1))
        right_tunnel = _right_tunnel_preview(maxx, cw, tol, cy0, cy1)
    else:
        right_solid = _right_connector_wing(maxx, y0, y1, cw, tol, cy0, cy1, spacing)
        male_tab = box(*_male_tongue_bounds(maxx, cw, tol, cy0, cy1, spacing))
        right_groove = Polygon()
        right_tunnel = Polygon()

    base_solid = clean_polygon(unary_union([left_solid, center_strip, right_solid]))
    return (
        base_solid,
        left_groove,
        male_tab,
        left_tunnel,
        y0,
        y1,
        cw,
        right_groove,
        right_tunnel,
    )


def add_connection_base(
    geom,
    params: ConnectionBaseParams,
    *,
    glyph_bounds: tuple[float, float, float, float] | None = None,
):
    """Union a horizontal base tab plus side connectors."""
    if not params.enabled or geom is None or geom.is_empty:
        return geom

    bounds = glyph_bounds or geom.bounds
    base_solid, *_rest = build_base_shapes(bounds, params)
    return clean_polygon(unary_union([geom, base_solid]))


def base_preview_rings(
    glyph_bounds: tuple[float, float, float, float],
    params: ConnectionBaseParams,
) -> dict | None:
    """2D rings for the base tab and connectors (for optional preview highlighting)."""
    if not params.enabled:
        return None

    from engine.font_geometry import geometry_to_rings

    (
        base_solid,
        left_groove,
        male_tab,
        left_tunnel,
        y0,
        y1,
        cw,
        right_groove,
        right_tunnel,
    ) = build_base_shapes(glyph_bounds, params)
    outer, holes = geometry_to_rings(base_solid)
    groove_outer, groove_holes = geometry_to_rings(left_groove)
    male_outer, male_holes = geometry_to_rings(male_tab) if not male_tab.is_empty else ([], [])
    left_tunnel_outer, left_tunnel_holes = geometry_to_rings(left_tunnel)
    right_payload = None
    if params.is_modular and not right_groove.is_empty:
        rg_o, rg_h = geometry_to_rings(right_groove)
        rt_o, rt_h = geometry_to_rings(right_tunnel)
        right_payload = {
            "groove": {"outer": rg_o, "holes": rg_h},
            "tunnel": {"outer": rt_o, "holes": rt_h},
        }
    wall_slots = side_wall_wire_slots(glyph_bounds, params)
    wall_outer, wall_holes = geometry_to_rings(wall_slots) if wall_slots is not None else ([], [])

    return {
        "position": params.position,
        "mode": params.mode,
        "outer": outer,
        "holes": holes,
        "groove": {"outer": groove_outer, "holes": groove_holes},
        "male_tab": {"outer": male_outer, "holes": male_holes},
        "side_tunnels": {
            "left": {"outer": left_tunnel_outer, "holes": left_tunnel_holes},
            **(
                {
                    "right": right_payload["tunnel"],
                }
                if right_payload
                else {}
            ),
        },
        "right_groove": right_payload["groove"] if right_payload else None,
        "wall_slots": {"outer": wall_outer, "holes": wall_holes},
        "y_range": [y0, y1],
        "connector_width_mm": cw,
        "spacing_mm": float(params.spacing_mm),
    }


def _box_mesh(extents: list[float]) -> trimesh.Trimesh:
    mesh = trimesh.creation.box(extents=extents)
    # Sit on bed: origin at corner min
    mesh.apply_translation([-extents[0] / 2, -extents[1] / 2, -extents[2] / 2])
    mesh.apply_translation([0, 0, 0])
    bounds = mesh.bounds
    mesh.apply_translation([-bounds[0][0], -bounds[0][1], -bounds[0][2]])
    return mesh


def _build_end_cap_mesh(
    *,
    letter_height_mm: float,
    depth_mm: float,
    base_height_mm: float,
    socket_width_mm: float,
    socket_height_mm: float,
    wall_mm: float = 5.0,
    side: str = "left",
) -> trimesh.Trimesh:
    """Full-height terminal module matching kit END.stl proportions.

    Hollow body with rear floor, open front pocket, and a side socket that
    mates with the modular rail connector / letter socket.
    """
    glyph_h = max(40.0, float(letter_height_mm))
    base_h = max(8.0, float(base_height_mm))
    height = glyph_h + base_h
    depth = max(20.0, float(depth_mm))
    # Kit END ≈ 146 × 172 × 64 with ~150 mm glyph → width ≈ 0.97 × glyph height
    width = max(40.0, min(160.0, glyph_h * 0.97))
    wall = max(2.4, min(5.5, float(wall_mm)))
    rear = min(3.2, depth * 0.05)  # kit rear floor ~3 mm
    shelf_z = depth * 0.598  # kit shelf at 38.3 / 64

    outer = _box_mesh([width, height, depth])

    # Main cavity from rear floor up (leave rear wall).
    cavity_w = max(4.0, width - 2 * wall)
    cavity_h = max(8.0, height - 2 * wall)
    cavity = _box_mesh([cavity_w, cavity_h, max(4.0, depth - rear + 0.2)])
    cavity.apply_translation(
        [
            (width - cavity_w) / 2,
            (height - cavity_h) / 2,
            rear,
        ]
    )
    body = outer.difference(cavity, engine="manifold")
    if not isinstance(body, trimesh.Trimesh) or body.is_empty:
        body = outer

    # Side socket (female pocket) facing the letter string — kit DUMMY 15×20×64.
    sock_x = max(3.0, socket_width_mm + 0.2)
    sock_y = max(4.0, min(socket_height_mm + 0.2, base_h))
    sock_z = max(8.0, depth - 0.4)
    socket = _box_mesh([sock_x + 0.5, sock_y, sock_z])
    sock_y0 = 0.1  # base strip at bottom of END module
    sock_z0 = (depth - sock_z) / 2
    if side == "right":
        socket.apply_translation([width - sock_x + 0.2, sock_y0, sock_z0])
    else:
        socket.apply_translation([-0.2, sock_y0, sock_z0])
    try:
        cut = body.difference(socket, engine="manifold")
        if isinstance(cut, trimesh.Trimesh) and not cut.is_empty:
            body = cut
    except Exception:
        pass

    _ = shelf_z
    return body


def build_modular_accessory_meshes(
    params: ConnectionBaseParams,
    depth_mm: float,
    letter_height_mm: float | None = None,
    wall_mm: float = 5.0,
) -> list[dict]:
    """Standalone STLs sized like kit CONNECTOR / DISTANCE / DUMMY / END."""
    if not params.is_modular:
        return []

    # Kit reference (mm):
    #   DISTANCE  5 × 20 × 64
    #   DUMMY     15 × 20 × 64
    #   CONNECTOR 25 × 16.8 × 60.74  (10 mm into each 15 mm socket + 5 mm gap)
    depth = max(20.0, float(depth_mm))
    base_h = max(8.0, float(params.height_mm))
    spacing = max(1.0, float(params.spacing_mm) if params.spacing_mm > 0.5 else 5.0)
    socket_x = max(8.0, float(params.connector_width_mm))  # DUMMY width
    tol = max(0.15, float(params.connector_tolerance_mm))
    insert_x = max(4.0, socket_x - 5.0)  # 10 mm into a 15 mm socket
    conn_len = insert_x * 2 + spacing  # 25 mm with kit defaults
    conn_y = max(8.0, min(base_h - 2.0 * tol, 16.8))
    conn_z = max(12.0, depth - 3.26)  # 60.74 at depth 64
    glyph_h = max(base_h + 20.0, float(letter_height_mm or 150.0))

    connector = _box_mesh([conn_len, conn_y, conn_z])
    distance = _box_mesh([spacing, base_h, depth])
    dummy = _box_mesh([socket_x, base_h, depth])

    end_left = _build_end_cap_mesh(
        letter_height_mm=glyph_h,
        depth_mm=depth,
        base_height_mm=base_h,
        socket_width_mm=socket_x,
        socket_height_mm=base_h,
        wall_mm=wall_mm,
        side="left",
    )
    end_right = _build_end_cap_mesh(
        letter_height_mm=glyph_h,
        depth_mm=depth,
        base_height_mm=base_h,
        socket_width_mm=socket_x,
        socket_height_mm=base_h,
        wall_mm=wall_mm,
        side="right",
    )

    return [
        {"name": "connector.stl", "mesh": connector, "label": "connector"},
        {"name": "distance.stl", "mesh": distance, "label": "distance"},
        {"name": "dummy_left.stl", "mesh": dummy.copy(), "label": "dummy_left"},
        {"name": "dummy_right.stl", "mesh": dummy.copy(), "label": "dummy_right"},
        {"name": "end_left.stl", "mesh": end_left, "label": "end_left"},
        {"name": "end_right.stl", "mesh": end_right, "label": "end_right"},
    ]
