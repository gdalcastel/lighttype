"""Bambu Studio-compatible 3MF: one printable piece per plate."""

from __future__ import annotations

import io
import json
import math
import uuid
import zipfile
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

import numpy as np
import trimesh

BED_SIZE_MM = 256.0
BED_CENTER_MM = BED_SIZE_MM / 2.0
PLATE_STRIDE_MM = BED_SIZE_MM * 1.2
ASSETS_DIR = Path(__file__).resolve().parent / "bambu_assets"
PROJECT_SETTINGS_PATH = ASSETS_DIR / "project_settings.config"
BAMBU_APP_VERSION = "02.08.02.61"


def _new_uuid() -> str:
    return str(uuid.uuid4())


def _fmt(n: float) -> str:
    return f"{float(n):.7g}"


def _a(value: str) -> str:
    return escape(value, {"\"": "&quot;"})


def _center_mesh(mesh: trimesh.Trimesh) -> tuple[trimesh.Trimesh, float]:
    """Center mesh at origin; return (mesh, half_height_z for bed lift)."""
    out = mesh.copy()
    bounds = out.bounds
    center = (bounds[0] + bounds[1]) / 2.0
    out.apply_translation(-center)
    half_z = float((bounds[1][2] - bounds[0][2]) / 2.0)
    return out, max(half_z, 0.1)


def _plate_origin(index: int, count: int) -> tuple[float, float]:
    """Bambu PartPlate grid: columns +X, rows −Y (cols = ceil(sqrt(n)))."""
    cols = max(1, int(math.ceil(math.sqrt(max(count, 1)))))
    col = index % cols
    row = index // cols
    return col * PLATE_STRIDE_MM, -row * PLATE_STRIDE_MM


def _load_project_settings() -> str:
    if PROJECT_SETTINGS_PATH.exists():
        return PROJECT_SETTINGS_PATH.read_text(encoding="utf-8")
    # Minimal fallback — Studio may still warn.
    return json.dumps(
        {
            "printable_area": ["0x0", "256x0", "256x256", "0x256"],
            "printable_height": "250",
            "curr_bed_type": "Textured PEI Plate",
            "printer_model": "Bambu Lab A1",
            "enable_support": "0",
            "wall_loops": "3",
            "sparse_infill_density": "15%",
            "layer_height": "0.2",
            "filament_type": ["PLA"],
        },
        indent=4,
    )


def _read_asset(name: str) -> bytes:
    path = ASSETS_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Missing Bambu asset: {path}")
    return path.read_bytes()


def _mesh_model_xml(mesh: trimesh.Trimesh, object_id: int, object_uuid: str) -> str:
    verts = np.asarray(mesh.vertices, dtype=float)
    faces = np.asarray(mesh.faces, dtype=int)
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<model unit="millimeter" xml:lang="en-US" '
        'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" '
        'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" '
        'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" '
        'requiredextensions="p">',
        ' <metadata name="BambuStudio:3mfVersion">1</metadata>',
        " <resources>",
        f'  <object id="{object_id}" p:UUID="{object_uuid}" type="model">',
        "   <mesh>",
        "    <vertices>",
    ]
    for v in verts:
        lines.append(f'     <vertex x="{_fmt(v[0])}" y="{_fmt(v[1])}" z="{_fmt(v[2])}"/>')
    lines.append("    </vertices>")
    lines.append("    <triangles>")
    for f in faces:
        lines.append(f'     <triangle v1="{int(f[0])}" v2="{int(f[1])}" v3="{int(f[2])}"/>')
    lines.extend(
        [
            "    </triangles>",
            "   </mesh>",
            "  </object>",
            " </resources>",
            f' <build p:UUID="{_new_uuid()}"/>',
            "</model>",
        ]
    )
    return "\n".join(lines)


def _collect_pieces(
    parts: list[dict],
    shadow_mesh=None,
    accessories: list[dict] | None = None,
) -> list[dict]:
    pieces: list[dict] = []
    for part in parts:
        pieces.append({"name": part["body_name"], "mesh": part["body"], "kind": "body"})
        pieces.append({"name": part["front_name"], "mesh": part["front"], "kind": "front"})
    for acc in accessories or []:
        pieces.append({"name": acc["name"], "mesh": acc["mesh"], "kind": "accessory"})
    if shadow_mesh is not None:
        pieces.append({"name": "shadow_cover.stl", "mesh": shadow_mesh, "kind": "shadow"})
    return pieces


def _display_name(raw: str) -> str:
    name = Path(raw).stem or raw
    return name.replace("_", " ")


