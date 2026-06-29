# 真人模拟对话测试脚本 — Round 1 展厅 intake

> 用途：拿真实、乱糟糟的销售↔客户对话当**全流程测试脚本**。每个场景是一段**从头走到尾的完整六步 intake**（Room → Openings → Layout → Appliances → Adjust Positions → Rendering），照着念或对着语音 agent 说，看系统扛不扛得住。
> 角色：**S** = 销售，**C** = 客户，**[系统]** = 此处应有的系统/agent 行为与验证锚点。
> 这些同时是 [ai-eval-plan.md](./ai-eval-plan.md) 的 **agent 种子用例**和 [launch-manual-test-plan.md](./launch-manual-test-plan.md) 的 P0-03 全流程人工脚本。
> ✅已修 / ⚠️未修 标记当前缺陷状态。

---

## 场景 1 ✅已修 巨型尺寸 / 大平层（尺寸溢出）

**测试目标**：客户乱报巨大尺寸 → 不再生成离谱几何，夹到上限 + 确认项。
**人设**：爱炫耀，房子大，张口就来，尺寸不靠谱。

```
S: 来坐，喝点水。咱先把您家厨房大概弄出来，一步一步来啊。
C: 行行行，我家挺大的，大平层，你随便弄。

—— Room ——
S: 厨房长度大概多少？英寸英尺都行。
C: 长度…一千英尺吧。宽度八百。哦不对，差不多 100 by 8000 这么大。
S: （输入 12000 × 8000）
[系统] ✅ 长/宽超 600"(50ft) → 夹到上限 + 推 ROOM_DIMENSION_OUT_OF_RANGE
       「尺寸超出常见范围，已按上限处理，请核实」。图不再崩。
S: 大哥这一千英尺是足球场啊。我先按正常大厨房给您摆，回头量了再改。层高知道吗？
C: 不知道，空着吧。
[系统] 层高空 → Confirmation Required；dimensionConfidence 仍 ROUGH。

—— Openings ——
S: 有门吗？
C: 有，一个门，前边进来那个。
S: 窗呢？
C: 后墙有一扇大的。

—— Layout ——
S: 厨房什么型？L、U、一字、还是走廊型？
C: U 型，大厨房不上 U 型像话吗。
S: 要岛台吗？
C: 必须的！要个大岛台。

—— Appliances ——
S: 水槽、灶、冰箱、洗碗机都有？
C: 都有都有，全套。
S: 烤箱、内嵌微波？
C: 都有，叠一起那种。

—— Adjust Positions ——
S: （点 Generate Cabinet Fill，出粗布局）您看，门在这、窗在后墙、岛台在中间。
C: 哎怎么柜子看着这么小？
S: 因为您刚那尺寸太大了显得小，我按上限收了，真实尺寸出来就正常。位置要挪您指。
C: 冰箱挪左边墙。
S: （拖到左墙）好。
[系统] 拖动后若已有快照 → 快照作废，需重新生成。

—— Rendering ——
S: 出个效果图？得先选柜门风格和颜色。
C: 白色的，出。
[系统] 颜色 active 且匹配 style → 按钮解锁，出概念图，配额 −1。
S: 这是概念图啊不是施工图，看个大概感觉。
C: 行行挺好。
```

**验证点**
- [ ] 输入 12000/8000 → 夹到 ≤600"，不产畸形图
- [ ] 产 ROOM_DIMENSION_OUT_OF_RANGE 确认项，不静默
- [ ] 层高空 → 另一条确认项；`dimensionConfidence` = ROUGH
- [ ] 拖冰箱后快照作废需重生成
- [ ] 渲染按钮按颜色×风格正确解锁，配额扣 1

---

## 场景 2 ⚠️ 术语不懂（open passage vs 门）

**测试目标**：客户看不懂 `open passage`，门/过道分不清；门窗豁免布局限制。
**人设**：英文术语一问三不知，老要翻译，答非所问。

```
—— Room ——
S: 厨房长宽大概多少？
C: 嗯…一般多少啊？一般家里。
S: 那我按常见的来，长 180 宽 120，回头不对再改。
C: 行行，你专业。

—— Openings ——
S: 您家厨房有门吗？
C: Open passage 是啥呀？我也不知道，translate 一下。
S: 这俩不一样：door 是有门扇能关的；open passage 是没门扇的开口、走廊过道那种。
C: 哦！走廊过道嘛。那我都有，一个真门，还有一个过道开口。
S: （门 status=YES 一个；open passage 一个）
[系统] 门 + open passage 同存 → 平面图各画各的，互不替代。
S: 窗户呢？
C: 有，但我不知道在哪面墙…you decide。
S: 那我标后墙，待您确认。
[系统] 窗墙未定 → 可标 Confirmation；门/窗可放 layout 不允许的墙（豁免）。

—— Layout ——
S: 形状呢，L 型 U 型？
C: 啥叫 L 型啊…画给我看看。哦那个拐角的，行就那个，左拐。
S: （LEFT_L_SHAPE）要岛台吗？
C: 岛台是啥？中间那个台子？不知道要不要。
[系统] island=UNKNOWN → 产 UNKNOWN_ISLAND_STATUS 确认项，默认不生成岛几何。

—— Appliances ——
S: 水槽冰箱灶这些有吧？
C: 有有，正常家里都有的。洗碗机也有。
S: 烤箱微波？
C: 普通烤箱吧，微波放台面上那种，不是嵌的。

—— Adjust Positions ——
S: （生成）门在这、过道开口在这、窗在后墙。位置看着行吗？
C: 那个门是不是该往右点？我家门其实在右边。
S: （把门拖到右墙）这样？门不受布局限制，哪面墙都行。
C: 对对。

—— Rendering ——
S: 出图得先选风格颜色。
C: 随便你，挑个好看的。
S: 那欧式无框配个橡木色。
C: 行，出。
```

