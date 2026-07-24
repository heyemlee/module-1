# Follow-up TODO（清理后待办）

Date: 2026-07-24  
Branch note: cleanup landed on `chore/code-cleanup-phase1` (`e082448`)  
Related trackers:

- Round 2 功能改造明细 → 根目录 `todo.md`
- Round 1 历史细节 → `docs/round1-context-archive.md`
- 本文件只收「清理遗留 + 运维/验收/中风险重构」待办，避免和 `todo.md` 抢同一份清单

---

## A. 低风险代码清理（可选）

- [x] 删除零引用控件：`CheckboxField` / `StatusPill` / `parseNullableSize`（`src/features/round1/showroom-intake-controls.tsx`）
- [ ] 本机清理 gitignore 残留（不进仓库）：
  - [ ] `.data/round1-projects.json`（旧文件仓，约 2.7MB）
  - [ ] `scripts/cabinet-colors-eu.json`（可用 `npm run db:prepare-cabinet-colors` 再生）
- [ ] 修正 `scripts/prepare-cabinet-colors.mjs` 里写死的本机 PDF 绝对路径（改为必传参数或相对路径）

## B. 中风险清理（需单独切片 + 测试）

- [ ] 移除未使用的 `generateLayoutBackground` 适配层
  - 涉及：`openai-image-adapter.ts`、failover 包装、相关 `*.test.ts`、mock
  - 生产路径只用 `generateConceptRendering`
  - 验收：`npx tsc --noEmit` / `npm test` / `npm run build`
- [ ] （可选）依赖分类：把 `@types/*`、`typescript` 从 `dependencies` 挪到 `devDependencies`
  - 先确认 Railway `npm install` / `npm ci` 在 production build 下仍能通过 type-check
- [ ] （可选）补齐 ESLint 配置：`npm run lint` 当前无配置文件，会交互式询问
- [ ] （可选）脚本 SSL 去重：多份 `resolveSsl` 与 `src/server/db/client.ts` 重复——合并前确认各脚本 env 行为一致

## C. 文档 / 档案（人工确认后再动）

- [ ] 决定是否归档或删除 `docs/round1-context-archive.md`（大历史 changelog；代码不引用）
- [ ] 决定是否归档或删除 `docs/superpowers/plans/2026-07-13-object-storage-migration-plan.md`（历史计划）
- [ ] 决定根目录 `plan.md` / `todo.md` 是否继续作为活跃 tracker（`todo.md` 仍有未勾选 QA）
- [ ] 历史文案里仍提到已删除的 `ROUND1_DATA_FILE` / `round1-repository.ts`（档案可保留；不要再当现网真相）

## D. 产品验收（用户侧，需 seed 项目）

来自 `todo.md` 未勾选项，搬到这里做总览：

- [ ] Round 2：galley / L 布局手动浏览器 QA（U 型已验）
- [ ] 设计基准流浏览器 QA：确认页锁定 → Round 2 自动进量尺 → 重锁 → 归档横幅
- [ ] 生产 / staging smoke：
  - [ ] 登录 / 会话过期 / 登出
  - [ ] 新建 / 打开项目
  - [ ] Round 1 快照保存与重试
  - [ ] Rendering Preferences + 选色渲染保真（2–3 个色）
  - [ ] Admin Cabinet Colors 批量编辑
  - [ ] `/projects/[id]/renderings` 历史页
  - [ ] Design basis lock → Technical Design

## E. 明确后续功能（不做“清理”，单独立项）

来自 Round 2 暂缓 / M3，以及 `ai_ctx` 原 “Later Work”：

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

1. 先做 **D（验收）**，确认现网行为再继续删代码  
2. 有空再做 **A**（几分钟级）  
3. **B** 各开独立 PR  
4. **C / E** 人工拍板后再动  

验证命令（任何代码改动后）：

```bash
npx tsc --noEmit
npm test
npm run build
```
