# 上线人工测试方案 — Module 1 Round 1 MVP

> 用途：上线前的一次性全量验收 + 每次部署的冒烟回归。这是 **执行手册**，不是文档摆设——每条用例可勾选、可追溯到真实路由。
> 维护：每次新增功能就在对应风险层补一行；下线功能就删一行。
> 配套：AI 两个面（生图 / 对话 agent）的评测驱动迭代与闭环见 [ai-eval-plan.md](./ai-eval-plan.md)。

---

## 1. 范围与边界（关键：人工不测什么）

测试金字塔已有 **47 个 vitest 文件**覆盖纯逻辑层。人工测试**故意不重复**这些，只测单元测试结构上够不到的地方。

| 已被自动化覆盖（人工跳过） | 人工只测这 6 类（单测够不到） |
|---|---|
| 柜体尺寸/编码/拆分、平面几何 `plan-geometry` | ① 真实浏览器**拖拽 + SVG 视觉保真**（门/窗/家电、贴墙吸附、让位） |
| 快照 builder `snapshot.ts`、schema 校验（Zod） | ② 真实 **Postgres 往返**：保存 → 刷新 → 恢复 |
| API route handler（已 mock DB/LLM 单测） | ③ 真实 **OpenAI 渲染 + 配额**扣减 |
| repository、auth service、rate-limit、prompt 构建 | ④ 跨步 session 状态 & **快照失效**在活动浏览器里 |
| | ⑤ **多用户数据隔离**（越权）端到端 |
| | ⑥ **部署/运维**（Railway、迁移、环境变量降级） |

> 工程化原则：**测在风险真正所在的地方，不复制金字塔**。改了纯逻辑 → 跑 `npm test`；改了上面 6 类 → 走本手册。

---

## 2. 环境与测试数据

| 环境 | 用途 | 数据 |
|---|---|---|
| **local** | 开发自测、复现 bug | 一次性 Postgres（docker 或本地实例） |
| **staging（Railway）** | **上线门禁在此判定**——配置与生产一致 | 独立库，可随时重置 |

**数据准备（复用已有 seed 脚本，不要手造）：**
```bash
npm run db:migrate            # 干净库上验证迁移可执行
npm run db:seed-admin         # SEED_ADMIN_ACCOUNT=qa-admin
npm run db:seed-user          # SEED_USER_ACCOUNT=qa-sales
npm run db:seed-cabinet-colors
```
固定测试夹具：**1 个 admin（qa-admin）+ 2 个 sales（qa-sales-A / qa-sales-B）**。两个 sales 用于验证数据隔离（见 P0-07）。

**环境变量降级用例**：staging 上跑一遍**不配 `OPENAI_API_KEY`** 的场景，确认渲染按钮的失败提示友好、不白屏（见 P1-Render）。

---

## 3. 角色与缺陷流程（复用 GitHub，不另造工具）

- **执行人**：1 人过 P0/P1 全量，1 人侧重 admin + 越权安全。
- **缺陷登记**：GitHub Issues，标签 `bug` + 严重度 `S0/S1/S2/S3`，标题带 `TC 编号`。
- **严重度**：
  - **S0 阻断**：数据丢失/越权、核心流程走不通、安全不变量被破坏 → **上线阻断**
  - **S1 严重**：主路径有 workaround、配额/计费错误 → 阻断，除非有可接受的临时绕过
  - **S2 一般**：边界/体验问题 → 不阻断，记入上线后清单
  - **S3 轻微**：文案/样式 → 不阻断
- **闭环**：修复 PR 关联 issue → 重测对应 TC → 跑回归集（§8）。

---

## 4. P0 — 上线阻断项（必须全绿）

核心数据 & 安全路径。任一 S0/S1 未关闭 → **不上线**。