def _model_settings_xml(entries: list[dict]) -> str:
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', "<config>"]
    for e in entries:
        face_count = int(len(e["mesh"].faces))
        label = _a(_display_name(e["name"]))
        lines.append(f'  <object id="{e["parent_id"]}">')
        lines.append(f'    <metadata key="name" value="{label}"/>')
        lines.append('    <metadata key="extruder" value="1"/>')
        lines.append(f'    <metadata face_count="{face_count}"/>')
        lines.append(
            f'    <part id="{e["mesh_id"]}" subtype="normal_part" uuid="{e["part_uuid"]}">'
        )
        lines.append(f'      <metadata key="name" value="{label}"/>')
        lines.append('      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>')
        lines.append(f'      <metadata key="source_file" value="{_a(e["name"])}"/>')
        lines.append('      <metadata key="source_object_id" value="0"/>')
        lines.append('      <metadata key="source_volume_id" value="0"/>')
        lines.append(
            f'      <mesh_stat face_count="{face_count}" edges_fixed="0" '
            'degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>'
        )
        lines.append("    </part>")
        lines.append("  </object>")

    for i, e in enumerate(entries, start=1):
        plate_label = _a(_display_name(e["name"]))
        lines.append("  <plate>")
        lines.append(f'    <metadata key="plater_id" value="{i}"/>')
        lines.append(f'    <metadata key="plater_name" value="{plate_label}"/>')
        lines.append('    <metadata key="locked" value="false"/>')
        lines.append('    <metadata key="filament_map_mode" value="Auto For Flush"/>')
        lines.append(f'    <metadata key="thumbnail_file" value="Metadata/plate_{i}.png"/>')
        lines.append(
            f'    <metadata key="thumbnail_no_light_file" value="Metadata/plate_no_light_{i}.png"/>'
        )
        lines.append(f'    <metadata key="top_file" value="Metadata/top_{i}.png"/>')
        lines.append(f'    <metadata key="pick_file" value="Metadata/pick_{i}.png"/>')
        lines.append("    <model_instance>")
        lines.append(f'      <metadata key="object_id" value="{e["parent_id"]}"/>')
        lines.append('      <metadata key="instance_id" value="0"/>')
        lines.append(f'      <metadata key="identify_id" value="{80 + i * 20}"/>')
        lines.append("    </model_instance>")
        lines.append("  </plate>")

    lines.append("  <assemble>")
    for e in entries:
        hz = e["half_z"]
        ox, oy = e["plate_xy"]
        lines.append(
            f'   <assemble_item object_id="{e["parent_id"]}" instance_id="0" '
            f'transform="1 0 0 0 1 0 0 0 1 {_fmt(ox)} {_fmt(oy)} {_fmt(hz)}" offset="0 0 0" />'
        )
        lines.append(
            f'   <assemble_item object_id="{e["parent_id"]}" volume_id="0" '
            'transform="1 0 0 0 1 0 0 0 1 0 0 0" />'
        )
    lines.append("  </assemble>")
    lines.append("</config>")
    return "\n".join(lines)


def _root_model_xml(entries: list[dict]) -> str:
    today = date.today().isoformat()
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<model unit="millimeter" xml:lang="en-US" '
        'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" '
        'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" '
        'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" '
        'requiredextensions="p">',
        f' <metadata name="Application">BambuStudio-{BAMBU_APP_VERSION}</metadata>',
        ' <metadata name="BambuStudio:3mfVersion">1</metadata>',
        ' <metadata name="Copyright"></metadata>',
        f' <metadata name="CreationDate">{today}</metadata>',
        ' <metadata name="Description">LightType multi-plate export</metadata>',
        ' <metadata name="Designer"></metadata>',
        ' <metadata name="DesignerCover"></metadata>',
        ' <metadata name="License"></metadata>',
        f' <metadata name="ModificationDate">{today}</metadata>',
        ' <metadata name="Origin">LightType</metadata>',
        ' <metadata name="Title">LightType</metadata>',
        " <resources>",
    ]
    for e in entries:
        lines.append(
            f'  <object id="{e["parent_id"]}" p:UUID="{e["parent_uuid"]}" type="model">'
        )
        lines.append("   <components>")
        lines.append(
            f'    <component p:path="/3D/Objects/{e["file_name"]}" objectid="{e["mesh_id"]}" '
            f'p:UUID="{e["component_uuid"]}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>'
        )
        lines.append("   </components>")
        lines.append("  </object>")
    lines.append(" </resources>")
    lines.append(f' <build p:UUID="{_new_uuid()}">')
    for e in entries:
        ox, oy = e["plate_xy"]
        lines.append(
            f'  <item objectid="{e["parent_id"]}" p:UUID="{e["item_uuid"]}" '
            f'transform="1 0 0 0 1 0 0 0 1 {_fmt(BED_CENTER_MM + ox)} {_fmt(BED_CENTER_MM + oy)} {_fmt(e["half_z"])}" '
            'printable="1"/>'
        )
    lines.append(" </build>")
    lines.append("</model>")
    return "\n".join(lines)


