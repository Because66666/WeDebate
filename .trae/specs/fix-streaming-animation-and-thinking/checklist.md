# Checklist

## 滑动窗口动画速度修复
- [x] 动画推进速度改为动态：每次推进 `Math.max(1, Math.floor((total - revealed) / 3))`，interval 50ms
- [x] 进度达 80% 时切换为逐字符精细推进
- [x] 内容被替换时旧动画立即完成，新内容重置动画

## 消息类型扩展
- [x] `Message` 接口新增 `reasoningContent?: string`
- [x] `readStream` 能识别并收集 `delta.reasoning_content`
- [x] `streamChatCompletion` 回调新增 `onReasoningToken`
- [x] `chat-service.ts` 传递 `onReasoningToken` 回调
- [x] `conversation.ts` 的 `updateMessage` 支持 `reasoningContent` 字段更新

## 思考内容包装渲染
- [x] 思考框：Brain 图标 + "已思考"标题 + 展开/收起箭头
- [x] 标题栏样式：浅紫色背景，圆角
- [x] 思考内容区域：独立容器，浅紫色背景
- [x] 可折叠（默认展开）
- [x] 在正式回答之前渲染 ThinkingBlock
- [x] 内容区域下有分隔线
- [x] TypeScript 编译无错误
