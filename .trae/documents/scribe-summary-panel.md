# 书记官总结面板 + 标题生成器修复 实施计划

## 概述

新增一个"书记官"智能体，在每位顾问发言完毕后对其发言正文进行分点归纳总结（不超过5点），并在屏幕右侧边框以动画方式弹出面板展示总结记录。同时修复标题生成器不正常工作的问题。

## 当前状态分析

### 已有的书记官基础设施

* `src/types/index.ts:1` 定义了 `SCRIBE_AGENT_ID = '__scribe__'`

* `src/prompts/agents/scribe.ts` 仅包含标题生成提示词 `SCRIBE_PROMPT`

* `src/services/scribe-service.ts` 仅包含 `generateTitle` 方法（非流式调用）

* `SCRIBE_AGENT_ID` 在以下位置被排除：

  * `src/services/turn-manager.ts:12` — 不参与发言轮转

  * `src/stores/agent.ts:57` — 不在启用列表中

  * `src/components/AgentPanel.tsx:288` — 不在管理面板中显示

### 发言调度流程（chat-service.ts）

* `sendMessage` 使用 while 循环串行 await 每个 agent 的 `streamChatCompletion`

* agent 完成后，将 `agentMessage` 追加到 `existingMessages`（仅 `content`，不含 reasoning/toolCalls）

* 然后调用 `turnManager.advance()` 进入下一位

* **关键钩子点**：`chat-service.ts:195-203`（agent 消息追加后、advance 前）是触发书记官并行总结的理想位置

### UI 面板模式

* `SettingsPanel.tsx` / `AgentPanel.tsx`：overlay 模式（fixed + 遮罩层 + `if (!open) return null`）

* `Sidebar.tsx`：侧边栏模式（`fixed inset-y-0 left-0 z-40` + `translate-x` transform 动画）

* CSS 变量定义在 `src/index.css`（Apple 设计令牌，包含 `--shadow-xl`、`--card`、`--border` 等）

* 全局 `prefers-reduced-motion` 会将动画时长压缩为 0.01ms

### 标题生成器现状（需修复）

* **调用链**：`InputBox.tsx:241-243` → `convStore.generateAndSetText` → `scribe-service.ts:generateTitle`（非流式 fetch）

* **问题 1**：`firstAgentResponse` 在 `onAgentMessageComplete` 回调中赋值（InputBox.tsx:188-190），但 `generateAndSetTitle` 是 fire-and-forget（未 await），错误被 catch 吞没（conversation.ts:167-169 仅 console.error）

* **问题 2**：`chat-service.ts:56` 内部的 `firstAgentContent` 是死代码，赋值后从未被使用/返回

* **问题 3**：若第一个 agent 的 `fullContent` 为空（如仅有 reasoning 无正文），`firstAgentResponse` 不会被赋值，标题永不生成

* **问题 4**：无任何用户可见的错误反馈，用户无法得知标题生成失败

## 提议变更

### 1. 新增书记官总结提示词

**文件**：`src/prompts/agents/scribe.ts`（编辑现有文件）

在现有 `SCRIBE_PROMPT` 基础上新增 `SCRIBE_SUMMARY_PROMPT`：

```
你是讨论室中的书记官。你的任务是对顾问的发言内容进行归纳总结。

要求：
- 只采用分点的方式简要概括（1. 2. 3. xxx）
- 最多5个要点
- 不包含任何标题、分割线、加粗等结构化格式
- 不要有前言、后语等额外内容
- 直接输出摘要分点，每点一行
- 每点控制在30字以内
- 使用中文
```

### 2. 新增书记官总结服务

**文件**：`src/services/scribe-service.ts`（编辑现有文件）

新增 `summarizeAgentSpeech` 方法（参考现有 `generateTitle` 的非流式调用模式）：

```typescript
export async function summarizeAgentSpeech(
  apiConfig: ApiConfig,
  agentName: string,
  agentContent: string,
): Promise<string> {
  // 复用 generateTitle 的 fetch 模式
  // system: SCRIBE_SUMMARY_PROMPT
  // user: `顾问「${agentName}」的发言：\n\n${agentContent}`
  // stream: false
  // 返回 content.trim()
}
```

### 3. 新增书记官状态管理 store
**文件**：`src/stores/scribe.ts`（新建文件）

