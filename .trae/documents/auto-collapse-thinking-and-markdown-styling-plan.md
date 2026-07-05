# 思考块自动折叠与 Markdown 样式优化计划

## 摘要

用户反馈两个前端体验问题：
1. 模型思考内容结束后，思考块应自动折叠，避免占用过多垂直空间。
2. Markdown 渲染质量不佳：表格缺少明显的边框样式；各级标题与正文样式区分度不足。

本计划将修改 `MessageItem.tsx` 实现思考结束后的自动折叠，并优化 `MarkdownRenderer.tsx` 的表格与标题渲染样式。

## 当前状态分析

### 思考块实现

- 文件：`src/components/MessageItem.tsx`
- `ThinkingBlock` 组件通过 `useState(isStreaming ?? false)` 控制初始展开状态：
  - 流式思考时默认展开。
  - 思考结束后保持用户最后的折叠状态，不会自动折叠。
- `isStreaming` 属性由父组件传入，取值为 `message.isStreaming && message.reasoningComplete === false`。
  - 当 `reasoningComplete` 变为 `true` 或消息完成时，`isStreaming` 从 `true` 变为 `false`，这是触发自动折叠的明确时机。

### Markdown 渲染实现

- 文件：`src/components/MarkdownRenderer.tsx`
- 使用 `marked` + 自定义 `CustomRenderer` 生成 HTML，再经 `DOMPurify` 消毒后渲染。
- 当前表格渲染：
  - 已添加 `border: 0.5px solid var(--border)` 到单元格和表格外框。
  - 表头使用 `var(--background-secondary)` 背景。
  - 但边框颜色较浅（`var(--border)` 为 `#e5e5ea` 或 `#3a3a3c`），在浅色/深色主题下可能不够明显。
  - 缺少行分隔、单元格内边距统一、圆角溢出等细节。
- 当前标题渲染：
  - `h1` 22px、`h2` 18px、`h3` 16px、`h4-h6` 14px，均加粗。
  - 虽然尺寸有分级，但与正文 14-15px 差距不够大，且颜色与正文一致，视觉上区分度不足。

### 全局样式

- 文件：`src/index.css`
- 定义了 Apple 风格的设计令牌（`--foreground`、`--border`、`--background-secondary` 等）。
- 未定义 `.markdown-body` 的全局样式，渲染完全依赖 `MarkdownRenderer.tsx` 内的内联样式。

## 计划变更

### 步骤 1：实现思考块自动折叠

**文件**：`src/components/MessageItem.tsx`

**操作**：
1. 在 `ThinkingBlock` 组件中新增 `useEffect`，监听 `isStreaming` 属性的变化。
2. 当 `isStreaming` 从 `true` 变为 `false` 时，调用 `setExpanded(false)`，将思考内容折叠。
3. 保留用户手动点击标题展开/折叠的能力；仅在“流式中 → 非流式”的转换时自动折叠。
4. 保持“思考中默认展开”的初始行为不变。

**关键代码方向**：
```tsx
const prevStreamingRef = useRef(isStreaming);
useEffect(() => {
  if (prevStreamingRef.current && !isStreaming) {
    setExpanded(false);
  }
  prevStreamingRef.current = isStreaming;
}, [isStreaming]);
```

**预期结果**：思考结束后，思考块自动收起，标题显示“已思考”；用户仍可点击展开查看。

### 步骤 2：优化 Markdown 表格样式

**文件**：`src/components/MarkdownRenderer.tsx`

**操作**：
1. 在 `CustomRenderer.table` 中增强表格结构：
   - 表格外框使用 `1px solid var(--border)`，并确保 `border-collapse: collapse`。
   - 表头单元格和单元格均使用更明显的边框（可保留 `0.5px` 但配合更深的表头背景）。
   - 表头背景使用 `var(--background-secondary)` 并加粗。
   - 增加 tbody 行之间的分隔线，可使用 `:nth-child(even)` 斑马纹或仅底部边框。
   - 由于 DOMPurify 仅允许内联 `style`，`:nth-child` 伪类无法直接写在行内样式中；方案是每行/单元格显式设置 `border-bottom`。
2. 保持外层 `overflow-x-auto` 容器，确保表格在窄屏下可横向滚动。
3. 确保单元格 padding、文字对齐、表头与正文字号差异清晰。

**样式细节**：
- 表头：背景 `var(--background-secondary)`，字体 `font-semibold`，字号 12px，颜色 `var(--foreground)`。
- 单元格：字号 13px，padding `8px 12px`，边框 `0.5px solid var(--border)`。
- 行：每行底部加 `0.5px solid var(--border)`，最后一行可不加。
- 表格整体圆角使用外层 `div` + `overflow:hidden` + 表格本身无边框冲突实现。

**预期结果**：表格在浅色/深色主题下都有清晰的边框、表头和行分隔。

### 步骤 3：优化 Markdown 标题样式

**文件**：`src/components/MarkdownRenderer.tsx`

**操作**：
1. 在 `CustomRenderer.heading` 中增强标题视觉层级：
   - 显著拉大标题与正文字号差距：`h1` 26px、`h2` 22px、`h3` 18px、`h4` 16px、`h5/h6` 14px。
   - 增加 `h1`/`h2` 底部细线边框（`border-bottom: 1px solid var(--border)`），提高分隔感。
   - 增加标题上下 margin：`h1` 上下 20px/12px，`h2` 18px/10px，`h3` 16px/8px，`h4-h6` 14px/6px。
   - 所有标题使用 `color: var(--foreground)` 并加粗，保持与正文的颜色一致性但靠尺寸、字重和间距区分。
   - `h1`/`h2` 可额外设置 `letter-spacing: -0.03em` 增强紧凑感。

**预期结果**：各级标题在视觉上明显区别于正文，层级清晰。

### 步骤 4：构建与验证

**操作**：
1. 运行 `npm run build`，确保 TypeScript 无错误。
2. 运行 `npm run lint`，检查新增代码是否引入新的 lint 错误。
3. 运行 `npm run test`，确保现有测试通过。
4. （如环境允许）启动 `npm run dev`，发送一条包含表格和各级标题的消息，验证：
   - 思考结束后思考块自动折叠。
   - 表格边框、表头、行分隔清晰可见。
   - 各级标题与正文有明显区分。

## 假设与决策

- **假设 1**：用户接受“思考结束后自动折叠，但用户仍可手动展开”的交互，不会要求完全禁止手动展开。
- **假设 2**：当前主题变量 `--border`、`--background-secondary`、`--foreground` 在浅色/深色模式下都可用，表格和标题样式只需基于这些变量调整。
- **假设 3**：DOMPurify 的 `ALLOWED_ATTR` 已包含 `style`，因此可以继续使用内联样式实现表格和标题样式，无需引入外部 CSS 文件。
- **决策 1**：使用 `useEffect` + `useRef` 监听 `isStreaming` 变化实现自动折叠，而非受控组件，以最小化对父组件的改动。
- **决策 2**：标题样式通过字号、间距和底部边框区分，不使用额外颜色，以保持与现有 Apple 风格一致。
- **决策 3**：表格样式基于现有 `CustomRenderer.table` 增强，不切换为 `react-markdown` 或其他库，避免引入新的依赖风险。

## 验证步骤

1. `npm run build` 通过，无 TypeScript 错误。
2. `npm run lint` 无新增错误（允许预先存在的警告/错误）。
3. `npm run test` 通过。
4. 手动验证：
   - 触发一条智能体回复，观察思考块在思考结束后自动折叠。
   - 发送包含 Markdown 表格和 `#`、`##`、`###` 标题的内容，确认样式改善。
