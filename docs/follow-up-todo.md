# Follow-up TODO（清理后待办）

Date: 2026-07-24  
Branch note: cleanup landed on `chore/code-cleanup-phase1` (`e082448`); layout-background + historical-doc cleanup on `chore/remove-layout-background`.

本文件是**唯一活跃 backlog**：清理遗留、可选重构、以及后续功能项。  
已删除的历史 tracker（仅在 git 历史可查）：根目录 `todo.md` / `plan.md`、`docs/round1-context-archive.md`、`docs/superpowers/plans/*`。

---

## A. 低风险代码清理

- [x] 删除零引用控件：`CheckboxField` / `StatusPill` / `parseNullableSize`（`src/features/round1/showroom-intake-controls.tsx`）
- [x] 本机清理 gitignore 残留（不进仓库）：`.data/round1-projects.json`、`scripts/cabinet-colors-eu.json`
- [x] 修正 `scripts/prepare-cabinet-colors.mjs`：PDF 路径改为必传参数

## B. 中风险清理（需单独切片 + 测试）

- [x] 移除未使用的 `generateLayoutBackground` 适配层（含死 `images.generate`）
  - 生产路径只用 `generateConceptRendering`
  - 验收：`npx tsc --noEmit` / `npm test` / `npm run build`
- [ ] （可选）依赖分类：把 `@types/*`、`typescript` 从 `dependencies` 挪到 `devDependencies`
  - 先确认 Railway `npm install` / `npm ci` 在 production build 下仍能通过 type-check
- [ ] （可选）补齐 ESLint 配置：`npm run lint` 当前无配置文件，会交互式询问
- [ ] （可选）脚本 SSL 去重：多份 `resolveSsl` 与 `src/server/db/client.ts` 重复——合并前确认各脚本 env 行为一致

## C. 文档 / 档案

- [x] 删除 `docs/round1-context-archive.md`（大历史 changelog；需要时查 git）
- [x] 删除 `docs/superpowers/plans/2026-07-13-object-storage-migration-plan.md` 及空目录
- [x] 删除根目录 `plan.md` / `todo.md`；活跃 backlog 收敛到本文件
- [x] 热上下文不再指向已删档案；旧 `ROUND1_DATA_FILE` / `round1-repository.ts` 文案仅存 git 历史

## D. 产品验收（用户侧）

验收状态（2026-07-24）：用户已自行完成浏览器 QA。

- [x] Round 2：galley / L 布局手动浏览器 QA（U 型已验）
- [x] 设计基准流浏览器 QA：确认页锁定 → Round 2 自动进量尺 → 重锁 → 归档横幅
- [x] 生产 / staging smoke：登录会话、项目 CRUD、Round 1 快照、渲染保真、Admin 色库、`/renderings`、Design basis → Technical Design

## E. 明确后续功能（不做“清理”，单独立项）

- [ ] M3：重锁按变更类型分级失效（只改颜色保留量尺）
- [ ] Round 2 量尺 / 方案 / intent **服务端持久化**（现为 localStorage + 内存态）
- [ ] 归档草稿查看入口
- [ ] island / peninsula 自动布柜（现为备注 + 决策项）
- [ ] 柜体标准表 DB 化 + 后台管理（现为 git 内 `CABINET_STANDARDS`）
- [ ] PDF 导出 / 打印样式
- [ ] Agent 增强：流式响应、会话持久化、字段级 “user confirmed” 防护
- [ ] `/admin/cabinet-colors` 若变慢：swatch 改为与 renderings 相同的按图路由流式加载

## F. 禁止当清理误删

以下区域不要在“整理”任务里顺手改行为：

- 鉴权 / 会话 / 密码 / 角色权限
- `schema.sql`、migrate / seed 脚本语义
- Design basis 锁定与 Round 1→2 handoff
- Rate limit、CSP、对象存储与图片字节路径
- Round 1 snapshot / readiness / production gate
- `docs/test-dialogues.md`（agent-eval / full-flow 仍引用）
- `perspective-cleanup.test.ts`（防回流护栏，保留）

---

## 建议顺序

1. ~~A / B(`generateLayoutBackground`) / C / D~~ — 已完成  
2. 可选 B 剩余项各开独立 PR  
3. **E** 功能项单独立项后再动  

验证命令（任何代码改动后）：

```bash
npx tsc --noEmit
npm test
npm run build
```
