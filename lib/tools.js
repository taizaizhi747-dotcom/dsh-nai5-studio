import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readPngMetadataFromFile, extractNormalizedMeta } from './png.js';
import { archiveManager } from './archive.js';
import { danbooruEngine } from './danbooru.js';
import { getWorkersDir, resolvePythonCommand } from './paths.js';

const execFileAsync = promisify(execFile);
const STITCH_SCRIPT = path.join(getWorkersDir(), 'stitch_comic.py');

export function createNovelAITools(client) {
  const generateTool = {
    name: 'generate_image',
    description: 'Generate images directly using NovelAI Diffusion V5. Writes production PNGs with embedded metadata directly to disk without external dependencies.',
    parameters: {
      type: 'object',
      properties: {
        positivePrompt: {
          type: 'string',
          description: 'Positive prompt tags and natural language scene description.'
        },
        prompt: {
          type: 'string',
          description: 'Alias for positivePrompt.'
        },
        negativePrompt: {
          type: 'string',
          description: 'Universal negative prompt (UC) tags.'
        },
        uc: {
          type: 'string',
          description: 'Alias for negativePrompt.'
        },
        stylePrompt: {
          type: 'string',
          description: 'Optional artist and style prompt block enclosed in <artist>...</artist>, <style>...</style>.'
        },
        style: {
          type: 'string',
          description: 'Optional preset code or name resolved from user artist_presets.json when stylePrompt is omitted.'
        },
        character: {
          type: 'string',
          description: 'Primary character name for folder and archive classification.'
        },
        topic: {
          type: 'string',
          description: 'Short scene/theme slug for filename and archive organization.'
        },
        rating: {
          type: 'string',
          enum: ['Safe', 'R18', 'X'],
          description: 'Content rating tag for filename and archive classification.'
        },
        idempotencyKey: {
          type: 'string',
          description: 'Optional client request deduplication key to prevent duplicate billing on retries.'
        },
        characterPrompts: {
          type: 'array',
          description: 'Independent character prompt boxes with coordinates and character-specific UC (supports up to 22 characters in NAI V5).',
          items: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              uc: { type: 'string' },
              negativePrompt: { type: 'string' },
              x: { type: 'number', description: 'Horizontal center position (0 to 1).' },
              y: { type: 'number', description: 'Vertical center position (0 to 1).' },
              useCoords: { type: 'boolean', description: 'Whether to use exact spatial coordinates.' }
            },
            required: ['prompt']
          }
        },
        width: {
          type: 'number',
          description: 'Width in pixels (default 832 for portrait, 1216 for landscape, 1024 for square).'
        },
        height: {
          type: 'number',
          description: 'Height in pixels (default 1216 for portrait, 832 for landscape, 1024 for square).'
        },
        steps: {
          type: 'number',
          description: 'Sampling steps (default 28).'
        },
        cfgScale: {
          type: 'number',
          description: 'CFG prompt guidance scale (default 5.5).'
        },
        scale: {
          type: 'number',
          description: 'Alias for cfgScale.'
        },
        cfgRescale: {
          type: 'number',
          description: 'CFG rescale factor (default 0).'
        },
        sampler: {
          type: 'string',
          description: 'Sampler algorithm (default k_euler_ancestral).'
        },
        seed: {
          type: 'number',
          description: 'RNG seed (randomized if omitted).'
        },
        fileNamePrefix: {
          type: 'string',
          description: 'Prefix for output filename.'
        },
        model: {
          type: 'string',
          description: 'Model id (nai-diffusion-5-full, nai-diffusion-5-full-medium, or nai-diffusion-4-5-full).'
        },
        effort: {
          type: 'string',
          enum: ['high', 'medium'],
          description: 'V5 generation effort tier (high=28 steps, medium=14 steps low-cost/fast).'
        },
        noiseSchedule: {
          type: 'string',
          enum: ['karras', 'exponential', 'polyexponential', 'native'],
          description: 'Sampler noise schedule (default karras).'
        },
        variety: {
          type: 'boolean',
          description: 'Enable Variety+ diversity boost (skip_cfg_above_sigma=58).'
        },
        transparentBackground: {
          type: 'boolean',
          description: 'Enable NAI V5 straight-alpha transparent background output.'
        },
        count: {
          type: 'number',
          description: 'Number of sequential batch images to generate (1-8, default 1).'
        },
        vibeReferences: {
          type: 'array',
          description: 'Optional Vibe Transfer reference images ({ image, strength, infoExtracted }).',
          items: {
            type: 'object',
            properties: {
              image: { type: 'string' },
              strength: { type: 'number' },
              infoExtracted: { type: 'number' }
            },
            required: ['image']
          }
        },
        preciseReferences: {
          type: 'array',
          description: 'Optional V4.5 Precise Reference images ({ image, type, strength, fidelity }). Auto-routes to V4.5 multipart.',
          items: {
            type: 'object',
            properties: {
              image: { type: 'string' },
              type: { type: 'string', enum: ['character&style', 'character', 'style'] },
              strength: { type: 'number' },
              fidelity: { type: 'number' }
            },
            required: ['image']
          }
        }
      }
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          filePath: { type: 'string' },
          seed: { type: 'number' },
          anlas: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          steps: { type: 'number' }
        },
        required: ['ok', 'filePath', 'seed']
      },
      render: (_args, val) => [{
        type: 'text',
        text: JSON.stringify(val)
      }]
    },
    async execute(args) {
      return await client.generateImage(args || {}, { source: 'agent' });
    }
  };

  const estimateTool = {
    name: 'estimate_cost',
    description: 'Estimate Anlas cost for a generation task without executing it.',
    parameters: {
      type: 'object',
      properties: {
        width: { type: 'number' },
        height: { type: 'number' },
        steps: { type: 'number' }
      }
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          anlas: { type: 'number' }
        },
        required: ['ok', 'anlas']
      },
      render: (_args, val) => [{
        type: 'text',
        text: JSON.stringify(val)
      }]
    },
    async execute(args) {
      const anlas = await client.estimateCost(args || {});
      return { ok: true, anlas };
    }
  };

  const getStateTool = {
    name: 'get_state',
    description: 'Get current active NovelAI account status, subscription tier, endpoint, and remaining Anlas balance.',
    parameters: {
      type: 'object',
      properties: {}
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          configured: { type: 'boolean' },
          tier: { type: 'string' },
          anlasBalance: { oneOf: [{ type: 'number' }, { type: 'null' }] },
          balanceSupported: { type: 'boolean' },
          active: { type: 'boolean' },
          accountId: { type: 'string' },
          accountName: { type: 'string' },
          endpoint: { type: 'string' }
        },
        required: ['ok', 'configured']
      },
      render: (_args, val) => [{
        type: 'text',
        text: JSON.stringify(val)
      }]
    },
    async execute() {
      const data = await client.getUserData();
      return { ok: true, ...data };
    }
  };

  const listHistoryTool = {
    name: 'list_history',
    description: 'List compact summaries of recent image generation archive records (limit default 8, max 20).',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          default: 8,
          description: 'Number of recent records to retrieve (default 8, max 20).'
        }
      }
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          total: { type: 'number' },
          records: {
            type: 'array',
            items: { type: 'object' }
          }
        },
        required: ['ok', 'records']
      },
      render: (_args, val) => {
        const recs = Array.isArray(val?.records) ? val.records : [];
        if (!recs.length) return [{ type: 'text', text: 'History: empty (0 records).' }];
        const lines = recs.map((r, i) =>
          `${i + 1}. ${r.character || '未命名'}/${r.topic || '-'} [${r.rating || '-'}|${r.styleCode || '-'}|s${r.seed ?? ''}|${r.width || '?'}x${r.height || '?'}] ${r.filePath || r.filename || ''}${r.promptPreview ? ' :: ' + r.promptPreview : ''}`
        );
        return [{ type: 'text', text: `History (${recs.length}/${val.total ?? recs.length}):\n${lines.join('\n')}` }];
      }
    },
    async execute(args) {
      const limit = Math.min(20, Math.max(1, Number(args?.limit) || 8));
      const res = archiveManager.listRecent(limit);
      const compactRecords = (res?.records || []).map(r => {
        const rawPrompt = String(r.prompt || '').replace(/\s+/g, ' ').trim();
        return {
          filename: r.filename,
          filePath: r.source_path || r.filePath,
          character: r.character,
          topic: r.topic,
          rating: r.rating,
          styleCode: r.styleCode,
          seed: r.seed,
          width: r.width,
          height: r.height,
          promptPreview: rawPrompt.length > 100 ? rawPrompt.slice(0, 100) + '...' : rawPrompt
        };
      });
      return { ok: true, total: res?.total ?? compactRecords.length, records: compactRecords };
    }
  };

  const readMetadataTool = {
    name: 'read_image_metadata',
    description: 'Read deduplicated NovelAI prompt parameters and generation settings embedded in a PNG file.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute or relative path to the PNG image file.'
        }
      },
      required: ['filePath']
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          metadata: { type: 'object' }
        },
        required: ['ok', 'metadata']
      },
      render: (_args, val) => [{
        type: 'text',
        text: JSON.stringify(val)
      }]
    },
    async execute(args) {
      if (!args?.filePath || !fs.existsSync(args.filePath)) {
        throw new Error(`File not found: ${args?.filePath}`);
      }
      const norm = extractNormalizedMeta(args.filePath);
      const cleanMeta = {};
      for (const [k, v] of Object.entries(norm)) {
        if (v !== undefined) cleanMeta[k] = v;
      }
      if (!cleanMeta.prompt && !cleanMeta.seed && !cleanMeta.steps) {
        const raw = readPngMetadataFromFile(args.filePath);
        if (raw.width) cleanMeta.width = raw.width;
        if (raw.height) cleanMeta.height = raw.height;
        if (raw.Software) cleanMeta.software = raw.Software;
        if (raw.Source) cleanMeta.source = raw.Source;
        if (raw.Description) cleanMeta.prompt = String(raw.Description).slice(0, 1500);
        else if (raw.Comment) cleanMeta.commentPreview = String(raw.Comment).slice(0, 800);
      }
      return { ok: true, metadata: cleanMeta };
    }
  };

  const searchDanbooruTool = {
    name: 'search_danbooru',
    description: 'Search user-configured Danbooru bilingual CSV tags and built-in visual synonyms (compact output, default limit 10).',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query in Chinese or English (e.g. 逆光, 旗袍, backlighting, depth of field).'
        },
        category: {
          type: 'string',
          enum: ['all', 'general', 'character', 'copyright', 'artist'],
          default: 'all',
          description: 'Filter category: all, general, character, copyright, or artist.'
        },
        limit: {
          type: 'number',
          default: 10,
          description: 'Maximum number of results to return (default 10, max 15).'
        },
        show_nsfw: {
          type: 'boolean',
          default: true,
          description: 'Whether to include NSFW tags from optional CSV.'
        }
      },
      required: ['query']
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          results: { type: 'array', items: { type: 'object' } },
          query: { type: 'string' }
        },
        required: ['prompt', 'results']
      },
      render: (_args, val) => {
        const rows = Array.isArray(val?.results) ? val.results : [];
        if (!rows.length) {
          const hint = val?.source === 'unconfigured_optional_csv'
            ? ' (no optional danbooru-cn.csv loaded; compose standard Danbooru English tags directly)'
            : '';
          return [{ type: 'text', text: `Danbooru "${val?.query || ''}": no hits${hint}.` }];
        }
        const lines = rows.map(r =>
          `- ${r.tag} [${r.category || 'general'},${r.post_count ?? 0}]${r.cn_name ? ' ' + r.cn_name : ''}`
        );
        return [{ type: 'text', text: `Danbooru "${val.query}" (${rows.length}):\n${lines.join('\n')}` }];
      }
    },
    async execute(args) {
      danbooruEngine.configure(client.config);
      return danbooruEngine.searchDanbooru(args?.query || '', { ...(args || {}), compact: true });
    }
  };

  const searchCodexTool = {
    name: 'search_codex',
    description: 'Search optional user-imported prompt codex JSON packs in the configured codex directory (compact output <=2000 chars).',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term in Chinese or English (e.g. rooftop, neon, 旗袍, 逆光).'
        },
        codex: {
          type: 'string',
          description: 'Optional filter by codex pack name or key.'
        },
        limit: {
          type: 'number',
          default: 4,
          description: 'Maximum results to return (default 4, capped at 6).'
        },
        include_negative: {
          type: 'boolean',
          default: false,
          description: 'Include truncated negative/UC snippets when inspecting UC patterns.'
        },
        max_chars: {
          type: 'number',
          default: 360,
          description: 'Max characters per entry prompt (default 360, max 600).'
        }
      },
      required: ['query']
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          results: { type: 'array', items: { type: 'object' } },
          count: { type: 'number' },
          totalMatched: { type: 'number' },
          totalEntries: { type: 'number' }
        },
        required: ['results']
      },
      render: (_args, val) => {
        const rows = Array.isArray(val?.results) ? val.results : [];
        if (!rows.length) {
          const hint = val?.totalEntries === 0 ? ' (codex folder is currently empty; optional feature)' : '';
          return [{ type: 'text', text: `Codex "${val?.query || ''}": no hits${hint}.` }];
        }
        const lines = rows.map((r, i) =>
          `${i + 1}. [${r.codex}] ${r.name}${r.category ? ` (${r.category})` : ''}: ${r.prompt}${r.negative ? `\n   UC: ${r.negative}` : ''}`
        );
        return [{
          type: 'text',
          text: `Codex "${val.query}" (${rows.length}/${val.totalMatched ?? rows.length} matched):\n${lines.join('\n')}`
        }];
      }
    },
    async execute(args) {
      danbooruEngine.configure(client.config);
      return danbooruEngine.searchCodex(args?.query || '', { ...(args || {}), compact: true });
    }
  };

  const getRelatedTagsTool = {
    name: 'get_related_tags',
    description: 'Get related visual and style tags using built-in synonyms and optional local tag database (compact output).',
    parameters: {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of English or Chinese visual tags.'
        },
        limit: {
          type: 'number',
          default: 12
        }
      },
      required: ['tags']
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          input_tags: { type: 'array', items: { type: 'string' } },
          related_tags: { type: 'array', items: { type: 'string' } },
          items: { type: 'array', items: { type: 'string' } }
        },
        required: ['related_tags']
      },
      render: (_args, val) => [{
        type: 'text',
        text: `Related tags (${(val?.input_tags || []).join(', ')}): ${(val?.items || val?.related_tags || []).join(', ') || 'none'}`
      }]
    },
    async execute(args) {
      danbooruEngine.configure(client.config);
      return danbooruEngine.getRelatedTags(args?.tags || [], { ...(args || {}), compact: true });
    }
  };

  const getArtistRecommendationsTool = {
    name: 'get_artist_recommendations',
    description: 'Recommend artist tags from optional user artist_presets.json, optional codexes, or optional Danbooru CSV.',
    parameters: {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of style/theme tags.'
        },
        limit: {
          type: 'number',
          default: 10
        }
      },
      required: ['tags']
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          query_tags: { type: 'array', items: { type: 'string' } },
          recommended_artists: { type: 'array', items: { type: 'string' } }
        },
        required: ['recommended_artists']
      },
      render: (_args, val) => [{
        type: 'text',
        text: val?.recommended_artists?.length
          ? `Recommended artists: ${val.recommended_artists.join(', ')}`
          : `Recommended artists: none (${val?.note || 'configure optional artist presets or Danbooru CSV to enable'})`
      }]
    },
    async execute(args) {
      danbooruEngine.configure(client.config);
      return danbooruEngine.recommendArtists(args?.tags || [], { ...(args || {}), compact: true });
    }
  };

  const stitchComicTool = {
    name: 'stitch_comic',
    description: 'Stitch multiple panel images into a unified manga page with layout and speech bubble dialogues (supports 4koma, grid-2x2, manga-classic, vertical-3). Requires Python 3 + Pillow.',
    parameters: {
      type: 'object',
      properties: {
        panels: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of image file paths for the panels (e.g. 4 images for 4koma).'
        },
        layout: {
          type: 'string',
          enum: ['4koma', 'grid-2x2', 'manga-classic', 'vertical-3'],
          default: '4koma',
          description: 'Manga page grid layout.'
        },
        dialogues: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of dialogue text lines for speech bubbles.'
        },
        outPath: {
          type: 'string',
          description: 'Optional output PNG file path. If omitted, saves under <outputDir>/comics/.'
        }
      },
      required: ['panels']
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          filePath: { type: 'string' },
          layout: { type: 'string' }
        },
        required: ['ok', 'filePath']
      },
      render: (_args, val) => [{
        type: 'text',
        text: JSON.stringify(val)
      }]
    },
    async execute(args) {
      const panels = args?.panels || [];
      if (!panels.length) throw new Error('At least one panel image is required.');
      const pythonCmd = resolvePythonCommand();
      if (!pythonCmd) {
        throw new Error('Comic stitching requires Python 3 with Pillow installed (`pip install Pillow`).');
      }

      const layout = args.layout || '4koma';
      let outPath = args.outPath;
      if (!outPath) {
        const now = new Date();
        const dir = path.join(client.getOutputDir(), 'comics');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        outPath = path.join(dir, `manga_${now.toISOString().replace(/[:.]/g, '-')}.png`);
      }

      const cmdArgs = [
        '-B',
        STITCH_SCRIPT,
        '--panels', ...panels,
        '--layout', layout,
        '--out', outPath
      ];
      if (Array.isArray(args.dialogues) && args.dialogues.length > 0) {
        cmdArgs.push('--dialogues', ...args.dialogues);
      }

      try {
        await execFileAsync(pythonCmd, cmdArgs, { encoding: 'utf8', timeout: 60000, windowsHide: true });
      } catch (err) {
        const detail = err?.stderr || err?.stdout || err?.message || String(err);
        if (/No module named ['"]PIL['"]/i.test(detail)) {
          throw new Error('Comic stitching requires Pillow (`pip install Pillow`).');
        }
        throw new Error(`Comic stitching failed: ${detail}`);
      }
      return { ok: true, filePath: outPath.replace(/\\/g, '/'), layout };
    }
  };

  const listAccountsTool = {
    name: 'list_accounts',
    description: 'List configured NovelAI API accounts (with masked tokens) and show which account is currently active.',
    parameters: {
      type: 'object',
      properties: {}
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          activeAccountId: { type: 'string' },
          accounts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                endpoint: { type: 'string' },
                tokenMasked: { type: 'string' },
                isActive: { type: 'boolean' }
              }
            }
          }
        },
        required: ['ok', 'activeAccountId', 'accounts']
      },
      render: (_args, val) => [{
        type: 'text',
        text: JSON.stringify(val)
      }]
    },
    async execute() {
      const summary = client.listAccounts();
      return { ok: true, ...summary };
    }
  };

  const switchAccountTool = {
    name: 'switch_account',
    description: 'Switch the active NovelAI API account by id, name, or endpoint substring, taking effect immediately.',
    parameters: {
      type: 'object',
      properties: {
        account: {
          type: 'string',
          description: 'Account id (e.g. "acc-official", "acc-relay"), name, or endpoint hostname.'
        }
      },
      required: ['account']
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          activeAccountId: { type: 'string' },
          activeAccount: { type: 'object' },
          state: { type: 'object' }
        },
        required: ['ok', 'activeAccountId']
      },
      render: (_args, val) => [{
        type: 'text',
        text: JSON.stringify(val)
      }]
    },
    async execute(args) {
      const switched = client.switchAccount(args?.account || args?.id);
      let state = null;
      try {
        state = await client.getUserData();
      } catch (err) {
        state = { error: err.message };
      }
      return { ok: true, ...switched, state };
    }
  };

  const img2imgTool = {
    name: 'img2img',
    description: 'Run image-to-image transformation using NovelAI V5 or V4.5. Accepts local path, base64, or data URL as source image. Requires Python 3 + Pillow.',
    parameters: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Source image file path, base64, or data URL.' },
        strength: { type: 'number', description: 'Transformation strength 0..1 (default 0.55).' },
        noise: { type: 'number', description: 'Extra noise amount 0..1 (default 0).' },
        positivePrompt: { type: 'string' },
        negativePrompt: { type: 'string' },
        stylePrompt: { type: 'string' },
        style: { type: 'string' },
        character: { type: 'string' },
        topic: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
        steps: { type: 'number' },
        cfgScale: { type: 'number' },
        seed: { type: 'number' },
        model: { type: 'string' }
      },
      required: ['image']
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          filePath: { type: 'string' },
          seed: { type: 'number' },
          anlas: { type: 'number' }
        },
        required: ['ok', 'filePath']
      },
      render: (_args, val) => [{ type: 'text', text: JSON.stringify(val) }]
    },
    async execute(args) {
      return await client.img2img(args || {}, { source: 'agent' });
    }
  };

  const inpaintTool = {
    name: 'inpaint',
    description: 'Inpaint (redraw masked region) using NovelAI V5/V4.5 inpainting model. Supply either a binary mask image or normalized maskRegions. Requires Python 3 + Pillow.',
    parameters: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Base image path, base64, or data URL.' },
        mask: { type: 'string', description: 'White-on-black mask PNG path or data URL.' },
        maskRegions: {
          type: 'array',
          description: 'Optional list of geometric regions ({ x, y, w, h, shape }) to synthesize mask when mask image is omitted.',
          items: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
              w: { type: 'number' },
              h: { type: 'number' },
              shape: { type: 'string', enum: ['rect', 'ellipse'] }
            }
          }
        },
        strength: { type: 'number', description: 'Inpaint blend strength 0..1 (default 0.7).' },
        colorCorrect: { type: 'boolean', description: 'Enable color correction (default true).' },
        positivePrompt: { type: 'string' },
        negativePrompt: { type: 'string' },
        stylePrompt: { type: 'string' },
        style: { type: 'string' },
        character: { type: 'string' },
        topic: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
        steps: { type: 'number' },
        cfgScale: { type: 'number' },
        seed: { type: 'number' }
      },
      required: ['image']
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          filePath: { type: 'string' },
          seed: { type: 'number' },
          anlas: { type: 'number' }
        },
        required: ['ok', 'filePath']
      },
      render: (_args, val) => [{ type: 'text', text: JSON.stringify(val) }]
    },
    async execute(args) {
      return await client.inpaint(args || {}, { source: 'agent' });
    }
  };

  const upscaleTool = {
    name: 'upscale',
    description: 'Upscale an artwork 2x or 4x using NovelAI /ai/upscale endpoint and save to the archive. Requires Python 3 + Pillow.',
    parameters: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Source image file path, base64, or data URL.' },
        scale: { type: 'number', enum: [2, 4], description: 'Upscale factor: 2 or 4 (runs two 2x passes).' },
        character: { type: 'string' },
        topic: { type: 'string' }
      },
      required: ['image']
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          filePath: { type: 'string' },
          width: { type: 'number' },
          height: { type: 'number' },
          anlas: { type: 'number' }
        },
        required: ['ok', 'filePath']
      },
      render: (_args, val) => [{ type: 'text', text: JSON.stringify(val) }]
    },
    async execute(args) {
      return await client.upscaleImage(args || {}, { source: 'agent' });
    }
  };

  const directorTool = {
    name: 'director_tool',
    description: 'Apply NovelAI Director Tools (/ai/augment-image): background removal, lineart, sketch, colorize, emotion edit, or declutter. Requires Python 3 + Pillow.',
    parameters: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Source image file path, base64, or data URL.' },
        tool: {
          type: 'string',
          enum: ['bg-removal', 'lineart', 'sketch', 'colorize', 'emotion', 'declutter'],
          description: 'Director tool mode.'
        },
        defry: { type: 'number', description: 'Intensity/defry 0..5 (default 0).' },
        prompt: { type: 'string', description: 'Colorize guidance prompt (used when tool=colorize).' },
        emotion: { type: 'string', description: 'Target expression e.g. happy, sad, angry, blush, surprised.' },
        emotionLevel: { type: 'string', enum: ['normal', 'slightly_weak', 'weak', 'even_weaker', 'very_weak', 'strong'], description: 'Emotion strength.' },
        character: { type: 'string' },
        topic: { type: 'string' }
      },
      required: ['image', 'tool']
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          filePath: { type: 'string' },
          anlas: { type: 'number' }
        },
        required: ['ok', 'filePath']
      },
      render: (_args, val) => [{ type: 'text', text: JSON.stringify(val) }]
    },
    async execute(args) {
      return await client.directorTool(args || {}, { source: 'agent' });
    }
  };

  return [
    generateTool,
    img2imgTool,
    inpaintTool,
    upscaleTool,
    directorTool,
    estimateTool,
    getStateTool,
    listAccountsTool,
    switchAccountTool,
    listHistoryTool,
    readMetadataTool,
    searchDanbooruTool,
    searchCodexTool,
    getRelatedTagsTool,
    getArtistRecommendationsTool,
    stitchComicTool
  ];
}
