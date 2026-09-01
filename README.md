# LightType

Type it. Light it. Print it.

Create illuminated 3D letters ready for printing. Type a word, choose a style, preview the hollow letters in 3D, and download individual STL files for each letter body and removable snap-fit front.

## Run

The app runs with Docker:

```bash
make start
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

| Command | What it does |
| --- | --- |
| `make start` | Build images and start web + API |
| `make logs` | Follow container logs |
| `make stop` | Stop the stack |
| `make restart` | Recreate the stack |
| `make ps` | Show container status |

Requires Docker (Docker Desktop or the Docker engine).

`make start` builds a production Next.js image and the FastAPI geometry API, then starts both. The UI proxies `/api/*` to the API container.

## Run without Docker

Requirements: Node.js 20+, Python 3.12+.

```bash
npm install
pip install -r api/requirements.txt
npm run dev
```

- App: http://127.0.0.1:43127
- API: http://127.0.0.1:8765

## What this is

LightType is a web app plus a Python geometry engine:

- **Frontend** — Next.js, React, Tailwind CSS, Three.js / React Three Fiber
- **API** — FastAPI
- **Geometry** — fontTools, Shapely, trimesh (Manifold booleans)

Each character is generated as its own printable pair:

- `01_G_body.stl` — hollow body, LED cavity, rear wall, mounting plug
- `01_G_front.stl` — removable snap-fit face

Files are packed as `GUILI.zip` with a README of the project settings.

The default project opens with **GUILI**, Montserrat Bold, 100 mm height, 25 mm depth, 2 mm walls, 8 mm spacing, and prototype **Profile A** plugs.

Profile A is a prototype mounting profile. It is not matched to a physical electrified bar until real dimensions are configured.

## Generate STL from the API

```bash
curl -X POST http://127.0.0.1:8765/api/generate/preview \
  -H 'Content-Type: application/json' \
  -d '{"text":"GUILI","font_id":"montserrat-bold","height_mm":100,"wall_mm":2,"spacing_mm":8}'
```

```bash
curl -X POST http://127.0.0.1:8765/api/generate/stl \
  -H 'Content-Type: application/json' \
  -d '{"text":"GUILI","font_id":"montserrat-bold","height_mm":100,"depth_mm":25,"wall_mm":2,"front_mm":1.5,"spacing_mm":8,"plug_profile":"profile-a","plug_position":"bottom-center","front_mount":"snap-fit"}'
```

Poll `GET /api/generate/{job_id}` then download `GET /api/download/{job_id}`.

## Fonts

Bundled typefaces are licensed under the SIL Open Font License. See `api/fonts/`.

## Architecture

Font geometry (typeface → glyph → 2D contour) is separate from product geometry (hollow body, snap-fit front, rear plug). Mechanical dimensions live on `PlugProfile`, so mounting systems can change later without rewriting letter outlines.
