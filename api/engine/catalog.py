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
    {"id": "custom-svg", "name": "Custom SVG", "available": True},
]

LETTER_STYLES = [
    {
        "id": "printed-diffuser",
        "name": "Diffuser Impresso",
        "subtitle": "Casca fina com flange na prateleira",
        "front_mount": "diffuser",
        "rear_type": "solid",
        "supports": 0,
        "backlit": False,
        "available": True,
    },
]

WALL_PROFILES = [
    {
        "id": "flat",
        "name": "Plano",
        "subtitle": "Paredes retas",
        "available": True,
    },
    {
        "id": "shelf",
        "name": "Prateleira",
        "subtitle": "Degrau interno para assentar a face",
        "available": True,
    },
    {
        "id": "frieze",
        "name": "Frisos",
        "subtitle": "Frisos decorativos nas paredes",
        "available": True,
    },
]

# Kit LED modular compartilhado — cada modelo abaixo trava UMA fixação.
_LED_KIT_BASE = {
    "letterStyleId": "printed-diffuser",
    "frontMount": "diffuser",
    "wallProfileId": "shelf",
    "heightMm": 150,
    "depthMm": 64,
    "wallMm": 5.0,
    "frontMm": 0.8,
    "spacingMm": 5,
    "diffuserShellMm": 0.8,
    "diffuserToleranceMm": 0.15,
    "shelfRatio": 0.598,
    "shelfStepMm": 0.8,
    "baseHeightMm": 20,
    "baseConnectorWidthMm": 15,
    "baseConnectorToleranceMm": 0.3,
    "materialPackId": "petg-diffuser",
    "minCavityMm": 8,
    "accentLit": True,
}


def _led_model(
    *,
    id: str,
    name: str,
    subtitle: str,
    image: str,
    mounting_system_id: str,
    mounting_patch: dict,
    ui: dict,
    category: str = "sign",
) -> dict:
    return {
        "id": id,
        "name": name,
        "subtitle": subtitle,
        "category": category,
        "available": True,
        "image": image,
        "mounting_system_id": mounting_system_id,
        "ui": ui,
        "patch": {
            **_LED_KIT_BASE,
            **mounting_patch,
            "mountingSystemId": mounting_system_id,
        },
    }