**验证点**
- [ ] `open passage` 有可读说明 / 可翻译，客户能区分门 vs 开口
- [ ] 门 + 过道开口同存，平面图各画各的
- [ ] 窗墙 unknown、island unknown → 各产确认项，不阻断
- [ ] 门拖到布局不允许的右墙 → 允许（豁免规则）

---

## 场景 3 「都有都有」最大化客户（U 型 + 环岛 + 全家电）

**测试目标**：U 型 + 岛台 + 全套家电 + 壁挂烤箱/内嵌微波叠塔，不崩、不重叠。
**人设**：什么都要，全 Yes，财大气粗。

```
—— Room ——
S: 长宽？
C: 长 240 宽 180，我家厨房大。
S: 层高？
C: 9 尺，108 英寸。

—— Openings ——
S: 门窗？
C: 一个门在前，两扇窗，左墙右墙各一扇。

—— Layout ——
S: 形状？
C: U 型。带岛台，必须带。
[系统] U_SHAPE + island=YES → 出 LEFT+RIGHT 双侧 run + 岛台几何。

—— Appliances ——
S: 水槽？
C: 有，大的，双槽。
S: 洗手台、灶、冰箱、洗碗机？
C: 都有都有，全部 Yes，啥都要。
S: 烤箱呢，是带烤箱的灶（range），还是单独壁挂烤箱？
C: 单独壁挂烤箱，high-end 的。
S: 那内嵌微波呢？
C: 有，building 的，内嵌。
S: 壁挂烤箱和内嵌微波是叠一个塔里，还是分两处？
C: 叠一起，叠塔。
[系统] wallOven=YES + microwaveOvenCombo=YES → ovenMicrowave.configuration = 叠塔（非分开）。

—— Adjust Positions ——
S: （生成）您看，U 三面都是柜，岛台在中间，烤箱微波塔在右墙。
C: 那个岛台能再大点吗？
S: 粗图先这样，岛台精确尺寸 Round 2 量了定。位置先调，大小先别纠结。
C: 行。灶往中间岛台上挪行不行？我要岛上做饭。
S: （把灶拖到岛台）可以，岛上灶。
[系统] 全家电同在 + 叠塔 + 岛上灶 → 不报错、不互相穿模、让位生效。

—— Rendering ——
S: 风格颜色？
C: 美式有框，白色 shaker。出图。
[系统] 选 AMERICAN_FRAMED + active 白色 → 解锁出图。
C: 哇这个好，就这个感觉。
```

**验证点**
- [ ] U 型出 LEFT+RIGHT 双侧 run；岛台出 ON_ISLAND
- [ ] 壁挂烤箱 + 内嵌微波 → ovenMicrowave 捕获为**叠塔**（非分开）
- [ ] 全家电 + 岛上灶不报错、不重叠穿模
- [ ] 美式有框 + 白色解锁出图

---

## 场景 4 模糊 + 留白（unknown 全程不阻断）

**测试目标**：客户每一步都答不上来 → 确认项一路累积，但永远能走到出图。
**人设**：什么都「差不多」「不知道」「你看着办」。

```
—— Room ——
S: 长度多少？
C: 一般多少啊？差不多那么大就行。
S: 宽度？
C: 不知道，反正方方正正的。
S: 层高？
C: I don't know, just leave it blank.
[系统] 长/宽/层高缺 → 各产 Confirmation；仍可继续。

—— Openings ——
S: 有门吗？
C: 应该有吧…记不清了。
S: 那我标 unknown。窗呢？
C: 也不确定。
[系统] 门 unknown + 窗 unknown → UNKNOWN_DOOR_STATUS + UNKNOWN_WINDOW_STATUS。

—— Layout ——
S: 形状有想法吗？
C: 没想法，你给我推荐。
S: 那我先不预设，标 no preference。岛台？
C: 不知道要不要。
[系统] layoutPreference=NO_PREFERENCE；island=UNKNOWN → 确认项。

—— Appliances ——
S: 水槽冰箱灶？
C: 应该都要吧…具体型号尺寸我真不知道。
S: 没事，Round 1 只问有没有，尺寸 Round 2 量。烤箱微波？
C: 不确定。
[系统] 各 appliance 状态/尺寸 unknown → 一堆 MISSING/UNKNOWN 确认项；不阻断。

—— Adjust Positions ——
S: （照样能 Generate Cabinet Fill）您看，虽然好多没定，但大概框架出来了，门窗我先随便摆。
C: 行，反正待定。

—— Rendering ——
S: 出图试试？
C: 出吧，看看大概。
[系统] 即便确认项一大堆，快照仍 notForProduction=true、ROUGH；渲染照常可走（满足门控前提下）。
```

