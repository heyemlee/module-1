# Round 2 整体改造 TODO — 单一模型驱动量尺 / 方案 / 图纸

Date: 2026-07-02(第一轮)/ 2026-07-06(第二轮规划)
Branch: codex/round2-visual-prototype
Status: 第一轮(阶段 0–5)代码完成,仅剩三布局手动浏览器 QA(需 seed 项目,用户侧验收);
第二轮(阶段 6–10:标准表 / 设计意向 / 规则化 autofill / 立面优先编辑)已规划,待实施

Last updated: 2026-07-06
Validation: `npm test` 通过(489 passed / 1 skipped)；`npx tsc --noEmit` 通过;
`npm run build` 成功。已走通 lock → measurement → submit → drawings review,
并验证 A1/A2/S1 模型驱动输出。死 fixture(`ROUND2_MEASUREMENT_FIXTURE` /
`ROUND2_CABINET_FIXTURE` / `ROUND2_SHEETS`)与孤立类型 `Round2Cabinet` 已删除。

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

- [x] 删除 `round2-fixtures.ts` 中已无消费方的 fixture(`ROUND2_MEASUREMENT_FIXTURE` /
      `ROUND2_CABINET_FIXTURE` / `ROUND2_SHEETS` 均已删;顺带删除孤立类型 `Round2Cabinet`);
      `ROUND1_REFERENCE_FIXTURE` 保留并注明仅用于测试与 handoff 无快照空态
- [x] `round2-visual-prototype.tsx` / `round1-handoff.tsx`:LOCK_REFERENCE / REPLACE_REFERENCE
      已携带完整 `Round1ReferenceSource`(阶段 0–3 期间完成);state 在锁定时
      `deriveWallsFromRound1`;无 Round 1 快照时维持 TASKS LOCKED 空态
- [x] 全量验证(按项目惯例):
  - [x] `npm test` 全绿(489 passed / 1 skipped)
  - [x] `npx tsc --noEmit` 退出码 0
  - [x] `npm run build` 成功
  - [ ] 浏览器 QA:分别用 galley、L 型、U 型三个项目走完整链路
        (锁定 → 量尺 → 提交 → 微调 → 图纸 → 标记已审)+ role 切换只读校验
        —— 需要已 seed 的三布局项目 + 登录,留作用户侧验收(模型输出已有单测覆盖)
- [x] 更新 `ai_ctx.md`:Round 2 状态、本次架构决定(单一模型、派生拓扑、约束式微调)

---

## 第二轮改造 — 设计正确性 + 立面优先编辑(2026-07-06 规划)

来源:2026-07-06 设计讨论(参照真实 CAD 图纸对齐目标形态)。三个主题:

1. autofill 从"贪心铺柜"升级为"规则驱动的分区求解":转角先行、水槽对窗锚定、
   功能邻接、挡板归位、吊柜从地柜派生、高度链消费天花实测。现状问题:每面墙独立
   从大到小贪心铺,余数 filler 丢段尾;`ceilingHeightSixteenths` 量了但无消费方;
   转角只是占位 —— 结果"乱填",02 阶段无法只做微调。
2. 影响几何的设计决策(转角策略/到顶/垃圾拉篮/抽屉比例/五金默认)必须在 autofill
   之前收集 —— 并入 01 量尺工作区作 DESIGN INTENT 分组,不新增独立阶段;
   不影响墙体几何的(门抽细节/配件/拉手)给默认值,02 阶段属性卡再调。
3. 02 方案阶段以立面为编辑面(宽度链/高度链/柜体配置三类输入),俯视图退化为
   只读投影 + 点击导航;方向永远是"立面/属性 → 模型 → 俯视图",单向。

原则不变:几何归确定性代码;所有编辑仍是同一 `Round2Model` 上的约束 action,
不引入第二数据源;未回答项默认值 + Confirmation Required 决策项,不阻塞提交。

## 阶段 6 — 柜体标准表(数据地基)

- [ ] 新建 `src/features/round2/model/cabinet-standards.ts`:纯数据常量 + Zod schema 同形校验
  - [ ] `baseWidths` 宽度档位(9/12/15/18/21/24/27/30/33/36,
        替代 `autofill.ts` 的 `STANDARD_CABINET_WIDTHS_SIXTEENTHS`)
  - [ ] `doorRule`(单门 ≤21″ / 对开 ≥24″)、`drawerStacks` 标准抽高组合(如 6/12/12)
  - [ ] `upperHeights` 档位(30/36/42)、`counterHeight` 34½″、`backsplashMin` 18″、
        moulding 预留
  - [ ] `fillerMin` ½″ / `fillerPreferred` 3″(替代 `FILLER_MIN_SIXTEENTHS`)
  - [ ] `corner` 常量(lazySusan 36×36;盲柜本墙最小宽 39″ + 邻墙 3″ 拉距)
  - [ ] `appliances` 宽度(DW24 / RNG30 / SB 30/33/36 / REF36,
        替代 `applianceWidth` / `applianceLabel` 内的硬编码)
  - [ ] 深度:base 24″ / upper 12″ / tall 24″(供俯视图投影与 A1 平面用)
