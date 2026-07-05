# 工具调用渲染与思考/正文顺序控制实施计划

## 摘要

用户要求：
1. 工具调用应渲染在思考内容里，单独一行，左侧使用放大镜图标表示搜索工具调用。
2. 前端渲染顺序严格控制为：A 的思考 → A 的正文 → B 的思考 → B 的正文；当某个智能体的思考尚未渲染完成时，不应跳过该模块去渲染下一个模块。

当前代码已实现核心逻辑，但尚未经过构建验证和独立审计。本计划目标是：
- 通过 TypeScript 构建验证代码正确性；
- 启动子智能体对所做修改进行独立核查；
- 修复核查中发现的问题；
- 最终确认功能符合用户需求。

## 当前状态分析

### 已实现的修改

1. **类型定义** (`src/types/index.ts`)
   - 新增 `ToolCallInfo` 接口，包含 `id`、`name`、`args`、`result`、`status`。
   - `Message` 接口新增 `reasoningComplete?: boolean` 和 `toolCalls?: ToolCallInfo[]`。

2. **状态管理** (`src/stores/conversation.ts`)
   - 新增 `patchMessage` 方法，用于局部更新消息字段（如 `reasoningComplete`、`toolCalls`），避免在流式过程中覆盖内容。

3. **OpenAI 流式服务** (`src/services/openai.ts`)
   - `StreamCallbacks` 新增 `onReasoningComplete` 和带 `id` 的 `onToolCallStart` / `onToolCallResult`。
   - 在 `readStream` 中检测 `delta.reasoning_content` 切换到 `delta.content` 时触发 `onReasoningComplete`，标志思考阶段结束。

4. **聊天服务** (`src/services/chat-service.ts`)
   - `sendMessage` 将可选回调 `onAgentReasoningComplete`、`onAgentToolCallStart`、`onAgentToolCallResult` 放在参数列表末尾，解决 TypeScript 可选参数顺序错误。
   - 将流式回调映射到 UI 回调，传播工具调用和思考完成事件。

5. **输入/调度组件** (`src/components/InputBox.tsx`)
   - 新建智能体消息时初始化 `reasoningComplete: false`。
   - 处理 `onAgentReasoningComplete`、`onAgentToolCallStart`、`onAgentToolCallResult` 回调，调用 `patchMessage` 更新对应消息。
   - 使用 `requestAnimationFrame` 批量合并 token 更新。

6. **消息渲染组件** (`src/components/MessageItem.tsx`)
   - `ThinkingBlock` 在展开区域渲染工具调用列表，每行一个工具调用，左侧使用 `Search` 放大镜图标。
   - 根据 `message.reasoningComplete !== false` 控制正文区域显示，确保思考完成前不渲染正文。

### 仍存在的风险

- 尚未运行 `npm run build`，可能存在未发现的 TypeScript 或 lint 错误。
- 不同模型对 `reasoning_content` 和 `content` 的切分行为不一致，`reasoningComplete` 的触发时机需要真实场景验证。
- 当某个智能体没有思考内容（直接输出正文）时，`reasoningComplete` 初始为 `false`，可能导致正文永远不显示，需要兜底处理。
- 工具调用状态更新（`pending` → `success`）和重新渲染的流畅性需要验证。

## 计划变更

### 步骤 1：运行构建并修复编译错误

**文件**：无新增文件，主要验证现有文件。
**操作**：
1. 在 `d:\python\model_debatement_room` 目录运行 `npm run build`。
2. 如果存在 TypeScript 错误，根据错误信息修复相关文件。
3. 运行 `npm run lint`，修复 lint 警告/错误（如果影响构建或明显违反项目规范）。

**预期结果**：`npm run build` 通过，无 TypeScript 错误。

### 步骤 2：启动子智能体进行独立代码审计

**触发原因**：根据工作区规则 `AGENTS.md`，完成需求后必须启动子智能体对所做工作进行独立核查和审计。

**操作**：
1. 启动 `TRAE-code-review` 或通用审计智能体，审查范围包括：
   - `src/types/index.ts`
   - `src/stores/conversation.ts`
   - `src/services/openai.ts`
   - `src/services/chat-service.ts`
   - `src/components/InputBox.tsx`
   - `src/components/MessageItem.tsx`
2. 审计重点：
   - 工具调用是否只在思考内容中渲染，未泄露到正文。
   - `reasoningComplete` 控制逻辑是否正确，特别是无思考内容模型的兜底。
   - 渲染顺序是否为 A 思考 → A 正文 → B 思考 → B 正文。
   - 类型安全和回调传递是否一致。
   - 是否存在性能问题（如过度重渲染、状态更新频率过高）。

**预期结果**：子智能体输出审计报告，列出发现的问题（如果有）。

### 步骤 3：修复审计中发现的问题

**操作**：
1. 根据审计报告，逐条评估并修复问题。
2. 常见问题及对应处理：
   - **无思考内容模型兜底**：在 `InputBox.tsx` 的 `onAgentMessageToken` 中，若消息没有 `reasoningContent` 且 `reasoningComplete === false`，自动设置为 `true`（当前代码已有类似逻辑，但需确认覆盖所有路径）。
   - **工具调用图标/文案**：确认 `Search` 图标和文案符合需求；如果不是搜索工具，考虑使用更通用的工具图标。
   - **渲染顺序**：确认 `MessageItem` 按消息数组顺序渲染，并且每个消息内部先渲染 `ThinkingBlock` 再渲染正文。
   - **状态更新性能**：确认 `patchMessage` 不会导致每 token 都触发保存。
3. 每修复一项，重新运行 `npm run build`。

**预期结果**：所有审计问题得到解决或明确记录为可接受。

### 步骤 4：功能验证与最终构建

**操作**：
1. 运行 `npm run build` 和 `npm run test`（如果有相关测试）。
2. 如果可能，启动开发服务器 `npm run dev`，手动验证：
   - 工具调用时思考内容区域出现放大镜图标和单独一行状态。
   - 思考未完成时正文区域不显示。
   - 多智能体场景下，每个智能体按顺序先显示思考再显示正文。

**预期结果**：构建通过，功能表现符合用户需求。

## 假设与决策

- **假设 1**：项目使用 `npm` 作为包管理器，`npm run build` 可正确执行 `tsc -b && vite build`。
- **假设 2**：`reasoning_content` 和 `content` 不会在同一 SSE 数据包中同时出现。如果同时出现，`reasoningComplete` 可能会提前触发；此情况可在后续迭代中通过更复杂的 delta 处理解决。
- **假设 3**：用户接受的工具调用图标是 `lucide-react` 的 `Search`，即使工具不一定是搜索工具。若审计建议更通用图标，将改用 `Wrench` 或根据工具名称动态选择。
- **决策 1**：`reasoningComplete` 默认 `false`，并在检测到正文 token 或收到 `onReasoningComplete` 时设为 `true`。对于没有思考内容的模型，在收到第一个正文 token 时自动设为 `true`。
- **决策 2**：工具调用渲染在 `ThinkingBlock` 内部、思考内容之前，便于用户理解“思考过程中调用了工具”。
- **决策 3**：子智能体审计使用 `TRAE-code-review` 技能，以确保审查结构化且覆盖关键文件。

## 验证步骤

1. `npm run build` 通过，无 TypeScript 错误。
2. `npm run lint` 无严重错误（警告可接受，但需记录）。
3. 子智能体审计报告已产出，提出的问题已处理。
4. （如环境允许）通过 `npm run dev` 手动验证多智能体流式渲染顺序和工具调用图标。
5. 最终向用户汇报：修改了哪些文件、解决了什么问题、是否还有已知限制。
