import type { AgentConfig, Message } from '../types';
import { getBaseSystemPrompt } from '../prompts/base';

export function buildAgentContext(
  agent: AgentConfig,
  messages: Message[],
  allAgents: AgentConfig[]
): Array<{ role: string; content: string }> {
  const result: Array<{ role: string; content: string }> = [];

  // 生成动态 Base 提示词
  const currentDate = new Date().toISOString().slice(0, 10);
  const agentsInfo = allAgents
    .map((a) => {
      const roleSummary = a.personaPrompt
        ? a.personaPrompt.replace(/[\n\r]+/g, ' ').slice(0, 50)
        : '无描述';
      return `- ${a.name}: ${roleSummary}`;
    })
    .join('\n');
  const basePrompt = getBaseSystemPrompt(currentDate, agentsInfo);

  // System prompt = base prompt + current agent's persona prompt
  const systemPrompt = `${basePrompt}\n\n${agent.personaPrompt}`;
  result.push({ role: 'system', content: systemPrompt });

  // Build a lookup map for agent names
  const agentNameMap = new Map<string, string>();
  for (const a of allAgents) {
    agentNameMap.set(a.id, a.name);
  }

  // Inject messages chronologically
  for (const msg of messages) {
    if (msg.role === 'user') {
      result.push({ role: 'user', content: `用户:${msg.content}` });
    } else if (msg.role === 'agent' && msg.agentId) {
      const agentName = agentNameMap.get(msg.agentId) ?? msg.agentId;
      result.push({ role: 'user', content: `${agentName}:${msg.content}` });
    }
  }

  return result;
}