# Composite recipes: UI applies `patch` onto ProjectConfig (camelCase keys).
# Um modelo = kit LED + fixação fixa (sem troca posterior).
MODEL_PRESETS = [
    _led_model(
        id="led-freestanding",
        name="Letreiro solto",
        subtitle="Só a letra — sem base nem furos de fixação",
        image="/models/freestanding.svg",
        mounting_system_id="none",
        mounting_patch={
            "baseEnabled": False,
            "shadowEnabled": False,
        },
        ui={
            "show_base": False,
            "lock_base": True,
            "show_shadow": False,
            "show_holes": False,
            "show_plug": False,
            "show_letter_style": False,
            "mounting_label": "Sem fixação",
        },
    ),
    _led_model(
        id="led-electrified-bar",
        name="Barra eletrificada",
        subtitle="Plug no perfil — protótipo de encaixe inferior",
        image="/models/electrified-bar.svg",
        mounting_system_id="electrified-bar",
        mounting_patch={
            "baseEnabled": False,
            "shadowEnabled": False,
            "plugPosition": "bottom-center",
        },
        ui={
            "show_base": False,
            "lock_base": True,
            "show_shadow": False,
            "show_holes": False,
            "show_plug": True,
            "show_letter_style": False,
            "mounting_label": "Barra eletrificada",
        },
    ),
    _led_model(
        id="led-wall-mount",
        name="Parede (furos)",
        subtitle="Furos traseiros para parafuso + cover de sombra",
        image="/models/wall-mount.svg",
        mounting_system_id="wall-mount",
        mounting_patch={
            "baseEnabled": False,
            "shadowEnabled": True,
        },
        ui={
            "show_base": False,
            "lock_base": True,
            "show_shadow": True,
            "show_holes": True,
            "show_plug": False,
            "show_letter_style": False,
            "mounting_label": "Parede (furos)",
            "suggest_holes": True,
        },
    ),
    _led_model(
        id="led-hanging",
        name="Suspenso",
        subtitle="Furo superior para fio ou argola",
        image="/models/hanging.svg",
        mounting_system_id="hanging",
        mounting_patch={
            "baseEnabled": False,
            "shadowEnabled": False,
            "basePosition": "top",
        },
        ui={
            "show_base": False,
            "lock_base": True,
            "show_shadow": False,
            "show_holes": True,
            "show_plug": False,
            "show_letter_style": False,
            "mounting_label": "Suspenso",
            "suggest_holes": True,
        },
    ),
    _led_model(
        id="led-desk-rail",
        name="Trilho de balcão",
        subtitle="Base modular com conectores laterais",
        image="/models/desk-rail.svg",
        mounting_system_id="desk-rail",
        mounting_patch={
            "baseEnabled": True,
            "baseMode": "modular",
            "basePosition": "bottom",
            "shadowEnabled": False,
        },
        ui={
            "show_base": True,
            "lock_base": True,
            "show_shadow": False,
            "show_holes": False,
            "show_plug": False,
            "show_letter_style": False,
            "mounting_label": "Trilho de balcão",
        },
    ),
    _led_model(
        id="led-desk-snap",
        name="Fileira snap",
        subtitle="Base macho/fêmea integrada entre letras",
        image="/models/desk-snap.svg",
        mounting_system_id="desk-snap",
        mounting_patch={
            "baseEnabled": True,
            "baseMode": "snap",
            "basePosition": "bottom",
            "shadowEnabled": False,
        },
        ui={
            "show_base": True,
            "lock_base": True,
            "show_shadow": False,
            "show_holes": False,
            "show_plug": False,
            "show_letter_style": False,
            "mounting_label": "Fileira snap",
        },
    ),
]

# Alias legado (localStorage / projetos antigos) → trilho de balcão.
MODEL_PRESET_ALIASES = {
    "led-modular-kit": "led-desk-rail",
}

MATERIAL_PACKS = [
    {
        "id": "pla-acrylic",
        "name": "PLA corpo + acrílico",
        "subtitle": "Corpo opaco, face translúcida cortada",
        "available": True,
        "body": "PLA",
        "face": "Acrílico 1.5–3 mm",
        "notes": "Imprima o corpo com face aberta para cima. Face em acrílico laser/CNC.",
        "patch": {
            "frontMm": 1.5,
            "frontToleranceMm": 0.25,
            "wallMm": 2.5,
        },
    },
    {
        "id": "petg-diffuser",
        "name": "PETG diffuser",
        "subtitle": "Casca translúcida impressa",
        "available": True,
        "body": "PLA/PETG opaco",
        "face": "PETG translúcido ~0.8 mm",
        "notes": "Diffuser em PETG natural ou branco translúcido; folga 0.15 mm.",
        "patch": {
            "frontMm": 0.8,
            "diffuserShellMm": 0.8,
            "diffuserToleranceMm": 0.15,
            "wallMm": 5.0,
        },
    },
    {
        "id": "petg-body",
        "name": "PETG estrutural",
        "subtitle": "Corpo resistente outdoor",
        "available": True,
        "body": "PETG",
        "face": "Acrílico ou PETG",
        "notes": "Parede ≥ 2.8 mm. Bom para open-back e uso externo.",
        "patch": {
            "wallMm": 3.0,
            "frontMm": 1.5,
        },
    },
    {
        "id": "pla-mini",
        "name": "PLA mini",
        "subtitle": "Peças pequenas / chaveiro",
        "available": True,
        "body": "PLA",
        "face": "Integrada",
        "notes": "Camadas finas; evite cavidades < 4 mm.",
        "patch": {
            "wallMm": 1.4,
            "frontMm": 1.2,
            "depthMm": 14,
        },
    },
]

