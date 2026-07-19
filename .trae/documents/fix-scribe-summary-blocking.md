# 修复书记官摘要总结无法动态接纳新 agent 的问题

## 问题现象

新增"立场分析师"后，书记官的摘要总结阻塞在"逻辑与批判性专家"——即只有事实员和逻辑专家的摘要，立场分析师及后续角色的摘要不出现。用户判断"摘要总结的代码逻辑没有办法动态接纳新的 agent"。

## 根因分析

### 根因 1（主要）：localStorage 旧配置覆盖新默认配置

**位置**：[src/stores/agent.ts](file:///d:/python/WeDebate-model_debatement_room/src/stores/agent.ts#L24-L28)

```typescript
loadAgents: () => {
  const stored = storageService.getAgents();
  const agents = stored.length > 0 ? stored : createDefaultAgents();
  set({ agents });
},
```

* 首次使用时 `localStorage` 为空，`createDefaultAgents()` 返回当前默认配置（现在含 7 个角色）。

* 但用户**之前已经使用过系统**，`localStorage` 的 `debate-room-agents` 键已保存旧的 6 个角色配置（不含立场分析师）。

* 再次加载时 `stored.length > 0` 为 true，直接采用旧配置，**新增的立场分析师永远不会被注入**。

* 代码中没有配置版本号、id 对齐或迁移机制，无法检测 localStorage 中的配置是否过时。

**影响链**：

* `agentStore.agents` = 旧 6 个 → `getEnabledAgents()` 返回旧 6 个 → `turnManager.initTurn(agents)` 创建的 `agentOrder` 为旧 6 个 → 发言顺序与提示词系统都基于旧配置。

* 书记官的 `summarizeAgentSpeech` 本身是通用的（不依赖 agent 列表），但 agent 根本没被加载，发言和总结都无法触发。

### 根因 2（次要）：isSummarizing 单布尔值无法表达并发总结

**位置**：[src/stores/scribe.ts](file:///d:/python/WeDebate-model_debatement_room/src/stores/scribe.ts#L10) 与 [src/components/InputBox.tsx](file:///d:/python/WeDebate-model_debatement_room/src/components/InputBox.tsx#L248-L280)

```typescript
useScribeStore.getState().setSummarizing(true);
summarizeAgentSpeech(apiConfig, agentName, content)
  .then(() => { ...; scribeStore.setSummarizing(false); })
  .catch(() => { useScribeStore.getState().setSummarizing(false); });
```

* `onAgentSpeechComplete` 是非阻塞的，每个 agent 发言完毕立即推进到下一个。

* 多个 agent 的 `summarizeAgentSpeech` Promise 会**并发执行**。

* `isSummarizing` 是单一全局布尔值：第一个 Promise 完成时置 false，但其他 Promise 仍在进行中——UI 的"正在总结..."指示器会在仍有总结进行时提前消失。

* **不会直接导致摘要丢失**（每个 Promise 独立 `addSummary`），但 UI 状态不准确，会让用户误以为"总结停止了"。

### 已排除的因素

* `turn-manager.ts` 的 `createTurnManager` / `advanceTurn` / `getNextAgent` 全部基于 `agents` 参数动态生成 `agentOrder`，无硬编码。

* `scribe-service.ts` 的 `summarizeAgentSpeech` 只接收 `agentName` 和 `agentContent`，不依赖 agent 列表。

* `SCRIBE_SUMMARY_PROMPT` 是通用提示词，不包含角色列表。

* `ScribePanel.tsx` 纯渲染组件，从 store 读取 summaries，无硬编码。

* `chat-service.ts` 中 `onAgentSpeechComplete` 回调每个 agent 发言后都会触发。

## 修复方案

### 修改 1：`loadAgents` 添加默认 agent 同步逻辑（主要修复）

**文件**：[src/stores/agent.ts](file:///d:/python/WeDebate-model_debatement_room/src/stores/agent.ts)
**同步修改**：[frontend\_template/src/stores/agent.ts](file:///d:/python/WeDebate-model_debatement_room/frontend_template/src/stores/agent.ts)

**改动**：`loadAgents` 在读取 localStorage 后，与 `AGENT_PRESETS` 做对齐：

* 缺失的默认 agent（按 id 匹配）从 `AGENT_PRESETS` 补充进来，保持 `AGENT_PRESETS` 中定义的顺序。

* 用户自定义的 agent（id 不在 `AGENT_PRESETS` 中）保留在默认 agent 之后。

* 用户对默认 agent 的修改（如改名、改提示词、禁用）予以保留。

* 如果最终结果与 localStorage 中的不同，则回写 localStorage。

需要从 `prompts/agents` 导出 `AGENT_PRESETS`（当前已导出）。

```typescript
import { createDefaultAgents, AGENT_PRESETS } from '../prompts/agents';

loadAgents: () => {
  const stored = storageService.getAgents();
  if (stored.length === 0) {
    set({ agents: createDefaultAgents() });
    return;
  }
  // 对齐：缺失的默认 agent 补充进来，保留用户自定义与修改
  const storedIds = new Set(stored.map((a) => a.id));
  const missingDefaults = AGENT_PRESETS.filter((p) => !storedIds.has(p.id));
  if (missingDefaults.length === 0) {
    set({ agents: stored });
    return;
  }
  // 按 AGENT_PRESETS 顺序重建：先保留 stored 中已有的默认 agent（按 preset 顺序），
  // 再追加用户自定义 agent
  const presetIds = new Set(AGENT_PRESETS.map((p) => p.id));
  const ordered: AgentConfig[] = [];
  for (const preset of AGENT_PRESETS) {
    const found = stored.find((a) => a.id === preset.id);
    if (found) {
      ordered.push(found); // 保留用户对该默认 agent 的修改
    } else {
      // 缺失则用默认配置补充
      ordered.push({
        id: preset.id,
        name: preset.name,
        color: preset.color,
        basePrompt: 'base',
        personaPrompt: preset.personaPrompt,
        enabled: true,
      });
    }
  }
  // 追加用户自定义 agent（id 不在 AGENT_PRESETS 中的）
  const customAgents = stored.filter((a) => !presetIds.has(a.id));
  const merged = [...ordered, ...customAgents];
  set({ agents: merged });
  storageService.setAgents(merged);
},
```

### 修改 2：`isSummarizing` 改为计数器以支持并发总结（次要修复）

**文件**：[src/stores/scribe.ts](file:///d:/python/WeDebate-model_debatement_room/src/stores/scribe.ts)
**同步修改**：[frontend\_template/src/stores/scribe.ts](file:///d:/python/WeDebate-model_debatement_room/frontend_template/src/stores/scribe.ts)

**改动**：将 `isSummarizing: boolean` 替换为 `summarizingCount: number`，并派生 `isSummarizing` 为 `summarizingCount > 0`。

* 新增 `incrementSummarizing()` 和 `decrementSummarizing()` 方法。

* 保留 `isSummarizing` 作为派生 getter（通过 `selectIsSummarizing` 选择器），避免大范围改动消费端。

* `InputBox.tsx` 中将 `setSummarizing(true)` 改为 `incrementSummarizing()`，`setSummarizing(false)` 改为 `decrementSummarizing()`。

```typescript
interface ScribeState {
  // ...
  summarizingCount: number;
  incrementSummarizing: () => void;
  decrementSummarizing: () => void;
  // 保留 isSummarizing 作为派生值（通过选择器）
}

export const selectIsSummarizing = (state: ScribeState): boolean =>
  state.summarizingCount > 0;
```

**消费端调整**：

* [src/components/ScribePanel.tsx](file:///d:/python/WeDebate-model_debatement_room/src/components/ScribePanel.tsx#L19): `const isSummarizing = useScribeStore(selectIsSummarizing);`

* [src/components/AppLayout.tsx](file:///d:/python/WeDebate-model_debatement_room/src/components/AppLayout.tsx#L22): `const scribeIsSummarizing = useScribeStore(selectIsSummarizing);`

* [src/components/InputBox.tsx](file:///d:/python/WeDebate-model_debatement_room/src/components/InputBox.tsx#L248): `useScribeStore.getState().incrementSummarizing();`

* [src/components/InputBox.tsx](file:///d:/python/WeDebate-model_debatement_room/src/components/InputBox.tsx#L275): `scribeStore.decrementSummarizing();`

* [src/components/InputBox.tsx](file:///d:/python/WeDebate-model_debatement_room/src/components/InputBox.tsx#L279): `useScribeStore.getState().decrementSummarizing();`

## 假设与决策

1. **假设**：用户之前使用过系统，localStorage 中保存了旧的 6 个 agent 配置。这是"无法动态接纳新 agent"的直接原因。
2. **决策**：采用 id 对齐策略而非版本号重置——保留用户对默认 agent 的自定义修改（如改了提示词或禁用了某角色），只补充缺失的默认 agent。
3. **决策**：`isSummarizing` 改为计数器而非彻底重构——最小化改动，保持 API 兼容。
4. **不改动**：`turn-manager.ts`、`scribe-service.ts`、`SCRIBE_SUMMARY_PROMPT`、`ScribePanel.tsx` 主体逻辑——它们本身是动态的，无需修改。
5. **frontend\_template 同步**：所有 `src/` 下的改动在 `frontend_template/src/` 下同步执行（虽然 `.gitignore` 忽略了 frontend\_template，但保持模板一致性）。

## 验证步骤

1. **复现验证**：在浏览器中用旧 localStorage（6个agent）加载应用，确认立场分析师缺失。
2. **修复验证**：应用修改 1 后刷新页面，确认：

   * 立场分析师自动出现在 agent 列表中，位置在逻辑专家之后、伦理学家之前。

   * 用户对其他 agent 的自定义修改（如改名/禁用）被保留。

   * 发言顺序正确：事实员 → 逻辑专家 → 立场分析师 → 伦理学家 → 心理分析师 → 战略家 → 催化师。
3. **摘要验证**：发起一轮讨论，确认书记官为**每个**发言的 agent 生成摘要（包括立场分析师及之后的角色）。
4. **并发验证**：观察多个 agent 的摘要并发生成时，"正在总结..."指示器在所有总结完成前持续显示（修改 2 的效果）。
5. **回归验证**：用户自定义 agent、禁用/启用 agent、重置到默认等操作正常工作。
6. **独立审计**：完成后启动子智能体对改动进行独立核查（遵循 AGENTS.md 约束）。