def _rels_objects(entries: list[dict]) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    ]
    for i, e in enumerate(entries, start=1):
        lines.append(
            f' <Relationship Target="/3D/Objects/{e["file_name"]}" Id="rel-{i}" '
            'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>'
        )
    lines.append("</Relationships>")
    return "\n".join(lines)


def _root_rels() -> str:
    return """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
 <Relationship Target="/Metadata/plate_1.png" Id="rel-2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail"/>
 <Relationship Target="/Metadata/plate_1.png" Id="rel-4" Type="http://schemas.bambulab.com/package/2021/cover-thumbnail-middle"/>
 <Relationship Target="/Metadata/plate_1_small.png" Id="rel-5" Type="http://schemas.bambulab.com/package/2021/cover-thumbnail-small"/>
</Relationships>
"""


CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
 <Default Extension="png" ContentType="image/png"/>
 <Default Extension="config" ContentType="application/octet-stream"/>
 <Default Extension="xml" ContentType="application/xml"/>
 <Default Extension="json" ContentType="application/json"/>
</Types>
"""


def write_3mf_bytes(
    parts: list[dict],
    shadow_mesh=None,
    accessories: list[dict] | None = None,
) -> bytes:
    """Pack every printable mesh as its own Bambu plate inside one .3mf."""
    raw_pieces = _collect_pieces(parts, shadow_mesh, accessories)
    n = len(raw_pieces)
    entries: list[dict] = []

    for i, piece in enumerate(raw_pieces):
        mesh, half_z = _center_mesh(piece["mesh"])
        mesh_id = 2 * i + 1
        parent_id = 2 * i + 2
        seq = i + 1
        file_name = f"object_{seq}.model"
        ox, oy = _plate_origin(i, n)
        entries.append(
            {
                "name": piece["name"],
                "mesh": mesh,
                "half_z": half_z,
                "mesh_id": mesh_id,
                "parent_id": parent_id,
                "file_name": file_name,
                "plate_xy": (ox, oy),
                # Match Bambu Studio UUID patterns (sequential in first block).
                "mesh_uuid": f"{seq:04d}0000-81cb-4c03-9d28-80fed5dfa1dc",
                "parent_uuid": f"{seq:08d}-61cb-4c03-9d28-80fed5dfa1dc",
                "component_uuid": f"{seq:04d}0000-b206-40ff-9872-83e8017abed1",
                "item_uuid": f"{parent_id:08d}-b1ec-4553-aec9-835e5b724bb4",
                "part_uuid": str(uuid.uuid4()),
            }
        )

    filament = {
        f"plate_{i + 1}": {"nozzle_sequence": [], "optimal_assignment": [], "sequence": []}
        for i in range(n)
    }

    plate_png = _read_asset("plate.png")
    plate_small = _read_asset("plate_small.png")
    plate_no_light = _read_asset("plate_no_light.png")
    top_png = _read_asset("top.png")
    pick_png = _read_asset("pick.png")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", CONTENT_TYPES)
        zf.writestr("_rels/.rels", _root_rels())
        zf.writestr("3D/3dmodel.model", _root_model_xml(entries))
        zf.writestr("3D/_rels/3dmodel.model.rels", _rels_objects(entries))
        for e in entries:
            zf.writestr(
                f"3D/Objects/{e['file_name']}",
                _mesh_model_xml(e["mesh"], e["mesh_id"], e["mesh_uuid"]),
            )
        zf.writestr("Metadata/model_settings.config", _model_settings_xml(entries))
        zf.writestr("Metadata/project_settings.config", _load_project_settings())
        zf.writestr(
            "Metadata/slice_info.config",
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            "<config>\n"
            "  <header>\n"
            '    <header_item key="X-BBL-Client-Type" value="slicer"/>\n'
            f'    <header_item key="X-BBL-Client-Version" value="{BAMBU_APP_VERSION}"/>\n'
            "  </header>\n"
            "</config>\n",
        )
        zf.writestr("Metadata/filament_sequence.json", json.dumps(filament, separators=(",", ":")))
        zf.writestr(
            "Metadata/cut_information.xml",
            '<?xml version="1.0" encoding="utf-8"?>\n<objects>\n'
            + "\n".join(
                f' <object id="{i}">\n  <cut_id id="0" check_sum="1" connectors_cnt="0"/>\n </object>'
                for i in range(1, n + 1)
            )
            + "\n</objects>\n",
        )
        for i in range(1, n + 1):
            zf.writestr(f"Metadata/plate_{i}.png", plate_png)
            zf.writestr(f"Metadata/plate_{i}_small.png", plate_small)
            zf.writestr(f"Metadata/plate_no_light_{i}.png", plate_no_light)
            zf.writestr(f"Metadata/top_{i}.png", top_png)
            zf.writestr(f"Metadata/pick_{i}.png", pick_png)

    return buf.getvalue()
