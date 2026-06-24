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

## 跨场景注意：客户 PII（电话 / 地址）

真实对话里客户会甩电话、地址（「你怎么知道我手机号的」那种），还会怀疑、骂咧咧。Round 1 **边界内不收集客户 PII**（CRM 是后续模块）。
- [ ] 确认 intake 表单/快照里**没有**电话/地址字段在收 PII
- [ ] 若 sales 硬塞进某个备注字段 → 不应进 Round 1 快照（避免合规问题）

---

### 这些脚本怎么用
1. **人工**：照着从头念到尾，走完六步，对每个场景的验证点逐条勾。
2. **语音 agent**：把 **C** 的话对着语音输入说，看 agent 把它解析成对的表单字段（AG 卡片）。
3. **eval 种子**：场景 1/3/4 的客户话术 = agent 的 NL→patch 黄金样本；场景 1 的尺寸 = 校验回归（已被 full-flow.test.ts 锁住）。