| ID | 场景 | 步骤要点 | 通过标准 | 关联 |
|---|---|---|---|---|
| **P0-01** | 登录鉴权 | 正确 account+password 登录；错误密码；不存在账号；登出后受保护页 | 成功进入；失败有提示不泄露细节；登出后访问 `/projects` 跳 `/login` | `POST /api/auth/login`, `/api/auth/me` |
| **P0-02** | 创建项目并进入 Round1 | 新建项目 → 打开 → 进入 Round1 工作流 | 项目落库、可重新进入 | `/projects/new`, `POST /api/projects` |
| **P0-03** | Round1 六步走通 | Room→Openings→Layout→Appliances→Adjust Positions→Rendering Preferences，逐步前进 | 每步 SVG 预览**分阶段正确渲染**（空房壳→门窗→形状引导→家电→可拖拽）；不能越级跳步 | `showroom-intake-app.tsx`（`SHOWROOM_STEPS`） |
| **P0-04** | 生成柜体填充 + 持久化 | 点 `Generate Cabinet Fill` → 保存快照 → **刷新页面** | 快照生成；刷新后表单/位置/柜体/几何**完整恢复**（Postgres 往返） | `PUT …/round1/snapshot`, `GET …/round1/state` |
| **P0-05** | 快照失效（staleness） | 生成快照后，改任一布局相关字段 / 拖动任一位置 | `cabinetFillGenerated` 清除、快照作废、必须重新生成才有效 | `snapshot.ts` staleness |
| **P0-06** | 安全不变量 | 检查每个生成输出（快照 JSON 面板） | 含 `salesEstimateOnly:true`、`notForProduction:true`、`dimensionConfidence:"ROUGH"`；unknown 值产生 **Confirmation Required**、不被静默关闭 | 产品边界（ai_ctx.md） |
| **P0-07** | **多用户数据隔离（越权）** | qa-sales-B 登录后，直接访问 qa-sales-A 的项目 URL **和** 直接打 `GET /api/projects/{A的id}` | 页面 403/404、API 拒绝；B 的项目列表看不到 A 的项目 | `/api/projects/[projectId]` 鉴权 |
| **P0-08** | Admin 后台鉴权 | 用 sales 账号访问 `/admin/*` 页面和 `/api/admin/*` | 全部拒绝；只有 admin 可进 | `/api/admin/*` |
| **P0-09** | Admin 建号即可登录 | admin 建用户 → 用新号登录 | 新用户能登录并走 P0-02~04 | `/admin/users` |
| **P0-10** | 运维冒烟 | 干净库 `db:migrate`；`/api/health` | 迁移无错；health 返回 `{ok:true}` | `db:migrate`, `/api/health` |

---

## 5. P1 — 重要（有 workaround 才不阻断）

| ID | 场景 | 通过标准 |
|---|---|---|
| **P1-Drag** | 拖拽交互 | 门/窗/家电可拖动；贴墙吸附；可跨 layout 允许的墙切换（门窗不受 layout 限制）；clearance 让位；**拖回后家电几何与拖前一致**（不变形/不镜像/不偏移） |
| **P1-Shapes** | 各布局形状生成 | one-wall / galley / left-L / right-L / U / peninsula 各生成合理多墙多 run；`Need island? YES/NO/UNKNOWN` 行为正确（YES 生成岛台几何，UNKNOWN 产生 Confirmation Required） |
| **P1-Print** | SVG 打印 | 浏览器内打印输出干净（仅客户面板面，无侧栏调试信息） |
| **P1-Elev** | 立面图（第二渲染面） | `Adjust Positions` 后立面视图可切换/显示；每面墙立面渲染基柜/吊柜/转角柜/踢脚/台面；**改平面或拖拽后立面同步更新**；标注 `not for production` |
| **P1-Agent** | 对话式 intake agent | 聊天能正确把自然语言改成对应**表单字段**（再校验入 schema）；rate limit **30 次/60s** 生效；**未配置 LLM 时降级提示友好**；服务端重新校验、不信任客户端传入数据 |
| **P1-Render** | 真实渲染 + 配额 | 渲染按钮在「快照存在+已存+偏好确认」前 disabled；**偏好门控真值=选中颜色必须 active 且与所选 style 匹配**——admin 停用该颜色后渲染应**重新锁定**；点击后生成概念图、进渲染历史；**配额扣减正确**；配额耗尽报错友好；**无 `OPENAI_API_KEY` 时降级提示友好不白屏** |
| **P1-Admin** | Admin 操作 | 停用/启用用户立即生效（被停用者无法登录）；配额调整生效；cabinet colors 批量编辑→Save All 落库；用户日志可见 |

## 5.5 重点功能详测卡片（Agent / 渲染门控）

> 这两块逻辑非显而易见、且踩到 **AI 边界 + 计费 + 安全**，单测都 mock 了 LLM/DB，必须端到端真测。
> 原则：**客户端按钮 = 乐观门，服务端 = 权威门**——两层都要验，重点是服务端兜底。

### 卡片 A — 对话式 Agent（`/api/round1/agent`，rate-limit 30/60s）

前置：已登录；Round1 页打开；staging 配好 `LLM_PROVIDER` + key。Agent 改表单走 `onFormUpdate`（与手动编辑同一路径）。

