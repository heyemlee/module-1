# Agentic 升级总体规划 — 工作台助手体系(多 agent + 共享运行时)

Date: 2026-07-07
Branch: codex/agentic-upgrade-plan(基于 codex/round2-visual-prototype)
Status: 规划中,未开始实施

## 背景与结论

本项目主体是确定性的业务流水线(Round 1 展厅录入 → 估价/平面图 → 概念渲染;Round 2 实测 →
规则 autofill 方案 → 图纸投影)。项目已内嵌一个未完成的 Round 1 对话式录入 agent
(`src/server/round1/agent-service.ts` + `src/features/round1/agent-chat-panel.tsx`),
具备工具循环、可插拔 LLM 层、Zod 边界防护与 eval 测试雏形。

本规划的结论:**不做一个通用大 agent,而是每个工作台配一个专用小 agent,共享同一套
agent 运行时**。理由:

- 各工作台的数据结构(`Round1FormInput` vs `Round2Model` state)、校验规则、权限边界完全不同,
  单一 agent 的越权只能靠 prompt 防,防不住;
- 用户(销售/设计师)任意时刻只在一个工作台里干活,"跨阶段通用"没有真实业务场景;
- 小 agent 工具面小,prompt 可控,eval 可穷举,失败可定位。

对用户呈现为统一体验:每个页面侧栏同一个聊天面板组件,"到了哪个工位,它就懂哪个工位的活"。

## 设计原则(硬边界,所有阶段共同遵守)

沿用 `ai_ctx.md` 的 AI Boundary,任何 agent 违反即视为实现错误:

1. **确定性代码拥有一切权威数据**:几何、尺寸、柜体数量/编号、尺寸链、readiness、
   决策项的产生与关闭。AI 只做「自然语言 ↔ 结构化数据」的翻译层。
2. **agent 的工具 = 已有确定性操作的包装**(domain 函数 / reducer action),
   不允许出现"由模型自由发挥"的写路径。
3. **提交/拍板类动作永远不给 agent**:冻结快照(Generate Cabinet Fill)、
   `SUBMIT_MEASUREMENT`、`MARK_REVIEWED`、`RESOLVE_DESIGN_DECISION`、发送消息给客户。
   工具列表中不存在对应工具,而非靠 prompt 禁止。
4. **写工具输入双重防护**:JSON Schema allowlist 剥离 + Zod 校验剥离
   (照抄 `sanitizePatchForUpdateIntake` + `round1FormSchema.safeParse` 模式)。
5. **agent 改动必须可审计、可撤销**:以「action/patch 列表」形式返回给客户端重放,
   聊天中展示"我做了哪几处修改"。
6. **`salesEstimateOnly` / `notForProduction` / Confirmation Required / 决策项**
   不允许被 agent 绕过、关闭或弱化表述。
7. **LLM 只在服务端调用**(现有约定),所有 agent API 带鉴权 + 每用户限流
   (沿用 `src/server/platform/rate-limit.ts`)。

## 目标架构

```
共享层(写一次,所有 agent 复用)
├── src/server/llm/            LLMProvider 抽象(已有,不动)
│     provider.ts / index.ts / openai|deepseek|anthropic-llm-provider.ts
├── src/server/agents/runtime.ts          [新] 通用 agent 运行时
│     runAgentTurn(agentDef, input, deps) — 泛化自 runRound1AgentTurn
│     AgentDef = { name, systemPrompt, tools, createContext, executeTool }
├── src/server/agents/agent-eval-kit.ts   [新] eval 测试工具(泛化 agent-eval.test.ts 模式)
├── src/components/ui/agent-chat.tsx      [新] 通用聊天面板(泛化 agent-chat-panel.tsx:
│     历史按 key 持久化、语音输入 use-speech-to-text、loading/未配置降级、审计条目展示)
└── SSE 流式输出(API 层通用能力,见阶段 1)

工作台 agent(互相独立)
├── Round 1 录入 agent      已有 70%,阶段 0 补完
├── Round 2 量尺 agent      阶段 2 新增
├── Round 2 方案微调 agent   阶段 3 新增(与量尺 agent 同一运行时上下文,工具面不同)
├── 渲染质检循环             阶段 4,无聊天界面的后台 generate→verify→retry
└── 客户沟通工具             阶段 5,挂在已有 agent 上的新工具,非独立 agent
```

