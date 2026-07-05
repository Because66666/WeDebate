# 增强提示词动态能力、网页内容抓取与 Markdown 扩展 Spec

## Why

当前基础提示词缺少动态上下文（日期、可用智能体信息），智能体的对话缺乏时间感知和角色感知能力。同时，已有搜索工具但缺乏网页内容抓取能力，无法深入阅读具体网页。此外，Markdown 渲染需要支持带框线字符的流程图/图表展示。

## What Changes

* **新增**: `base.ts` 基础提示词动态注入当前日期信息，让智能体感知时间

* **新增**: `base.ts` 基础提示词动态注入当前可用智能体列表及其角色描述

* **新增**: `server/search.ts` 新增 `fetchWebPage` 函数：访问指定 URL 并提取页面主要文本内容

* **新增**: 前端新增 `web_fetch` 工具，通过后端 API 获取网页内容，注册到 ToolRegistry

* **新增**: MarkdownRenderer 新增自定义组件渲染带框线字符（`┌┐│↕↓─` 等）的流程图/图表块，使用等宽字体 + 外边框

## Impact

* Affected specs: 基础聊天室功能、智能体能力增强

* Affected code:

  * `src/prompts/base.ts` - 改为函数形式，接受 `currentDate` 和 `agentsInfo` 参数返回动态提示词

  * `src/services/context-builder.ts` - 构建系统提示词时传入日期和智能体信息

  * `server/search.ts` - 新增 `fetchWebPage(url)` 函数及对应 API endpoint

  * `server/index.ts` 或路由文件 - 新增 `/api/fetch-page` 端点

  * `src/services/tools/` - 新增 `web-fetch.ts` 工具实现

  * `src/services/tools/index.ts` - 注册 `web_fetch` 工具

  * `src/components/MarkdownRenderer.tsx` - 新增流程图/图表自定义渲染组件

  * `src/types/index.ts` - 可能新增 fetch 结果类型

## ADDED Requirements

### Requirement: 动态日期注入

基础提示词应包含当前日期信息。

#### Scenario: 构建智能体上下文时

* **WHEN** 系统构建智能体系统提示词时

* **THEN** 自动注入当前日期（格式：YYYY-MM-DD）

* **AND** 日期信息放在提示词开头或结尾，格式如 "当前日期：2026-06-16"

### Requirement: 动态智能体列表注入

基础提示词应包含当前所有可用智能体的名称。

#### Scenario: 构建智能体上下文时

* **WHEN** 系统构建智能体系统提示词时

* **THEN** 自动注入当前所有已启用智能体的列表，包含名称和角色描述

* **AND** 格式如 "当前讨论室中的顾问：\n- 科技顾问\n- 金融顾问"

### Requirement: 网页内容抓取工具

系统应提供通过 URL 获取网页主要文本内容的能力。

#### Scenario: 后端服务新增网页抓取

* **WHEN** 用户或智能体需要查看特定网页内容

* **THEN** 后端 `server/search.ts` 提供 `fetchWebPage(url: string)` 函数

* **AND** 函数访问 URL、解析 HTML、提取 `<article>` 或 `<main>` 等主要内容区域的文本

* **AND** 返回纯文本内容（去除 HTML 标签），限制最大字符数（如 8000 字符），如果超过则截断，并且提示“<文本过长，系统自动截断>”

#### Scenario: API 端点

* **WHEN** 前端调用 `/api/fetch-page?url=...`

* **THEN** 后端返回 `{ url, content: string, error?: string }`

* **AND** content 包含页面主要文本内容

#### Scenario: 前端工具注册

* **WHEN** 系统初始化

* **THEN** `web_fetch` 工具注册到 ToolRegistry，参数包含 `url`

* **AND** 工具描述清晰说明其功能

### Requirement: 流程图/图表 Markdown 渲染

Markdown 渲染器应支持包含框线字符的流程图/图表块。

#### Scenario: Markdown 中包含框线图表

* **WHEN** Markdown 内容中包含使用 `┌┐└┘│─↕↓` 等字符绘制的图表

* **THEN** 渲染器识别这些内容并用等宽字体、带外边框的预格式化块展示

* **AND** 保持原始字符对齐和格式

#### Scenario: 实现方式

* **WHEN** Markdown 解析器遇到代码块或文本中包含框线字符

* **THEN** 自定义渲染组件判断文本块是否包含框线字符

* **AND** 如果是，使用 `<pre class="diagram-block">` 包裹，应用等宽字体和外边框样式

* **AND** 如果不是，使用默认渲染

## MODIFIED Requirements

### Requirement: base.ts 改为动态函数

**原有方式**: `BASE_SYSTEM_PROMPT` 为静态字符串常量。

**修改后**:

* 将 `BASE_SYSTEM_PROMPT` 改为导出函数 `getBaseSystemPrompt(currentDate: string, agentsInfo: string): string`

* 函数返回包含日期和智能体信息的完整提示词字符串

* `context-builder.ts` 中调用该函数时传入动态参数

### Requirement: context-builder.ts 传入动态信息

**原有方式**: `buildAgentContext` 直接使用 `BASE_SYSTEM_PROMPT` 常量。

**修改后**:

* 在调用 `getBaseSystemPrompt` 时，传入当前日期和智能体列表信息

* 智能体信息从 `allAgents` 参数中提取（名称 + personaPrompt 的前 50 字摘要）

## REMOVED Requirements

无