```typescript
interface ScribeSummary {
  id: string;
  conversationId: string;            // 绑定会话 ID
  agentId: string;
  agentName: string;
  agentColor: string;
  summary: string;
  timestamp: number;
}

interface ScribeState {
  currentConversationId: string | null;   // 当前会话 ID
  summariesByConversation: Record<string, ScribeSummary[]>;  // 按会话 ID 分组的总结记录
  panelOpen: boolean;                      // 面板是否打开
  isSummarizing: boolean;                  // 是否正在总结
  hasShownOnce: boolean;                   // 当前会话是否已首次弹出过

  // Actions
  setCurrentConversation: (id: string | null) => void;  // 切换会话时调用
  addSummary: (summary: ScribeSummary) => void;
  setSummarizing: (v: boolean) => void;
  openPanel: () => void;
  closePanel: () => void;
  // 内部：读写 localStorage
  loadSummaries: (conversationId: string) => void;
  persistSummaries: (conversationId: string) => void;
}

// 当前会话的 summaries 派生选择器
export function selectCurrentSummaries(state: ScribeState): ScribeSummary[] {
  if (!state.currentConversationId) return [];
  return state.summariesByConversation[state.currentConversationId] ?? [];
}
```

**持久化策略**：
* `summariesByConversation` 按会话 ID 分组存储总结记录
* 每次添加总结后，立即调用 `persistSummaries(conversationId)` 将该会话的总结列表写入 localStorage
* 切换对话时调用 `setCurrentConversation` + `loadSummaries` 加载该会话的总结记录
* `panelOpen`、`hasShownOnce` 不持久化（每次刷新重置）

**localStorage 结构**：
```typescript
// key: 'debate-room-scribe-summaries-{conversationId}'
// value: ScribeSummary[]
```

### 3.1 新增 storage 层支持书记官总结持久化
**文件**：`src/services/storage.ts`（编辑现有文件）

在 `STORAGE_KEYS` 中新增：
```typescript
SCRIBE_SUMMARIES: (conversationId: string) => `debate-room-scribe-summaries-${conversationId}`,
```

在 `storageService` 中新增方法：
```typescript
// Scribe Summaries (per conversation)
getScribeSummaries: (conversationId: string): ScribeSummary[] => {
  try {
    const raw = localStorage.getItem(`debate-room-scribe-summaries-${conversationId}`);
    return raw ? (JSON.parse(raw) as ScribeSummary[]) : [];
  } catch {
    return [];
  }
},
setScribeSummaries: (conversationId: string, summaries: ScribeSummary[]): void => {
  try {
    localStorage.setItem(
      `debate-room-scribe-summaries-${conversationId}`,
      JSON.stringify(summaries)
    );
  } catch {
    // silently fail
  }
},
deleteScribeSummaries: (conversationId: string): void => {
  try {
    localStorage.removeItem(`debate-room-scribe-summaries-${conversationId}`);
  } catch {
    // silently fail
  }
},
```

需要 import `ScribeSummary` 类型（从 `../stores/scribe` 或 `../types`，建议将 `ScribeSummary` 类型定义放在 `src/types/index.ts` 中避免循环依赖）。

**文件**：`src/types/index.ts`（编辑现有文件）
新增 `ScribeSummary` 接口定义（供 storage 和 store 共享）。

### 4. 修改 ChatService 触发书记官

**文件**：`src/services/chat-service.ts`（编辑现有文件）

在 `sendMessage` 的回调签名中新增可选回调：

```typescript
onAgentSpeechComplete?: (agentId: string, agentName: string, content: string) => void;
```

在 `chat-service.ts:195-203`（agent 消息追加后、`advance()` 前）调用此回调：

```typescript
existingMessages = [...existingMessages, agentMessage];

// 触发书记官总结（非阻塞，由调用方决定如何处理）
onAgentSpeechComplete?.(agent.id, agent.name, fullContent);

turnManager.advance();
```

**同时修复标题生成器问题**：将 `sendMessage` 的返回类型从 `Promise<void>` 改为 `Promise<string | null>`，返回 `firstAgentContent`。删除内部的死代码注释，让 `firstAgentContent` 真正被返回。

### 5. 修改 InputBox 集成书记官 + 修复标题生成

**文件**：`src/components/InputBox.tsx`（编辑现有文件）

#### 5.1 集成书记官回调
在 `chatService.sendMessage` 调用中传入新的 `onAgentSpeechComplete` 回调：
```typescript
// onAgentSpeechComplete（新增）
(agentId, agentName, content) => {
  if (!content) return;
  const scribeStore = useScribeStore.getState();
  const conversationId = convStore.currentConversationId;
  if (!conversationId) return;
  scribeStore.setSummarizing(true);
  
  // 非阻塞启动书记官总结，与下一位顾问并行
  summarizeAgentSpeech(apiConfig, agentName, content)
    .then((summary) => {
      const agent = agentStore.agents.find(a => a.id === agentId);
      scribeStore.addSummary({
        id: crypto.randomUUID(),
        conversationId,            // 绑定当前会话 ID
        agentId,
        agentName,
        agentColor: agent?.color ?? '#888',
        summary,
        timestamp: Date.now(),
      });
      scribeStore.setSummarizing(false);
      // 首次总结完成时弹出面板
      if (!scribeStore.hasShownOnce) {
        scribeStore.openPanel();
      }
    })
    .catch((err) => {
      console.error('[Scribe] 总结失败:', err);
      scribeStore.setSummarizing(false);
    });
}
```