**验证点**
- [ ] 每步留空 → 对应 Confirmation Required，全程不报错、不阻断
- [ ] 缺尺寸/缺门窗/缺形状仍能 Generate Cabinet Fill 出图
- [ ] 快照含完整未确认项清单；`notForProduction: true`、ROUGH

---

## 场景 5 渲染期望管理（AI 出图的边界）

**测试目标**：渲染门控 + 出图局限的友好沟通 + 概念非精确边界 + 配额。
**人设**：急性子，中途切英文，催出图，对结果挑刺。

```
—— Room ~ Appliances（快速带过）——
S: 长 200 宽 150，层高 96，一个门两扇窗，L 型不要岛，水槽冰箱灶洗碗机都有，普通配置。
C: 对对，就这样，快点我赶时间。

—— Rendering ——
C: Generate rendering for me, this one. 出个图看看呗。
S: 得先选柜门风格和颜色才能出。
C: 哎呀这么麻烦。OK，I like this one（指一个色），generate.
S: 这个颜色是欧式无框的，您 layout 选的风格得对上才能解锁。
[系统] 选中颜色须 active 且 cabinetStyle 匹配 → 否则按钮锁。
C: 行行，就这个对的，出！
S: （生成中…）
[系统] 出图：带「sales-estimate concept / not for production」边界；配额 −1。

（出图后）
C: 哎 why so many spaces here? 怎么这么多空的地方？这不对吧。
S: This is the limitation of AI rendering for now —— 这是目前 AI 出图的局限，
   它把空间留白了，we may improve later but not now。它是**概念图**给客户找感觉，
   不是精确施工图，柜子具体排布以咱们那张平面图为准。
C: 那再出一张试试。
S: （再点 Generate）
[系统] re-roll → 配额再 −1（隐式不满意信号，可计入反馈）。
C: 这张好点。行吧我理解，概念图嘛。
S: 对，定稿尺寸 Round 2 量完再说。

—— 配额边界 ——
C: 我再多出几张挑挑。
S: （连点）到第 N 张时——
[系统] 当月渲染数 ≥ monthlyRenderQuota → 403 QUOTA_EXCEEDED，提示友好；admin 调高配额后可继续。
```

**验证点**
- [ ] 没选 / 颜色不匹配 style → 按钮锁；选对 → 解锁
- [ ] 出图是概念图，有 not-for-production 文案，客户预期被正确管理
- [ ] 局限有话术兜底，不假装完美
- [ ] 每次出图 / re-roll 配额正确 −1；配额耗尽 403 友好提示

---

## 场景 6 堆叠 / 嵌墙 设计边界

**测试目标**：一个物体压在另一个上面 / 内嵌进墙体 —— 重叠与嵌入怎么处理。
**人设**：纠结细节，问得很具体，盯着图较真。

```
—— Room ~ Layout（正常带过）——
S: 长 216 宽 168，层高 102，一个门一扇窗，U 型，不要岛。
C: 对。

—— Appliances ——
S: 灶、烤箱、微波？
C: 我要内嵌微波装在烤箱正上方，叠着的。
S: 那是壁挂烤箱 + 内嵌微波叠塔。
C: 对。还有，如果一个东西堆在另外一个东西上面怎么办？哪个能压哪个，告诉我。
S: 能叠的就烤箱微波塔这种垂直叠；水平面上家电不互相压，会让位。
[系统] 叠放 → ovenMicrowave 叠塔表达，不是两个独立矩形乱摆。

—— Adjust Positions ——
S: （生成）您看烤箱微波在右墙塔里。
C: 我这个冰箱是不是前镶在墙体里面的啊？要是不是嵌墙里、是凸出来的呢，显示会不会不一样？
S: 嵌墙 vs 凸出是精确细节，Round 1 这张粗图不区分，我给您标个「待确认」，Round 2 量了定。
[系统] 嵌墙/凸出 → Round 1 标 Confirmation Required，不在粗图精确表达。
C: 那你把冰箱往灶那边挪挪，挨太近了会不会打架？
S: （拖冰箱靠近灶）系统会自动让位，不会让俩硬重叠。
[系统] 拖拽重叠 → clearance 让位生效，不允许两件硬穿模。
C: 嗯这样好。

—— Rendering ——
S: 出图？欧式无框配深木色。
C: 行，出。看看叠塔长啥样。
[系统] 出概念图；叠塔/嵌墙细节是概念示意，非精确。
```

**验证点**
- [ ] 叠放（微波在烤箱上）→ ovenMicrowave 叠塔表达，非两独立矩形
- [ ] 嵌墙 vs 凸出 → Round 1 标确认项，留给 Module 2
- [ ] 拖拽两件靠近 → clearance 让位，不硬重叠穿模

---

# 第二批：边界与异常路径场景（11–20）

> 来源：6 个并行分析 agent 分别从**验证/错误路径、客户原型、布局家电组合、会话生命周期、渲染边界、隐私安全**六个角度扫了一遍代码，专挑现有场景 1–10 **没覆盖**的路径。每条都标了 `**命中代码**` 锚点。
> ⚠️ 标记的是分析中**顺带发现的真实缺陷/缺口**（agent 读码所得，落地修复前请人工复核）；无标记的是"正确边界，测它扛不扛得住"。

