---
name: nai5-studio-workflow
description: Use when generating anime or illustration artwork with dsh-nai5-studio (NovelAI Diffusion V5), assembling V5 single or multi-character prompts, querying optional Danbooru tags or codex packs, inspecting PNG metadata or history, switching NovelAI accounts, or stitching multi-panel comic pages.
---

# NAI5 Studio 生图与工作流指南

本技能配合 `dsh-nai5-studio`（DSH 插件或独立 MCP Server）使用，覆盖 NovelAI Diffusion V5 直连生图、可选词库检索、多角色坐标控制、漫画拼版与资产复用流程。

> 详细提词语法、多角色坐标隔离、权重防炸与双轨漫画结构，按需阅读：[NovelAI V5 提示词编写参考](references/v5-prompt-guide.md)。

---

## 一、 16 个原生工具分工与调用规范

| 工具名 | 用途 | 推荐调用规范 |
| --- | --- | --- |
| `generate_image` | 直连 NovelAI V5 / V4.5 渲染并结构化落盘 PNG | 无需前置 `estimate_cost`，支持 `model`、`effort` (`medium` 14 步 / `high` 28~50 步)、`noiseSchedule`、`variety`、`transparentBackground`、`count` (1~8)、`vibeReferences`、`preciseReferences` |
| `img2img` | 基于参考底图重绘演化 | 传入 `image`（文件路径 / data URI / base64）、`strength`、`noise`，保留人物与构图微调 |
| `inpaint` | 局部蒙版精准重绘 | 传入 `image` 与黑白蒙版 `mask`（白色区域重绘），可配合 `strength` 与 `colorCorrect` |
| `upscale` | NovelAI 原生无损超分辨率放大 | 支持 `scale: 2` 或 `4`，适合高精立绘与画廊大图二段增强 |
| `director_tool` | NovelAI 导演工具后处理 | 支持 `bg-removal`（一键去背）、`line-art`、`sketch`、`colorize`、`emotion`、`declutter` |
| `search_danbooru` | 查询可选双语 CSV 词表与内置同义词 | 默认 `limit: 8~10`；用于核对特定服饰、姿势或光影的标准英文 tag |
| `search_codex` | 检索用户挂载的可选法典 JSON 包 | 保持上下文精简：单次请求 `limit: 3~4`、`include_negative: false`、`max_chars: 360` |
| `get_related_tags` | 基于同义词聚类推荐关联标签 | 传入中/英文核心词列表，快速补齐构图或光影细节 |
| `get_artist_recommendations` | 从可选画师预设 / 法典 / CSV 中推荐画师 | 传入主题或画风标签列表；未配置外置库时返回空列表与提示 |
| `stitch_comic` | 多格图片拼版与矢量气泡嵌字 | 支持 `4koma`、`grid-2x2`、`manga-classic`、`vertical-3`，默认保存至 `<outputDir>/comics/` |
| `list_history` | 查看最近归档生图记录 | 默认 `limit: 8`，快速检索近期 `seed`、角色目录与文件名 |
| `read_image_metadata` | 读取 PNG 嵌入的去重生成参数 | 复刻或微调既有成图时传入图片路径 |
| `get_state` | 查询当前启用账号的套餐、余额与配置状态 | 仅在检查连接状态或余量时调用；未配置时返回 `configured: false` |
| `list_accounts` | 列出已配置账号（Token 已脱敏） | 查看可用官方或兼容中转账号 |
| `switch_account` | 切换当前活动账号 | 传入账号 `id`、备注名或接口域名子串即时切换 |
| `estimate_cost` | 预估单次生成的 Anlas 消耗 | 仅在用户明确询问费用时调用 |

---

## 二、 `generate_image` 标准装配协议

1. **标准画幅选择**
   - 单人竖构图：`832×1216`（2:3）
   - 双人 / 宽场景横构图：`1216×832`（3:2）
   - 方形构图：`1024×1024`（1:1）
2. **混合提词装配**
   - 用离散 Danbooru Tag 锁定人物发型发色、眸色、体型、典型服装件与镜头机位（骨架）。
   - 用简洁英文现在分词/介词短句描述空间从属关系、动作交互与光线走向（血肉），短句与 Tag 间以 `, ` 分隔。
   - 详见 [v5-prompt-guide.md](references/v5-prompt-guide.md)。
3. **风格预设隔离 (`style` / `stylePrompt`)**
   - 若用户已在本地配置可选 `artist_presets.json`，可传入 `style`（如 `"01"`）或显式传入 `stylePrompt`。
   - 风格串仅用于约束线条、色彩、介质与笔触，不混入人物特征或构图机位词。
4. **多角色分框与坐标 (`characterPrompts`)**
   - 多人画面最多支持 22 个独立角色框，为每位角色分别描述外貌/服装并分配 `x`、`y`（`0~1`）坐标与 `useCoords: true`，同时填写专属排他 `negativePrompt` 防止发色/服饰串色。
5. **生成档位、参考图与质量底线**
   - **步数档位**：`effort: 'medium'`（14 步极速）、`steps: 28`（标准高质）、`steps: 50`（超高精细打磨）；支持 `noiseSchedule`、`variety`（Variety+）与 `transparentBackground`（V5 直出透明 Alpha）。
   - **V4.5 精准参考与 Vibe Transfer**：传入 `preciseReferences` 时自动切至 `nai-diffusion-4-5-full` 并按官方白底填充尺寸（1024×1536 / 1472×1472 / 1536×1024）以 multipart 格式规范发送；`vibeReferences` 支持 V5 氛围迁移动态编码缓存。
   - **质量尾与负向底线**：正向末尾自动补齐或保留 `very aesthetic, masterpiece`；引擎会自动补全基础质量与防建筑畸变 UC；全年龄场景在 `negativePrompt` 中显式保留 `nsfw, nude`。

---

## 三、 结果交付规范

1. 生成成功后使用可用展示工具（如 `present`）挂载原图，并在回复中**单独成段**内嵌预览图（前后留空行，不与正文/列表同行；路径统一正斜杠并用 `<...>` 包裹）：
   - **DSH 聊天界面**（`AssistantMarkdown.tsx → fileMediaUrl`）：**只认不带 `file:///` 的原生本地绝对路径**（如 `![成品预览](</path/to/outputs/...png>)`），加 `file:///` 会被判定为非本地路径从而跳过预览。
   - **Antigravity**：使用带 `file:///` 的格式 `![成品预览](<file:///path/to/outputs/...png>)`。
2. 输出单行简洁回执：`**Seed**: <数值> ｜ **Anlas 消耗**: <数值> ｜ **原图路径**: <filePath>`。
3. 若 `get_state` 或生图返回未配置账号提示，引导用户在工作台右上角「配置账号」填写 NovelAI 官方 (`https://image.novelai.net`) 或兼容中转 API Key。
4. 结合当前成图的构图、光影与人物动态，附带 2~3 条可执行的下一步微调或剧情续写方向。
