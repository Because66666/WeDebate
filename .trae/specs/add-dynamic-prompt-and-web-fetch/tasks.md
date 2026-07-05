# Tasks

- [x] Task 1: 将 base.ts 改为动态函数并接入 context-builder
  - [x] 将 `BASE_SYSTEM_PROMPT` 改为 `getBaseSystemPrompt(currentDate: string, agentsInfo: string): string`
  - [x] 函数返回包含日期和智能体信息的完整提示词
  - [x] 修改 `context-builder.ts`：调用 `getBaseSystemPrompt` 时传入当前日期和智能体列表信息
  - [x] 更新 `chat-service.ts` 中引用 `BASE_SYSTEM_PROMPT` 的地方

- [x] Task 2: 实现网页内容抓取后端功能
  - [x] 在 `server/search.ts` 中新增 `fetchWebPage(url: string)` 函数
  - [x] 函数逻辑：fetch URL → 解析 HTML → 提取主要内容 → 去除 HTML 标签 → 限制 8000 字符
  - [x] 在 server 路由中新增 `GET /api/fetch-page?url=...` 端点

- [x] Task 3: 实现前端 web_fetch 工具
  - [x] 创建 `src/services/tools/web-fetch.ts`：实现 `Tool` 接口
  - [x] 在 `src/services/tools/index.ts` 中注册 `web_fetch` 工具

- [x] Task 4: MarkdownRenderer 支持流程图/图表块
  - [x] 新增框线字符检测（Unicode `\u2500-\u257F\u2580-\u259F`）
  - [x] 框线图表使用等宽字体、独立浅色背景、外边框展示
  - [x] 不影响普通代码块和内联代码渲染

# Task Dependencies
- [Task 1] 无依赖
- [Task 2] 无依赖
- [Task 3] 依赖 [Task 2]
- [Task 4] 无依赖
