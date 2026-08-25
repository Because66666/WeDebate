/**
 * ask_user 工具：向用户提问以获取澄清、偏好或补充信息。
 *
 * 采用工厂函数按消息绑定——chat-service 在每个智能体发言开始时用当前
 * 消息 id 重新注册本工具，卡片因此能嵌入到正确的 Agent 消息中。
 * 工具执行期间挂起等待用户在 AskUserCard 上作答（见 services/ask-user.ts），
 * 用户提交后答案以可读文本作为工具结果返回给模型。
 *
 * 系统自动在末尾追加一个 id="__supplement__" 的自由回答题
 * 「补充说明（可选）」，用户可跳过（AskUserCard 对该题放行提交）。
 */
import type { AskUserAnswer, AskUserQuestion, Tool } from '../../types';
import { askUserService } from '../ask-user';

/** 选项按钮组中追加的「其他」选项文案（与 AskUserCard 约定一致） */
const OTHER_OPTION_LABEL = '其他';

/** 补充说明题的固定 id（AskUserCard 据此允许跳过） */
const SUPPLEMENT_QUESTION_ID = '__supplement__';

/** 将模型给出的原始 questions 参数规范化为 AskUserQuestion[]（最多 3 题，与工具描述一致） */
function parseQuestions(raw: unknown): AskUserQuestion[] {
  if (!Array.isArray(raw)) return [];
  const questions: AskUserQuestion[] = [];
  for (const item of raw.slice(0, 3)) {
    if (typeof item !== 'object' || item === null) continue;
    const obj = item as Record<string, unknown>;
    const question = String(obj.question ?? '').trim();
    if (!question) continue;
    const type =
      obj.type === 'multiple' || obj.type === 'single' || obj.type === 'free'
        ? obj.type
        : 'free';
    const options =
      type !== 'free' && Array.isArray(obj.options)
        ? obj.options.map((o) => String(o)).filter((o) => o.trim())
        : undefined;
    if (type !== 'free' && (!options || options.length < 2)) {
      // 选择题选项不足时降级为自由回答，避免渲染出无法作答的卡片
      questions.push({ id: crypto.randomUUID(), question, type: 'free' });
      continue;
    }
    questions.push({
      id: crypto.randomUUID(),
      question,
      type,
      ...(options ? { options } : {}),
    });
  }
  return questions;
}

/** 将用户答案格式化为可读文本，作为工具结果返回给模型 */
function formatAnswers(
  questions: AskUserQuestion[],
  answers: Record<string, AskUserAnswer>,
): string {
  const lines: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const a = answers[q.id];
    // 补充说明题未填写时跳过
    if (q.id === SUPPLEMENT_QUESTION_ID && !a?.text?.trim()) continue;
    if (!a) {
      lines.push(`${i + 1}. ${q.question}：未作答`);
      continue;
    }
    if (q.type === 'free') {
      lines.push(`${i + 1}. ${q.question}：${a.text?.trim() || '未作答'}`);
      continue;
    }
    const choices = Array.isArray(a.choice) ? a.choice : a.choice ? [a.choice] : [];
    const parts = [...choices];
    if (choices.includes(OTHER_OPTION_LABEL) && a.other_text?.trim()) {
      parts[parts.indexOf(OTHER_OPTION_LABEL)] = `${OTHER_OPTION_LABEL}（${a.other_text.trim()}）`;
    }
    lines.push(`${i + 1}. ${q.question}：${parts.length > 0 ? parts.join('、') : '未作答'}`);
  }
  return `用户的回答如下：\n${lines.join('\n')}`;
}

/** 创建绑定到指定消息的 ask_user 工具实例 */
export function createAskUserTool(messageId: string): Tool {
  return {
    name: 'ask_user',
    description:
      '向用户提问以获取澄清、偏好或补充信息。当讨论议题存在歧义、需要在多个方向间做取舍、或缺少关键背景信息时调用；问题要精简（一次不超过 3 个），选项要明确互斥。用户的回答会作为工具结果返回，随后你再继续发言。不要每次发言都使用该工具。',
    parameters: {
      questions: {
        type: 'array',
        description: '要向用户确认的问题列表（1~3 个）',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string', description: '问题文本' },
            type: {
              type: 'string',
              enum: ['single', 'multiple', 'free'],
              description: '题型：single=单选，multiple=多选，free=自由回答',
            },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: '候选选项（single/multiple 必填且不少于 2 个，free 不需要）',
            },
          },
          required: ['question', 'type'],
        },
      },
    },
    execute: async (args: Record<string, unknown>) => {
      const questions = parseQuestions(args.questions);
      if (questions.length === 0) {
        return '提问格式无效：请通过 questions 参数提供至少一个包含 question 字段的问题对象。';
      }
      // 末尾固定追加「补充说明（可选）」自由题
      questions.push({
        id: SUPPLEMENT_QUESTION_ID,
        question: '补充说明（可选）',
        type: 'free',
      });

      const answers = await askUserService.request(messageId, questions);
      if (!answers) {
        return '用户未作答（本次询问已被中断或被新的用户指令取代），请基于已有上下文和后续用户消息继续。';
      }
      return formatAnswers(questions, answers);
    },
  };
}
