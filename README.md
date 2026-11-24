# dsh-nai5-studio

**dsh-nai5-studio** 是面向 **DeepSeek Harness (DSH)** 的 NovelAI Diffusion V5 原生直连生图插件与独立浮层工作台，同时内置标准 Stdio **MCP Server**（可独立接入 Antigravity / Claude Desktop / Cursor 等客户端）。

本仓库以完全自包含、跨平台（Windows / macOS / Linux）和零私有依赖为目标构建：不捆绑 API 密钥、个人角色库、私密中转地址或第三方法典/词库数据包，所有个人预设与词库均作为**可选外部配置**按需加载或通过界面一键导入。

---

## 核心特性

- **NovelAI Diffusion V5 / V4.5 原生直连引擎** (`lib/client.js`, `lib/linter.js`)
  - 直接请求 NovelAI 生成接口并提取 ZIP/PNG，原生支持 V5 最高 **22 个独立角色分框 (`characterPrompts`)**、2D `(X, Y)` 坐标站位、14 / 28 / 50 步质量档位、Vibe Transfer 与 V4.5 Precise Reference（自动白底填充 `1024×1536` / `1472×1472` / `1536×1024` 与 multipart 编码）。
  - 完整图生图 (`img2img`)、涂抹局部重绘 (`inpaint`)、2×/4× 原生无损超分 (`upscale`) 与导演工具 (`bg-removal` / `line-art` / `sketch` / `colorize` / `emotion` / `declutter`)。
  - 自动修复 V5 权重语法 (`repairV5Prompt`)、3MP 面积自动等比钳位、`0` CFG 保留、本地 Anlas 估算与同 Seed 幂等去重缓存。
  - 原生写入 UTF-8 `iTXt` / `tEXt` 元数据块，兼容 NAI 官网拖入识别中文提示词。
- **Canvas-First 枫霜毛玻璃悬浮工作台** (`src/*` -> `client.js`)
  - 左侧 3 层创建检查器（提示词 / 角色与参考 / 参数与协同）固定底部极速芯片栏与 CTA，右侧宽阔画布舞台内置局部重绘涂抹画笔、A/B 对比滑块与后处理浮动工具栏。
  - 自适应系统与 DSH 宿主亮暗主题（霜晓浅色 / 玄月深色），内置 4 套纯 CSS 枫霜景致（朔月寒霜 / 霜晓素雪 / 孤枫水墨 / 雪暮金灯）、3 档画卷通透度，支持「赏画」透视切景、画廊/灯箱一键「设为画卷」，以及在「景致 ▾」菜单内直接**上传本地图片作为底层背景**。
  - 可拖拽 2D 角色坐标画布、快捷群像排布（双人 / 三人 / 四人 / 六人 / 九人 / 十二人）、提示词权重步进按钮（`1.1::tag::`）与可视化词组权重抽屉。
  - 对话参数同步锁与自动镜像：支持将工作台画风、画幅、固定 Seed 与 2D 站位一键锁定同步到 DSH 对话生成流。
- **虚拟化原比例瀑布流画廊、收藏夹与暗房灯箱** (`lib/archive.js`, `lib/thumb.js`)
  - 按 `YYYY-MM-DD/<character>/<HHMMSS>_<character>_<topic>_<rating>_<style>_s<seed>.png` 自动归档，支持收藏夹标星筛选 (`favorites`) 与批量归类移动 / 物理删除。
  - 并发 Python/Pillow WebP 缩略图与 `workers/image_helper.py` 图像处理（未安装 Python 或 Pillow 时自动无感降级返回原图或使用纯 JS 后备解析），配合 SSE 实时推送刷新。
- **可选画风预设 / OC 库 / 一键导入词库与法典** (`lib/danbooru.js`, `data/synonyms.json`)
  - 高性能 Structure-of-Arrays (SoA) 检索内核，内置干净的中英文构图/光影/服饰/画风同义词映射，支持 **50 万+ 词条**跨 简体/繁體/日语/韩语 与 D站官方别名毫秒级检索。
  - 支持在「词库与法典」标签页点击 **「导入词库/法典」** 直接上传 `.nai5pack.gz` 一体包、单本法典 `.json` 或 4 种常见格式的 `.csv` 词表（9 列扩展四语表 / 6 列标准表 / 12 列中文全量总表 / 4 列 SD 自动补全表，自动兼容 UTF-8 与 GBK）；也可在工作台弹窗一键导入 JSON 预设，或放置外部配置文件到 `<dataDir>`。