**注意**：`convStore.currentConversationId` 在此处可能为旧快照值。应改为从最新的 store 获取：`useConversationStore.getState().currentConversationId`。

#### 5.2 修复标题生成器

将 `firstAgentResponse` 的获取方式从回调改为返回值：

```typescript
// 修改前：通过回调赋值（fire-and-forget）
let firstAgentResponse: string | null = null;
// onAgentMessageComplete 中赋值...
await chatService.sendMessage(...);
if (firstAgentResponse) { convStore.generateAndSetTitle(...); }

// 修改后：使用返回值
const firstAgentContent = await chatService.sendMessage(...);
if (firstAgentContent) {
  // await 确保错误被捕获和记录
  await convStore.generateAndSetText(apiConfig, text, firstAgentContent);
}
```

同时删除 `InputBox.tsx:188-190` 中的 `firstAgentResponse` 回调赋值逻辑。

### 6. 修复 generateAndSetTitle 错误处理

**文件**：`src/stores/conversation.ts`（编辑现有文件）

在 `generateAndSetTitle` 中增加更详细的日志，便于诊断：

```typescript
generateAndSetTitle: async (apiConfig, userMessage, agentResponse) => {
  const { currentConversationId } = get();
  if (!currentConversationId) {
    console.warn('[TitleGen] 无当前对话，跳过标题生成');
    return;
  }
  const conv = get().conversations.find((c) => c.id === currentConversationId);
  if (!conv) {
    console.warn('[TitleGen] 未找到对话');
    return;
  }
  if (conv.title !== '新对话') {
    console.log('[TitleGen] 标题已存在，跳过:', conv.title);
    return;
  }
  try {
    console.log('[TitleGen] 开始生成标题...');
    const title = await generateTitle(apiConfig, userMessage, agentResponse);
    if (title) {
      get().updateConversationTitle(currentConversationId, title);
      console.log('[TitleGen] 标题已更新:', title);
    } else {
      console.warn('[TitleGen] 生成的标题为空');
    }
  } catch (err) {
    console.error('[TitleGen] 标题生成失败:', err);
  }
},
```

### 7. 新增 ScribePanel 组件

**文件**：`src/components/ScribePanel.tsx`（新建文件）

参考 `Sidebar.tsx` 的侧边栏模式（fixed + translate-x transform 动画），实现右侧面板：

* 位置：`fixed inset-y-0 right-0 z-40`

* 宽度：`w-80`（320px）

* 动画：`transition-transform duration-300 ease-in-out`

* 隐藏时：`translate-x-full`

* 显示时：`translate-x-0`

* 样式：复用 CSS 变量（`--card`、`--border`、`--shadow-xl`）

面板内容结构：

```
┌─────────────────────────────────┐
│ 📋 书记官记录          [X]      │  Header（h-12）
├─────────────────────────────────┤
│                                 │
│  ● 事实核查员                    │  总结条目
│  1. xxx                         │  （agent 颜色圆点 + 名称）
│  2. xxx                         │
│  3. xxx                         │
│                                 │
│  ● 逻辑专家                      │
│  1. xxx                         │
│  2. xxx                         │
│                                 │
│  [正在总结...] (若 isSummarizing)│
│                                 │
├─────────────────────────────────┤
│                                 │  Footer（可选）
└─────────────────────────────────┘
```

总结条目使用 `MarkdownRenderer` 渲染 summary 内容（支持有序列表格式）。

### 8. 修改 AppLayout 挂载 ScribePanel

**文件**：`src/components/AppLayout.tsx`（编辑现有文件）

在 `SettingsPanel` 和 `AgentPanel` 之后挂载 `ScribePanel`：

```tsx
{/* Overlay panels */}
<SettingsPanel />
<AgentPanel />
<ScribePanel />  {/* 新增 */}
```

### 9. 切换对话时加载对应会话的书记官记录
**文件**：`src/stores/conversation.ts`（编辑现有文件）

在 `switchConversation` 中调用 `useScribeStore.getState().setCurrentConversation(id)`，由 scribe store 内部负责加载该会话的总结记录：
```typescript
switchConversation: (id: string) => {
  set({ currentConversationId: id });
  storageService.setCurrentConversationId(id);
  // 切换 scribe store 到新会话，加载该会话的总结记录
  useScribeStore.getState().setCurrentConversation(id);
},
```