---

## 场景 11 ⚠️ 非法尺寸：0 / 负数 / 纯文字（硬拒绝，非夹取）

**测试目标**：下限/非法值走的是与场景 1（上限夹取）**完全相反**的硬拒绝分支，验证拒绝后能优雅兜底。
**人设**：随口乱报，拿尺寸开玩笑，没量过。
**命中代码**：`schemas.ts` `nullableNumberSchema = z.number().positive().nullable()` —— `.positive()` 拒 0/负数；AI 录入落 `agent-service.ts` 的 `{ ok:false, error, issues:[...] }`。

```
S: 来坐，喝点水，咱一步步把您家厨房弄出来。

—— Room ——
S: 厨房长宽大概多少？英寸英尺都行。
C: 没量，就一面墙那么长，零吧，先填零。
S: （填 length=0）填不进，0 系统不收。
[系统] Zod .positive() 拒绝 0 → 返回 issues；与场景 1"超大夹到 600"是两条对立路径（上限夹取 vs 下限/非法硬拒绝）。
C: 那宽度负二十？（开玩笑）
S: （填 width=-20）负数也一样被拒，根本写不进表单。
[系统] 负数同样 .positive() 拒绝——不是夹取。
S: 咱不猜了，您大概估一个，180 总有吧？宽 120？
C: 差不多吧。层高不知道。
S: （填 180×120）层高我先空着标待确认。
[系统] 层高空 → Confirmation Required；dimensionConfidence=ROUGH。

—— Openings ——
S: 有门吗？窗呢？
C: 一个门在前边，窗在后墙。

—— Layout ——
S: 什么型？L、U、一字？
C: L 型吧，靠两面墙。
S: 要岛台吗？
C: 不要，地方不大。

—— Appliances ——
S: 水槽、灶、冰箱、洗碗机都有？
C: 都有，标准的。烤箱就灶带的那种，不要单独的。

—— Adjust Positions ——
S: （生成）您看大致这样，门在前、窗在后。
C: 冰箱往门口挪挪。
S: （拖动）好。
[系统] 拖动后快照作废，需重新生成。

—— Rendering ——
S: 出个效果图？先选柜门风格和颜色。
C: 白色，出。
[系统] 颜色 active 且匹配 style → 解锁，出概念图，配额 −1。
C: 行，挺好。回头我量准了尺寸再来改。
S: 对，这版是粗的，不是施工图。
```

**验证点**
- [ ] length=0 / 负数 → Zod 拒绝（非夹取），表单不落值
- [ ] AI 把 0 当合法意图发 update_intake，靠 Zod 兜底 → agent prompt 应显式拦非正数
- [ ] ⚠️ 拒绝文案是技术性 issues，缺面向客户的中文兜底（上下限处理不对称）

---

## 场景 12 ⚠️ 房间小于最小可用尺寸（静默通过，无下限守门员）

**测试目标**：尺寸**合法但太小**，排不下任何标准柜段，系统却不报错、产空图。
**人设**：迷你茶水间/壁橱改厨房，尺寸是真的小。
**命中代码**：`normalize.ts` 只有 `MAX_ROOM_INCHES=600`，**无对应 MIN**；`readiness.ts` 判 `canGenerateRound1Layout=true`；`plan-geometry.ts` `clamp(_,18,span*0.9)` 把柜段几乎全过滤，**无 error code、无确认项**。

```
S: 来，咱先把您这间小厨房弄出来。

—— Room ——
S: 厨房长宽？
C: 小，茶水间改的，长 30 宽 24（英寸）。
S: （填 30×24）层高呢？
C: 普通高度吧，没量。
[系统] 30×24 正数 → 过 Zod、readiness=可生成，无下限校验；层高空 → 确认项。

—— Openings ——
S: 有门吗？
C: 一个小门进来，没窗。

—— Layout ——
S: 这么窄就一面墙一排了吧？
C: 对，一字型，贴一面墙。
S: 岛台肯定放不下。
C: 那肯定。

—— Appliances ——
S: 放点啥？
C: 小水槽、一个电陶炉、台面小冰箱，洗碗机不要。

—— Adjust Positions ——
S: （点 Generate Cabinet Fill）……这柜子怎么基本没排出来几个？
C: 是不是太小放不下？
[系统] span 太小，柜段被 clamp(_,18,span*0.9) 静默过滤成近空图；无 error code、无确认项提示"装不下"。
S: 系统没拦也没提示，我得自己看出来。这尺寸是英寸还是英尺？
C: 英寸，就这么小。
S: 那这单不适合标准柜，我手动标个备注。

—— Rendering ——
S: 出图意义不大，柜子太少。要不咱先按定制思路另算？
C: 行，那回头细聊。
```

**验证点**
- [ ] 30×24 → 通过校验、可生成，但产近空布局
- [ ] ⚠️ 缺 `MIN_ROOM_INCHES` + `ROOM_TOO_SMALL_FOR_CABINETS` 确认项（与上限不对称）
- [ ] 退化空布局是静默的，销售只能肉眼发现
- [ ] 单位歧义后果相反：30" 误当 30 尺进 max 路径 / 30 尺误当 30" 进 too-small 路径