MOUNTING_SYSTEMS = [
    {
        "id": "none",
        "name": "Sem fixação",
        "subtitle": "Só a letra / base",
        "available": True,
        "patch": {},
    },
    {
        "id": "electrified-bar",
        "name": "Barra eletrificada",
        "subtitle": "Plug no perfil (protótipo)",
        "available": True,
        "note": "Profile A é protótipo visual até dimensões reais.",
        "patch": {
            "baseEnabled": False,
            "plugPosition": "bottom-center",
        },
    },
    {
        "id": "wall-mount",
        "name": "Parede (furos)",
        "subtitle": "Furos traseiros para parafuso",
        "available": True,
        "patch": {
            "baseEnabled": False,
            "shadowEnabled": True,
        },
        "suggest_holes": True,
    },
    {
        "id": "hanging",
        "name": "Suspenso",
        "subtitle": "Furo superior para fio/argola",
        "available": True,
        "patch": {
            "baseEnabled": False,
            "basePosition": "top",
        },
        "suggest_holes": True,
    },
    {
        "id": "desk-rail",
        "name": "Trilho de balcão",
        "subtitle": "Base modular com conectores",
        "available": True,
        "patch": {
            "baseEnabled": True,
            "baseMode": "modular",
            "basePosition": "bottom",
            "baseHeightMm": 20,
        },
    },
    {
        "id": "desk-snap",
        "name": "Fileira snap",
        "subtitle": "Base macho/fêmea integrada",
        "available": True,
        "patch": {
            "baseEnabled": True,
            "baseMode": "snap",
            "basePosition": "bottom",
        },
    },
]

FONT_DESCRIPTIONS: dict[str, str] = {
    "montserrat-bold": "Sans geométrica",
    "poppins-extrabold": "Sans moderna",
    "inter-bold": "Sans neutra",
    "outfit-bold": "Sans arredondada",
    "oswald-bold": "Condensada bold",
    "anton": "Display condensada",
    "archivo-black": "Display pesada",
    "nunito-extrabold": "Arredondada bold",
    "quicksand-bold": "Arredondada suave",
    "varela-round": "Circular",
    "playfair-bold": "Serif elegante",
    "merriweather-bold": "Serif legível",
    "libre-baskerville-bold": "Serif clássica",
    "pacifico": "Script manuscrita",
    "dancing-script-bold": "Script cursiva",
    "great-vibes": "Script ornamental",
    "bebas-neue": "Display alta",
    "righteous": "Display retrô",
    "lobster": "Display script",
}


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


def get_letter_style(style_id: str) -> dict:
    for style in LETTER_STYLES:
        if style["id"] == style_id:
            return style
    return LETTER_STYLES[0]


def fonts_public() -> list[dict]:
    return [
        {
            "id": f.id,
            "name": f.name,
            "category": f.category,
            "family": f.css_family,
            "weight": f.weight,
            "preview_weight": f.preview_weight,
            "description": FONT_DESCRIPTIONS.get(f.id, ""),
        }
        for f in FONTS
    ]


def letter_styles_public() -> list[dict]:
    return LETTER_STYLES


def wall_profiles_public() -> list[dict]:
    return WALL_PROFILES


def model_presets_public() -> list[dict]:
    return [p for p in MODEL_PRESETS if p.get("available", True)]


def material_packs_public() -> list[dict]:
    return [p for p in MATERIAL_PACKS if p.get("available", True)]


def mounting_systems_public() -> list[dict]:
    return [m for m in MOUNTING_SYSTEMS if m.get("available", True)]


def get_model_preset(preset_id: str) -> dict | None:
    resolved = MODEL_PRESET_ALIASES.get(preset_id, preset_id)
    for p in MODEL_PRESETS:
        if p["id"] == resolved:
            return p
    return None


def get_material_pack(pack_id: str) -> dict | None:
    for p in MATERIAL_PACKS:
        if p["id"] == pack_id:
            return p
    return None


def get_mounting_system(system_id: str) -> dict | None:
    for m in MOUNTING_SYSTEMS:
        if m["id"] == system_id:
            return m
    return None


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