**scribe store 的 `setCurrentConversation` 实现**：
```typescript
setCurrentConversation: (id: string | null) => {
  set({ currentConversationId: id, hasShownOnce: false, panelOpen: false });
  if (id) {
    // 从 localStorage 加载该会话的总结记录
    get().loadSummaries(id);
  }
},

loadSummaries: (conversationId: string) => {
  const summaries = storageService.getScribeSummaries(conversationId);
  set((state) => ({
    summariesByConversation: {
      ...state.summariesByConversation,
      [conversationId]: summaries,
    },
  }));
},
```

同时在 `deleteConversation` 中清理对应的 scribe summaries：
```typescript
deleteConversation: (id: string) => {
  // 删除该会话的书记官记录
  storageService.deleteScribeSummaries(id);
  set((state) => {
    const conversations = state.conversations.filter((c) => c.id !== id);
    const currentConversationId =
      state.currentConversationId === id
        ? conversations[0]?.id ?? null
        : state.currentConversationId;
    return { conversations, currentConversationId };
  });
  get().saveConversations();
  storageService.setCurrentConversationId(get().currentConversationId);
  // 切换 scribe store
  useScribeStore.getState().setCurrentConversation(get().currentConversationId);
},
```

注意：为避免循环依赖，`conversation.ts` 中直接使用 `useScribeStore.getState()`（zustand store 可跨模块引用，无循环依赖问题）。

## 假设与决策

1. **书记官总结使用同一 apiConfig**：复用用户在设置中配置的 API，不单独配置
2. **书记官总结不进入 agent 上下文**：总结记录存储在独立的 scribe store 中，不追加到 `existingMessages`，避免影响后续 agent 的上下文和形成循环依赖
3. **总结记录持久化到 localStorage 并绑定会话 ID**：每个会话的总结记录独立存储在 `debate-room-scribe-summaries-{conversationId}` 键中，切换对话时加载对应会话的记录，删除对话时清理对应记录
4. **书记官作为默认角色存在，不纳入管理面板**：书记官（`SCRIBE_AGENT_ID`）是系统内置角色，不出现在 `AgentPanel` 中，用户无法通过面板管理/删除/禁用它。当前代码已在 `AgentPanel.tsx:288` 和 `turn-manager.ts:12` 中排除 `SCRIBE_AGENT_ID`，此行为保持不变
5. **面板首次自动弹出，之后保持打开**：用户可手动关闭，关闭后新的总结仍会追加（面板保持关闭直到用户重新打开）
6. **面板使用 fixed + transform 动画**：参考 Sidebar 模式，不使用 overlay 遮罩层，面板会覆盖在 ChatArea 右侧（宽度 320px，影响较小）
7. **书记官总结异步并行**：通过 `.then()` fire-and-forget 启动，不阻塞下一位顾问发言
8. **标题生成器修复方式**：将 `firstAgentResponse` 获取从回调改为 `sendMessage` 返回值，并添加详细日志
9. **`ScribeSummary` 类型定义位置**：放在 `src/types/index.ts` 中，供 storage 和 store 共享，避免循环依赖

## 验证步骤

1. **书记官总结触发**：

   * 发送一条用户消息
   * 第一位顾问（事实核查员）发言完毕后，确认书记官开始总结（控制台日志）
   * 书记官总结完成时，右侧面板动画弹出
   * 面板中显示事实核查员的总结（分点格式）

2. **并行执行验证**：

   * 第一位顾问完成后，第二位顾问和书记官应同时工作
   * 第二位顾问发言过程中，书记官总结应完成并弹出面板
   * 第二位顾问完成后，面板中追加第二位顾问的总结

3. **总结格式验证**：

   * 确认总结为分点格式（1. 2. 3.）
   * 确认不超过5点
   * 确认无标题、分割线等额外结构化内容

4. **标题生成器修复验证**：

   * 发送第一条消息后，观察控制台 `[TitleGen]` 日志
   * 确认标题从"新对话"更新为生成的标题
   * 确认标题不超过50字符
   * 若 API 失败，确认控制台有明确的错误日志

5. **持久化验证**：

   * 在对话 A 中发送消息，生成若干书记官总结
   * 切换到对话 B，确认面板显示对话 B 的总结（初始为空）
   * 切换回对话 A，确认面板恢复显示对话 A 的总结记录
   * 刷新页面，确认对话 A 的总结记录仍然存在（从 localStorage 加载）

6. **删除对话验证**：

   * 删除一个有书记官总结的对话
   * 确认 localStorage 中对应的 `debate-room-scribe-summaries-{conversationId}` 键被清除

7. **面板交互验证**：

   * 点击关闭按钮，面板滑出
   * 切换对话，面板加载该会话的总结记录
   * 在新对话中发送消息，面板重新弹出

8. **暗色模式验证**：

   * 切换暗色模式，确认面板样式正确