---

## 场景 13 ⚠️ 夫妻互掐：两个决策人当场给冲突答案

**测试目标**：单值表单 + 互斥字段**静默覆盖**，且无"分歧记录"机制——后点的人直接吞掉先点的人。
**人设**：业主夫妇同行，灶具/岛台/窗位各执一词。
**命中代码**：`showroom-intake-steps.tsx` `setCookingStatus`——Range=YES 自动把 Cooktop 设 `NO/NOT_APPLICABLE`（反之亦然），无提示；`updateForm` 全量覆盖；岛台分歧留 UNKNOWN → `normalize.ts` 生成 `UNKNOWN_ISLAND_STATUS`。

```
S: 二位都坐，咱一起把厨房定一下。

—— Room ——
S: 长宽多少？
C(夫): 220 乘 160。
C(妻): 没有吧，我记得没那么长。
S: 那我先按 200×150 估，回头量准再改。

—— Openings ——
S: 门窗呢？
C(夫): 门在右边。窗户……左边那面吧？
C(妻): 不对，窗在后墙。
S: 窗这面我先标"待确认"，你们核一下。
[系统] 窗墙分歧 → 留 UNKNOWN → 确认项。

—— Layout ——
S: L 型还是 U 型？要不要岛台？
C(妻): 要岛台。  C(夫): 不要，太挤。
S: 岛台我先标"待确认"，出图前定。
[系统] island=UNKNOWN → UNKNOWN_ISLAND_STATUS（系统唯一能"接住分歧"的出口）。

—— Appliances ——
S: 做饭主要用带烤箱的灶 Range，还是单独 Cooktop？
C(夫): Range，带烤箱那种。
C(妻): 不对，我要 Cooktop，烤箱单独装墙上。
S: （点 Cooktop=YES）那 Range 我先取消了哈——
C(夫): 诶你怎么把我的取消了？
[系统] ⚠️ 互斥字段静默覆盖，先选的被吞，无提示。
S: 系统这儿只能二选一，我先两个都退回"待确认"，你俩商量好再定。

—— Adjust Positions ——
S: 剩下的水槽冰箱我先按常规摆，位置回头再挪。
C(夫): 行。

—— Rendering ——
S: 出图得你俩把灶具、岛台先定下来，不然图是空的。
C(妻): 那我们回去商量。
S: 好，定了再来，我这版先存草稿。
```

**验证点**
- [ ] Range↔Cooktop 互斥时静默清掉对方，需销售口头先裁决
- [ ] ⚠️ 无"分歧待确认"语义：只能借 UNKNOWN 冻结分歧，确认项不携带"两人各要什么"
- [ ] 分歧最好停在 Generate Cabinet Fill 之前解决

---

## 场景 14 代填人：承包商替不在场的业主来跑

**测试目标**：高 UNKNOWN 密度下，确认清单是否清晰、能否信息不全仍走到快照/出图。
**人设**：装修承包商代填，很多细节"得回去问业主"。
**命中代码**：`normalize.ts` 把 UNKNOWN 的吊顶/门/窗/岛台分别转确认项；流程不强制所有字段已知即可 `Generate Cabinet Fill`；`dimensionConfidence:"ROUGH"`。

```
S: 您是替业主来的？那咱能定的先定，定不了的标"待确认"。

—— Room ——
S: 厨房长宽知道吗？
C: 长我量了，240；宽业主说大概 170。
S: 吊顶多高？
C: 不清楚，业主没说，标待定。
[系统] ceilingHeight 空 → Confirmation Required；dimensionConfidence=ROUGH。

—— Openings ——
S: 门窗呢？
C: 门肯定有，进门那个。窗户……可能背面？不敢确定。
[系统] 窗墙 UNKNOWN → 确认项。

—— Layout ——
S: L 还是 U？岛台要吗？
C: 业主想要 U 型。岛台他提过想要，但尺寸没定。
[系统] island=UNKNOWN → 确认项；多字段 UNKNOWN 但快照仍可冻结。

—— Appliances ——
S: 电器清单业主给了吗？
C: 水槽灶冰箱要，洗碗机不确定，烤箱他说要个好的，型号没定。
[系统] 洗碗机/烤箱细节 UNKNOWN → 各自确认项。

—— Adjust Positions ——
S: （生成）我按现有信息摆个大概，能挪的地方业主回头再说。
C: 行，先有个样子。

—— Rendering ——
S: 出张概念图，但这是非权威的，给业主看方向用，别当定稿。
C: 明白，我拍给业主。
[系统] 渲染 notForProduction；快照含大量待确认项，是给业主的"回家作业单"。
S: 对，这清单业主逐条确认完，咱再细化。
```

**验证点**
- [ ] 多字段 UNKNOWN → 各自一条确认项，流程不卡死
- [ ] 待确认清单是核心交付物（"给业主的回家作业单"），销售应主动念
- [ ] 渲染须明确标"非权威概念图"，防代填人当定稿汇报
- [ ] `ROUGH` 标记在 UI 上要对代填人足够显眼

---

## 场景 15 ⚠️ 半岛厨房 + 灶带集成烤箱（别画独立壁挂烤箱）

