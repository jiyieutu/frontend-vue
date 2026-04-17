# 备份平台功能整合说明（前端）

本次已在现有 Vue 工程中新增一组可直接对接后端 `/api/platform/**` 的页面。

## 已新增页面
- `/platform/assets` 资产管理页
- `/platform/repositories` 仓库管理页
- `/platform/policies` 策略管理页
- `/platform/jobs` 任务中心页
- `/platform/backup` 备份页
- `/platform/restore` 恢复页
- `/platform/progress` 进度页
- `/platform/logs` 日志页
- `/platform/operations` 平台运营大屏
- `/platform/report-templates` 报表模板设计
- `/platform/dead-letters` Webhook 死信处理台

## 对接方式
- 普通接口通过 `src/api/platform.js` 调用
- 任务实时进度通过 SSE `streamJob(jobId)` 订阅
- 若本地存储中存在 `platform.tenantId`，请求会自动附加 `X-Tenant-Id`

## 说明
- 新页面已挂到主路由和侧边栏 Builtin 菜单中。
- 若你们其他工程只想复用运营层页面，可重点使用 `/platform/operations`、`/platform/report-templates`、`/platform/dead-letters`。
