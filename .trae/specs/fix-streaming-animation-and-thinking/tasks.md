# Tasks

- [x] Task 1: 修复 MarkdownRenderer 滑动窗口动画速度
  - [x] 将固定 1字符/30ms 改为动态速度：每次推进 `Math.max(1, Math.floor((content.length - revealedLength) / 3))`，interval 改为 50ms
  - [x] 当 `revealedLength / content.length >= 0.8` 时，切换为逐字符精细推进（保持动画美观）
  - [x] 当内容被完全替换（新 agent 开始）时，立即完成旧内容动画

- [x] Task 2: 扩展消息类型支持 reasoning_content
  - [x] 在 `src/types/index.ts` 的 `Message` 接口中新增 `reasoningContent?: string` 字段
  - [x] 修改 `src/services/openai.ts` 的 `readStream` 函数，识别 `delta.reasoning_content` 并收集
  - [x] 修改 `streamChatCompletion` 回调接口，增加 `onReasoningToken` 回调
  - [x] 修改 `src/services/chat-service.ts` 中调用 `streamChatCompletion` 的位置，传递 `onReasoningToken` 回调
  - [x] 修改 `src/stores/conversation.ts` 的 `updateMessage`，支持 `reasoningContent` 字段更新
  - [x] 修改 `src/components/InputBox.tsx` 的 `onAgentMessageToken` 回调，传递 reasoning 内容

- [x] Task 3: 实现思考内容包装渲染组件
  - [x] 创建 `ThinkingBlock` 组件（在 MessageItem.tsx 中）：
    - [x] 可折叠的思考框，标题栏带 Brain 图标 + "已思考" 文字 + ChevronDown/ChevronRight 箭头
    - [x] 标题栏样式：浅紫色背景 `#F3E8FF` / dark `#2E1065`，圆角边框
    - [x] 思考内容区域：独立容器，浅紫色背景 `#F8F4FF` / dark `#1E1B2E`，使用 MarkdownRenderer 渲染
    - [x] 默认展开状态
    - [x] 内容区域下方有分隔线
  - [x] 在 `MessageItem.tsx` 中，当消息有 `reasoningContent` 时，在正式回答之前渲染 `ThinkingBlock`
  - [x] 思考内容也应用滑动窗口动画（如果 reasoningContent 在流式输出中）

# Task Dependencies
- [Task 2] 无依赖
- [Task 1] 无依赖（可并行执行）
- [Task 3] 依赖 [Task 2]
