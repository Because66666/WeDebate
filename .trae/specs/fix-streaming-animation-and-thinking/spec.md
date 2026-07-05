# 修复流式渲染性能与思考内容展示 Spec

## Why

当前项目存在两个影响用户体验的问题：1）文字滑块动画速度远低于大模型输出速度，导致多智能体轮替时出现内容跳变；2）大模型的思考过程和工具调用结果没有与正式回答正确区分，思考内容被正式回答替换，缺少视觉包装。

## What Changes

- **修复**: MarkdownRenderer 滑动窗口动画速度过慢，改为动态速度匹配（非固定 1 字符/30ms）
- **新增**: 识别并解析 LLM 的思考内容（reasoning/thinking），以独立的可折叠思考框展示
- **新增**: 思考框样式参考 DeepSeek 设计，包含标题（"已思考"）、旋转图标、思考文本区域
- **修改**: 当智能体消息内容被替换（新智能体开始）时，旧内容的动画立即完成

## Impact

- Affected specs: 原有的增强能力 spec
- Affected code:
  - `src/components/MarkdownRenderer.tsx` - 重写动画机制，支持思考内容包装
  - `src/services/openai.ts` - 新增 `reasoning_content` 字段的识别与提取
  - `src/types/index.ts` - 可能新增思考内容相关的消息字段
  - `src/services/chat-service.ts` - 传递 reasoning 回调
  - `src/stores/conversation.ts` - 存储消息时保存 reasoning 内容
  - `src/components/MessageItem.tsx` - 渲染思考内容包装

## ADDED Requirements

### Requirement: 动态速度滑动窗口动画

系统应动态调整文字揭示速度，使其匹配或接近大模型的输出速度。

#### Scenario: 流式输出时渲染
- **WHEN** 智能体消息正在流式输出
- **THEN** 滑动窗口的揭示速度应动态调整：每次 interval 推进的字符数 `= Math.max(1, Math.floor((content.length - revealedLength) / 3))`
- **AND** 最小间隔调整为 50ms，每次推进至少 1 个字符
- **AND** 当 `revealedLength` 追赶超过 `content.length` 的 80% 时，切换为逐字符精细推进
- **AND** 总进度 = `revealedLength / content.length`，保持动画视觉连续

#### Scenario: 智能体切换时动画处理
- **WHEN** 一个新的智能体开始输出（content 内容被完全替换）
- **THEN** 旧内容的动画立即完成（revealedLength = content.length）
- **AND** 新内容重置动画状态（revealedLength = 0），重新开始

### Requirement: 思考内容识别与独立展示

系统应能识别 LLM 返回的思考过程内容，并与正式回答分开渲染。

#### Scenario: 模型返回 reasoning_content
- **WHEN** LLM 在流式响应中返回 `delta.reasoning_content` 字段
- **THEN** 该内容被单独收集，与 `delta.content`（正式回答）分离
- **AND** 思考过程最后以可折叠的思考框形式展示在正式回答之前

#### Scenario: 思考框渲染
- **WHEN** 消息包含思考内容
- **THEN** 在正式回答内容上方，渲染一个独立的思考区域：
  - 标题栏：左侧为思考图标（Brain 或 Spline 图标）+ "已思考"文字，右侧为展开/收起箭头图标
  - 标题栏背景色浅紫色/浅灰色，圆角边框
  - 思考内容区域：独立容器，与正式 Markdown 内容分离
  - 默认展开状态，用户可点击标题栏收起/展开
- **AND** 样式参考 DeepSeek HTML 第 2943-3101 行，具体特征：
  - 浅紫色背景（`#F3E8FF` light / `#2E1065` dark）的标题栏
  - 思考内容区域使用 `#F8F4FF` light / `#1E1B2E` dark 背景
  - 思考图标使用 `Brain` 从 `lucide-react` 导入
  - 标题文字 "已思考"
  - 内容区域下边缘有分隔线

## MODIFIED Requirements

### Requirement: MarkdownRenderer 滑动动画（原有性能问题修复）

**原有方式**: 固定每 30ms 推进 1 字符（约 33 字符/秒），远低于 LLM 输出速度。

**修改后**:
- 每次 interval 推进的字符数 = `Math.max(1, Math.floor((totalLength - revealedLength) / 3))`
- Interval 周期调整为 50ms
- 当内容被完全替换（新 agent 开始）时，旧内容动画立即完成

### Requirement: 消息内容存储（新增思考字段）

**原有方式**: 消息只存储 `content` 字段。

**修改后**:
- 消息类型新增可选字段 `reasoningContent?: string` 存储思考内容
- 流式更新时同时更新 `content` 和 `reasoningContent`

## REMOVED Requirements

无