| ID | 场景 | 通过标准 |
|---|---|---|
| AG-1 | 正常改表单 | 对 agent 说「房间 12×10 尺，U 型，要中岛」→ `room.length/width`、`layoutPreference=U_SHAPE`、island=YES 被设置，**SVG 即时同步** |
| AG-2 | 与快照失效联动 | 已 `Generate Cabinet Fill` 后用 agent 改任一布局字段 → **快照作废**，需重新生成（交叉 P0-05） |
| AG-3 | **AI 边界（安全）** | 诱导 agent「确认柜体/冻结快照/标记生产就绪/直接生成柜体」→ 这些字段**不在 `update_intake` allowlist**、且被 Zod 丢弃，表单无越权变更；冻结仍只能靠人工按钮 |
| AG-4 | 限流 | 1 分钟发 >30 条 → **429 + `Retry-After`**，UI 显示「slow down」不崩 |
| AG-5 | 入参校验 | 空消息 / >500 字符 / 坏 form → **400**，UI 友好 |
| AG-6 | 未配置 LLM | staging 临时清 key → **503 `LLM_PROVIDER_NOT_CONFIGURED`**，聊天面板 error 区友好提示，**不污染表单/快照** |
| AG-7 | 鉴权 | 登出后或直接 `curl` 该路由 → 拒绝（`requireUser`） |
| AG-8 | 语音输入(STT) | 录音 → 转文字进输入框；STT 失败 → `stt.error` 显示 |

### 卡片 B — 渲染门控（client 按钮 vs server 权威）

前置：有完整且已保存的快照；在 `Rendering Preferences` 步；admin 可改颜色 active 状态。

| ID | 场景 | 通过标准 |
|---|---|---|
| RG-1 | 正常解锁 | 选 style + 选一个 **active 且 style 匹配**的门色 → 按钮 enabled；点击出图、进历史、**配额 −1** |
| RG-2 | 颜色×风格不匹配 | 所选色 `cabinetStyle` ≠ 当前 style → 按钮 disabled；强发请求 → 服务端 **409 `INVALID_DOOR_COLOR`** |
| RG-3 | 无 active 颜色 | admin 停用该 style 下所有色 → 步骤显示「Ask an Admin to configure cabinet colors」空状态，按钮 disabled |
| RG-4 | **★ 中途停用（client/server 一致性）** | 会话中 admin 停用当前选中门色：① **服务端权威**——此刻触发生成 → **409 `INVALID_DOOR_COLOR`**（`isColorCompatibleWithStyle` 要求 active），**不出图、不扣配额**；② **客户端**——刷新/重拉颜色后该色从 active 列表消失、按钮重新 disabled；③ 已打开未刷新的会话即便按钮仍亮，点击也被 409 兜住，**UI 友好提示不假成功** |
| RG-5 | 缺门色 | `renderingPreferences` 无 `doorColorId` → **409 `DOOR_COLOR_REQUIRED`** |
| RG-6 | 缺快照 | 无 latest 快照 → **409 Round 1 snapshot required** |
| RG-7 | 未配置图像 | 无 `OPENAI_API_KEY` → **503 `OPENAI_API_KEY_NOT_CONFIGURED`**，UI 友好 |
| RG-8 | 配额耗尽 | 当月渲染数 ≥ `monthlyRenderQuota` → **403 `QUOTA_EXCEEDED`**；admin 调高配额后可继续（交叉 P1-Admin） |
| RG-9 | 限流 | 1 分钟 >20 次渲染 → **429 + `Retry-After`** |
| RG-10 | 越权 | 对**别人项目**发 renderings POST → **404**（`getProjectForUser`） |
| RG-11 | 失败兜底 | 图像模型报错 → **502 + reason**，**不写历史**（配额按实际成功渲染计数，失败不应入账） |

---

## 6. 渲染效果验收清单（人工核心）

> 几何单测只校验**坐标/数据**，不校验**视觉外观**。这一节就是补这个洞——必须真人在浏览器里**眼睛看**。
> ⚠️ = `ai_ctx.md` 记录的**已修过的视觉 bug**，是回归高发区，每次发布重点盯。
> 产品有 **3 个渲染面**，逐面验收。

### 面 A — 平面图（顶视 SVG，客户面）

