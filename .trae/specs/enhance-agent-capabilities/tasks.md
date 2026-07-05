# Tasks

- [x] Task 1: 安装 `@overclockedsenku/duckduckjs` 依赖并验证兼容性
  - [x] 在项目中安装 `@overclockedsenku/duckduckjs` 包
  - [x] 验证该包在 Vite + React 环境下的导入和基本使用是否正常（不兼容，改用纯 fetch 方案）
  - [x] 如不兼容，调研替代方案（使用 DuckDuckGo Instant Answer API + fetch）

- [x] Task 2: 实现 DuckDuckGo 搜索工具
  - [x] 在 `src/services/tools/` 下创建 `duckduckgo-search.ts`，实现 `Tool` 接口
  - [x] 实现搜索逻辑：接收查询参数 → 调用 DuckDuckGo 搜索 → 返回格式化结果
  - [x] 将搜索工具注册到 `ToolRegistry` 中
  - [x] 在 OpenAI 服务中集成搜索工具调用流程

- [x] Task 3: 改造 AgentPanel 人设提示词编辑为模态对话框
  - [x] 创建 `PersonaEditorModal` 组件（居中模态对话框 + 遮罩层）
  - [x] 替换 AgentCard 中的 collapsible 内联编辑区域为"编辑"按钮
  - [x] 点击"编辑"按钮弹出 PersonaEditorModal，预填当前人设内容
  - [x] 保存按钮更新人设提示词并关闭；取消按钮关闭不保存

- [x] Task 4: 实现 MarkdownRenderer 滑动窗口渐变动画
  - [x] 流式渲染时追踪最新追加的文本区间位置
  - [x] 实现 6 字符滑动窗口算法：新字符流入时窗口滑动，旧区域变稳定
  - [x] 实现 CSS 渐变：窗口内文字从左（不透明）到右（透明）渐变
  - [x] 非流式状态保持原有渲染方式，不影响 Markdown 功能

- [x] Task 5: 复刻 DeepSeek 风格输入框
  - [x] 分析参考 HTML 中 DeepSeek 输入框的样式特征（圆角、内边距、按钮位置等）
  - [x] 重新设计 InputBox 的布局：发送按钮置于输入框内部右侧
  - [x] 添加文件上传按钮（样式参考，功能暂不实现）
  - [x] 调整焦点/悬停状态的视觉反馈

- [x] Task 6: 实现系统默认智能体"书记官"
  - [x] 创建书记官提示词文件 `src/prompts/agents/scribe.ts`：提示词要求生成 50 字符以内的简短标题
  - [x] 创建书记官服务 `src/services/scribe-service.ts`：调用 OpenAI API，使用书记官提示词 + 用户首条消息 + 首个智能体回复，生成标题
  - [x] 在 `types/index.ts` 中定义书记官常量 ID（`SCRIBE_AGENT_ID = '__scribe__'`）
  - [x] 修改 `conversation.ts` store：首个智能体回复完成后调用书记官服务生成标题
  - [x] 修改 `AgentPanel.tsx`：过滤掉书记官 ID，使其不显示在列表中
  - [x] 确保书记官不参与智能体发言调度

# Task Dependencies
- [Task 1] 无依赖（可最先执行）
- [Task 2] 依赖 [Task 1]
- [Task 3] 无依赖（可并行执行）
- [Task 4] 无依赖（可并行执行）
- [Task 5] 无依赖（可并行执行）
- [Task 6] 无依赖（可并行执行）