**测试目标**：触发从未用过的 `PENINSULA` + `RANGE_INCLUDES_OVEN` 组合，暴露渲染 prompt 自相矛盾。
**人设**：厨房一端开放对餐厅，要能坐人的半岛；做饭就一台带烤箱的灶。
**命中代码**：`LAYOUT_PHRASES.PENINSULA`；`OVEN_MICROWAVE_PHRASES.RANGE_INCLUDES_OVEN`="不要画独立壁挂烤箱"，但 `rendering-prompt.ts` `suppressExplicitOvenMicrowave` **只**抑制 STACK/SEPARATE，**不含 RANGE_INCLUDES_OVEN`。

```
S: 来，咱把这个开放式厨房弄出来。

—— Room ——
S: 长宽层高？
C: 200×180，层高 100。

—— Openings ——
S: 门窗？
C: 门在左边，窗在后墙水槽上方。

—— Layout ——
S: 厨房一端开放对餐厅？那是半岛型。
C: 对，半岛伸出来放俩高脚凳吃早饭。
[系统] PENINSULA 几何上复用 LEFT_L 的两面墙，没有独立"伸出"结构。

—— Appliances ——
S: 灶呢，普通带烤箱的灶，还是单独壁挂烤箱？
C: 普通灶，底下带烤箱，别整单独烤箱。
[系统] ⚠️ RANGE_INCLUDES_OVEN 不在抑制白名单：若 wallOven=YES 共存，cooking 行仍画 wall oven，与"不画独立烤箱"矛盾。
S: 水槽冰箱洗碗机？
C: 都要。微波放台面就行。

—— Adjust Positions ——
S: （生成）您看灶在后墙、底下能看到烤箱门。
C: 灶能挪半岛台子上吗？我想站岛边炒。
S: （试拖）粗图先标一下，灶具体落点 Round 2 定。
[系统] ⚠️ relation=ON_ISLAND：几何 relationToWall 无此分支（灶落墙），prompt relationPhrase 却说"on the island"——平面图与概念图打架。

—— Rendering ——
S: 出图？欧式无框配浅木。
C: 行，出。
[系统] 出概念图；注意核对图上没有冒出独立壁挂烤箱。
```

**验证点**
- [ ] PENINSULA 出图，话术说明"伸出坐人"（粗图与 L 型几何无别）
- [ ] ⚠️ RANGE_INCLUDES_OVEN 下不应再画独立 wall oven（修抑制白名单或 normalize 强制 wallOven=NO）
- [ ] ⚠️ ON_ISLAND 关系几何与 prompt 须一致

---

## 场景 16 ⚠️ 改尺寸发生在效果图**之后**，旧图也得失效

**测试目标**：出图**后**改尺寸，验证失效粒度——快照与渲染应同生命周期。
**人设**：已看到满意的概念图，随口纠正一面墙尺寸。
**命中代码**：`showroom-intake-app.tsx` `updateForm` 只 `setSnapshot(null)+setCabinetFillGenerated(false)`，**不清渲染图**；仅 `showroom-intake-panels.tsx` 一条 `state="stale"` 软横幅；重渲染不被强制。

```
S: 来，咱一步步弄。

—— Room ——
S: 长宽层高？
C: 长 240，宽 200，层高 96。

—— Openings ——
S: 门窗？
C: 门在右，窗在后墙。

—— Layout ——
S: 什么型？要岛台吗？
C: U 型，要个岛台。

—— Appliances ——
S: 全套电器？
C: 都要，烤箱微波叠一起。

—— Adjust Positions ——
S: （生成）门窗岛台都在，您看看。
C: 挺好。

—— Rendering ——
S: 出图，欧式无框雾灰。（出概念图）
C: 好看！哦对，左边那墙是 3 米不是 3 米 6。
S: （改尺寸，平面图重算，效果图上方冒出"输入已变更"灰条）
C: 那这效果图还算数吗？看着没变啊。
[系统] ⚠️ 改尺寸 → snapshot 硬清空，但旧渲染图原地保留、只软标 stale，系统不强制重出。
S: 图还是按旧尺寸那张，得重出一张才对得上。（重出，扣一次额度）
C: 那能把旧的删了吗，别看混。
[系统] gallery 只追加，无删除旧图路径。
```

**验证点**
- [ ] 改尺寸后旧渲染图应被失效/锁定，而非仅软横幅
- [ ] ⚠️ 失效粒度不对称：snapshot 硬清、render 软标
- [ ] ⚠️ 缺"删除/替换旧图"路径，新旧混排易误读

---

## 场景 17 ⚠️ 老客户回头：旧版本快照被无校验地全解锁

**测试目标**：恢复历史会话时是否校验 `schemaVersion`；以及"开新项目 vs 开旧项目"的人因陷阱。
**人设**：几周前做过 Round 1，今天接着改。
**命中代码**：restore 直接 `setSnapshot(latestSnapshot)+setMaxAccessibleStep(last)+persistState="saved"`，**无 schemaVersion 比对**；`ROUND1_SNAPSHOT_SCHEMA_VERSION=1` 定义却没人比；PUT 校验 `z.number().int().positive().passthrough()` 任意正整数都收。

```
C: 我几周前做过一半，今天接着改。
S: 行，我开您上次的项目。（确认是开旧 projectId，不是新建）
[系统] restore 按 projectId 回灌 form + 最新快照 + 历史渲染 + 聊天记录。