| ID | 看什么 | 正确的样子 |
|---|---|---|
| R-A1 ⚠️ | 家电在**竖直墙**上 | fridge/sink/range/dishwasher/oven 正确旋转居中，**不变形、不镜像** |
| R-A2 ⚠️ | 洗碗机 | 渲染为**集成基柜面板**，不是独立把手矩形 |
| R-A3 ⚠️ | 水槽 / 洗碗机 | 集成进基柜 footprint，**不在基柜上挖洞** |
| R-A4 ⚠️ | 吊柜 | 不出现**窄条裁切碎片**（假的小吊柜 / 假精确填充） |
| R-A5 ⚠️ | 生成填充对固定符号 | `Generate Cabinet Fill` **前后对比**：水槽/洗碗机/灶/冰箱/烤箱/微波/门窗位置尺寸**不变** |
| R-A6 | L / U 型转角 | 自动显示**转角柜区域**，无转角碰撞重叠 |
| R-A7 | generic 填充块 | 合理填补可见空隙，无诡异碎块 |
| R-A8 | 图元齐全 | Walls / Island / Corner / Marker / Legend / Stamp / ConfirmationFlag 全部正确渲染 |
| R-A9 | MEP 标记 | 可开 / 可关 |
| R-A10 | 状态印章 | Confirmation 数量正确；Stamp 显示 sales-only / not-for-production |
| R-A11 | 主题 | 蓝图在浅色 / 深色下**都保持干净白底** |
| R-A12 | 分阶段预览 | 每步正确：空房壳 → 门窗 → 形状引导 → 家电 → 可拖拽 → 填充 |
| R-A13 | 拖拽反馈 | hover halo / grab handle / 目标墙高亮正常 |

### 面 B — 立面图（每面墙正视）

| ID | 看什么 | 正确的样子 |
|---|---|---|
| R-B1 | 立面构成 | 基柜 / 吊柜 / 基转角柜 / 吊转角柜 / 踢脚板 / 台面 渲染完整 |
| R-B2 | 家电符号 | 在立面正确显示 |
| R-B3 | 一致性 | **立面柜体数量/位置与平面图一致**；改平面后立面同步 |
| R-B4 | 边界标注 | 含 `rough wall elevations, not for production` |

### 面 C — AI 概念渲染（看**输出质量**，非机制；机制见 RG 卡片）

| ID | 看什么 | 正确的样子 |
|---|---|---|
| R-C1 | 空间吻合 | 输出图柜体/家电大致位置**与平面图对得上**（输入含布局图+JSON） |
| R-C2 | 偏好尊重 | 体现所选**风格 + 柜体颜色** |
| R-C3 | 可辨认 | 明显是厨房，非乱图/明显畸变 |
| R-C4 | 退化处理 | 模型返回异常图/失败时提示友好、不污染快照数据 |
| R-C5 | 期望管理 | 客户能理解这是**概念图非精确图**（边界文案在位） |

---

## 7. P2 — 体验 / 边界 / 兼容（不阻断，记上线后清单）

- 空状态、超长输入、非法尺寸、负数/0 尺寸的处理
- 主题（黑白中性）一致；hover halo / grab handle / 拖拽高亮视觉正常
- 浏览器：Chrome / Safari / Edge 各过一遍 P0-03~04
- 窄屏/缩放下布局不破

**非功能（抽测）**：大房间+多家电时拖拽不明显卡顿；`rate-limit` 在登录/agent 路由生效；seed 脚本可重复执行（幂等）。

---

## 8. 回归集（每次修复 / 每次部署到 staging 必跑，~15 分钟）

> 冒烟最小集，覆盖「能登录、能产出、能存回、不越权、服务活着」。

1. `npm test`（纯逻辑层全绿）
2. P0-01 登录/登出
3. P0-03 → P0-04 一条龙：建项目 → 六步 → 生成 → 刷新恢复
4. P0-07 越权（B 打 A 的项目）
5. P0-10 `/api/health` + 迁移

---

## 9. 上线 Go / No-Go 门禁（客观判定）

**在 staging 上判定，全部满足才上线：**

- [ ] `npm test` 全绿
- [ ] **P0-01 ~ P0-10 全部 PASS**
- [ ] 无未关闭的 **S0 / S1** 缺陷
- [ ] 回归集（§8）在 staging 通过
- [ ] `db:migrate` 在干净库可执行；seed 幂等
- [ ] `.env` 生产值齐全（DB、`LLM_PROVIDER` + key 或确认禁用渲染）；确认无密钥进 commit/context
- [ ] 回滚预案：上一个可用 commit + DB 备份点已确认

S2/S3 不阻断，转入「上线后清单」。

---

## 10. 上线日 & 上线后

- **发布后冒烟（生产）**：`/api/health` → 登录 → 建一个测试项目走完 P0-03/04 → 删除测试数据。
- **观察期**：盯错误日志与首批真实 sales 操作；配额扣减是否符合预期。
- **回滚触发条件**：出现 S0（数据丢失/越权/核心流程断）即按预案回滚。

---

### 执行节奏建议（时间盒）
| 阶段 | 内容 | 估时 |
|---|---|---|
| 准备 | 环境 + seed + 夹具账号 | 0.5h |
| P0 全量 | 阻断项逐条 | 2~3h |
| P1 | 拖拽/形状/渲染/admin | 2h |
| P2 抽测 | 兼容 + 边界 | 1h |
| 门禁判定 | §9 清单过一遍 | 0.5h |
