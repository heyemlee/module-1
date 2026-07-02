# Round 2 整体改造 TODO — 单一模型驱动量尺 / 方案 / 图纸

Date: 2026-07-02
Branch: codex/round2-visual-prototype
Status: 阶段 0–4 已完成；阶段 5 收尾待办

Last updated: 2026-07-02
Validation: `npm test` 通过(489 passed / 1 skipped)；`npx tsc --noEmit` 通过；浏览器已走通
lock → measurement → submit → drawings review，并验证 A1/A2/S1 模型驱动输出。

## 背景与问题

当前 Round 2 的 handoff 页加载并锁定真实 Round 1 快照(`round2/page.tsx` → `Round1ReferenceSource`),
但锁定之后三个工作区完全没有使用它:

- 量尺字段(Wall A/B/C + 一个窗)写死在 `round2-fixtures.ts` 的 `ROUND2_MEASUREMENT_FIXTURE`。
- 方案工作区的 14 个柜子写死在 `ROUND2_CABINET_FIXTURE`(固定 U 型)。
- 图纸 A1–A4 内嵌另一套独立硬编码柜子(`drawing-sheet.tsx` 的 `PlanSheet` / `elevationSpecs`),
  与方案页的编号、数量互相矛盾。

结果:不论 Round 1 锁定什么 layout,Round 2 永远显示同一个假 U 型厨房,且三个页面互不一致。

## 目标(UX 方案摘要)

"图纸不是产出物,是模型的实时投影。" 销售量完数据直接得到专业图纸,无"生成图纸"步骤:

1. 墙体从 Round 1 锁定布局派生(L 型两面 / U 型三面 / galley 两面对墙),不再固定 A/B/C。
2. 尺寸链即输入框:在图上点空位录入实测值,图按真实比例即时重排。
3. 提交即出方案:确定性引擎按标准柜宽自动铺满,余数自动生成挡板(filler)。
4. 微调 = 重新分配余量,不是自由拖拽:改宽/移位由同墙挡板吸收差值,尺寸链永远闭合;
   挡板低于最小值自动生成决策项(沿用 Confirmation Required 模式)。
5. 挡板是一等对象:可选中、可挪端、进柜体表编号。
6. 出图 = 打印视图:A1 平面、各墙立面、S1 柜体表从同一模型渲染,#1..#n 全局自动编号。

## 关键约束

- **Round 1 floorPlan 坐标是画布像素,不是英寸。** 派生只取拓扑与意向:墙的数量与方位、
  窗/门/水电固定点的所属墙与相对顺序、电器清单、柜型意向(layoutPreference、cabinet fill)。
  一切真实尺寸以 Round 2 实测为准,派生代码不得把 px 当英寸换算。
- 尺寸统一用 1/16″ 整数存储(沿用现有 `*16` 约定),显示层负责分数格式化(如 150 3/8″)。
- 几何归确定性代码所有(与 Round 1 `buildFloorPlan` 同一哲学),AI 不参与布柜/尺寸。
- 原型阶段仍为内存态("CHANGES ARE NOT SAVED" 横幅保留),持久化列为后续项,不在本轮范围。
- 现有骨架保留:三栏布局、SELECT_OBJECT 双向联动、measurement/proposal/drawing 版本与
  STALE 传播、decision rail、role 切换。只换数据源,不推翻交互框架。

---

## 阶段 0 — 核心模型与 Round 1 派生(地基)

- [x] 新建 `src/features/round2/model/round2-model.ts`:
  - [x] `Round2Model = { walls: Round2Wall[]; ... }`
  - [x] `Round2Wall = { id; label ("A"/"B"/...动态); lengthSixteenths | null(未实测); segments: WallSegment[] }`
  - [x] `WallSegment` 判别联合:`cabinet | filler | appliance | opening(窗/门) | gap`,
        宽度为 1/16″ 整数;cabinet 带 kind(base/upper/sink/tall)、标准宽度档位、全局编号位
  - [x] 分数格式化工具 `formatSixteenths()`(30″、¾″、150 3/8″)+ 单测