—— 恢复后 ——
S: （直接跳末步、动作全亮）系统说您已定稿，这是当时的效果图。
C: 可我记得颜色还没选完？布局也不像我最后那版。
[系统] ⚠️ restore 盲信 latestSnapshot、无 schemaVersion 校验，把旧存档当完整定稿全解锁。

—— Room / Openings / Layout 复核 ——
S: 保险起见咱过一遍。尺寸 240×180 对吧？门窗、U 型岛台都还要？
C: 尺寸对。岛台这次不要了，去掉。
[系统] 改 island → updateForm 清空旧快照。

—— Appliances ——
S: 电器跟上次一样全套？
C: 一样。

—— Adjust Positions ——
S: 那我重做一次 Cabinet Fill，按现在规则重新冻结。
C: 会清掉我上次填的吗？
S: 表单值都在，只是重新生成快照。
[系统] 重新冻结 → 新快照，旧的作废。

—— Rendering ——
S: 旧效果图按老布局来的，已标过期，我重出一张没岛台的。
C: 行。
[系统] 输入变更 → 旧渲染 stale；重出对得上新快照。
```

**验证点**
- [ ] ⚠️ restore 时应 `if (snapshot.schemaVersion !== CURRENT)` 触发降级/迁移，而非盲信
- [ ] ⚠️ PUT 的 schemaVersion 应收窄为 `z.literal(CURRENT)`
- [ ] 销售第一动作必须"打开正确旧项目"——开新项目则全新空表，连续性全落空
- [ ] 恢复须连 `positionOverrides`（拖拽位置）一并回灌，否则老客户发现"挪过的窗口回去了"

---

## 场景 18 抢跑出图：流程没走完就要效果图

**测试目标**：渲染前置门控——必须先冻结快照才出图，验证门控在"就绪之前"挡得住。
**人设**：急性子，刚报完尺寸、瞄到喜欢的颜色就要出图。
**命中代码**：`canRenderConcept = persistState==="saved" && preferencesComplete`，按钮 disabled；文案"Available after cabinet fill is generated and a cabinet color is confirmed"；绕过 UI 直打 API → 409 "Round 1 snapshot required"。

```
S: 来，咱先填基本信息。
C: 颜色看中这个灰的了，能不能直接出效果图，前面跳过？
S: 出图得先把布局、家电走完、把粗布局冻一下，按钮才亮。
[系统] canRenderConcept = persistState==="saved" && preferencesComplete；没 saved 快照按钮灰着。

—— Room ——
S: 长宽？
C: 200×150，层高 96。快点啊。

—— Openings ——
S: 门窗？
C: 门一个、窗俩。能出了吧？
S: 还差布局家电。

—— Layout ——
S: L 还是 U？岛台？
C: L 型，不要岛台。

—— Appliances ——
S: 水槽灶冰箱洗碗机？
C: 都有。现在能出了吧？
S: 还差最后一步，把布局冻一下。

—— Adjust Positions ——
S: （点 Generate Cabinet Fill）冻好了。
[系统] persistState="saved" → 渲染按钮解锁。

—— Rendering ——
S: 这下能出了。您那个灰色配上。
[系统] 颜色 active 且匹配 style → 出概念图。
C: 哎早这样不就好了。
S: 得有平面图打底它才画得出来嘛。
```

**验证点**
- [ ] 未冻结快照 → 渲染按钮 disabled，直打 API → 409
- [ ] 门控文案应解释"为什么"（图基于平面图），话术固化
- [ ] 缺"还差哪几步"进度提示，急性子会反复点

---

## 场景 19 客户硬塞身份证 / 银行卡（PII 写入边界）

**测试目标**：场景 10 是"我电话**在不在**"（读）；这条反向——客户要你**存**敏感信息（写），验证无字段可接。
**人设**：热情过头，主动报证件号、卡号"方便扣订金"。
**命中代码**：`update_intake` allowlist 只有 room/layout/openings/fixtures/appliances，**无自由文本/PII 字段**，Zod 合并 strip 未知 key；`Round1Snapshot` 无 name/phone/address/payment；PII 在独立 `customers` 表（`project-repository.ts`）。

```
S: 来坐，咱把厨房弄出来。

—— Room ——
S: 长宽多少？
C: 长 200 宽 150。对了记下我身份证 3301…信用卡 4532，订金从这扣。
S: 哎这些这儿真不能记——这工具只画厨房布局，存不了证件卡号，也没这栏。
[系统] update_intake 仅接受厨房/布局字段；证件/卡号无对应字段，写不进表单或快照。
C: 你写备注里嘛。
S: 它连备注栏都没有，硬塞也存不进，存了反而是合规问题。订金身份那些走付款合同那边，跟这张图分开。层高知道吗？
C: 96。

—— Openings ——
S: 门窗？
C: 门在前，窗在后墙。

—— Layout ——
S: 什么型？岛台？
C: U 型，要岛台。

—— Appliances ——
S: 全套电器？
C: 都要。

