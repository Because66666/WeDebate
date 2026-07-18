import type { AgentConfig } from '../../types';
import { FACT_CHECKER_PROMPT } from './fact-checker';
import { LOGIC_EXPERT_PROMPT } from './logic-expert';
import { POSITION_ANALYST_PROMPT } from './position-analyst';
import { ETHICIST_PROMPT } from './ethicist';
import { PSYCHOLOGIST_PROMPT } from './psychologist';
import { STRATEGIST_PROMPT } from './strategist';
import { CATALYST_PROMPT } from './catalyst';

export interface AgentPreset {
  id: string;
  name: string;
  color: string;
  personaPrompt: string;
}

// 角色卡顺序：严格按照文档定义的发言顺序排列
export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: 'fact-checker',
    name: '事实与信息核查员',
    color: '#F59E0B',
    personaPrompt: FACT_CHECKER_PROMPT,
  },
  {
    id: 'logic-expert',
    name: '逻辑与批判性思维专家',
    color: '#8B5CF6',
    personaPrompt: LOGIC_EXPERT_PROMPT,
  },
  {
    id: 'position-analyst',
    name: '立场分析师',
    color: '#06B6D4',
    personaPrompt: POSITION_ANALYST_PROMPT,
  },
  {
    id: 'ethicist',
    name: '伦理与价值哲学家',
    color: '#EC4899',
    personaPrompt: ETHICIST_PROMPT,
  },
  {
    id: 'psychologist',
    name: '心理与行为分析师',
    color: '#14B8A6',
    personaPrompt: PSYCHOLOGIST_PROMPT,
  },
  {
    id: 'strategist',
    name: '系统与长远影响战略家',
    color: '#F97316',
    personaPrompt: STRATEGIST_PROMPT,
  },
  {
    id: 'catalyst',
    name: '创新与横向思维催化师',
    color: '#6366F1',
    personaPrompt: CATALYST_PROMPT,
  },
];

export function createDefaultAgents(): AgentConfig[] {
  return AGENT_PRESETS.map((preset) => ({
    id: preset.id,
    name: preset.name,
    color: preset.color,
    basePrompt: 'base',
    personaPrompt: preset.personaPrompt,
    enabled: true,
  }));
}
