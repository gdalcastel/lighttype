# LightType

Type it. Light it. Print it.

Create illuminated 3D letters ready for printing. Mobile-first web + Capacitor (iOS/Android) with NFC write.

## Layout

```
/
├── Makefile
├── docker-compose.yml
├── app/          # Next.js + Capacitor
└── api/          # FastAPI (geometry engine)
```

No database — persistence and business data will go through the xbot API.

## Run (web)

```bash
make install
make dev
```

- App: http://127.0.0.1:43127
- API: http://127.0.0.1:8765/api/health

| Command | What it does |
| --- | --- |
| `make start` | Docker web + API |
| `make dev` | Local web + API |
| `make mobile LAN_IP=192.168.x.x` | Build static + sync Capacitor |
| `make cap-android` | Open Android Studio |
| `make cap-ios` | Open Xcode |
| `make cap-dev LAN_IP=192.168.x.x` | Capacitor live-reload → Next local |

## Mobile (Capacitor)

Web e app compartilham o mesmo frontend. NFC só funciona no app nativo.

1. Descubra o IP da máquina na LAN (não use `localhost` no celular).
2. Suba a API acessível na rede:

```bash
make api API_HOST=0.0.0.0
```

3. Gere o app e sincronize:

```bash
make mobile LAN_IP=192.168.0.10
make cap-android   # ou make cap-ios
```

4. No Android Studio / Xcode, rode no aparelho com NFC.

Painel **NFC** fica na aba Exportar: grava texto ou URL em tag NDEF.

## Stack

- **app** — Next.js, React, Tailwind, Three.js, Capacitor 7, `@capgo/capacitor-nfc`
- **api** — FastAPI + fontTools, Shapely, trimesh

## Fonts

Bundled typefaces are licensed under the SIL Open Font License. See `api/fonts/`.