- [ ] `autofill.ts`、`STEP_CABINET_WIDTH` 档位、`SET_SEGMENT_KIND` 宽度规则全部改读
      标准表 —— 自动填充与 02 微调使用同一档位来源
- [ ] 单测:schema 校验;消费方替换后现有 autofill / state 测试不回归
- 决定:**不建数据库表**。标准是低频变更、需版本追溯的数据,git 配置文件最合适;
  将来出现多品牌/多门店差异或非开发人员后台修改需求时,再以同一 Zod schema 升级为
  DB 表 + 管理页(repository 加载 + 整表缓存;远程 PG ~254ms/查询,禁止逐次查库)。

验收:全仓 grep 无第二处柜宽/门规则/电器宽度字面量;改标准表一处,
autofill 结果与微调档位同步变化。

## 阶段 7 — 设计意向收集(并入量尺工作区,不新增阶段)

- [ ] `round2-types.ts` 新增 `Round2DesignIntent`:
  - [ ] 每个转角一项:`lazySusan | blindBase | deadCorner`(默认 deadCorner=双侧 filler 占位)
  - [ ] 吊柜到顶与否 + flat moulding 形式(默认档位由天花实测推导,见阶段 8 高度链)
  - [ ] tall 柜位置意向、垃圾拉篮(默认水槽侧)、抽屉柜/门板柜比例偏好、烟机形式
  - [ ] 全局五金默认:`handle | fingerPull`
- [ ] 题目列表由派生拓扑 + 实测动态生成(与量尺字段同一派生机制):
      有几个转角出几道转角题;同墙有窗才问水槽对窗;天花实测决定"到顶"怎么问
- [ ] `measurement-workspace.tsx`:新增 DESIGN INTENT 分组(与 ROOM / OPENINGS 并列),
      chip 选择题 8–12 题;引导顺序末站:总长 → offset → 下一面墙 → 意向 → 提交
- [ ] 全部有默认值,**不阻塞 SUBMIT**;未确认项在 autofill 后生成
      Confirmation Required 决策项(沿用 Round 1 哲学)
- [ ] `round2-state.ts`:intent 存入 state;SUBMIT_MEASUREMENT 时传给 autofill;
      REPLACE_REFERENCE 时重置
- [ ] 单测:拓扑→题目派生(galley 0 转角题 / L 型 1 / U 型 2);跳过默认值 → 决策项生成

验收:U 型项目量尺页出现 2 道转角题;全部跳过仍可提交出方案,
但决策栏出现对应"按默认值填充,待确认"项。

## 阶段 8 — autofill 升级:规则驱动的分区求解

签名扩为 `autofillRound2Model(model, measurements, intent)`,输入四份:
派生拓扑 + 实测 + 标准表 + 设计意向。规则按优先级执行:

- [ ] **① 转角先行(架构性改动)**:逐墙填充**之前**,先在相邻墙交接处按 intent 做
      转角决议 —— 转角同时消耗两面墙宽度(lazySusan 两侧各 36″;盲柜本墙 ≥39″ 且
      邻墙 3″ filler;deadCorner 双侧 filler),把每面墙可填区间的起点内推;
      转角段为一等 segment,进柜体表与决策项
- [ ] **② 锚定固定点**:同墙有窗时水槽柜中线对齐窗中线(现有 reservation 机制上
      加对齐规则);灶台对燃气位、冰箱靠墙端保持
- [ ] **③ 分区填充 + 功能邻接**:锚点把墙切为区间,区间内铺标准宽;
      DW 紧贴水槽、垃圾拉篮在水槽另一侧、灶台两侧优先抽屉柜、宁少而宽
- [ ] **④ 挡板归位**:filler 推到转角侧/墙端,不留两柜中间;宽度落在 ½″–3″ 时
      先尝试相邻柜换档使其归 0 或 ≥3″,不成才出决策项
- [ ] **⑤ 吊柜从地柜派生**(不再独立铺一遍):烟机段对齐灶台段宽度、冰箱上方深柜
      或留空、吊柜尽量与地柜对缝、窗两侧对称
- [ ] **⑥ 高度链消费天花实测**:吊柜高 = min(标准档, 天花 − 台面 − 后挡水 − moulding
      预留);flat moulding 规格为推导产物;结果写入 `heightProfile`(阶段 9 消费)
- [ ] 单测:闭合性/确定性回归 + 新规则各至少一条断言(转角双墙扣宽、水槽对窗居中、
      filler 不在柜间、96″ 与 108″ 天花得出不同吊柜档)

验收:U 型 + lazySusan intent 提交后,两面墙各让出 36″ 转角段;窗下水槽居中;
所有 filler 位于墙端/转角侧;决策项只剩真正需要人定的。