关键交互模式(所有带界面的 agent 一致):**客户端上行「当前状态 + 用户消息 + 近 N 轮历史」,
服务端 agent 对状态副本执行工具,下行「回复 + 变更列表」,客户端经现有 update 路径应用**。
Round 1 已是此模式(`updatedForm` → `onFormUpdate`,快照 staleness 自动生效);
Round 2 原型是内存态,同样适用:reducer 是纯函数,服务端可直接 import
`src/features/round2/round2-state.ts` 对上行 state 跑 action,再把 action 列表传回重放。
**因此 Round 2 持久化不是 agent 的前置条件。**

图的实时性来自现有架构本身:三张图(Round 1 SVG 平面图、Round 2 量尺图、方案/立面/图纸)
全部是数据的确定性投影,agent 改数据 → React 自动重渲染。agent 永远不直接产出图形。

---

## 阶段 0 — 补完 Round 1 录入 agent(P0)

现状:工具循环(`update_intake` / `estimate_cabinets` / `explain_confirmations`)、
聊天面板(语音、按项目持久化)、`POST /api/round1/agent`(鉴权 + 30/min/user 限流)、
`agent-eval.test.ts` 已存在。

- [ ] 新增只读工具 `read_current_form`:返回当前表单的紧凑摘要(已填字段 + 未知字段),
      让 agent 能回答"现在水槽在哪面墙""还差什么没填"
- [ ] 新增只读工具 `describe_floor_plan`:从 `buildFloorPlan` 结果生成文字描述
      (复用 `rendering-verification.ts` 的 `buildExpectedInventory` 词汇),
      让 agent 能对客户口头复述当前平面图
- [ ] system prompt 增补:引导 agent 在多信息缺失时主动追问下一个最重要的缺口
      (按 Confirmation Required 的权重排序)
- [ ] eval 集扩充(`agent-eval.test.ts`):
  - [ ] 中英混杂 + 单位歧义用例(尺/寸/bare number)各 ≥3 条
  - [ ] "先说 A 后改口 B" 的覆盖更新用例
  - [ ] 只读问题用例("现在冰箱在哪")断言不产生写调用
- [ ] 聊天 UI:展示每轮 `toolCallsMade` 对应的人话摘要("已更新:房间尺寸、冰箱位置")
- [ ] 失败路径打磨:LLM 超时/限流时面板可重试,表单不受影响

验收:eval 全绿;人工走查 10 段真实展厅话术,填表正确率满意;只读问题不触发写工具。

## 阶段 1 — 共享基建抽取(趁只有一个 agent 时做,成本最低)

- [ ] `src/server/agents/runtime.ts`:把 `runRound1AgentTurn` 泛化为
      `runAgentTurn(agentDef, { message, history, contextInput }, deps)`;
      Round 1 agent 改写为第一个 `AgentDef`,行为不变(现有测试原样通过)
- [ ] SSE 流式:
  - [ ] `LLMProvider` 增加可选 `runAgentLoopStream`(增量 token + 工具调用事件);
        provider 未实现时 runtime 回退为整轮返回
  - [ ] agent API 路由支持 `text/event-stream`;事件类型:`token` / `tool_call` /
        `state_patch` / `done`
  - [ ] 前端:每收到 `state_patch` 立即应用 → **图在对话过程中逐步成形**(展厅演示价值)
- [ ] `src/components/ui/agent-chat.tsx` 通用聊天面板:从 `agent-chat-panel.tsx` 提炼,
      props 注入 endpoint、存储 key、占位文案、语音语言;Round 1 面板改为薄包装
- [ ] `src/server/agents/agent-eval-kit.ts`:提炼 eval 模式(fake provider 脚本 +
      真 provider 可选开关),供后续 agent 复用
- [ ] 限流配置按 agent 名区分(沿用现有 in-process limiter)

验收:Round 1 agent 在新 runtime 上行为与重构前一致(`npm test` 全绿);
流式开启后首 token < 2s(体感);聊天面板组件可被第二个调用方复用。

## 阶段 2 — Round 2 量尺助手(最高业务价值的新 agent)

