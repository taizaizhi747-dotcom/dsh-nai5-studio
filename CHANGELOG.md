# Changelog

All notable changes to `dsh-nai5-studio` will be documented in this file.

## [1.0.0] - 2026-11-19

### Added
- Standalone open-source DSH plugin package layout (`package.json`, `index.js`, `client.js`, `cordis.patch.yml`, `mcp_server.mjs`) with MIT license.
- Cross-platform path resolution (`lib/paths.js`) and OS-native file reveal (`win32`, `darwin`, `linux`).
- Optional user-managed artist presets, OC character presets, character naming rules, external Danbooru CSV, and custom prompt codex packs with in-UI JSON import.
- Zero-config first-run account onboarding popover for official `https://image.novelai.net` and compatible relay endpoints.
- Neutral professional illustration & comic assistant persona (`persona.md`).
- Standalone Python comic stitcher (`workers/stitch_comic.py`) and concurrent WebP thumbnail worker (`workers/thumb_worker.py`) with clean fallback when Python/Pillow is unavailable.
- Bundled MIT-licensed `skills/nai5-studio-workflow` agent skill and NovelAI V5 prompting reference (`references/v5-prompt-guide.md`).
- Self-contained Node `--test` test suite and multi-OS GitHub Actions CI workflow.
