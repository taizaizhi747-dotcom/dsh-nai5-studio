# NovelAI Diffusion V5 提示词编写参考

本指南为 `dsh-nai5-studio` 内置的通用 NovelAI Diffusion V5 提词与排版工程参考，聚焦结构清晰、低串色、可复现的提示词编写方式。

---

## 1. 标准拼装时序

建议在 `generate_image` 中按以下逻辑组织正向词与参数：

```text
[全局人数与机位] -> [<artist>/<style> 风格块（可选）] -> [角色外貌/服装] -> [动作交互与空间环境] -> [光影/氛围与质量尾]
```

示例（单人窗边场景）：

```text
1girl, solo, cowboy shot, slightly from below,
silver hair, side ponytail, amber eyes, dark tailored blazer, pleated skirt,
sitting by an open wooden window overlooking an evening street, resting her chin in her hand, looking at viewer,
warm sunset light streaming through dust motes, soft rim light, delicate shadows, very aesthetic, masterpiece
```

---

## 2. 混合提词法则（Tag 骨架 + 自然语言短句血肉）

1. **适合用离散 Danbooru Tag 锁定的核心（骨架）**
   - 角色身份指纹：发色、发型、瞳色、体型、标志性配饰（如 `long black hair, blunt bangs, red hair ribbon`）。
   - 服饰结构与材质：`pleated skirt, trench coat, translucent silk, lace trim`。
   - 基础机位与景别：`portrait, cowboy shot, full body, from above, dutch angle, depth of field`。
2. **适合用英文短句描写的动态与从属关系（血肉）**
   - 空间隶属：`leaning against the stone railing`, `standing under a glowing streetlamp`, `framed by blooming cherry branches`。
   - 连续动作与视线：`holding a steaming ceramic mug with both hands, glancing gently toward the camera`。
   - 局部光影与空气感：`cool moonlight across half of her face`, `raindrops sliding down the glass pane`。
3. **四类建议显式写清的细节**
   - **具体结构**：用 `three tall arched windows` 替代模糊的 `windows`。
   - **颜色隔离**：写明颜色归属物体（如 `navy coat, white scarf, black boots`），减少跨部位串色。
   - **物体数量**：出现成对/多件道具时明确数量（如 `two porcelain teacups on the saucer`）。
   - **体型修饰**：按需要明确身材比例，防止角色体型随画风剧烈漂移。

---

## 3. 权重语法与常见陷阱

- **增强权重**：`1.1::tag::` 或 `1.2::tag::`（建议不超过 `1.4`，避免过饱和与线条崩坏）。
- **削弱或剔除**：
  - `-1::tag::`：弱化某种属性。
  - `-2::tag::` / `-3::tag::`：强力抑制背景或多余元素。
- **数字结尾标签防粘连**：当 `artist:name01` 这类数字结尾标签包裹权重时，标签与 `::` 之间需留出逗号或空格隔离（例如 `artist:example01, ::`），本插件 `lib/linter.js` 也会自动兜底修正。
- **避免冲突词**：多角色画面不要同时保留 `solo`；`lib/linter.js` 会在多人场景下自动移除冗余 `solo` 并在 `2girls`/`2boys` 等复数词存在时清理冲突的单人词（同时保留 `1girl, 1boy` 的双人组合）。

---

## 4. V5 多角色分框与配对交互（最多 22 框）

NovelAI V5 原生支持在 `characterPrompts` 中定义最多 **22** 个独立角色框：

1. **坐标分布**：使用 `x`（左 `0` 到右 `1`）与 `y`（上 `0` 到下 `1`）指定主体重心，常用双人站位为 `A (0.25, 0.50)` 与 `B (0.75, 0.50)`。
2. **单框独立排他 UC**：在角色 `A` 的 `negativePrompt` 中写入角色 `B` 的独特发色、瞳色或关键服饰（反之亦然），可显著降低多人同框时的特征串色。
3. **V5 成对动作锚点**：
   - 发起方框内写 `source#<action>`（例如 `source#patting head`）。
   - 承受方框内写 `target#<action>`（例如 `target#patting head`）。
   - 双向互动可在双方框内写 `mutual#<action>`（例如 `mutual#holding hands`）。
4. **可见性一致**：特写或半身裁切镜头中不可见的下半身/鞋袜，应从该角色正向词中移出，必要时放进其独立 `negativePrompt`。

---

## 5. 双轨漫画工作流

- **轨 A（单图多格直出）**：采用 `832×1216`，在全局正向中明确版式（如 `4koma`、`2x2 comic grid` 或方位分栏），需要满版无白边时可附加 `borderless panels, full bleed, edge to edge, no page margins` 及 `-1::white border, page margin::`。
- **轨 B（独立高清分格 + 自动拼版）**：逐格调用 `generate_image` 生成分格原图（角色特征更稳定），再调用 `stitch_comic` 选择 `4koma`、`grid-2x2`、`manga-classic` 或 `vertical-3` 并传入 `dialogues` 数组自动绘制矢量对白气泡。

---

## 6. 可选外置配置挂接点

无需改动插件代码即可按需扩展工作流能力（默认数据目录为 `~/.dsh/nai5-studio`，可通过 `NAI5_DATA_DIR` 修改）：

- `artist_presets.json` / UI「导入」：挂载自定义画师与风格编号（供 `style` 参数与工作台下拉调用）。
- `oc_presets.json` / `character_rules.json`：挂载常用原创角色描述及自动按角色名建子目录归档规则。
- `codexes/*.json` 与 `danbooru-cn.csv`：挂载离线参考配方包与双语标签表（支持 UTF-8 / GBK），供 `search_codex` / `search_danbooru` 与「词库与法典」页签检索。
