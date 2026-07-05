import type { ApiConfig } from '../types';

interface StreamCallbacks {
  onToken: (token: string) => void;
  onReasoningToken?: (token: string) => void; // 思考内容 token
  onReasoningComplete?: () => void; // 思考阶段结束、正文阶段开始
  onComplete: (fullContent: string) => void;
  onError: (error: Error) => void;
  // 日志记录钩子
  onToolCallStart?: (id: string, name: string, args: Record<string, unknown>) => void;
  onToolCallResult?: (id: string, name: string, result: string) => void;
}

/** 流式响应中累积的 tool_call 片段 */
interface ToolCallDelta {
  id?: string;
  type?: string;
  function: {
    name?: string;
    arguments: string;
  };
}

const DSML_START = '<｜｜DSML｜｜tool_calls>';
const DSML_END = '</｜｜DSML｜｜tool_calls>';
const MAX_TOOL_ROUNDS = 30;

/**
 * 执行一次流式对话请求，支持工具调用。
 *
 * 当模型以 DSML 文本或标准 tool_calls 形式请求工具时，会自动执行工具并将结果
 * 重新送入对话，最终流式输出模型的文字回复。支持多轮工具调用，但有深度上限。
 */
export async function streamChatCompletion(
  apiConfig: ApiConfig,
  messages: Array<Record<string, unknown>>,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>,
  executeTool?: (name: string, args: Record<string, unknown>) => Promise<string>,
  depth = 0,
): Promise<void> {
  // 构建请求
  const baseUrl = apiConfig.endpoint.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const requestBody: Record<string, unknown> = {
    model: apiConfig.model,
    messages,
    stream: true,
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
  }

  // 发送请求
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal,
    });
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    return;
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const body = await response.text();
      if (body) detail += ` — ${body}`;
    } catch {
      // ignore
    }
    callbacks.onError(new Error(detail));
    return;
  }

  // 读取流式响应
  const { fullContent, toolCalls, rawDsmlBlocks } = await readStream(
    response,
    callbacks,
  );

  // 注意: reasoningContent 已通过 onReasoningToken 回调逐 token 传递

  // 如果没有 tool_calls，直接返回累积的内容
  if (toolCalls.length === 0) {
    callbacks.onComplete(fullContent);
    return;
  }

  // --- 处理 tool_calls ---
  if (!executeTool) {
    callbacks.onComplete(
      fullContent || '模型请求使用工具，但未提供工具执行器。',
    );
    return;
  }

  if (depth >= MAX_TOOL_ROUNDS) {
    callbacks.onComplete(
      fullContent || '工具调用轮次已达上限，无法继续调用工具。',
    );
    return;
  }

  // 1. 将 assistant 的 tool_calls 消息追加到对话。
  //    为了让基于 DSML 文本的模型能识别“已经输出过工具调用”，把原始 DSML
  //    块保留在 content 中；同时保留标准 tool_calls 字段供标准模型使用。
  const rawDsml = rawDsmlBlocks.join('\n');
  const assistantMsg: Record<string, unknown> = {
    role: 'assistant',
    content: rawDsml || null,
    tool_calls: toolCalls.map((tc) => ({
      id: tc.id,
      type: tc.type || 'function',
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    })),
  };
  const updatedMessages = [...messages, assistantMsg];

  // 2. 执行每个工具并追加结果
  for (const tc of toolCalls) {
    const toolId = tc.id || '';
    const funcName = tc.function.name || '';
    let result: string;

    try {
      const args = tc.function.arguments
        ? JSON.parse(tc.function.arguments)
        : {};
      callbacks.onToolCallStart?.(toolId, funcName, args);
      result = await executeTool(funcName, args);
      callbacks.onToolCallResult?.(toolId, funcName, result);
    } catch (err) {
      result = `工具执行失败: ${err instanceof Error ? err.message : String(err)}`;
      callbacks.onToolCallResult?.(toolId, funcName, result);
    }

    updatedMessages.push({
      role: 'tool',
      tool_call_id: toolId,
      content: result,
    });
  }

  // 3. 提示模型基于工具结果给出最终正文，不要再输出工具调用标签
  updatedMessages.push({
    role: 'system',
    content:
      '工具调用已完成，结果已返回。请基于上述工具结果直接给出你的最终回复，使用 Markdown 格式，不要再输出任何工具调用标签。',
  });

  // 4. 重新请求模型获取后续回复（仍保留 tools/executeTool，允许模型继续调用工具）
  await streamChatCompletion(
    apiConfig,
    updatedMessages,
    callbacks,
    signal,
    tools,
    executeTool,
    depth + 1,
  );
}

