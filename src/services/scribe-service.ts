import type { ApiConfig } from '../types';
import { SCRIBE_PROMPT, SCRIBE_SUMMARY_PROMPT } from '../prompts/agents/scribe';

export async function generateTitle(
  apiConfig: ApiConfig,
  userMessage: string,
  agentResponse: string,
): Promise<string> {
  const { apiKey, endpoint, model } = apiConfig;
  const baseUrl = endpoint.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const messages = [
    { role: 'system', content: SCRIBE_PROMPT },
    { role: 'user', content: `用户消息：${userMessage}\n\n智能体回复：${agentResponse}` },
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const body = await response.text();
      if (body) detail += ` — ${body}`;
    } catch {
      // ignore body read failure
    }
    throw new Error(detail);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  return content.trim().slice(0, 50);
}

export async function summarizeAgentSpeech(
  apiConfig: ApiConfig,
  agentName: string,
  agentContent: string,
): Promise<string> {
  const { apiKey, endpoint, model } = apiConfig;
  const baseUrl = endpoint.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const messages = [
    { role: 'system', content: SCRIBE_SUMMARY_PROMPT },
    { role: 'user', content: `顾问「${agentName}」的发言：\n\n${agentContent}` },
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const body = await response.text();
      if (body) detail += ` — ${body}`;
    } catch {
      // ignore body read failure
    }
    throw new Error(detail);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  return content.trim();
}
