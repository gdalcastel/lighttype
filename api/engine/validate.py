"""Mesh validation and conservative repair before STL export."""

from __future__ import annotations

import trimesh

from engine.errors import ValidationError


def repair_mesh(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    mesh = mesh.copy()
    mesh.remove_infinite_values()
    try:
        mesh.update_faces(mesh.nondegenerate_faces())
        mesh.update_faces(mesh.unique_faces())
        mesh.remove_unreferenced_vertices()
    except Exception:
        pass
    try:
        vol = float(mesh.volume)
    except Exception:
        vol = 0.0
    if bool(mesh.is_watertight) and vol > 0:
        try:
            trimesh.repair.fix_normals(mesh)
        except Exception:
            pass
        return mesh
    try:
        mesh.merge_vertices()
        trimesh.repair.fix_winding(mesh)
        trimesh.repair.fix_inversion(mesh)
        trimesh.repair.fix_normals(mesh)
        trimesh.repair.fill_holes(mesh)
    except Exception:
        pass
    return mesh


def validate_mesh(mesh: trimesh.Trimesh, part_name: str) -> list[str]:
    """Return a list of remaining issues. Empty means the part is printable."""
    issues: list[str] = []
    if mesh is None or len(mesh.faces) == 0:
        issues.append("empty")
        return issues
    if mesh.area < 1e-4:
        issues.append("zero-area")
    try:
        vol = float(mesh.volume)
    except Exception:
        vol = 0.0
        issues.append("volume")
    if vol <= 0:
        issues.append("non-positive-volume")
    if not bool(mesh.is_watertight):
        issues.append("not-watertight")
    if not bool(getattr(mesh, "is_winding_consistent", True)):
        issues.append("inverted-normals")
    try:
        if mesh.faces.shape[0] and (mesh.area_faces < 1e-12).any():
            issues.append("zero-area-faces")
    except Exception:
        pass
    return issues


def validate_or_explain(mesh: trimesh.Trimesh, part_name: str, letter: str) -> trimesh.Trimesh:
    mesh = repair_mesh(mesh)
    issues = validate_mesh(mesh, part_name)
    fatal = [i for i in issues if i in ("empty", "zero-area", "non-positive-volume")]
    if fatal:
        raise ValidationError(
            f"The {part_name} for “{letter}” isn’t printable yet.",
            suggestion="Try increasing the letter height or reducing the wall thickness.",
            letter=letter,
        )
    # Watertight failures are repaired when possible; remaining ones are warnings
    # but we still export if volume is positive and faces exist.
    if "not-watertight" in issues:
        mesh = repair_mesh(mesh)
        issues = validate_mesh(mesh, part_name)
        if "empty" in issues or "non-positive-volume" in issues:
            raise ValidationError(
                f"The {part_name} for “{letter}” isn’t printable yet.",
                suggestion="Try a simpler font or a larger letter height.",
                letter=letter,
            )
    return mesh