interface ReadStreamResult {
  fullContent: string;
  toolCalls: ToolCallDelta[];
  reasoningContent: string;
  rawDsmlBlocks: string[];
}

/**
 * 读取 SSE 流，提取文字内容、思考内容和 tool_calls。
 *
 * 对 DSML 格式的工具调用做特殊处理：
 * - 检测到完整 DSML 块时，将其解析为标准 tool_calls，同时保留原始 DSML 文本；
 * - DSML 块本身不会作为正文 token 输出；
 * - 位于 DSML 块前后的普通文本仍会被正常输出；
 * - 跨 SSE 数据块被切分的 DSML 标记也能被正确拼接。
 */
async function readStream(
  response: Response,
  callbacks: StreamCallbacks,
): Promise<ReadStreamResult> {
  const body = response.body;
  if (!body) {
    return {
      fullContent: '',
      toolCalls: [],
      reasoningContent: '',
      rawDsmlBlocks: [],
    };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let reasoningContent = '';
  let buffer = '';

  // 按 index 收集标准 OpenAI 格式的 tool_call 片段
  const toolCallMap = new Map<number, ToolCallDelta>();

  // DSML 处理状态
  const rawDsmlBlocks: string[] = [];
  let dsmlBuffer = '';
  let normalBuffer = '';
  let inDsmlMode = false;
  let dsmlToolCallIndex = 0;

  // 思考/正文阶段跟踪
  let hasReceivedReasoning = false;
  let reasoningEnded = false;

  function emitNormal(text: string) {
    if (!text) return;
    fullContent += text;
    callbacks.onToken(text);
  }

  // 计算 text 的末尾有多少字符可能构成 DSML_START 的前缀
  function findPartialStartLength(text: string): number {
    const max = Math.min(text.length, DSML_START.length - 1);
    for (let i = max; i > 0; i--) {
      if (DSML_START.startsWith(text.slice(-i))) return i;
    }
    return 0;
  }

  function processNormalBuffer() {
    const startIndex = normalBuffer.indexOf(DSML_START);
    if (startIndex !== -1) {
      // 发现完整 DSML 起始标记：输出标记前的正文，进入 DSML 模式
      emitNormal(normalBuffer.slice(0, startIndex));
      dsmlBuffer = normalBuffer.slice(startIndex);
      normalBuffer = '';
      inDsmlMode = true;
      processDsmlBuffer();
      return;
    }

    const holdLen = findPartialStartLength(normalBuffer);
    if (holdLen === 0) {
      emitNormal(normalBuffer);
      normalBuffer = '';
    } else if (holdLen < normalBuffer.length) {
      // 末尾存在可能的 DSML 起始前缀，先保留，其余安全内容可输出
      emitNormal(normalBuffer.slice(0, -holdLen));
      normalBuffer = normalBuffer.slice(-holdLen);
    }
    // holdLen === normalBuffer.length 时全部保留，等待下一个 chunk
  }

  function processDsmlBuffer() {
    const endIndex = dsmlBuffer.indexOf(DSML_END);
    if (endIndex === -1) return;

    const blockEnd = endIndex + DSML_END.length;
    const block = dsmlBuffer.slice(0, blockEnd);
    rawDsmlBlocks.push(block);

    const parsedToolCalls = parseDsmlToolCalls(block);
    if (parsedToolCalls) {
      for (const tc of parsedToolCalls) {
        toolCallMap.set(dsmlToolCallIndex++, tc);
      }
    }

    const afterText = dsmlBuffer.slice(blockEnd);
    dsmlBuffer = '';
    inDsmlMode = false;

    if (afterText) {
      normalBuffer = afterText;
      processNormalBuffer();
    }
  }

  function processDeltaContent(text: string) {
    if (inDsmlMode) {
      dsmlBuffer += text;
      processDsmlBuffer();
    } else {
      normalBuffer += text;
      processNormalBuffer();
    }
  }

  function processStandardToolCalls(
    deltas: Array<Record<string, unknown>>,
  ) {
    for (const tc of deltas) {
      const idx = tc.index as number;
      let entry = toolCallMap.get(idx);
      if (!entry) {
        entry = { function: { arguments: '' } };
        toolCallMap.set(idx, entry);
      }
      if (tc.id) entry.id = tc.id as string;
      if (tc.type) entry.type = tc.type as string;
      const func = tc.function as Record<string, unknown> | undefined;
      if (func?.name) {
        entry.function.name = func.name as string;
      }
      if (func?.arguments) {
        entry.function.arguments += func.arguments as string;
      }
    }
  }

  function handleSseLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return true; // 继续读取
    if (trimmed === 'data: [DONE]') return false; // 正常结束
    if (!trimmed.startsWith('data: ')) return true;

    const jsonStr = trimmed.slice(6);
    if (!jsonStr) return true;

    try {
      const parsed = JSON.parse(jsonStr);
      const choice = parsed.choices?.[0];
      if (!choice) return true;

      const delta = choice.delta;
      if (!delta) return true;

      if (delta.reasoning_content) {
        hasReceivedReasoning = true;
        const token = delta.reasoning_content as string;
        reasoningContent += token;
        callbacks.onReasoningToken?.(token);
      }

      if (delta.content) {
        if (hasReceivedReasoning && !reasoningEnded) {
          reasoningEnded = true;
          callbacks.onReasoningComplete?.();
        }
        processDeltaContent(delta.content as string);
      }

      if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
        processStandardToolCalls(delta.tool_calls as Array<Record<string, unknown>>);
      }
    } catch {
      // Skip malformed JSON
    }

    return true;
  }

  function finalizeBuffers() {
    if (inDsmlMode) {
      // 流结束时 DSML 仍未闭合：先尝试解析为工具调用，避免原始工具调用文本泄露到正文
      const parsedToolCalls = parseDsmlToolCalls(dsmlBuffer);
      if (parsedToolCalls) {
        for (const tc of parsedToolCalls) {
          toolCallMap.set(dsmlToolCallIndex++, tc);
        }
      } else {
        // 解析失败才作为普通正文输出，避免内容丢失
        emitNormal(dsmlBuffer);
      }
      dsmlBuffer = '';
      inDsmlMode = false;
    }
    if (normalBuffer) {
      emitNormal(normalBuffer);
      normalBuffer = '';
    }
    // 流结束时若已收到 reasoning 但未触发完成回调，兜底触发一次
    if (hasReceivedReasoning && !reasoningEnded) {
      reasoningEnded = true;
      callbacks.onReasoningComplete?.();
    }
  }

  function buildResult(): ReadStreamResult {
    return {
      fullContent,
      toolCalls: collectToolCalls(toolCallMap),
      reasoningContent,
      rawDsmlBlocks,
    };
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const shouldContinue = handleSseLine(line);
        if (!shouldContinue) {
          finalizeBuffers();
          return buildResult();
        }
      }
    }

    // 处理 buffer 余量
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed === 'data: [DONE]') {
        finalizeBuffers();
        return buildResult();
      }
      if (trimmed.startsWith('data: ')) {
        handleSseLine(trimmed);
      }
    }

    finalizeBuffers();
    return buildResult();
  } catch (err) {
    finalizeBuffers();
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    return buildResult();
  }
}

