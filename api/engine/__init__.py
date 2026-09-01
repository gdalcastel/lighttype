"""LightType geometry engine.

FONT GEOMETRY is responsible for turning type into 2D contours.
PRODUCT GEOMETRY is responsible for hollow bodies, fronts, snap-fits and plugs.
"""

from engine.errors import GeometryError, UnsupportedCharacterError, ValidationError

__all__ = ["GeometryError", "UnsupportedCharacterError", "ValidationError"]