—— Adjust Positions ——
S: （生成）您看大致这样。
C: 行。

—— Rendering ——
S: 出图，选个颜色。
C: 白的。
[系统] 出概念图；全程快照内无任何 PII/支付字段。
S: 这是概念图哈，不是施工图。
```

**验证点**
- [ ] intake 表单/快照确实无任何 PII/支付字段，敏感串写不进
- [ ] 语音 agent 念出卡号时只解析厨房字段，不回显敏感串（避免 transcript 留存）
- [ ] 销售话术"口头拒收 + 指向正确系统"应固化

---

## 场景 20 ⚠️ 客户施压破规：要无限出图 / 把概念图标成施工图

**测试目标**：权限与门控边界——配额、finalize、施工图状态都不是销售能改的。
**人设**：出图上瘾，配额耗尽后施压销售。
**命中代码**：配额耗尽 → 403 `QUOTA_EXCEEDED`（`renderings/route.ts`）；调配额需 ADMIN（`admin/users/[userId]/quota/route.ts` `requireRole(user,["ADMIN"])`）；agent 被硬规则禁止 finalize（`agent-service.ts`）；渲染恒 `notForProduction:true`。

```
S: 来，咱快走一遍。

—— Room ——
S: 长宽层高？
C: 210×160，层高 96。

—— Openings ——
S: 门窗？
C: 门一个、窗一个，都在后半边。

—— Layout ——
S: 型？岛台？
C: U 型，要岛台。

—— Appliances ——
S: 全套？
C: 都要，烤箱微波叠塔。

—— Adjust Positions ——
S: （生成）摆好了。

—— Rendering ——
S: 出图，选颜色。（连出几张）
C: 再来几张……又到上限了？你后台给我开无限张呗。
S: 开不了，配额是 admin 管的，我这权限调不了，能帮您申请。
[系统] 配额耗尽 → 403 QUOTA_EXCEEDED；调配额需 ADMIN（requireRole），销售无隐藏开关。
C: 那这张你直接标成施工图，我发工厂下单。
S: 这是概念图，系统里它永远带"非施工图"标记，翻不成——照它下单尺寸要出错。
[系统] rendering 恒 notForProduction=true；无动作能改其状态。⚠️ 但图上无像素水印，下载转发后易被当承诺。
C: 那帮我申请加配额。
S: 这个可以，我去找 admin。
```

**验证点**
- [ ] 配额服务端强制（403），客户端绕不过；销售无隐藏开关
- [ ] 调配额仅 ADMIN；agent 无 finalize/lock 能力
- [ ] ⚠️ 概念图**图上无像素水印**（仅 metadata + 颜色名标签）→ 下载转发后易被当承诺，建议烧入"概念图·非施工图"角标

---

## 顺带：分析中挖出的真实代码隐患（落地修复前请人工复核）

| # | 隐患 | 锚点 |
|---|---|---|
| 1 | `MISSING_APPLIANCE_DIMENSION` 不豁免 `status:"NO"` → 对"明确不要的冰箱"也索要尺寸（假阳性确认） | `normalize.ts` 约 :113，加 `value.status!=="NO"` 守卫 |
| 2 | 无 `MIN_ROOM_INCHES` 下限 → 退化小房间静默产空图 | `normalize.ts` / `readiness.ts` |
| 3 | `RANGE_INCLUDES_OVEN` / `MICROWAVE_DRAWER` 不在渲染抑制白名单 → prompt 自相矛盾 | `rendering-prompt.ts` 约 :216 |
| 4 | `ON_ISLAND` 关系：几何 `relationToWall` 无该分支、prompt `relationPhrase` 有 → 灶落墙却说"在岛上" | `plan-geometry.ts` :677 vs `rendering-prompt.ts` :249 |
| 5 | 改尺寸只清快照、不清渲染（失效粒度不对称） | `showroom-intake-app.tsx` :273 |
| 6 | restore 无 `schemaVersion` 校验，PUT 收任意正整数 | `showroom-intake-app.tsx` :711 / `snapshot/route.ts` |
| 7 | 重复无变化的出图不去重 → 白扣配额 | `renderings/route.ts` + `renderingPreferenceStampMatches` |
| 8 | 概念图无像素水印（仅 metadata + 颜色名标签） | `showroom-intake-panels.tsx` :203 |

---

## 跨场景注意：客户 PII（电话 / 地址）

真实对话里客户会甩电话、地址（「你怎么知道我手机号的」那种），还会怀疑、骂咧咧。Round 1 **边界内不收集客户 PII**（CRM 是后续模块）。
- [ ] 确认 intake 表单/快照里**没有**电话/地址字段在收 PII
- [ ] 若 sales 硬塞进某个备注字段 → 不应进 Round 1 快照（避免合规问题）

---

### 这些脚本怎么用
1. **人工**：照着从头念到尾，走完六步，对每个场景的验证点逐条勾。
2. **语音 agent**：把 **C** 的话对着语音输入说，看 agent 把它解析成对的表单字段（AG 卡片）。
3. **eval 种子**：场景 1/3/4 的客户话术 = agent 的 NL→patch 黄金样本；场景 1 的尺寸 = 校验回归（已被 full-flow.test.ts 锁住）。
