# 智能体能力增强与UI优化 Spec

## Why

项目当前已具备多智能体辩论、Markdown渲染和基础聊天功能。为进一步提升智能体的实用性（联网搜索能力）和交互体验（提示词编辑优化、流式渲染动画、输入框样式），需要对现有功能进行增强和完善。

## What Changes

- **新增**: 为智能体添加 DuckDuckGo 网页搜索工具，通过 `@overclockedsenku/duckduckjs` 包实现
- **新增**: 系统默认智能体角色"书记官"（Scribe），固定存在、不显示在 AgentPanel 中，负责为每次新对话生成标题
- **修改**: AgentPanel 中智能体人设提示词编辑改为屏幕居中的模态对话框，带保存/取消按钮
- **修改**: MarkdownRenderer 流式渲染时实现 6 字滑动窗口 + 渐变动画效果
- **修改**: InputBox 文本输入框样式参考 DeepSeek 聊天输入框风格进行复刻

## Impact

- Affected specs: 构建的聊天室功能
- Affected code:
  - `src/services/tools/` - 新增搜索工具实现
  - `src/services/scribe-service.ts` - **新增** 书记官服务，负责调用 API 生成标题
  - `src/prompts/agents/scribe.ts` - **新增** 书记官提示词文件
  - `src/types/index.ts` - 可能新增搜索相关类型；可能新增书记官常量
  - `src/stores/conversation.ts` - 标题生成逻辑改为调用书记官服务
  - `src/components/AgentPanel.tsx` - 人设编辑改为模态对话框；书记官不显示在列表中
  - `src/components/MarkdownRenderer.tsx` - 新增滑动窗口渐变动画
  - `src/components/InputBox.tsx` - 输入框样式复刻
  - `package.json` - 新增依赖 `@overclockedsenku/duckduckjs`

## ADDED Requirements

### Requirement: DuckDuckGo 搜索工具

系统应为智能体提供 DuckDuckGo 网页搜索能力。

#### Scenario: 智能体发起搜索
- **WHEN** 智能体被配置了搜索工具且用户在对话中触发搜索需求
- **THEN** 系统通过 `@overclockedsenku/duckduckjs` 执行网页搜索，返回结构化搜索结果
- **AND** 搜索结果以 Markdown 格式注入到智能体的上下文消息中

#### Scenario: 搜索工具注册
- **WHEN** 系统启动或配置变更
- **THEN** 搜索工具自动注册到 `ToolRegistry` 中
- **AND** 搜索工具的 `name`、`description`、`parameters` 符合 `Tool` 接口规范

### Requirement: 人设提示词编辑模态对话框

系统应提供单独的模态对话框用于编辑智能体人设提示词。

#### Scenario: 编辑人设提示词
- **WHEN** 用户在 AgentPanel 中点击"编辑人设"按钮
- **THEN** 屏幕中央弹出模态对话框，包含一个大型可编辑文本框
- **AND** 文本框预填当前人设提示词内容
- **AND** 对话框底部有"保存"和"取消"两个按钮
- **WHEN** 用户点击"保存" - 更新提示词并关闭对话框
- **WHEN** 用户点击"取消" 或 点击遮罩层 - 关闭对话框，不保存更改

### Requirement: 流式渲染滑动窗口渐变动画

Markdown 实时渲染时，新输出的文字应以 6 字为滑动窗口呈现渐变效果。

#### Scenario: 流式输出时渲染
- **WHEN** 智能体消息正在流式输出
- **THEN** 最新输出的文字以 6 个字符为单位的滑动窗口显示
- **AND** 窗口内的文字从左到右呈现从深色到透明的渐变（左端完全不透明，右端完全透明）
- **AND** 随着新字符流入，窗口持续向右滑动，旧的窗口区域变为完全不透明的稳定状态
- **AND** 保持所有 Markdown 渲染功能正常（标题、加粗、表格、代码块等）

### Requirement: 系统默认智能体"书记官"

系统应提供一个固定存在的系统默认智能体"书记官"，负责为新对话生成标题。

#### Scenario: 新对话创建时自动生成标题
- **WHEN** 用户发送第一条消息创建新对话
- **THEN** 系统自动调用"书记官"智能体，使用当前对话的第一条用户消息和首个智能体回复作为上下文
- **AND** 书记官通过 OpenAI API 生成一个简短（50 字符以内）的对话标题
- **AND** 标题显示在左侧边栏的对话历史列表中

#### Scenario: 书记官不显示在前端管理界面
- **WHEN** 用户打开 AgentPanel（智能体管理面板）
- **THEN** 书记官不出现在智能体列表中
- **AND** 用户无法通过 AgentPanel 删除、禁用或编辑书记官

#### Scenario: 书记官配置与普通智能体隔离
- **WHEN** 系统初始化
- **THEN** 书记官的提示词存储在 `src/prompts/agents/scribe.ts` 中
- **AND** 书记官的 ID 使用固定常量（如 `'__scribe__'`），不参与用户智能体的调度轮次
- **AND** 书记官不被包含在 `agentStore.agents` 列表中

### Requirement: DeepSeek 风格输入框

输入框组件应复刻 DeepSeek 聊天输入框的视觉风格。

#### Scenario: 输入框渲染
- **WHEN** 输入框在页面底部渲染
- **THEN** 样式参考目标 HTML 文件中 DeepSeek 输入框的设计：
  - 圆角胶囊/圆润风格
  - 适当的 padding 和内边距
  - 焦点状态有清晰的视觉反馈
  - 发送按钮位于输入框内部右侧
  - 支持文件上传按钮（样式参考）

## MODIFIED Requirements

### Requirement: AgentPanel 人设编辑（原有内联编辑改为模态框）

**原有方式**: 在 AgentCard 中以 collapsible 区域内联编辑人设提示词。

**修改后**:
- AgentCard 中的展开/收起按钮改为"编辑"按钮，点击后弹出模态对话框
- 移除 collapsible 内联编辑区域
- 模态框居中显示，带遮罩层
- 模态框内提供大文本编辑区域 + 保存/取消按钮

### Requirement: MarkdownRenderer 流式渲染优化（新增滑动窗口动画）

**原有方式**: 流式渲染时使用 debounce 100ms 刷新，无动画效果。

**修改后**:
- 流式渲染时识别最新追加的文本区间
- 对最新区间的文本应用 6 字滑动窗口 + 从左到右的渐变效果
- 非流式渲染（稳定状态）保持原有渲染方式不变
- `isStreaming` 属性控制是否启用动画

### Requirement: 对话标题生成（原有内联摘要改为书记官调用）

**原有方式**: 在 `handleSend` 回调中，直接截取首个智能体回复的前 50 字符作为标题。

**修改后**:
- 标题生成逻辑移至独立的书记官服务（`src/services/scribe-service.ts`）
- 书记官通过 OpenAI API 生成标题（调用时使用书记官自己的提示词和系统角色）
- 标题生成在首个智能体回复完成后自动触发
- 标题仍保持在 50 字符以内

## REMOVED Requirements

无
