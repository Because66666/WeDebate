# Tasks

- [x] Task 1: 项目初始化与基础架构搭建
  - [x] SubTask 1.1: 使用Vite创建React + TypeScript项目
  - [x] SubTask 1.2: 安装依赖（Tailwind CSS, Zustand, react-markdown, remark-gfm, lucide-react）
  - [x] SubTask 1.3: 配置Tailwind CSS，定义设计Token（白色主色、浅蓝辅色、字体、间距）
  - [x] SubTask 1.4: 创建项目目录结构（components / stores / services / types / utils / prompts）
  - [x] SubTask 1.5: 定义核心TypeScript类型（Agent, Message, Conversation, Tool等）

- [x] Task 2: 类型定义与服务层实现
  - [x] SubTask 2.1: 定义完整类型系统（`src/types/index.ts`）：Agent, AgentConfig, Message, Conversation, ApiConfig, Tool, ToolRegistry
  - [x] SubTask 2.2: 实现OpenAI API服务（`src/services/openai.ts`）：流式请求、SSE解析、错误处理
  - [x] SubTask 2.3: 实现智能体上下文构建器（`src/services/context-builder.ts`）：以user角色注入其他智能体输出和用户消息，格式为"角色名:内容"
  - [x] SubTask 2.4: 实现浏览器工具扩展接口（`src/services/tools/`）：Tool接口定义、ToolRegistry注册机制
  - [x] SubTask 2.5: 实现本地存储服务（`src/services/storage.ts`）：API配置、对话历史的读写
  - [x] SubTask 2.6: 实现智能体发言调度器（`src/services/turn-manager.ts`）：按次序发言、用户插队回退1位、3轮自动停止

- [x] Task 3: 提示词文件组织
  - [x] SubTask 3.1: 创建基础提示词文件（`src/prompts/base.ts`）：所有智能体共享的基础系统提示词
  - [x] SubTask 3.2: 创建智能体人物扮演提示词文件夹（`src/prompts/agents/`）：每个智能体一个独立文件，便于扩展

- [x] Task 4: 状态管理层实现
  - [x] SubTask 4.1: 实现对话Store（`src/stores/conversation.ts`）：对话列表、当前对话、消息管理
  - [x] SubTask 4.2: 实现智能体Store（`src/stores/agent.ts`）：智能体配置管理、启用/禁用
  - [x] SubTask 4.3: 实现设置Store（`src/stores/settings.ts`）：API配置、主题切换、侧边栏状态
  - [x] SubTask 4.4: 实现发言调度状态（`src/stores/turn.ts`）：当前发言智能体、轮次计数、用户插队状态

- [x] Task 5: 核心UI组件实现
  - [x] SubTask 5.1: 实现应用布局组件（`src/components/AppLayout.tsx`）：侧边栏 + 主区域 + 顶栏
  - [x] SubTask 5.2: 实现侧边栏组件（`src/components/Sidebar.tsx`）：对话历史列表、新建/删除、收拢/展开
  - [x] SubTask 5.3: 实现聊天区域组件（`src/components/ChatArea.tsx`）：消息列表、智能自动滚动（上滑时停止自动滚动）
  - [x] SubTask 5.4: 实现消息组件（`src/components/MessageItem.tsx`）：用户消息靠右、智能体消息靠左无气泡样式、智能体间分隔线、颜色标识
  - [x] SubTask 5.5: 实现输入框组件（`src/components/InputBox.tsx`）：文本输入、Enter发送、Shift+Enter换行、空输入禁用发送、智能体输出时允许用户输入并插队
  - [x] SubTask 5.6: 实现Markdown渲染组件（`src/components/MarkdownRenderer.tsx`）：react-markdown + remark-gfm，流式渲染时注意性能优化（节流渲染）

- [x] Task 6: 设置与智能体管理面板
  - [x] SubTask 6.1: 实现API设置面板（`src/components/SettingsPanel.tsx`）：API Key、端点、模型配置
  - [x] SubTask 6.2: 实现智能体管理面板（`src/components/AgentPanel.tsx`）：智能体列表、编辑、添加、删除、启用/禁用

- [x] Task 7: 核心交互流程串联
  - [x] SubTask 7.1: 实现发言调度流程：按次序流式请求 → 用户可中途输入插队 → 插队后发言次序回退1位 → 3轮后自动停止
  - [x] SubTask 7.2: 实现对话标题生成：首条消息后使用智能体回复摘要生成标题
  - [x] SubTask 7.3: 实现对话切换与持久化：切换对话时恢复消息，自动保存到localStorage
  - [x] SubTask 7.4: 实现暗色模式切换

- [x] Task 8: 样式打磨与响应式适配
  - [x] SubTask 8.1: 实现扁平设计风格的所有视觉细节（白色主色、浅蓝辅色、间距、过渡动画）
  - [x] SubTask 8.2: 实现响应式布局（375px / 768px / 1024px / 1440px）
  - [x] SubTask 8.3: 实现暗色模式完整适配
  - [x] SubTask 8.4: 无障碍支持（键盘导航、焦点状态、ARIA标签）

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 2, Task 3]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 4]
- [Task 7] depends on [Task 5, Task 6]
- [Task 8] depends on [Task 7]
