# Checklist

## 动态提示词
- [x] `base.ts` 导出 `getBaseSystemPrompt` 函数（非常量），接受 `currentDate` 和 `agentsInfo` 参数
- [x] `context-builder.ts` 调用 `getBaseSystemPrompt` 时传入当前日期和智能体信息
- [x] 智能体信息包含名称和角色描述摘要
- [x] TypeScript 编译无错误

## 网页内容抓取后端
- [x] `server/search.ts` 新增 `fetchWebPage(url)` 函数，可提取网页主要文本内容
- [x] `GET /api/fetch-page?url=...` 端点存在且返回 `{ url, content, error? }`
- [x] 内容限制 8000 字符以内
- [x] 服务端可正常运行

## 前端 web_fetch 工具
- [x] `src/services/tools/web-fetch.ts` 实现 `Tool` 接口
- [x] 工具注册到 ToolRegistry
- [x] 大模型可调用 web_fetch 工具获取网页内容

## 流程图/图表 Markdown 渲染
- [x] Markdown 中的框线字符块使用等宽字体、带外边框展示
- [x] 不影响普通 Markdown 渲染（代码块、表格等）
- [x] 暗色模式兼容
- [x] TypeScript 编译无错误
