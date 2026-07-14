# MediaVault

MediaVault is a desktop app for downloading and converting media, built with Tauri, React, and TypeScript. Paste a URL (or drop one anywhere in the window), pick a format and quality, and MediaVault handles the rest with a concurrent download queue powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp).

## Features

- **URL downloads** — paste or drag-and-drop media URLs; MediaVault analyzes them with yt-dlp and shows a media picker before downloading
- **Download queue** — configurable number of concurrent downloads with live progress, pause, and cancel
- **History** — finished, failed, and cancelled jobs move to a dedicated history view with retry, remove, clear-history, and open-in-folder actions
- **Format & quality selection** — choose video/audio output format and quality per download, with configurable defaults
- **Managed dependencies** — MediaVault checks for `yt-dlp` and `ffmpeg` on first launch and can download them into its own bin directory, so there is nothing to install manually
- **Settings** — default output folder, max concurrent downloads, default quality/format/bitrate, light/dark theme
- **File conversion** *(work in progress)* — the converter UI is in place; the ffmpeg-backed conversion pipeline is not wired up yet

## Tech stack

| Layer | Tools |
| --- | --- |
| Desktop shell | [Tauri 2](https://tauri.app/) (Rust) |
| Frontend | React 19, TypeScript, Vite |
| UI | Tailwind CSS 4, shadcn/ui (Radix), lucide-react, sonner |
| State | Zustand |
| Media engines | yt-dlp, ffmpeg (auto-managed) |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ and [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/) (stable toolchain)
- Platform prerequisites for Tauri 2 — see the [Tauri guide](https://tauri.app/start/prerequisites/) (on Windows: WebView2, which ships with Windows 11)

### Run in development

```sh
pnpm install
pnpm tauri dev
```

On first launch, open the app and let it install its managed copies of `yt-dlp` and `ffmpeg` if they are not already on your system.

### Build a release binary

```sh
pnpm tauri build
```

The installer/bundle is written to `src-tauri/target/release/bundle/`.

## Project structure

```
src/                    React frontend
  components/           UI panels (queue, history, converter, settings, …)
  hooks/                Download event + global drag-and-drop hooks
  lib/                  Tauri command wrappers, download queue, URL parsing
  store/                Zustand app store (downloads, conversions, settings)
src-tauri/
  src/download.rs       yt-dlp download orchestration + progress events
  src/media.rs          Media info / analysis (yt-dlp -J)
  src/utils.rs          Dependency check + managed install of yt-dlp/ffmpeg
```

## Disclaimer

MediaVault is intended for downloading content you have the right to download (your own uploads, openly licensed media, etc.). Respect the terms of service of the platforms you use and the copyright of content owners.
