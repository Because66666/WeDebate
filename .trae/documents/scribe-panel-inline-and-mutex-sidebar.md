# 书记官面板内联化 & 与左侧栏互斥

## 总结

将 `ScribePanel` 从右侧浮层（overlay）改为**内联挤占主界面**的布局（桌面端 `md:static` + 宽度过渡），与左侧 `Sidebar` 的实现方式完全对称（镜像）。同时在 `AppLayout` 顶栏按钮组第 2 位插入一个「书记官」按钮，该按钮在书记官首次开始输出摘要时出现，点击可打开书记官面板。左侧栏与书记官面板**互斥**：打开一方时自动收拢另一方。

## 当前状态分析

1. **AppLayout.tsx（L69-120）** 顶栏右侧按钮组目前有 3 个按钮：[主题切换, 智能体, 设置]，**没有**书记官按钮。按钮组容器 `borderRadius` 已为 `var(--radius-lg)`（长方形圆角）。Body 区（L123-130）是 `flex flex-1 overflow-hidden`，内部为 `<Sidebar />` + `<main>`；`ScribePanel` 当前被放在 overlay 区（L134），不参与 flex 布局。

2. **Sidebar.tsx** 桌面端用 `md:static` + `md:transition-[width]` + `md:w-64`/`md:w-0 md:overflow-hidden` 实现挤占主内容；移动端用 `fixed inset-y-0 left-0` + `translate-x` + 遮罩层。开关状态来自 `useSettingsStore.sidebarOpen` / `toggleSidebar()`。

3. **ScribePanel.tsx** 当前为纯 overlay：`fixed inset-y-0 right-0 z-40` + `translate-x-full`/`translate-x-0`，带 `boxShadow`。状态来自 `useScribeStore.panelOpen` / `closePanel()` / `openPanel()`。

4. **settings.ts** 有 `sidebarOpen` / `toggleSidebar`（仅 `(set)`，无 `get`）；**scribe.ts** 有 `panelOpen` / `openPanel` / `closePanel` / `hasShownOnce` / `isSummarizing`。两 store 当前互不引用。

5. **触发点**（InputBox.tsx L233-258）：`onAgentSpeechComplete` → `setSummarizing(true)` → `summarizeAgentSpeech` → `addSummary` + `setSummarizing(false)` + 若 `!hasShownOnce` 则 `openPanel()`。即首次摘要完成时自动打开面板，并置 `hasShownOnce=true`。

## 改动方案

### 决策（已定，无需再问）
- **按钮可见性**：条件渲染，当 `hasShownOnce || isSummarizing` 时显示（即书记官开始工作时出现，覆盖「首次开始输出摘要」时刻）。
- **按钮行为**：仅「打开」（`openPanel()`），panel 已打开时点击为 no-op。符合用户「打开...若关闭的时候」描述。
- **互斥实现**：在 store action 层做跨 store 协调（运行时 `getState()` 调用，ES module 循环引用在 action 内部访问是安全的 live binding），覆盖所有打开路径（顶栏按钮点击 + InputBox 自动打开）。

---

### 1. `src/stores/settings.ts` — 打开侧栏时收拢书记官面板

- 顶部新增 `import { useScribeStore } from './scribe';`
- `create` 签名由 `(set)` 改为 `(set, get)`。
- 修改 `toggleSidebar`：仅当**即将打开**（`next === true`）时调用 `useScribeStore.getState().closePanel()`。

```ts
toggleSidebar: () => {
  const next = !get().sidebarOpen;
  if (next) useScribeStore.getState().closePanel();
  set({ sidebarOpen: next });
},
```

### 2. `src/stores/scribe.ts` — 打开书记官面板时收拢侧栏

- 顶部新增 `import { useSettingsStore } from './settings';`
- 修改 `openPanel`：打开时同时把 `sidebarOpen` 置 false（zustand 暴露的 `setState` 直接设置）。

```ts
openPanel: () => {
  useSettingsStore.setState({ sidebarOpen: false });
  set({ panelOpen: true, hasShownOnce: true });
},
```

> 说明：`closePanel` 不变（关闭一方不自动打开另一方）。`setCurrentConversation` 中的 `panelOpen:false` 不变。

### 3. `src/components/ScribePanel.tsx` — 由 overlay 改为内联（镜像 Sidebar）

将 `<aside>` 的 className 改为与 `Sidebar` 对称的「移动端 fixed + 桌面端 static 宽度过渡」结构，并新增移动端遮罩层；移除 `boxShadow`（内联无需投影，与 Sidebar 一致）。