业务场景:量尺现场,一手卷尺一手设备,语音报数即录入;agent 读回尺寸链校验,
当场暴露矛盾与缺漏,避免二次上门。

- [ ] 服务端 `src/server/round2/measurement-agent.ts`(AgentDef):
  - [ ] 写工具 `edit_measurements`:批量设置量尺值。参数:
        `[{ measureKey, valueSixteenths }]`;服务端把 key 校验到派生墙生成的动态
        `Record<measureKey, ...>` 集合内(allowlist 即派生结果),值换算为 1/16″ 整数;
        执行 = 对上行 state 依次跑 `EDIT_MEASUREMENT`
  - [ ] 只读工具 `read_measurement_status`:每面墙已填/缺失字段、必填完成度、
        当前尺寸链推导结果(如"窗右侧到墙角 = 90 3/8″")
  - [ ] 只读工具 `check_chain`:返回尺寸链矛盾/异常值(超长/负值/开口超出墙体)
  - [ ] **不提供** `SUBMIT_MEASUREMENT` 工具
- [ ] system prompt:单位规则照抄 Round 1(尺=英尺、bare number=英寸、分数格式);
      增加"每次录入后核对尺寸链并主动汇报缺口/矛盾"的行为要求;中英混说
- [ ] API:`POST /api/round2/agent`(鉴权 + 限流;body 携带序列化 state + task=measurement)
- [ ] 前端:量尺工作台侧栏挂通用聊天面板;`state_patch` → dispatch 重放 action;
      聊天内展示"本轮修改了哪些测量值"并支持逐条撤销(dispatch 反向 EDIT_MEASUREMENT)
- [ ] 语音:复用 `use-speech-to-text`,默认 zh-CN,分数尺寸口语("150又8分之3")解析进 eval
- [ ] eval:量尺话术 ≥10 条(多值一句话、改口、带矛盾的数、缺单位),断言换算与 key 归属

验收:口述一面墙(总长/天花/窗宽/窗偏移)一次成功率满意;故意报矛盾值时 agent 主动指出;
SUBMIT 仍只能人点;`npm test` 全绿。

## 阶段 3 — Round 2 方案微调助手

业务场景:设计师对 autofill 初始方案做调整,"3号柜改36,差值给右边挡板"一句话完成
连锁操作;决策项的解释交给 agent,拍板留给人。

- [ ] 扩展 Round 2 AgentDef 工具面(同一 endpoint,按当前 task 注入不同工具集):
  - [ ] 写工具 `adjust_cabinet_width`(包 `STEP_CABINET_WIDTH`,含方向/目标档位)
  - [ ] 写工具 `nudge_group`(包 `NUDGE_GROUP`)、`move_filler_end`(包 `MOVE_FILLER_END`)
  - [ ] 写工具 `set_segment_kind` / `set_segment_front` / `set_height_profile`
        (包对应 action;枚举值即 allowlist)
  - [ ] 只读工具 `read_proposal`:各墙 segment 序列、挡板宽度、全局编号、决策项列表
  - [ ] 只读工具 `explain_decision`:解释某决策项成因与可选解法(不关闭)
  - [ ] **不提供** `RESOLVE_DESIGN_DECISION` / `MARK_REVIEWED` 工具
- [ ] system prompt:余量分配语义(改宽由同墙挡板吸收、低于最小值会生成决策项)、
      调整后必须汇报连锁影响(挡板变化、新决策项、STALE 传播)
- [ ] eval:调整话术 ≥10 条,重点断言(a)只调用允许的 action;(b)触发决策项时
      回复中如实汇报而非隐瞒;(c)请求"帮我确认/通过评审"时拒绝并指引人操作

验收:典型微调一句话完成且三视图(平面/立面/柜体表)一致变化;决策项只增不灭(除非人拍板);
`npm test` 全绿。

## 阶段 4 — 渲染质检 agentic 闭环(无聊天界面)

现状:`rendering-verification.ts` 已接入 `POST /api/projects/[id]/round1/renderings`,
生成后用 vision 模型对照 `buildExpectedInventory` 检查一次。

- [ ] 把"检查一次"升级为 bounded loop:生成 → 质检 → 不合格则把具体差异
      (如"sink rendered on the wrong wall")作为负向约束追加进 prompt 重新生成 →
      再质检;最多重试 2 次