- [x] 新建 `src/features/round2/model/derive-walls.ts`:
  - [x] `deriveWallsFromRound1(floorPlan: FloorPlan): DerivedWall[]` —
        由 `baseCabinets/wallCabinets` 的 `wall` 字段(TOP/LEFT/RIGHT/BOTTOM)判定哪些墙参与,
        按顺时针顺序命名 A/B/C...
  - [x] 提取每面墙的固定点:window / door / markers(水电)/ 电器意向,只保留所属墙 + 相对顺序
  - [x] 覆盖布局:ONE_WALL、L(左右)、U、GALLEY;peninsula / island 先降级为备注项(见"暂缓")
  - [x] 单测:每种 layoutPreference 一个 fixture,断言墙数、命名、固定点归属
- [x] `Round1ReferenceSource` 增加派生结果或在 LOCK_REFERENCE 时计算并存入 state

验收:galley 快照派生出 2 面对墙,U 型派生出 3 面墙,窗归属正确;`npm test` 通过。

## 阶段 1 — 量尺工作区:字段派生 + 图上录入

- [x] `round2-types.ts`:`Round2Measurements` 由固定 6 字段改为按派生墙/固定点动态生成的
      `Record<measureKey, number | null>`(总长、天花、每个 opening 的宽度与 offset)
- [x] `round2-state.ts`:
  - [x] `createRound2PrototypeState` 不再引用 `ROUND2_MEASUREMENT_FIXTURE`;
        LOCK_REFERENCE / REPLACE_REFERENCE 时由派生结果初始化空白量尺(状态 DRAFT)
  - [x] `EDIT_MEASUREMENT` 按动态 key 工作;未完成必填项时禁止 SUBMIT
- [x] `measurement-workspace.tsx`:字段列表由派生墙生成(分组:每面墙一组 + ROOM + OPENINGS);
      进度条按真实完成度计算(替换写死的 72% / 06/08)
- [x] `measured-plan.tsx`:
  - [x] 平面图按派生墙拓扑绘制(不再固定三面 U 型)
  - [x] 尺寸链可点击:点某段 → 聚焦左侧对应输入框(双向:改输入框图即时重排)
  - [x] 未实测段显示占位样式(虚线 + "待量"),已实测段显示分数英寸
- [x] 引导顺序:总长 → 固定点 offset → 下一面墙(当前项高亮)
- [x] 更新 / 补齐 `measured-plan.test.tsx`、`round2-state.test.ts`

验收:锁定 galley 参考后量尺页出现 2 面墙字段;每输入一个值平面图即时变化;
未量完不能提交。

## 阶段 2 — 自动布柜引擎 + 挡板

- [x] 新建 `src/features/round2/model/autofill.ts`:
  - [x] `autofillWall(wall, intent): WallSegment[]` — 纯函数、确定性:
        标准柜宽档位(9/12/15/18/21/24/27/30/33/36),先放电器/水槽固定段,
        再铺柜体,余数生成挡板置于墙端(默认)或转角侧
  - [x] 转角处理:相邻墙相接处预留 corner 段(盲角柜或 filler,先做 filler + 备注)
  - [x] 全局编号:按墙序 A→B→C,先吊柜后地柜,#1..#n;挡板独立编号 F1..Fn 进柜体表
  - [x] 挡板最小值规则(默认 ½″,可常量配置):低于阈值 → 产出 decision item 数据
  - [x] 单测:总宽恒等于墙长(闭合性)、同输入同输出(确定性)、挡板阈值触发决策项
- [x] `round2-state.ts`:SUBMIT_MEASUREMENT 后自动执行 autofill,模型进入 state;
      REPLACE_REFERENCE / SUBMIT_NEW_MEASUREMENT 时重新 autofill 并把 proposal/drawing 置 STALE
- [x] 删除 `ROUND2_CABINET_FIXTURE` 的消费方(fixture 文件在阶段 5 统一移除)

验收:提交量尺后方案页自动出现铺满的柜体 + 挡板;尺寸链每段之和 === 墙实测总长
(单测断言)。

## 阶段 3 — 方案工作区:约束式微调

- [x] `round2-types.ts` / `round2-state.ts`:
  - [x] 移除自由偏移 `SET_CABINET_OFFSET` / `cabinetOffsets`,替换为约束动作:
    - [x] `STEP_CABINET_WIDTH`(标准档位换档,差值由同墙挡板吸收)
    - [x] `NUDGE_GROUP`(1/16″ 步进,挡板间转移余量;支持 ←/→ 键盘)
    - [x] `MOVE_FILLER_END`(挡板挪端:左端/右端/柜间)
    - [x] `SET_SEGMENT_KIND`(换柜型,宽度规则同换档)
  - [x] 任何微调后重算闭合性;挡板 < 阈值或 < 0 → 生成/更新决策项,proposalStatus 走
        NEEDS_DECISION;恢复后可 RESOLVE
  - [x] 泛化 `SET_SINK_WIDTH`(30/33/36)为 `STEP_CABINET_WIDTH` 的特例,删除专用 action