```tsx
return (
  <>
    {/* Mobile overlay backdrop */}
    <div
      className={`fixed inset-0 z-30 transition-opacity duration-[800ms] ease-in-out md:hidden ${
        panelOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      style={{ backgroundColor: 'rgba(0,0,0,0.32)' }}
      onClick={closePanel}
      aria-hidden="true"
    />

    <aside
      className={`${
        panelOpen ? 'translate-x-0' : 'translate-x-full'
      } fixed inset-y-0 right-0 z-40 flex w-80 flex-col transition-transform duration-[800ms] ease-in-out md:static md:z-auto md:translate-x-0 md:transition-[width] md:duration-[800ms] md:ease-in-out ${
        panelOpen ? 'md:w-80' : 'md:w-0 md:overflow-hidden'
      }`}
      style={{
        backgroundColor: 'var(--card)',
        borderLeft: '0.5px solid var(--border)',
      }}
      role="complementary"
      aria-label="书记官记录面板"
      aria-hidden={!panelOpen}
    >
      {/* Header / Body 保持不变 */}
    </aside>
  </>
);
```

要点：
- 移动端：`fixed inset-y-0 right-0` + `translate-x-full`/`translate-x-0` + 遮罩（与 Sidebar 镜像，方向相反）。
- 桌面端：`md:static` + `md:transition-[width]`，`md:w-80`（开）/ `md:w-0 md:overflow-hidden`（关），从而**挤占**主内容宽度（主内容右边界左移）。
- 移除 `boxShadow: 'var(--shadow-xl)'`（内联不再需要）。

### 4. `src/components/AppLayout.tsx` — 插入按钮 + 调整 ScribePanel 位置

**4.1 导入**
- `lucide-react` 导入追加 `ClipboardList`（与 ScribePanel 顶栏图标一致）。
- 新增 `import { useScribeStore } from '../stores/scribe';`

**4.2 组件内新增 scribe 状态**
```ts
const scribeHasShownOnce = useScribeStore((s) => s.hasShownOnce);
const scribeIsSummarizing = useScribeStore((s) => s.isSummarizing);
const openScribePanel = useScribeStore((s) => s.openPanel);
const showScribeButton = scribeHasShownOnce || scribeIsSummarizing;
```

**4.3 在右侧按钮组第 2 位插入书记官按钮**（条件渲染，位于「主题切换」与「智能体」之间）：
```tsx
{showScribeButton && (
  <button
    onClick={openScribePanel}
    aria-label="书记官面板"
    className="flex h-7 w-7 cursor-pointer items-center justify-center outline-none transition-all duration-200"
    style={{ color: 'var(--icon-muted)', borderRadius: 'var(--radius-sm)' }}
    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    title="书记官面板"
  >
    <ClipboardList size={16} />
  </button>
)}
```
按钮顺序变为：[主题切换, 书记官(条件), 智能体, 设置]。

**4.4 将 `<ScribePanel />` 从 overlay 区移入 body flex 容器**（放在 `<main>` 之后，使其在桌面端作为右侧内联列）：
```tsx
<div className="flex flex-1 overflow-hidden">
  <Sidebar />
  <main className="flex flex-1 flex-col overflow-hidden">
    <ChatArea />
    <InputBox />
  </main>
  <ScribePanel />   {/* 由 overlay 区迁入；桌面端挤占主内容右侧 */}
</div>

{/* Overlay panels */}
<SettingsPanel />
<AgentPanel />
{/* ScribePanel 已迁出 */}
```

## 假设与决策
- **循环引用安全**：`settings.ts` ↔ `scribe.ts` 互引，跨 store 调用均在 action 函数体内（运行时），ES module live binding 保证两 store 在调用时均已初始化。项目已有 `useXStore.getState()` 跨 store 调用先例（InputBox.tsx）。
- **不修改 `closePanel`**：关闭一方不联动打开另一方（仅「打开」触发互斥收拢）。
- **不修改 InputBox.tsx**：自动打开路径走的是 `openPanel()`，已被步骤 2 覆盖（会自动收拢侧栏），无需改动。
- **按钮无激活态高亮**：保持与同组按钮一致的 hover 样式，不过度设计。
- **移动端互斥**：store 层协调对移动端同样生效（打开 scribe 时 `sidebarOpen=false`，Sidebar 的移动端 fixed 也会随之滑出；反之亦然）。

## 验证步骤
1. **按钮出现时机**：新对话中首次有智能体发言完成 → 书记官开始总结（`isSummarizing=true`）→ 顶栏第 2 位出现书记官按钮；之前不显示。
2. **内联挤占**：桌面端打开书记官面板，主讨论区右边界左移、宽度收窄，面板位于右侧且无投影；关闭后主区恢复。
3. **互斥 - 顶栏**：打开左侧栏 → 再点书记官按钮 → 左侧栏自动收拢、书记官面板展开；反向同理。
4. **互斥 - 自动打开**：左侧栏展开状态下，首次摘要完成自动弹出书记官面板时，左侧栏自动收拢。
5. **移动端**：窄屏下书记官面板以 fixed + 遮罩形式滑入；与左侧栏仍互斥。
6. **关闭不联动**：单独关闭书记官面板（X 按钮）不会打开左侧栏；反之亦然。
7. **切换对话**：切换对话后 `hasShownOnce` 重置、面板关闭、按钮在下次总结前不显示。

## 待修改文件清单
- `src/stores/settings.ts`（新增 import + `get` + 改 `toggleSidebar`）
- `src/stores/scribe.ts`（新增 import + 改 `openPanel`）
- `src/components/ScribePanel.tsx`（overlay → 内联 + 遮罩）
- `src/components/AppLayout.tsx`（导入 + 状态 + 第 2 位按钮 + 迁移 ScribePanel 位置）