- [ ] 重试仍不合格:照常入库,但渲染记录带 `verificationIssues` 明细,
      UI 上向销售展示差异点(而不是静默给一张错图)
- [ ] 计费护栏:重试计入现有 20/min/user 渲染限流与用户配额;记录每次尝试的
      issue 列表供后续调 prompt
- [ ] 测试:fake VisionClient 驱动「一次通过 / 一次失败后通过 / 全失败」三条路径

验收:注入一个必然画错的 fixture,观察到自动重试与最终差异标注;配额与限流生效。

## 阶段 5 — 客户沟通工具(挂载,不新建 agent)

- [ ] Round 1 agent 新增只读工具 `draft_customer_message`:输入沟通目的
      (确认清单 / 跟进 / 估价说明),从快照 + Confirmation Required 项生成中文话术草稿;
      Round 2 agent 同理(数据源为决策项 + 量尺缺口)
- [ ] 输出永远是「草稿文本」,由销售自行复制发送;不接任何消息通道(边界 3)
- [ ] 草稿必须包含"初步估价/非生产数据"性质声明(边界 6)

验收:7 个待确认项能生成一条不漏项、口吻自然的微信草稿;不出现"最终/已确认"类措辞。

---

## 明确不做(防止 agentic 化变形)

| 不做 | 原因 |
|---|---|
| AI 布柜 / AI 参与几何与尺寸计算 | `autofill.ts` / `buildFloorPlan` 规则引擎是项目立身之本(ai_ctx 核心决策) |
| AI 生成图纸 | 图纸是模型的实时投影(todo.md),没有 AI 的位置 |
| 跨工作台通用超级 agent | 工具面爆炸、越权靠 prompt 防不住、eval 不可穷举 |
| n8n / 外部工作流 agent | ai_ctx 明确 V1 不做;CRM/提醒类留待以后 |
| 管理后台 agent | 用户/配额表单已够用,对话是负价值 |
| agent 自动发送消息给客户 | 外发动作必须人执行 |

## 测试与评估策略

- 每个 agent 三层测试:
  1. **工具单测**(确定性,无 LLM):sanitize/换算/allowlist/reducer 包装正确性;
  2. **脚本化 eval**(fake provider 按脚本出工具调用):断言端到端 state 变化与审计列表;
  3. **真 provider eval**(env 开关,CI 不跑):话术集回归,prompt 每次修改后必跑。
- 边界回归用例固定化:每个 agent 必含「请求提交/拍板/关闭确认项 → 拒绝」用例。
- 现有 561 项测试保持全绿;`npx tsc --noEmit`、`npm run build` 纳入每阶段验收。

## 风险与开放问题

- **Round 2 state 上行体积**:整份 state 随消息上行,墙多时偏大 → 可只上行
  agent 所需切片(测量 Record / segment 摘要),阶段 2 实现时评估。
- **流式 + 工具循环的 provider 差异**:三家 provider 的流式工具调用协议不同,
  阶段 1 先做 OpenAI 兼容协议(openai/deepseek 同协议),anthropic 允许回退非流式。
- **语音识别对分数尺寸的鲁棒性**:"150又8分之3"的 STT 输出形态需现场采样,
  解析规则进 eval 而非 prompt 里赌。
- **成本**:量尺/微调 agent 单轮多工具调用,token 消耗高于 Round 1 → 沿用每用户
  限流 + 现有配额体系,`ai-status` 管理页可观测用量。
- **Round 2 持久化时序**:agent 不依赖持久化,但持久化落地后需把「上行 state」
  改为「服务端读库 + 乐观锁」,runtime 接口预留 contextInput 抽象即为此。

## 建议实施顺序与依赖

```
阶段 0(Round 1 补完)──┐
                        ├─→ 阶段 1(runtime/SSE/面板抽取)──→ 阶段 2(量尺)──→ 阶段 3(微调)
阶段 4(渲染闭环,独立)─┘                                     阶段 5(沟通工具,随 2/3 顺手)
```

阶段 4 与 0/1 无依赖可并行;阶段 2 必须在阶段 1 之后(避免复制两份循环代码再合并)。
