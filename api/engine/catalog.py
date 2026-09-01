"""Fonts, product types, mounting systems and plug profiles.

Mechanical dimensions live only in PlugProfile — never hardcoded in the
product geometry pipeline.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path

FONTS_DIR = Path(__file__).resolve().parent.parent / "fonts"


@dataclass(frozen=True)
class FontSpec:
    id: str
    name: str
    category: str
    file: str
    css_family: str
    weight: int
    preview_weight: int = 700

    @property
    def path(self) -> Path:
        return FONTS_DIR / self.file


@dataclass(frozen=True)
class PlugProfile:
    id: str
    name: str
    diameter_mm: float
    length_mm: float
    neck_diameter_mm: float
    neck_length_mm: float
    tolerance_mm: float
    locking_type: str
    rotation: float = 0.0
    subtitle: str = "Prototype mounting profile"
    prototype: bool = True

    def with_overrides(
        self,
        diameter_mm: float | None = None,
        length_mm: float | None = None,
        neck_diameter_mm: float | None = None,
        neck_length_mm: float | None = None,
        tolerance_mm: float | None = None,
        rotation: float | None = None,
    ) -> "PlugProfile":
        data = asdict(self)
        if diameter_mm is not None:
            data["diameter_mm"] = diameter_mm
        if length_mm is not None:
            data["length_mm"] = length_mm
        if neck_diameter_mm is not None:
            data["neck_diameter_mm"] = neck_diameter_mm
        if neck_length_mm is not None:
            data["neck_length_mm"] = neck_length_mm
        if tolerance_mm is not None:
            data["tolerance_mm"] = tolerance_mm
        if rotation is not None:
            data["rotation"] = rotation
        return PlugProfile(**data)


# Extensibility: only Letters + Electrified Bar ship in the MVP.
PRODUCT_TYPES = [
    {"id": "letters", "name": "Letters", "available": True},
    {"id": "numbers", "name": "Numbers", "available": False},
    {"id": "logos", "name": "Logos", "available": False},
    {"id": "symbols", "name": "Symbols", "available": False},
    {"id": "custom-svg", "name": "Custom SVG", "available": False},
]

MOUNTING_SYSTEMS = [
    {
        "id": "electrified-bar",
        "name": "Electrified bar",
        "available": True,
        "note": "Visual representation only. Profile A is a prototype.",
    },
    {"id": "wall-mount", "name": "Wall mount", "available": False},
    {"id": "magnetic", "name": "Magnetic", "available": False},
    {"id": "peg", "name": "Peg", "available": False},
    {"id": "screw", "name": "Screw", "available": False},
    {"id": "custom", "name": "Custom", "available": False},
]


FONTS: list[FontSpec] = [
    FontSpec("montserrat-bold", "Montserrat Bold", "popular", "Montserrat-Bold.ttf", "Montserrat", 700),
    FontSpec("poppins-extrabold", "Poppins ExtraBold", "popular", "Poppins-ExtraBold.ttf", "Poppins", 800),
    FontSpec("inter-bold", "Inter Bold", "popular", "Inter-Bold.ttf", "Inter", 700),
    FontSpec("outfit-bold", "Outfit Bold", "popular", "Outfit-Bold.ttf", "Outfit", 700),
    FontSpec("oswald-bold", "Oswald Bold", "bold", "Oswald-Bold.ttf", "Oswald", 700),
    FontSpec("anton", "Anton", "bold", "Anton-Regular.ttf", "Anton", 400, 400),
    FontSpec("archivo-black", "Archivo Black", "bold", "ArchivoBlack-Regular.ttf", "Archivo Black", 400, 400),
    FontSpec("nunito-extrabold", "Nunito ExtraBold", "rounded", "Nunito-ExtraBold.ttf", "Nunito", 800),
    FontSpec("quicksand-bold", "Quicksand Bold", "rounded", "Quicksand-Bold.ttf", "Quicksand", 700),
    FontSpec("varela-round", "Varela Round", "rounded", "VarelaRound-Regular.ttf", "Varela Round", 400, 400),
    FontSpec("playfair-bold", "Playfair Display Bold", "serif", "PlayfairDisplay-Bold.ttf", "Playfair Display", 700),
    FontSpec("merriweather-bold", "Merriweather Bold", "serif", "Merriweather-Bold.ttf", "Merriweather", 700),
    FontSpec("libre-baskerville-bold", "Libre Baskerville Bold", "serif", "LibreBaskerville-Bold.ttf", "Libre Baskerville", 700),
    FontSpec("pacifico", "Pacifico", "script", "Pacifico-Regular.ttf", "Pacifico", 400, 400),
    FontSpec("dancing-script-bold", "Dancing Script Bold", "script", "DancingScript-Bold.ttf", "Dancing Script", 700),
    FontSpec("great-vibes", "Great Vibes", "script", "GreatVibes-Regular.ttf", "Great Vibes", 400, 400),
    FontSpec("bebas-neue", "Bebas Neue", "display", "BebasNeue-Regular.ttf", "Bebas Neue", 400, 400),
    FontSpec("righteous", "Righteous", "display", "Righteous-Regular.ttf", "Righteous", 400, 400),
    FontSpec("lobster", "Lobster", "display", "Lobster-Regular.ttf", "Lobster", 400, 400),
]

FONT_CATEGORIES = [
    {"id": "popular", "name": "Popular"},
    {"id": "bold", "name": "Bold"},
    {"id": "rounded", "name": "Rounded"},
    {"id": "serif", "name": "Serif"},
    {"id": "script", "name": "Script"},
    {"id": "display", "name": "Display"},
]


PLUG_PROFILES: list[PlugProfile] = [
    PlugProfile(
        id="profile-a",
        name="Profile A",
        diameter_mm=8.0,
        length_mm=12.0,
        neck_diameter_mm=6.0,
        neck_length_mm=3.5,
        tolerance_mm=0.2,
        locking_type="friction",
        rotation=0.0,
        subtitle="Prototype mounting profile",
        prototype=True,
    )
]


def get_font(font_id: str) -> FontSpec:
    for font in FONTS:
        if font.id == font_id:
            return font
    raise KeyError(font_id)


def get_plug_profile(profile_id: str) -> PlugProfile:
    for profile in PLUG_PROFILES:
        if profile.id == profile_id:
            return profile
    raise KeyError(profile_id)


def fonts_public() -> list[dict]:
    return [
        {
            "id": f.id,
            "name": f.name,
            "category": f.category,
            "family": f.css_family,
            "weight": f.weight,
            "preview_weight": f.preview_weight,
        }
        for f in FONTS
    ]


def plug_profiles_public() -> list[dict]:
    return [
        {
            "id": p.id,
            "name": p.name,
            "subtitle": p.subtitle,
            "prototype": p.prototype,
            "diameter_mm": p.diameter_mm,
            "length_mm": p.length_mm,
            "neck_diameter_mm": p.neck_diameter_mm,
            "neck_length_mm": p.neck_length_mm,
            "tolerance_mm": p.tolerance_mm,
            "locking_type": p.locking_type,
            "rotation": p.rotation,
            "note": "Prototype only. Not matched to a physical bar until real dimensions are configured.",
        }
        for p in PLUG_PROFILES
    ]
