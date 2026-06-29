# AI 生成质量评测计划 — Rendering + Agent

> 配套 [launch-manual-test-plan.md](./launch-manual-test-plan.md):那份管「功能 / 上线人工验收」;**本份管「两个 AI 面（① 生图渲染 ② 对话 agent）的评测驱动迭代与闭环」**。
> 目标成熟度：**Walk 级**（golden 集 + CI 门禁 + VLM 评委 + 灰度反馈），**不上 Run 级平台**（Braintrust/RLHF 那套等量级到了再说）。
> 确定性内核（几何 / 柜体 / 快照）已由 **47 个 vitest** 覆盖，本计划不重复测，只复用其快照当夹具。

---

## 0. 总原则：离线榨干 → 灰度 → 全量 → 闭环

```
【Phase 0 种子集】──点火──┐
                         ▼
   Phase 1 离线门禁(CI,$0) ──► Phase 2 质量评测(VLM+人工校准)
                                        │ 够好可灰度
                                        ▼
                              Phase 3 灰度 Pilot(几个真实 sales)
                                        │ 够好可全量
                                        ▼
                              Phase 4 全量 ──► Phase 5 闭环(常态)
                                        ▲              │
                                        └─ 生产👎→新种子─┘
```

**核心顺序**：离线把质量推到「够好可灰度」→ 上线(先灰度)拿**你想不到的真实输入** → 反馈回流变新种子 → 再回离线。**不 big-bang 上线。**

> 为什么离线调优不够、必须上线:离线只能测「你想得到的失败」,测不出真实输入分布(unknown unknowns)和「图有没有帮 sales 成交」这个业务结果。灰度就是用最小风险拿这两样。

---

## 1. 共用脊柱：Golden 快照集（最高杠杆,先做这个）

6–12 个**冻结快照**(从真实表单跑出来,导出 JSON 提交成 fixture)。agent 测、prompt 测、生图评测、反馈回放——**全部 key 在同一批快照上**,所以先做它一步解锁全部。

覆盖清单:
- **布局各一**:`ONE_WALL` / `GALLEY` / `LEFT_L_SHAPE` / `RIGHT_L_SHAPE` / `U_SHAPE` / `PENINSULA`
- **边界**:超小房 / 超大房 / 多家电 / `unknown` 值产 Confirmation Required / 有岛(island=YES)
- **回归**:任何已踩过的视觉 bug 各固化一个(见 manual-test-plan §6 的 ⚠️ 项)

---

## 2. 阶段 + 退出标准（每个 gate 客观可判）

> 阈值是**起始默认值,按实际校准**,不是铁律。

### Phase 0 — 种子集（闭环前 / 灰度前）
做:① 6–12 golden 快照 ② 20–30 条 agent 种子句(sales 真实说法 + ~5 条对抗,如「标成可生产」)③ 生图 **rubric** 定稿(墙位 / 风格 / 颜色 / 像厨房 / 无畸变)+ 人工先把 golden 各评一遍。
**✅ 退出 → Phase 1:** 三类种子都成文可复现;rubric 定稿且人工基准分就位。

### Phase 1 — 离线门禁（CI，确定性，$0，每次 commit）
做:扩 [`rendering-prompt.test.ts`](../src/features/round1/rendering-prompt.test.ts) → golden prompt 矩阵(对每个快照断言关键空间约束/风格/颜色/计数);agent 加 `update_intake` allowlist 断言 + 种子句 NL→patch。
**✅ 退出 → Phase 2:**
- CI 全绿
- agent 对**禁止字段(柜体生成/位置确认/快照冻结/生产就绪)写入 = 0**（硬门,安全）
- 种子句 NL→patch 正确率 **≥ 90%**

### Phase 2 — 质量评测（VLM 评委 + 人工校准）
做:VLM-as-judge 按 rubric 给生图打结构化分;对 ~30 张人工评过的样本校准。
**✅ 退出 → 可灰度(Phase 3):**
- VLM 评委 vs 人工 **一致率 ≥ 85%**(校准达标,评委才可信)
- golden 场景 rubric **通过率 ≥ 80%**,且**墙位「搬家」失败 = 0**(prompt 的硬契约,家电不许被模型挪墙)
- 生图**成本/张**在预算内
- **配套硬前提:** manual-test-plan 的 **P0 门禁全绿**(别灰度一个坏 app)

### Phase 3 — 灰度 Pilot（2–3 个真实 sales）
做:开给少数真实 sales;反馈路径先上**零 UI 隐式版**(见 §3);每周 triage 一次。
**✅ 退出 → 可全量(Phase 4):**
- 跑满 **≥ 2 周** 且 **≥ 50 张**真实渲染
- 生产 **👎 率(或 re-roll 率)≤ 阈值 且稳定/下降**
- **无 S0 / S1**
- **闭环至少合上一次**:灰度暴露的失败已被吸收成**新 golden 种子并回归**
- 配额 / 成本符合预期

### Phase 4 — 全量
做:放开;隐式信号继续采;视 👎 量决定是否上**显式 👍/👎 + 原因 chip**。
**维持:** CI 门禁 + 回归集常驻。

### Phase 5 — 闭环（常态）
生产 👎 / re-roll → 周度 triage(按 rubric 维度聚类:墙位?风格?颜色?)→ 新种子进 golden 集 → 改 prompt → CI 门禁 → 上线 → 回到生产。

---

## 3. 反馈路径（分层，先白捡 0 成本的）

| 层级 | 信号 | 成本 | 喂给 |
|---|---|---|---|
| **隐式(先做)** | agent 设了字段、sales 当场改回 = 对 agent 的 👎 | 在 agent 回传处记一条 `{agent设, 人最终}` | agent eval 种子 |
| **隐式(先做)** | 同项目 re-roll 渲染 = 对上一张的(噪声)👎 | 数 renderings 历史即得 | 生图 KPI(粗) |
| **显式(量大再加)** | 渲染卡 👍/👎 + 原因 chip | renderings 表加 2 列 + [renderings-view.tsx](../src/features/platform/renderings-view.tsx) 加控件 | golden 种子 + 校准 VLM 评委的人工标签 |

> 关键:快照已冻结持久化(`saveRenderingHistory` 带 `snapshotId`)→ 一个 👎 = 一个**可复现 golden 失败样本**,零额外采集。一个机制三个回报:长 golden 集 / 在线 KPI / 校准评委的人工标签。

---

## 4. 明确不建（YAGNI）

FID / IS(你不训模型,只调 prompt 打 API,与你无关)、自动相似度指标、RLHF / 奖励模型训练、实时大盘、标注平台、客户侧反馈采集、Run 级 eval 平台。**👎 量大到 sales 反馈处理不过来时**再逐项考虑。