- [x] `design-plan.tsx` / `wall-elevation.tsx`:改读 `Round2Model`(墙数动态、选中墙立面
      按实测比例渲染);挡板渲染为可选中的琥珀色段并显示宽度
- [x] `proposal-workspace.tsx`:墙 Tab 由派生墙生成(不再写死 A/B/C);选中柜属性栏:
      宽度档位 chips + nudge 按钮 + 挡板余量显示
- [x] `decision-rail.tsx`:决策项来自模型(挡板不足、量尺冲突),替换演示数据;
      REQUEST_REMEASURE 保留并关联到具体墙/段
- [x] 更新 `proposal-selection.test.tsx`、`decision-rail.test.tsx`、`round2-state.test.ts`

验收:改任一柜宽,同墙挡板数值即时变化且尺寸链仍闭合;把挡板压到 ¼″ 出现决策项;
平面/立面/决策栏三处联动选中。

## 阶段 4 — 图纸:同一模型渲染

- [x] `drawing-sheet.tsx` 重写为模型驱动:
  - [x] 删除 `PlanSheet` / `ElevationSheet` / `elevationSpecs` 三套硬编码
  - [x] A1 平面:按派生墙拓扑 + 实测尺寸绘制,尺寸链(分段 + 总长)自动生成
  - [x] 立面页数量动态:每面参与墙一页(A2..A[n+1]),`ROUND2_SHEETS` 由模型生成
  - [x] 立面含:柜体红叉门线、红色编号、上下双层尺寸链、竖向总高/台面高标注、
        窗/门蓝色开口
- [x] `cabinet-schedule.tsx`(S1):从模型生成行,含挡板行(F 编号、宽度、位置);
      保留 measurement/proposal 版本水印
- [x] `drawing-review.tsx`:sheet 切换、zoom、MARK_REVIEWED 逻辑不变,仅换数据源
- [x] 更新 `drawing-sheet.test.tsx`(断言:图纸编号与方案页一致、尺寸链闭合、
      galley 参考只出 2 张立面)

验收:方案页看到的 #编号/宽度/挡板与 A 系图纸、S1 柜体表逐项一致;
换一个 Round 1 参考锁定后整套图纸随之变化。

## 阶段 5 — 收尾与验证

- [ ] 删除 `round2-fixtures.ts` 中已无消费方的 fixture(测试改用各阶段的构造函数);
      `Round1ReferenceSource` demo fixture 若 handoff 空态仍需要则保留并注明仅用于无快照演示
- [ ] `round2-visual-prototype.tsx` / `round1-handoff.tsx`:LOCK_REFERENCE 携带完整派生输入
      (目前只传 snapshotId);无 Round 1 快照时维持 TASKS LOCKED 空态
- [ ] 全量验证(按项目惯例):
  - [ ] `npm test` 全绿
  - [ ] `npx tsc --noEmit` 退出码 0
  - [ ] `npm run build` 成功
  - [ ] 浏览器 QA:分别用 galley、L 型、U 型三个项目走完整链路
        (锁定 → 量尺 → 提交 → 微调 → 图纸 → 标记已审)+ role 切换只读校验
- [ ] 更新 `ai_ctx.md`:Round 2 状态、本次架构决定(单一模型、派生拓扑、约束式微调)

## 暂缓 / 明确不做(本轮)

- 持久化(量尺与方案存库)、多人协同 —— 原型仍为内存态。
- island / peninsula 的自动布柜 —— 派生时降级为备注 + 决策项,不阻塞主墙链路。
- 盲角柜、异形墙(斜墙/柱子)、吊顶造型 —— 转角先用 filler + 决策项占位。
- PDF 导出 / 打印样式 —— 图纸先满足屏幕审阅。
- Round 1 侧任何改动:Round 1 保持粗颗粒(salesEstimateOnly),精确性只存在于 Round 2。

## 建议实施顺序

阶段 0 → 1 → 2 是一个可交付切片(解决"对不上"+"量完即出方案"),先做完并验证;
阶段 3、4 各为独立切片;阶段 5 收尾。每个阶段单独提交,commit 前跑 test + tsc。
