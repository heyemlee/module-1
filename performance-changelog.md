# Performance Changelog

Date started: 2026-07-24  
Purpose: 记录每一次**可感知性能**改动的前后对比与量化结果。  
Rule: 以后每次优化都在本文件**顶部追加**一条新记录（最新在上）。不要改写旧条目的结论；若事后补测，在原条目下加 “Update” 小节。

---

## How To Log A New Entry

复制下面模板，填完后贴到「Entries」最上方。

```md
### YYYY-MM-DD — 简短标题

| | |
|---|---|
| **PR / commit** | `#N` / `sha` |
| **Surface** | Round 1 / Round 2 / Admin / API / … |
| **Symptom** | 用户感知到什么慢 |
| **Evidence class** | `measured`（有计时） / `derived`（由代码常量或体积推算） / `expected`（设计预期，未实测） |

**Before**
- …

**Change**
- …

**After**
- …

**Quantification**
| Metric | Before | After | Delta | Class |
|--------|--------|-------|-------|-------|
| … | … | … | … | measured/derived/expected |

**How to re-measure**
- …
```

量化约定：

- `measured`：浏览器 Network / Performance、服务端日志、或本地基准脚本给出的数字。
- `derived`：由已知产物大小、调用次数、代码常量推算（例如「每张图约 2.8MB base64」）。
- `expected`：尚无数字，只写方向与机制；补测后升格为 `measured` / `derived`。
- 没有数字时写 `n/a`，不要编造。

---

## Backlog (not yet done)

按性价比排列，做完一条就移到 Entries 并打勾删除：

1. Round 1 / Round 2 首包 `dynamic()` 拆包（按 step / task）
2. Round 1 进页服务端预取 state + snapshot（去掉客户端瀑布）
3. Rendering Preferences 选色 PUT debounce
4. POST `/renderings` 前置 DB 查询 `Promise.all` + 配额索引 `(created_by_user_id, created_at)`
5. `listRenderings` 去掉或截断 `prompt`
6. Admin cabinet-colors 色板加载（已记在 `docs/follow-up-todo.md` E）

---

## Entries

### 2026-07-24 — Round 1 渲染读图去 sharp + POST 去 base64；Round 2 草稿 debounce

| | |
|---|---|
| **PR / commit** | branch `perf/rendering-image-latency` / `f622ff2`（PR 待开） |
| **Surface** | Round 1 renderings API + gallery/preview；Round 2 measurement draft |
| **Symptom** | Gallery / 历史缩略图 TTFB 偏高；生成完成后 UI 卡一下；量尺敲键偶发抖 |
| **Evidence class** | `derived`（体积与调用路径）+ `expected`（体感，未做线上 A/B） |

#### 1) 渲染图 GET 不再重复 sharp

**Before**

- 写入路径已在 `generateRound1Rendering` → `normalizeRenderingImageBase64` 规范到 **1536×1024 PNG**。
- 读路径 `GET …/round1/renderings/[id]/image` 每次仍调用 `normalizeRenderingImageBuffer`（sharp rotate + resize + png encode）。
- 一次 Gallery 打开 ≈ N 次「鉴权 + DB + S3 + CPU sharp」。

**Change**

- 读路径直接返回 `getRenderingImage` 的已存 bytes；sharp 只保留在写路径。
- 文件：`src/app/api/projects/[projectId]/round1/renderings/[renderingId]/image/route.ts`

**After**

- 每个缩略图少一轮 sharp CPU；TTFB 主要剩鉴权 + 对象存储 RTT。
- 缓存头不变：`Cache-Control: private, max-age=31536000, immutable`。

**Quantification**

| Metric | Before | After | Delta | Class |
|--------|--------|-------|-------|-------|
| sharp decode/resize/encode per image GET | 1× | 0× | −100% CPU work on read path | derived |
| Canonical pixel size served | 1536×1024（写后再处理） | 1536×1024（写时已定） | 同尺寸，少一次重编码 | derived |
| Gallery of N images: sharp invocations | N | 0 | −N | derived |
| Measured TTFB (p50) | n/a | n/a | 待补测 | expected |

**How to re-measure**

1. Staging 打开含 ≥6 张历史渲染的 `/projects/[id]/renderings`。
2. DevTools Network：对比改前/改后各 `/image` 请求 Waiting (TTFB)。
3. 可选：服务端对 image route 打 `Date.now()` 日志，对比 sharp 调用前后。

---

#### 2) POST `/renderings` 响应去掉 `imageBase64`

**Before**

- `saveRenderingHistory` 返回 `{ ...rendering, id, createdAt }`，含完整 `imageBase64`。
- 代码注释与列表路径已标明单张约 **~2.8MB** base64；Gallery **列表**早已不带图，但**生成成功响应**仍回灌整图。
- 客户端 `conceptRenderingFromTaskResult` 优先用 `data:image/png;base64,…`，主线程 JSON 解析 + 大字符串分配。

**Change**

- `saveRenderingHistory` 返回前剥离 `imageBase64`；PNG 只在 object storage。
- 客户端统一用 `renderingImageUrl(projectId, id)` 加载。
- 文件：`round1-postgres-repository.ts`、`showroom-intake-app.tsx` + 相关测试。

**After**

- 生成成功响应体积降到元数据量级（id / model / prompt / size / preference stamp…）。
- 预览改为并行/懒加载 image route（与 Gallery 同一路径）。

**Quantification**

| Metric | Before | After | Delta | Class |
|--------|--------|-------|-------|-------|
| POST success body includes full PNG base64 | yes (~2.8MB / image, repo note) | no | ≈ −2.8MB / successful generate | derived |
| Client main-thread parse of multi-MB JSON on complete | yes | no | 去掉大分配 | derived |
| Preview bytes still transferred | via JSON | via `/image` (cacheable) | 同图，可缓存、可并行 | derived |
| Measured “Generating… → preview visible” | n/a | n/a | 待补测 | expected |

**How to re-measure**

1. DevTools Network：抓 POST `…/round1/renderings`，看 Response size。
2. 对比随后 `/image` 是否 200 + `immutable` 缓存命中（第二次打开 Gallery）。

---

#### 3) Round 2 localStorage 草稿 debounce + leave flush

**Before**

- `round2-visual-prototype` 在每次 `state` 变更时同步 `JSON.stringify` + `localStorage.setItem`。
- 量尺连敲数字时，完整 `Round2PrototypeState`（提交后含整模）反复序列化，易造成输入卡顿。

**Change**

- 保存 debounce **400ms**（`ROUND2_DRAFT_SAVE_DEBOUNCE_MS`）。
- `pagehide` / `visibilitychange(hidden)` / 组件卸载时 flush，避免丢最后一次编辑。
- 文件：`round2-visual-prototype.tsx`、`round2-draft-storage.ts`

**After**

- 连续按键合并为一次写盘；离开页仍落盘。

**Quantification**

| Metric | Before | After | Delta | Class |
|--------|--------|-------|-------|-------|
| Draft save debounce | 0ms（每次 dispatch） | 400ms | 连敲合并 | derived |
| Saves per 10 keystrokes in 200ms | ≤10 | 1（再加离开时 flush） | ≈ −90% writes in burst | expected |
| Risk of losing last edit on tab close | low (sync) | mitigated by flush | 行为对齐 Round 1 draft | derived |
| Measured long-task / INP while typing | n/a | n/a | 待补测 | expected |

**How to re-measure**

1. Performance panel：量尺连敲，看 `setItem` / long tasks 次数。
2. 敲几个尺寸 → 立刻关 tab → 重开 Round 2，确认草稿恢复到最后值。

---

## Related Docs

| Doc | Role |
|-----|------|
| `docs/follow-up-todo.md` | 功能 / 清理 backlog（非性能日记） |
| `ai_ctx.md` | 热上下文；指向本文件作性能记录入口 |
| `docs/launch-manual-test-plan.md` | 上线人工验收（可顺带做 TTFB 抽查） |