## 阶段 9 — 方案工作区:立面优先编辑,俯视图只读投影

核心:立面不是新编辑器,是把现有约束 action 换触发入口;三类输入全部打到同一模型。

- [ ] `proposal-workspace.tsx` 布局对调:立面占大位(带墙 Tab),俯视图缩为左下 minimap,
      右侧保留决策栏 + 选中属性卡
- [ ] **宽度链 = 输入框**(复用量尺阶段 `inch-field.tsx` 模式):点上/下尺寸链标签 →
      标准档位 chips + 自定义;映射到现有 `STEP_CABINET_WIDTH` / `NUDGE_GROUP` /
      `MOVE_FILLER_END`,**零新 action**,差值照旧由同墙挡板吸收
- [ ] 尺寸链标签防重叠:窄段错行/引线标注,消除 "27'36″"、"3624″" 粘连
      (`wall-elevation.tsx` + `drawing-sheet.tsx`;已旗标为独立后台任务,可先行单独做)
- [ ] **高度链(新)**:`Round2Model.heightProfile { counterSixteenths; backsplashSixteenths;
      upperHeightSixteenths; mouldingSixteenths }` + `SET_HEIGHT_PROFILE` action;
      全局生效(改一处所有墙立面同步);校验 Σ ≤ `ceilingHeightSixteenths`,
      超出/余隙异常 → 决策项;立面纵向渲染从写死坐标(92/214/306)改为按 heightProfile 比例
- [ ] **柜体正面配置(新)**:`WallSegment.front? { doorCount: 1|2; drawerStack: number[];
      hardware; accessories: (trashPullout|spicePullout|lazySusan)[] }` +
      `SET_SEGMENT_FRONT` action;默认由标准表 doorRule + intent 派生,**front 只存例外**;
      立面即时渲染单门/对开 V 线与抽屉分割线;流入 S1 柜体表新列(门/抽/配件)
- [ ] `design-plan.tsx` 改只读投影:base 24″ 实线 + upper 12″ 虚线叠加 + tall 全深 +
      转角块 + 开口,尺寸链自动生成(横向来自 segment 宽度,纵深来自标准表);
      交互仅剩点击 → `SELECT_OBJECT` 跳对应墙立面(双向联动已有)
- [ ] 属性卡:宽度档位 / 门型 / 抽高组合 / 配件 / 五金 chips(mockup 已定稿于本次讨论)
- [ ] 更新测试:`proposal-selection`、立面渲染(front V 线/抽屉线)、S1 新列、
      heightProfile 校验与决策项
- 阶段内实施顺序:宽度链输入(纯 UI,见效最快)→ front + S1 → heightProfile
      (牵扯立面纵向渲染改造)

验收:全程只在立面 + 属性卡操作即可完成微调;俯视图与图纸随动且无任何独立输入口;
高度链改吊柜档位,所有墙立面与 A 系图纸同步变化。

## 阶段 10 — 收尾与验证(第二轮)

- [ ] `npm test` 全绿;`npx tsc --noEmit` 退出码 0;`npm run build` 成功
- [ ] 浏览器 QA:U 型项目走 锁定 → 量尺 → 意向 → 提交 → 立面微调 → 图纸 → 标记已审
- [ ] 补上第一轮遗留:galley / L / U 三布局手动浏览器 QA(需 seed 项目)
- [ ] 更新 `ai_ctx.md`:标准表、design intent、规则化 autofill、立面优先编辑、
      heightProfile 与 front 字段

## 暂缓 / 明确不做

- 持久化(量尺/方案/intent 存库)、多人协同 —— 原型仍为内存态。
- island / peninsula 的自动布柜 —— 派生时降级为备注 + 决策项,不阻塞主墙链路。
- 异形墙(斜墙/柱子)、吊顶造型 —— 继续占位。(盲角柜已从暂缓移入阶段 8,由 intent 驱动)
- 俯视图深度自定义(如 12″ 浅地柜)—— 先固定标准深度,后续在属性卡加 depth 字段。
- 柜体标准表的 DB 化与后台管理页 —— 等多品牌/非开发修改需求出现再做(见阶段 6 决定)。
- PDF 导出 / 打印样式 —— 图纸先满足屏幕审阅。
- Round 1 侧任何改动:Round 1 保持粗颗粒(salesEstimateOnly),精确性只存在于 Round 2。

## 建议实施顺序

第一轮(已完成):阶段 0 → 1 → 2 一个切片,阶段 3、4 独立切片,阶段 5 收尾。

第二轮:阶段 6(数据地基)最先;6 → 7 → 8 为"设计正确性"切片 —— 完成后提交量尺
即得到方向正确的方案,02 阶段才真正只剩微调;阶段 9 为独立"立面编辑"切片
(其中宽度链输入与标签防重叠可先行);阶段 10 收尾。
每个阶段单独提交,commit 前跑 test + tsc(+ build,按项目惯例)。
