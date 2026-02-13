# Kodama App

Desktop and mobile application for [Kodama](https://github.com/andymitch/kodama), a privacy-focused P2P security camera system.

## Overview

Kodama App is a Tauri v2 desktop application that embeds a full Kodama server and presents a polished SvelteKit UI for managing cameras, viewing live streams, and reviewing recordings.

## Quick Start

```bash
# Setup (install deps, pin crypto)
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
├── app/                    # Tauri desktop app
│   ├── package.json        # Tauri CLI + dev/build scripts
│   └── src-tauri/
│       ├── Cargo.toml      # kodama via git dependency
│       ├── tauri.conf.json
│       └── src/
│           ├── lib.rs      # App setup + embedded server
│           └── main.rs     # Entry point
├── ui/                     # SvelteKit frontend (adapter-static)
│   ├── package.json
│   ├── svelte.config.js
│   └── src/
└── scripts/
    └── setup.sh            # Crypto dependency pinning
```

The app embeds a full Kodama server (Iroh QUIC + axum web) and opens a webview to it. The SvelteKit UI communicates entirely over WebSocket and REST — no Tauri IPC is needed for video, audio, or telemetry.

## Dependencies

- [kodama](https://github.com/andymitch/kodama) — Core library (transport, capture, storage, server, web)
- [Tauri v2](https://tauri.app) — Desktop framework
- [SvelteKit](https://kit.svelte.dev) — Frontend framework

## Headless Web UI

The SvelteKit UI can also be built as standalone static files for use with `kodama-server`:

```bash
cd ui && bun install && bun run build
# Then point kodama-server at the build output:
KODAMA_UI_PATH=./ui/build kodama-server
```

## License

BSL 1.1 — See LICENSE for details.