/** 将 Map 转为有序数组 */
function collectToolCalls(map: Map<number, ToolCallDelta>): ToolCallDelta[] {
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([, v]) => v);
}

/**
 * 解析 DSML 格式的工具调用块。
 * 某些模型会以文本形式输出类似下面的内容，需要解析为标准的 tool_calls：
 * <｜｜DSML｜｜tool_calls>
 *   <｜｜DSML｜｜invoke name="web_search">
 *     <｜｜DSML｜｜parameter name="query" string="true">关键词</｜｜DSML｜｜parameter>
 *   </｜｜DSML｜｜invoke>
 * </｜｜DSML｜｜tool_calls>
 */
function parseDsmlToolCalls(text: string): ToolCallDelta[] | null {
  const blockMatch = text.match(
    /<｜｜DSML｜｜tool_calls>([\s\S]*?)<\/｜｜DSML｜｜tool_calls>/,
  );
  if (!blockMatch) return null;

  const inner = blockMatch[1];
  const toolCalls: ToolCallDelta[] = [];

  const invokeRegex =
    /<｜｜DSML｜｜invoke name="([^"]+)">([\s\S]*?)<\/｜｜DSML｜｜invoke>/g;
  let invokeMatch: RegExpExecArray | null;

  while ((invokeMatch = invokeRegex.exec(inner)) !== null) {
    const name = invokeMatch[1];
    const paramBlock = invokeMatch[2];
    const params: Record<string, unknown> = {};

    const paramRegex =
      /<｜｜DSML｜｜parameter name="([^"]+)"[^>]*>([\s\S]*?)<\/｜｜DSML｜｜parameter>/g;
    let paramMatch: RegExpExecArray | null;

    while ((paramMatch = paramRegex.exec(paramBlock)) !== null) {
      const paramName = paramMatch[1];
      const paramValue = paramMatch[2];
      try {
        params[paramName] = JSON.parse(paramValue);
      } catch {
        params[paramName] = paramValue;
      }
    }

    toolCalls.push({
      id: crypto.randomUUID(),
      type: 'function',
      function: {
        name,
        arguments: JSON.stringify(params),
      },
    });
  }

  return toolCalls.length > 0 ? toolCalls : null;
}
