# CLAUDE.md

## General

- **Always use `bun` instead of `npm`/`node`** for JavaScript/TypeScript tasks

## Commands

### Setup
```bash
./scripts/setup.sh
```

### Build
```bash
cd ui && bun install && bun run build   # Build SvelteKit frontend
cd app && bun run tauri build           # Build Tauri desktop app
```

### Run (Development)
```bash
cd app && bun run tauri dev
```

## Architecture

- `app/` — Tauri v2 desktop app, embeds a full Kodama server
- `ui/` — SvelteKit frontend (adapter-static), shared between desktop app and headless web use
- The app depends on `kodama` (git dependency from github.com/andymitch/kodama) with `features = ["web"]`
- The SvelteKit UI communicates via WebSocket and REST — no Tauri IPC for media

## Key Patterns

- The embedded server binds to `127.0.0.1` (localhost only) in the desktop app
- UI path is resolved from Tauri's bundled resources in production, auto-detected in dev
- Crypto dependency pinning (sha2/digest) is required after `cargo update` — run `./scripts/setup.sh`
