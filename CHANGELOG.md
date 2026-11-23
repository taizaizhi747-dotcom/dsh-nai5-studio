# Changelog

All notable changes to `dsh-nai5-studio` will be documented in this file.

## [2.0.0] - 2026-11-24

### Added
- **Canvas-First Frost & Maple Atelier UI**: Refactored floating workbench (`src/workbench.js`, `src/studio.js`, `src/theme.css`) into a docked 3-layer inspector (Prompt / Characters & References / Params & DSH Bridge) paired with an expansive Hero Canvas Stage (`InpaintMaskEditor`, `CompareSlider`, `PostProcessToolbar`, collapsible filmstrip) and pinned quick-status footer chips.
- **4 Pure-CSS Atelier Scenes & Custom Canvas Backdrop**: Added curated Frost & Maple scenes (`moonblade`, `dawn-snow`, `maple-ink`, `lantern-dusk`), 3-level translucency selector (`soft`, `balanced`, `vivid`), `◀ / ▶` scene cycling inside `赏画` peek mode, and one-click `设为画卷` custom backdrop from Gallery or Lightbox while preserving `/api/novelai/wallpaper`.
- **Full Image-to-Image, Inpaint, Upscale & Director Pipeline**: Added `img2img`, `inpaint`, `upscale`, and `director_tool` (16 total MCP tools in `mcp_server.mjs` plus HTTP routes `/api/novelai/img2img`, `/inpaint`, `/upscale`, `/director`, `/repair-prompt`, `/inspect-upload`).
- **Vibe Transfer, V4.5 Precise Reference & Batch Generation**: Added `vibeReferences` encoding cache, `preciseReferences` (auto-switching to `nai-diffusion-4-5-full` with official white-flattened padded geometry via `workers/image_helper.py` and multipart form upload), `count` (1–8 batch outputs), `noiseSchedule`, `variety`, `transparentBackground`, and `14` (`effort: 'medium'`) / `28` / `50` step quality tiers.
- **Favorites & Batch Gallery Management**: Added persistent Favorites (`.cache/favorites.json`, `/api/novelai/favorites`, `/favorites/toggle`), expandable non-squishing character filter pills, and batch move / batch delete actions in `GalleryView` and `LightboxOverlay`.
- **Prompt Syntax Auto-Repair**: Added `repairV5Prompt` in `lib/linter.js` for fixing full-width delimiters and V5 weighting spacing.

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
