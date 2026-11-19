# Contributing to dsh-nai5-studio

Thank you for your interest in contributing to `dsh-nai5-studio`!

## Development Setup

1. Ensure Node.js `>=22.2.0` is installed. Optional thumbnail & comic stitching features require Python 3 with `Pillow` (`pip install Pillow`).
2. Never edit generated artifacts (`client.js`, `cordis.patch.yml`) directly — modify `src/*`, `persona.md`, or `scripts/build.mjs` and rebuild.

```bash
npm run build
npm run check
npm test
```

## Guidelines

- Keep zero runtime npm dependencies unless genuinely necessary; prefer Node.js built-in modules (`node:fs`, `node:zlib`, `node:crypto`, `node:test`).
- Preserve cross-platform compatibility across `win32`, `darwin`, and `linux`. Do not hardcode OS-specific paths or shell commands without platform dispatch.
- Keep `src/` modular and rebuild `client.js` cleanly before committing.
- Never commit API credentials, personal output directories, or third-party proprietary asset packs.
