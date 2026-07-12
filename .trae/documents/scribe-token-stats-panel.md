# 书记官 Token 统计面板实现计划

## Summary

在书记官记录面板的摘要列表末尾新增"Token 统计"特殊项,样式与现有顾问摘要卡片一致(圆角卡片+header+主体),展示累计的输入 token 总数和输出 token 总数。统计范围包含**顾问发言**(主流式调用)和**书记官总结调用**(非流式)两部分 token,按用户确认采用**数据层插入特殊项**方案——统计项作为 `summaries` 数组的一个特殊元素,始终位于数组末尾,新顾问摘要插入到它之前,并随数组一起持久化到 localStorage。

更新时序:

* 第一位顾问发言完毕 → 读取流末尾 usage → 累计到统计项(首次创建) → 渲染

* 书记官总结完成 → 读取非流式 response.usage → 累计到统计项 → 渲染

* 后续每位顾问重复以上两步

## Current State Analysis

### 现有架构关键点

1. **数据流**:[chat-service.ts](file:///d:\python\WeDebate-model_debatement_room\src\services\chat-service.ts) 的 `sendMessage` 循环调度顾问发言,每位顾问发言完毕后调用 `onAgentSpeechComplete?.(agentId, agentName, fullContent)`([L207](file:///d:\python\WeDebate-model_debatement_room\src\services\chat-service.ts#L207))。

2. **书记官触发**:[InputBox.tsx#L233-L260](file:///d:\python\WeDebate-model_debatement_room\src\components\InputBox.tsx#L233-L260) 实现 `onAgentSpeechComplete`,异步调用 `summarizeAgentSpeech` 生成摘要,成功后 `scribeStore.addSummary(...)`。

3. **状态管理**:[stores/scribe.ts](file:///d:\python\WeDebate-model_debatement_room\src\stores\scribe.ts) 使用 Zustand,`summariesByConversation: Record<string, ScribeSummary[]>`,`addSummary` 直接 append 到末尾,`persistSummaries` 写入 localStorage。

4. **持久化**:[storage.ts#L112-L138](file:///d:\python\WeDebate-model_debatement_room\src\services\storage.ts#L112-L138) `getScribeSummaries`/`setScribeSummaries` 存取整个 `ScribeSummary[]` 数组,无需修改存储层。

5. **渲染**:[ScribePanel.tsx#L89-L130](file:///d:\python\WeDebate-model_debatement_room\src\components\ScribePanel.tsx#L89-L130) `summaries.map(...)` 渲染每项,样式为圆角卡片(borderRadius/border/backgroundColor 由 CSS 变量驱动)+ header(色点 + agentName)+ 主体(Markdown)。

6. **流式调用**:[openai.ts](file:///d:\python\WeDebate-model_debatement_room\src\services\openai.ts) 的 `streamChatCompletion` 当前**未传** **`stream_options.include_usage`**,`readStream` 也**未捕获 usage**。OpenAI 兼容 API 在 `stream_options: { include_usage: true }` 时会在流末尾发送一个 `choices: []` 且带 `usage` 字段的 chunk。

7. **非流式调用**:[scribe-service.ts](file:///d:\python\WeDebate-model_debatement_room\src\services\scribe-service.ts) 的 `summarizeAgentSpeech` 是 `stream: false` 的非流式调用,`data.usage` 字段可直接读取,但当前**未读取**。

8. **数据结构**:[types/index.ts#L84-L93](file:///d:\python\WeDebate-model_debatement_room\src\types\index.ts#L84-L93) `ScribeSummary` 接口固定 7 个字段,无 type 区分。

### 现状结论

* 项目目前**完全没有 token usage 处理代码**(grep `usage|prompt_tokens|completion_tokens` 在 src 下无匹配)。

* 需要从底层 `streamChatCompletion` 开始改造,逐层暴露 usage 数据,直到 store 和 UI。

## Proposed Changes

### 1. [src/types/index.ts](file:///d:\python\WeDebate-model_debatement_room\src\types\index.ts) — 扩展数据结构

**What**: 新增 `ChatUsage` 类型;扩展现有 `ScribeSummary` 接口添加可选的统计项字段。

**Why**: 用一个数组同时承载摘要项和统计项,需要类型层面区分;可选字段保证旧 localStorage 数据向后兼容(无 `kind` 字段视为普通摘要)。

**How**: 在 `ScribeSummary` 接口后追加可选字段:

```typescript
// 新增类型
export interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// 扩展 ScribeSummary(追加可选字段,不破坏现有字段)
export interface ScribeSummary {
  id: string;
  conversationId: string;
  agentId: string;
  agentName: string;
  agentColor: string;
  summary: string;
  timestamp: number;
  // —— 统计项扩展字段(可选,向后兼容)——
  // 缺省(undefined)视为普通顾问摘要项
  kind?: 'stats';
  inputTokens?: number;
  outputTokens?: number;
}
```

统计项的语义约定:`kind === 'stats'` 时,`agentId` 固定为 `'scribe-stats'`,`agentName` 固定为 `'Token 统计'`,`agentColor` 用一个中性色(如 `var(--icon-muted)` 对应色或 `#888`),`summary` 为空字符串。

### 2. [src/services/openai.ts](file:///d:\python\WeDebate-model_debatement_room\src\services\openai.ts) — 流式层捕获 usage

**What**: 在 `streamChatCompletion` 中请求 usage 并通过新增 `onUsage` 回调暴露;支持递归(工具调用)场景下的 usage 累积转发。

**Why**: OpenAI 流式 API 默认不发 usage,必须显式 `stream_options.include_usage = true`;usage chunk 的 `choices` 为空数组,现有代码 `if (!choice) return true;` 会跳过它,需在 return 前捕获。

**How**:

* 在 `StreamCallbacks` 接口新增 `onUsage?: (usage: ChatUsage) => void;`

* 在 `requestBody` 中追加 `requestBody.stream_options = { include_usage: true };`(注意:对不支持该参数的 OpenAI 兼容服务,大多数会忽略未知字段,不会报错;少数严格服务可能拒绝,但属于边缘情况,可接受)

* 在 `readStream` 内部新增局部变量 `let usage: ChatUsage | undefined;`

* 修改 `handleSseLine`:在 `JSON.parse` 后,**先**捕获 `parsed.usage`(若存在赋值给 `usage`),再判断 `choice`。这样即使 `choices` 为空数组,usage 也已被记录。

* 在 `ReadStreamResult` 接口新增 `usage?: ChatUsage;`,在 `buildResult` 中返回

* 在 `streamChatCompletion` 中,`readStream` 返回后立即调用 `if (usage) callbacks.onUsage?.(usage);`(在判断 `toolCalls.length === 0` 之前,确保递归每一轮的 usage 都能向上冒泡)

* 递归调用 `streamChatCompletion` 时,内层 `onUsage` 直接转发到外层 callbacks 的 `onUsage`,实现多轮工具调用的 usage 累积由上层(chat-service)负责

### 3. [src/services/chat-service.ts](file:///d:\python\WeDebate-model_debatement_room\src\services\chat-service.ts) — 传递顾问发言 usage

**What**: `sendMessage` 接收并累积单次顾问发言的 usage,通过扩展 `onAgentSpeechComplete` 签名传出。

**Why**: 顾问发言可能涉及多轮工具调用(递归 `streamChatCompletion`),需要在 chat-service 层累加所有轮次的 usage,再一次性传给 `onAgentSpeechComplete`。

**How**:

* 修改 `onAgentSpeechComplete` 签名:

  ```typescript
  onAgentSpeechComplete?: (
    agentId: string,
    agentName: string,
    content: string,
    usage?: ChatUsage,
  ) => void;
  ```

* 在 `while (true)` 循环内,每个顾问发言开始前初始化 `let agentUsage: ChatUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };`

* 在 `streamChatCompletion` 的 callbacks 中新增:

  ```typescript
  onUsage: (u) => {
    agentUsage.prompt_tokens += u.prompt_tokens ?? 0;
    agentUsage.completion_tokens += u.completion_tokens ?? 0;
    agentUsage.total_tokens += u.total_tokens ?? 0;
  },
  ```

* 修改 [L207](file:///d:\python\WeDebate-model_debatement_room\src\services\chat-service.ts#L207):

  ```typescript
  const finalUsage = agentUsage.total_tokens > 0 ? agentUsage : undefined;
  onAgentSpeechComplete?.(agent.id, agent.name, fullContent, finalUsage);
  ```

  (若该次发言 usage 全为 0,传 undefined,避免无意义更新)

### 4. [src/services/scribe-service.ts](file:///d:\python\WeDebate-model_debatement_room\src\services\scribe-service.ts) — 书记官总结返回 usage

**What**: `summarizeAgentSpeech` 返回值从 `string` 改为 `{ summary: string; usage?: ChatUsage }`,读取非流式响应的 `data.usage`。

**Why**: 书记官总结调用本身也消耗 token,需纳入统计。

**How**:

* 修改返回类型签名:`Promise<{ summary: string; usage?: ChatUsage }>`

* 在 `const data = await response.json();` 后:

  ```typescript
  const content = data.choices?.[0]?.message?.content ?? '';
  const rawUsage = data.usage;
  const usage: ChatUsage | undefined = rawUsage
    ? {
        prompt_tokens: rawUsage.prompt_tokens ?? 0,
        completion_tokens: rawUsage.completion_tokens ?? 0,
        total_tokens: rawUsage.total_tokens ?? 0,
      }
    : undefined;
  return { summary: content.trim(), usage };
  ```

### 5. [src/stores/scribe.ts](file:///d:\python\WeDebate-model_debatement_room\src\stores\scribe.ts) — 新增 addTokens,改造 addSummary 保证统计项在末尾

**What**: 新增 `addTokens(conversationId, inputTokens, outputTokens)` 方法;改造 `addSummary` 确保新摘要插入到统计项之前;接口扩展。

**Why**: 用户要求数据层方案,统计项作为数组特殊元素,新摘要必须始终插入到统计项之前;`addTokens` 负责累计 token 并保证统计项存在且位于末尾。

**How**:

* `ScribeState` 接口新增:

  ```typescript
  addTokens: (conversationId: string, inputTokens: number, outputTokens: number) => void;
  ```

* **改造** **`addSummary`**:不再简单 append,改为"分离统计项 → 追加新摘要到普通项末尾 → 重新拼上统计项":

  ```typescript
  addSummary: (summary) => {
    const { conversationId } = summary;
    set((state) => {
      const existing = state.summariesByConversation[conversationId] ?? [];
      const statsEntries = existing.filter((s) => s.kind === 'stats');
      const normalEntries = existing.filter((s) => s.kind !== 'stats');
      const statsEntry = statsEntries[0]; // 至多一个
      const newEntries = statsEntry
        ? [...normalEntries, summary, statsEntry]
        : [...normalEntries, summary];
      return {
        summariesByConversation: {
          ...state.summariesByConversation,
          [conversationId]: newEntries,
        },
      };
    });
    get().persistSummaries(conversationId);
    if (!get().hasShownOnce) get().openPanel();
  },
  ```

* **新增** **`addTokens`**(首次调用时自动创建统计项):

  ```typescript
  addTokens: (conversationId, inputTokens, outputTokens) => {
    set((state) => {
      const existing = state.summariesByConversation[conversationId] ?? [];
      const statsEntries = existing.filter((s) => s.kind === 'stats');
      const normalEntries = existing.filter((s) => s.kind !== 'stats');
      let statsEntry = statsEntries[0];
      if (!statsEntry) {
        statsEntry = {
          id: crypto.randomUUID(),
          conversationId,
          agentId: 'scribe-stats',
          agentName: 'Token 统计',
          agentColor: '#888',
          summary: '',
          timestamp: Date.now(),
          kind: 'stats',
          inputTokens: 0,
          outputTokens: 0,
        };
      }
      const updatedStats: ScribeSummary = {
        ...statsEntry,
        inputTokens: (statsEntry.inputTokens ?? 0) + inputTokens,
        outputTokens: (statsEntry.outputTokens ?? 0) + outputTokens,
        timestamp: Date.now(),
      };
      return {
        summariesByConversation: {
          ...state.summariesByConversation,
          [conversationId]: [...normalEntries, updatedStats],
        },
      };
    });
    get().persistSummaries(conversationId);
  },
  ```

* 防御性处理:`loadSummaries` 加载旧数据时无需主动补统计项(只有在第一次 `addTokens` 时才会创建)。但如果旧数据中意外存在多个 `kind === 'stats'` 项(理论上不会发生),`filter` 取第一个,其余会被静默丢弃——可接受。

### 6. [src/components/InputBox.tsx](file:///d:\python\WeDebate-model_debatement_room\src\components\InputBox.tsx) — 接入 usage 流

**What**: 修改 `onAgentSpeechComplete` 回调,接收顾问发言 usage 并立即累计到统计项;修改 `summarizeAgentSpeech` 的 `.then` 处理,接收书记官总结 usage 并累计。

**Why**: 这是"顾问发言完毕"和"书记官总结完成"两个更新时机的接入点。

**How**: 修改 [L233-L260](file:///d:\python\WeDebate-model_debatement_room\src\components\InputBox.tsx#L233-L260):

```typescript
(agentId, agentName, content, usage) => {
  if (!content) return;
  const conversationId = useConversationStore.getState().currentConversationId;
  if (!conversationId) return;

  // 触发点 1:顾问发言完毕,立即累计该次发言的 token(创建/更新统计项)
  if (usage && (usage.prompt_tokens > 0 || usage.completion_tokens > 0)) {
    useScribeStore.getState().addTokens(
      conversationId,
      usage.prompt_tokens,
      usage.completion_tokens,
    );
  }

  useScribeStore.getState().setSummarizing(true);

  summarizeAgentSpeech(apiConfig as ApiConfig, agentName, content)
    .then(({ summary, usage: scribeUsage }) => {
      const agent = agentStore.agents.find((a) => a.id === agentId);
      const scribeStore = useScribeStore.getState();
      scribeStore.addSummary({
        id: crypto.randomUUID(),
        conversationId,
        agentId,
        agentName,
        agentColor: agent?.color ?? '#888',
        summary,
        timestamp: Date.now(),
      });
      // 触发点 2:书记官总结完成,累计该次总结的 token
      if (scribeUsage && (scribeUsage.prompt_tokens > 0 || scribeUsage.completion_tokens > 0)) {
        scribeStore.addTokens(
          conversationId,
          scribeUsage.prompt_tokens,
          scribeUsage.completion_tokens,
        );
      }
      scribeStore.setSummarizing(false);
    })
    .catch((err) => {
      console.error('[Scribe] 总结失败:', err);
      useScribeStore.getState().setSummarizing(false);
    });
},
```

### 7. [src/components/ScribePanel.tsx](file:///d:\python\WeDebate-model_debatement_room\src\components\ScribePanel.tsx) — 渲染统计面板

**What**: 在 `summaries.map(...)` 中根据 `item.kind` 分支渲染:统计项渲染为 Token 统计卡片(样式与摘要卡片一致),普通项保持现有逻辑。

**Why**: 用户要求"样式和之前的顾问摘要一致"——同样的圆角卡片、header(图标 + 标题)、主体区;主体区展示输入/输出 token 数。

**How**:

* 从 `lucide-react` 新增 import `BarChart3`(用作统计项 header 图标,替代摘要项的色点)

* 修改 [L89-L130](file:///d:\python\WeDebate-model_debatement_room\src\components\ScribePanel.tsx#L89-L130) 的 `summaries.map(...)`:

  ```tsx
  {summaries.map((item) => {
    if (item.kind === 'stats') {
      // 统计项:样式与摘要卡片一致,header 用图标 + "Token 统计",主体展示两个数字
      return (
        <div
          key={item.id}
          className="overflow-hidden"
          style={{
            borderRadius: 'var(--radius-md)',
            border: '0.5px solid var(--border)',
            backgroundColor: 'var(--background-secondary)',
          }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{ borderBottom: '0.5px solid var(--border)' }}
          >
            <BarChart3 size={12} style={{ color: 'var(--icon-muted)' }} aria-hidden="true" />
            <span
              className="font-semibold"
              style={{ fontSize: '12px', color: 'var(--foreground)' }}
            >
              {item.agentName}
            </span>
          </div>
          <div className="px-3 py-2.5">
            <div
              className="flex flex-col gap-1"
              style={{ fontSize: '13px', color: 'var(--foreground)' }}
            >
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--foreground-secondary)' }}>输入 Token</span>
                <span className="font-semibold tabular-nums">
                  {(item.inputTokens ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--foreground-secondary)' }}>输出 Token</span>
                <span className="font-semibold tabular-nums">
                  {(item.outputTokens ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    // 普通顾问摘要项:保持现有渲染逻辑不变
    return (
      <div key={item.id} className="overflow-hidden cursor-pointer" /* ... 现有代码 ... */>
        {/* ... 现有内容 ... */}
      </div>
    );
  })}
  ```

* 统计项不绑定 `onClick` 滚动(它没有对应的顾问发言可滚动到)

* `isSummarizing` 的"正在总结..."提示仍渲染在 map 之后,因此会显示在统计项**之后**——这与现有行为一致(总结提示在最末),且只在 `isSummarizing === true` 时短暂出现,统计项完成后即消失。可接受,无需调整。

### 8. 不需要修改的部分

* **storage.ts**:`getScribeSummaries`/`setScribeSummaries` 存取整个数组,新结构向后兼容,无需改动

* **prompts/agents/scribe.ts**:提示词与 token 统计无关,无需改动

* **chat-service.ts 的** **`onAgentMessageComplete`** **等其他回调**:不涉及 usage,不动

## Assumptions & Decisions

1. **OpenAI 兼容服务对** **`stream_options.include_usage`** **的支持**:大多数主流服务(OpenAI、DeepSeek、智谱、阿里云等)支持;少数不支持的会忽略该字段,此时流末尾不发 usage chunk,`onUsage` 不触发,该次顾问发言的 token 不计入统计——降级行为可接受,不报错。**不强制要求服务支持**。

2. **usage 字段名假设**:遵循 OpenAI 标准 `prompt_tokens` / `completion_tokens` / `total_tokens`。如果某服务用非标准字段名(如 `input_tokens`/`output_tokens`),则该次 usage 解析为 undefined,跳过统计——降级行为可接受。

3. **统计项创建时机**:不在 `loadSummaries` 时主动创建空统计项,而是在第一次 `addTokens` 调用时按需创建。这样旧会话在未产生新发言前不显示统计面板,符合"面板始终位于摘要序列末尾"的语义(空会话不显示)。

4. **统计项的唯一性**:理论上一个会话最多一个统计项。`addSummary` 和 `addTokens` 都通过 `filter((s) => s.kind === 'stats')` 取第一个,即使意外出现多个也会被静默合并为单个,无需额外清理逻辑。

5. **面板位置:数据层方案**——用户明确选择。统计项作为 `summaries` 数组末尾的特殊元素,随数组持久化到 localStorage。新摘要通过 `addSummary` 的"分离统计项 → 追加 → 重新拼接"逻辑保证插入到统计项之前。

6. **tabular-nums**:统计数字使用 `tabular-nums` Tailwind 类,确保数字等宽对齐,避免更新时数字"抖动"。

7. **`agentColor`** **for stats**:用 `#888` 中性色,实际渲染中 header 图标使用 `var(--icon-muted)`,色点字段在统计项中不渲染(用图标替代)。

8. **两位更新时机**:顾问发言完→更新一次(顾问发言 token);书记官总结完→再更新一次(书记官总结 token)。这与用户描述"等一个顾问回答完即更新一次"完全吻合(发言完确实更新了),书记官总结的 token 作为追加更新。

## Verification Steps

1. **类型检查**:`npm run typecheck` 或 `tsc --noEmit` 通过,无类型错误
2. **构建**:`npm run build` 成功
3. **首位顾问发言测试**:

   * 发起一次讨论,第一位顾问发言完毕后,书记官面板出现统计卡片

   * 统计卡片显示"输入 Token"和"输出 Token"两个数字(非 0,假设服务支持 usage)

   * 统计卡片位于摘要列表末尾(此时可能还没有摘要,或只有第一位顾问的摘要)
4. **多顾问多轮测试**:

   * 第二位、第三位顾问依次发言完毕,统计数字递增

   * 每次新摘要出现时,统计卡片始终位于所有摘要之后
5. **持久化测试**:

   * 刷新页面,重新打开同一会话,统计卡片仍在,数字保持累计值
6. **降级测试**:

   * 切换到一个不支持 `stream_options.include_usage` 的服务,发起讨论

   * 顾问发言完毕后统计数字可能为 0 或不更新(取决于服务是否返回非流式 usage),不报错

   * 书记官总结完成后的非流式 usage 通常仍可获取(大多数服务在非流式响应中返回 usage),该部分 token 仍会累计
7. **样式验证**:统计卡片与摘要卡片视觉一致——相同的圆角、边框、背景色、header 高度、字号
8. **滚动行为**:点击统计卡片不触发滚动(无 onClick),点击摘要卡片仍可滚动到对应顾问发言
9. **审计子智能体核查**:实现完成后,启动 Explore 子智能体独立核查:

   * 流式 usage 是否在所有递归路径下都能冒泡到 `onAgentSpeechComplete`

   * `addSummary` 是否在所有路径下保证统计项位于末尾

   * `addTokens` 首次创建与后续累加逻辑是否正确

   * localStorage 持久化是否包含统计项

   * 旧数据(无统计项)加载后是否正常渲染,不报错

