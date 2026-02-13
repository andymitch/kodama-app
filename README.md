# Kodama App

Desktop and mobile application for [Kodama](https://github.com/andymitch/kodama), a privacy-focused P2P security camera system.

Built with [Tauri v2](https://tauri.app), the app embeds a full Kodama server and presents a [Svelte 5](https://svelte.dev) UI for managing cameras, viewing live streams, and reviewing recordings. The UI communicates entirely over WebSocket and REST — no Tauri IPC is needed for video, audio, or telemetry.

## Quick Start

**Prerequisites:** [Rust](https://rustup.rs), [bun](https://bun.sh)

```bash
# Setup (install dependencies, verify build)
./scripts/setup.sh

# Run in development mode
cd app && bun run tauri dev

# Build for release
cd app && bun run tauri build
```

## Architecture

```
kodama-app/
├── Cargo.toml              # Workspace root
├── app/                    # Tauri v2 desktop app
│   ├── package.json        # Tauri CLI + dev/build scripts
│   └── src-tauri/
│       ├── Cargo.toml      # kodama dependency (git)
│       ├── tauri.conf.json # Window config, bundling, icons
│       └── src/
│           ├── lib.rs      # App setup + embedded server
│           └── main.rs     # Entry point
├── ui/                     # Svelte 5 + Vite frontend (static SPA)
│   ├── package.json
│   └── src/
│       ├── App.svelte      # Root component + hash router
│       ├── pages/          # Dashboard, Settings
│       └── lib/
│           ├── transport-ws.ts  # WebSocket binary protocol
│           ├── types.ts         # Shared type definitions
│           └── components/      # UI components
└── scripts/
    └── setup.sh
```

The embedded server runs on `127.0.0.1:3000` and uses [Iroh](https://iroh.computer) for P2P QUIC transport. Cameras connect as peers, and the web UI connects via WebSocket for live video (fMP4), audio, and telemetry.

## Configuration

Environment variables for the embedded server:

| Variable | Default | Description |
|---|---|---|
| `KODAMA_WEB_PORT` | `3000` | Web server port |
| `KODAMA_KEY_PATH` | OS data dir | Path to server identity key |
| `KODAMA_BUFFER_SIZE` | `512` | Frame broadcast buffer capacity |
| `KODAMA_STORAGE_PATH` | *(disabled)* | Enable recording to this directory |
| `KODAMA_STORAGE_MAX_GB` | `10` | Max recording storage size |
| `KODAMA_RETENTION_DAYS` | `7` | Recording retention period |

## Headless Web UI

The Svelte UI can also be built as standalone static files for use with `kodama-server`:

```bash
cd ui && bun install && bun run build
# Point kodama-server at the build output:
KODAMA_UI_PATH=./ui/build kodama-server
```

## Releases

Releases are built automatically via GitHub Actions when a `v*` tag is pushed. Current platforms:

- **macOS** — `.dmg` (aarch64 + x86_64)
- **Linux** — `.AppImage`, `.deb`, `.rpm`
- **Windows** — `.msi`, `.exe`
- **iOS / Android** — Built when platform support is initialized (`tauri ios init` / `tauri android init`)

## License

BSL 1.1 — See [LICENSE](LICENSE) for details.