- **多账号管理与分格漫画拼版**
  - 支持 NovelAI 官方 (`https://image.novelai.net`) 与兼容 `/v1/models` 的自定义中转端点，内置连通性测试与一键切换。
  - 独立 `workers/stitch_comic.py` 支持 `4koma`、`grid-2x2`、`manga-classic`、`vertical-3` 四种排版与跨平台中文字体矢量气泡渲染。

---

## 快速开始

### 1. 环境要求

- **Node.js** `>= 22.2.0`（零外部 npm 运行时依赖）
- **Python 3 + Pillow**（可选，用于 WebP 缩略图加速与 `stitch_comic` 漫画拼版：`pip install Pillow`）

### 2. 安装到 DeepSeek Harness (DSH)

```bash
git clone https://github.com/taizaizhi747-dotcom/dsh-nai5-studio.git
cd dsh-nai5-studio
```

将本目录作为 bundle/插件接入 DSH（例如使用 DSH `plugin_manager` 或在 DSH profile `package.json` 中 link 本目录），`dsh.bundle.patch` 会自动加载根目录的 [`cordis.patch.yml`](file:///cordis.patch.yml) 与 [`client.js`](file:///client.js)。

安装后进入 DSH 界面：
- 按 **`Alt + N`** 或点击右下角悬浮球展开工作台；
- 右侧边栏「NAI5 Studio」启动卡片也可一键打开工坊、画廊或重置窗口位置。

### 3. 独立 MCP Server 接入（Antigravity / Claude Desktop / Cursor）

本仓库自带标准 Stdio MCP Server [`mcp_server.mjs`](file:///mcp_server.mjs)，提供 16 个原生工具：
`generate_image`, `img2img`, `inpaint`, `upscale`, `director_tool`, `estimate_cost`, `get_state`, `list_accounts`, `switch_account`, `list_history`, `read_image_metadata`, `search_danbooru`, `search_codex`, `get_related_tags`, `get_artist_recommendations`, `stitch_comic`。

在 MCP 配置文件中添加：

```json
{
  "mcpServers": {
    "nai5-studio": {
      "command": "node",
      "args": ["/absolute/path/to/dsh-nai5-studio/mcp_server.mjs"],
      "env": {
        "NAI5_DATA_DIR": "/path/to/your/nai5-data",
        "NAI5_OUTPUT_DIR": "/path/to/your/outputs"
      }
    }
  }
}
```

如果通过 npm 全局或局部安装，也可以直接使用 `bin` 命令 `dsh-nai5-studio-mcp`。

---

## 首次运行与账号配置

首次使用无需手动建立复杂配置文件：

1. **Web 工作台引导**：打开悬浮窗后，顶部会提示配置 API 账号；点击「立即配置 API Key」即可在右上角弹窗中填写 NovelAI 官方 Endpoint（`https://image.novelai.net`）或任意兼容中转站地址与 Token。
2. **配置文件路径**：凭据会自动保存在数据目录（默认 `~/.dsh/nai5-studio/credentials.json`），结构示例见 [`examples/credentials.example.json`](file:///examples/credentials.example.json)。
3. **环境变量直连**（可选，适合容器或 CI）：设置 `NAI_TOKEN`（或 `NOVELAI_API_KEY`）与可选 `NAI_ENDPOINT`。

---

## 可选外部配置与扩展包

所有数据与输出目录默认跨平台自动解析，也可通过插件配置 (`config`) 或环境变量覆盖：

| 配置项 (`config.*`) | 环境变量 | 默认位置 | 说明 |
| --- | --- | --- | --- |
| `dataDir` | `NAI5_DATA_DIR` | `~/.dsh/nai5-studio` | 插件数据根目录 |
| `outputDir` | `NAI5_OUTPUT_DIR` | `~/Pictures/NAI5-Studio` | 成品 PNG 与归档目录（同时自动生成 `.nai5-archive.jsonl`） |
| `credentialsFile` | `NAI5_CREDENTIALS_FILE` | `<dataDir>/credentials.json` | 多账号凭据 JSON |
| `artistPresetsFile` | `NAI5_ARTIST_PRESETS_FILE` | `<dataDir>/artist_presets.json` | 可选画师/风格预设（也可在 UI 内点击「导入」直接载入） |
| `ocPresetsFile` | `NAI5_OC_PRESETS_FILE` | `<dataDir>/oc_presets.json` | 可选 OC 角色库（也可在 UI 内点击「导入」直接载入） |
| `characterRulesFile` | `NAI5_CHARACTER_RULES_FILE` | `<dataDir>/character_rules.json` | 可选角色自动归档正则规则 |
| `codexDir` | `NAI5_CODEX_DIR` | `<dataDir>/codexes` | 可选外置提示词法典 JSON 文件夹 |
| `danbooruCsv` | `DANBOORU_CSV_PATH` | `<dataDir>/danbooru-cn.csv` | 可选多语 Danbooru CSV 词表（自动识别 9 列四语/6 列标准/12 列中文总表/4 列 SD 补全表及 UTF-8/GBK） |
| `wallpaperFile` | `NAI5_WALLPAPER_FILE` | `<dataDir>/wallpaper.{webp,png,jpg,jpeg}` | 可选工作台自定义背景原画 |

所有 JSON 文件结构均已在 [`examples/`](file:///examples) 目录提供标准示例。

---

## 内置 Agent Skill 与推荐搭配技能

### 1. 内置核心技能（MIT 协议）

仓库自带面向 Agent 的工具工作流与 V5 提词规范技能：

- 入口文件：[`skills/nai5-studio-workflow/SKILL.md`](./skills/nai5-studio-workflow/SKILL.md)
- 提词参考：[`skills/nai5-studio-workflow/references/v5-prompt-guide.md`](./skills/nai5-studio-workflow/references/v5-prompt-guide.md)

**接入方式**：
- **DSH**：在 `@deepseek-ai/dsh-skill-filesystem` 的 `customSkillDirs` 中添加 `/path/to/dsh-nai5-studio/skills`。
- **Antigravity / Claude Code / Codex CLI**：将 `dsh-nai5-studio/skills/nai5-studio-workflow` 复制或软链接到你的全局或项目 `.agents/skills/`（或 `.claude/skills/`）目录即可按需加载。

### 2. 进阶画面构思与多模块写作技能（第三方独立安装）

如果你需要重度的插画构图构思、连续分镜脚本、OC 角色与服装设计完整方法论，推荐额外搭配上游社区项目：

- **[Miint-Sunny/nai5-prompting](https://github.com/Miint-Sunny/nai5-prompting)**（开源协议：`GPL-3.0-only`）

> 由于许可证边界不同（本插件为 **MIT** 协议，而 `nai5-prompting` 为 **GPL-3.0-only**），本仓库不将其代码或文本直接混包分发。按上述仓库说明将其技能包挂载到你的 `skills` / `customSkillDirs` 目录后，即可与本插件及 `nai5-studio-workflow` 无缝协同工作。

---

## 安全与隐私边界

- **Origin 隔离**：所有 `/api/novelai/*` HTTP 接口均校验 `Origin`，仅放行 `localhost` / `127.0.0.1` / `[::1]`、`app://-` 与 `file://` 请求，拒绝跨站外部域访问。
- **目录沙箱**：图片读取、元数据分析、删除与系统文件管理器定位接口均经过 `path.resolve` + `fs.realpathSync` 真实路径约束，严格限制在配置的 `outputDir` 内部。
- **本地凭据**：API Key 仅写入本地 `credentials.json`，并在 `list_accounts` / 接口与界面展示时做掩码脱敏。

---

## 开发与测试

```bash
# 重新打包 src/* -> client.js 与 persona.md -> cordis.patch.yml，并执行全量语法检查
npm run build

# 仅执行语法与构建一致性检查
npm run check

# 运行完整自包含单元测试（全部在临时目录沙箱执行，不污染本机环境）
npm test
```

---

## 开源协议

本项目基于 [MIT License](file:///LICENSE) 开源。
